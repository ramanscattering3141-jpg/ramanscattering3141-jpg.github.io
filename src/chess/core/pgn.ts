// PGN reader and writer with nested variations, comments and NAGs.
import { GameTree, START_FEN, type MoveNode } from './tree';
import { isMoveAssessment, parseAnnotationRun, NAG_SYMBOLS } from './nag';

export interface PgnError { message: string; offset: number }
export interface ParsedGame { tree: GameTree; errors: PgnError[]; result: string }

const SEVEN_TAGS = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

type Tok =
  | { t: 'tag'; name: string; value: string; at: number }
  | { t: 'comment'; text: string; at: number }
  | { t: 'open'; at: number }
  | { t: 'close'; at: number }
  | { t: 'nag'; n: number; at: number }
  | { t: 'num'; at: number }
  | { t: 'result'; v: string; at: number }
  | { t: 'san'; v: string; nags: number[]; at: number };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\uFEFF' || /\s/.test(c)) { i++; continue; }
    if (c === '%' && (i === 0 || src[i - 1] === '\n')) { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '[') {
      const m = /^\[\s*([A-Za-z0-9_]+)\s+"((?:[^"\\]|\\.)*)"\s*\]/.exec(src.slice(i, i + 4096));
      if (m) { out.push({ t: 'tag', name: m[1], value: m[2].replace(/\\(["\\])/g, '$1'), at: i }); i += m[0].length; continue; }
      i++; continue;
    }
    if (c === '{') {
      const end = src.indexOf('}', i + 1);
      const stop = end < 0 ? n : end;
      out.push({ t: 'comment', text: src.slice(i + 1, stop).replace(/\s+/g, ' ').trim(), at: i });
      i = stop + 1; continue;
    }
    if (c === ';') {
      const end = src.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      out.push({ t: 'comment', text: src.slice(i + 1, stop).trim(), at: i });
      i = stop; continue;
    }
    if (c === '(') { out.push({ t: 'open', at: i }); i++; continue; }
    if (c === ')') { out.push({ t: 'close', at: i }); i++; continue; }
    if (c === '$') {
      const m = /^\$(\d+)/.exec(src.slice(i, i + 5));
      if (m) { out.push({ t: 'nag', n: Number(m[1]), at: i }); i += m[0].length; continue; }
      i++; continue;
    }
    // A word runs to whitespace or a structural character.
    let j = i;
    while (j < n && !/[\s{}()\[\];$]/.test(src[j])) j++;
    let word = src.slice(i, j);
    const at = i;
    i = j;
    if (RESULTS.has(word) || word === '½-½') { out.push({ t: 'result', v: word === '½-½' ? '1/2-1/2' : word, at }); continue; }
    const num = /^(\d+)(\.+|…)?(.*)$/.exec(word);
    if (num && (num[2] || num[3] === '')) {
      out.push({ t: 'num', at });
      word = num[3];
      if (!word) continue;
    }
    word = word.replace(/^(\.+|…)/, '');
    if (!word) continue;
    // Strip trailing annotation glyphs written directly after the move ("Nf3!?", "e4±").
    const m = /^(.*?[a-h1-8QRBNKO#+])([!?±∓⩲⩱∞=□+\-\/]*)$/.exec(word);
    let san = word;
    let nags: number[] = [];
    if (m && m[2]) {
      // "+" after a SAN is check, not an annotation, unless followed by more symbols.
      const tail = m[2];
      const parsed = parseAnnotationRun(tail);
      if (parsed && !/^\+$/.test(tail) && !/^=[QRBN]/.test(tail)) { san = m[1]; nags = parsed; }
    }
    out.push({ t: 'san', v: san, nags, at });
  }
  return out;
}

/** Split a PGN file into games and parse each one. Illegal moves stop that line and are reported. */
export function parsePgn(src: string): ParsedGame[] {
  const toks = tokenize(src);
  const games: ParsedGame[] = [];
  let k = 0;
  while (k < toks.length) {
    const headers: Record<string, string> = {};
    while (k < toks.length && toks[k].t === 'tag') {
      const tk = toks[k] as Extract<Tok, { t: 'tag' }>;
      headers[tk.name] = tk.value;
      k++;
    }
    const startFen = headers.FEN && headers.SetUp !== '0' ? headers.FEN : START_FEN;
    const errors: PgnError[] = [];
    let tree: GameTree;
    try { tree = new GameTree(startFen); } catch {
      errors.push({ message: `Invalid FEN tag: ${headers.FEN}`, offset: toks[k]?.at ?? 0 });
      tree = new GameTree();
    }
    Object.assign(tree.headers, headers);
    let result = headers.Result ?? '*';
    // Stack of [current node, node before the last move] for variation handling.
    let cur: MoveNode = tree.root;
    let prev: MoveNode | null = null;
    const stack: Array<{ cur: MoveNode; prev: MoveNode | null; dead: boolean }> = [];
    let dead = false; // after an illegal move, skip until the line ends
    let pendingStart: string | undefined;
    let sawMove = false;
    while (k < toks.length) {
      const tk = toks[k];
      if (tk.t === 'tag') break; // next game
      k++;
      if (tk.t === 'result') { result = tk.v; if (stack.length === 0) break; continue; }
      if (dead && tk.t !== 'open' && tk.t !== 'close') continue;
      switch (tk.t) {
        case 'comment':
          if (!sawMove && cur === tree.root && stack.length === 0) tree.root.comment = join(tree.root.comment, tk.text);
          else if (pendingStart !== undefined) pendingStart = join(pendingStart || undefined, tk.text);
          else cur.comment = join(cur.comment, tk.text);
          break;
        case 'open':
          stack.push({ cur, prev, dead });
          if (!dead) {
            if (!prev) { errors.push({ message: 'Variation with no move to replace', offset: tk.at }); dead = true; }
            else { cur = prev; prev = null; pendingStart = ''; }
          }
          break;
        case 'close': {
          const s = stack.pop();
          if (!s) { errors.push({ message: 'Unmatched )', offset: tk.at }); break; }
          ({ cur, prev, dead } = s);
          pendingStart = undefined;
          break;
        }
        case 'nag': if (cur !== tree.root) cur.nags.push(tk.n); break;
        case 'num': break;
        case 'san': {
          if (tk.v === '--' || tk.v === 'Z0') { errors.push({ message: 'Null moves are not supported', offset: tk.at }); dead = true; break; }
          const san = normalizeCastling(tk.v);
          try {
            const node = tree.addMove(cur, san);
            if (pendingStart) node.startComment = join(node.startComment, pendingStart);
            pendingStart = undefined;
            for (const g of tk.nags) if (!node.nags.includes(g)) node.nags.push(g);
            prev = cur; cur = node; sawMove = true;
          } catch {
            errors.push({ message: `Illegal or unreadable move "${tk.v}"`, offset: tk.at });
            dead = true;
          }
          break;
        }
      }
    }
    if (stack.length) errors.push({ message: 'Unclosed variation', offset: src.length });
    if (!tree.headers.Result) tree.headers.Result = result;
    if (sawMove || Object.keys(headers).length) games.push({ tree, errors, result });
  }
  return games;
}

function join(a: string | undefined, b: string): string { return a ? `${a} ${b}` : b; }

export function normalizeCastling(san: string): string {
  return san.replace(/^0-0-0/, 'O-O-O').replace(/^0-0/, 'O-O');
}

export interface WriteOptions { comments?: boolean; variations?: boolean; nags?: boolean; maxLine?: number; symbols?: boolean }

/** Write one game. Headers follow the Seven Tag Roster order, then the rest alphabetically. */
export function writePgn(tree: GameTree, opts: WriteOptions = {}): string {
  const o = { comments: true, variations: true, nags: true, maxLine: 80, symbols: false, ...opts };
  const h = { ...tree.headers };
  for (const t of SEVEN_TAGS) if (!(t in h)) h[t] = t === 'Result' ? '*' : t === 'Date' ? '????.??.??' : '?';
  if (tree.startFen !== START_FEN) { h.SetUp = '1'; h.FEN = tree.startFen; } else { delete h.SetUp; delete h.FEN; }
  const lines: string[] = [];
  const keys = [...SEVEN_TAGS, ...Object.keys(h).filter((k) => !SEVEN_TAGS.includes(k)).sort()];
  for (const k of keys) lines.push(`[${k} "${String(h[k]).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`);
  const words: string[] = [];
  if (o.comments && tree.root.comment) words.push(`{${clean(tree.root.comment)}}`);
  writeLine(tree.root, words, o, true);
  words.push(h.Result);
  const body: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    let w = words[i];
    while (w === '(' && i + 1 < words.length) w += words[++i];
    if (line && line.length + 1 + w.length > o.maxLine) { body.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) body.push(line);
  return `${lines.join('\n')}\n\n${body.join('\n')}\n`;
}

function clean(c: string): string { return c.replace(/[{}]/g, '').trim(); }

function writeLine(from: MoveNode, out: string[], o: Required<WriteOptions>, forceNumber: boolean): void {
  let node = from;
  let needNum = forceNumber;
  while (node.children.length) {
    const main = node.children[0];
    writeMove(main, out, o, needNum);
    needNum = false;
    if (o.comments && main.comment) needNum = true;
    if (o.variations) {
      for (const alt of node.children.slice(1)) {
        out.push('(');
        writeMove(alt, out, o, true);
        const altHasComment = o.comments && !!alt.comment;
        writeLine(alt, out, o, altHasComment);
        out[out.length - 1] += ')';
        needNum = true;
      }
    }
    node = main;
  }
}

function writeMove(n: MoveNode, out: string[], o: Required<WriteOptions>, forceNumber: boolean): void {
  if (o.comments && n.startComment) out.push(`{${clean(n.startComment)}}`);
  const white = n.ply % 2 === 1;
  const num = Math.floor((n.ply - 1) / 2) + 1;
  let w = white ? `${num}. ` : forceNumber || (o.comments && n.startComment) ? `${num}... ` : '';
  w += n.san;
  const rest: string[] = [];
  if (o.nags) for (const g of n.nags) {
    if (o.symbols && NAG_SYMBOLS[g] && isMoveAssessment(g)) w += NAG_SYMBOLS[g];
    else rest.push(`$${g}`);
  }
  // Number and move are one word so line wrapping never separates them.
  out.push(w);
  out.push(...rest);
  if (o.comments && n.comment) out.push(`{${clean(n.comment)}}`);
}

/** Write several games separated by blank lines. */
export function writePgnDatabase(trees: GameTree[], opts?: WriteOptions): string {
  return trees.map((t) => writePgn(t, opts)).join('\n');
}

/**
 * Round-trip check used before every export: the written PGN must parse back without errors and
 * produce the same moves in every variation.
 */
export function validatePgn(text: string): { ok: boolean; games: number; errors: string[] } {
  const games = parsePgn(text);
  const errors = games.flatMap((g, i) => g.errors.map((e) => `Game ${i + 1}: ${e.message}`));
  return { ok: errors.length === 0 && games.length > 0, games: games.length, errors };
}

/** Moves of the main line as a SAN list (useful for search and tests). */
export function mainlineSans(tree: GameTree): string[] { return tree.mainline().map((n) => n.san); }
