// Tokens → games. Each printed move is checked against the position it is played from;
// variations are attached to the position they branch from; anything that cannot be placed or
// read is reported as an issue with its page location. No move is ever made up.
import { Chess, type Move } from 'chess.js';
import { GameTree, START_FEN, type MoveNode } from './tree';
import { resolveMove, type NotationLanguage, type Resolution } from './san';
import { boardFromFen, placementKey } from './fen';
import type { DiagramMarker, SourceRef, Token } from './notation';

export type IssueKind = 'illegal' | 'ambiguous' | 'unplaced' | 'repaired' | 'number';

export interface Issue {
  kind: IssueKind;
  message: string;
  raw: string;
  ref: SourceRef;
  /** Position the move was tried in (for the correction UI). */
  fen?: string;
  /** Path key of the node the move was tried from. */
  at?: string;
  candidates?: string[];
}

export interface Anchor { path: string; ref: SourceRef }

export interface ExtractedGame {
  tree: GameTree;
  issues: Issue[];
  anchors: Anchor[];
  /** Diagram id → path key of the node whose position it shows. */
  diagrams: Record<string, string>;
  firstRef: SourceRef;
  lastRef: SourceRef;
  confidence: number;
  /** "game" (has a header or starts from move 1) or "fragment" (starts from a diagram). */
  type: 'game' | 'fragment';
}

export interface ReconstructOptions {
  language?: NotationLanguage;
  style?: 'algebraic' | 'descriptive' | 'auto';
  /** Book prints main-line moves in bold and analysis in regular type. */
  boldMain?: boolean;
  /** Glyph → piece map learned so far for this book (updated in place). */
  glyphs?: Map<string, string>;
}

interface Ctx {
  game: Draft | null;
  cursor: MoveNode | null;
  parens: Array<MoveNode | null>;
  text: string[];
  headers: Record<string, string> | null;
  diagram: DiagramMarker | null;
  sinceGameText: number;
}

interface Draft extends ExtractedGame { confSum: number; confN: number; ended: boolean }

function newDraft(tree: GameTree, ref: SourceRef, type: 'game' | 'fragment'): Draft {
  return { tree, issues: [], anchors: [], diagrams: {}, firstRef: ref, lastRef: ref, confidence: 1, type, confSum: 0, confN: 0, ended: false };
}

export function reconstruct(tokens: Token[], opts: ReconstructOptions = {}): { games: ExtractedGame[]; orphans: Issue[] } {
  const games: Draft[] = [];
  const orphans: Issue[] = [];
  const glyphs = opts.glyphs ?? new Map<string, string>();
  const glyphVotes = new Map<string, Map<string, number>>();
  const ctx: Ctx = { game: null, cursor: null, parens: [], text: [], headers: null, diagram: null, sinceGameText: 0 };

  const finish = () => {
    if (ctx.game) flushText(ctx);
    ctx.game = null; ctx.cursor = null; ctx.parens = [];
  };

  let i = 0;
  let inRun = false;
  /** Ply (of the position before the move) announced by the last move number in this run. */
  let expectBefore: number | null = null;
  let mainRun = false;

  const resolveAt = (node: MoveNode, tok: Extract<Token, { t: 'move' }>, idx: number): Resolution => {
    const chess = new Chess(node.fen);
    const r = resolveMove(tok.raw, chess, { language: opts.language, style: opts.style, glyphs, fuzzy: tok.ocr || tok.conf < 1 });
    if (r.kind === 'ambiguous') return disambiguate(node, r.candidates, idx) ?? r;
    return r;
  };

  /** Try each candidate and keep the only one after which the next printed moves stay legal. */
  const disambiguate = (node: MoveNode, cands: Move[], idx: number): Resolution | null => {
    const upcoming: string[] = [];
    for (let j = idx + 1; j < tokens.length && upcoming.length < 6; j++) {
      const t = tokens[j];
      if (t.t === 'move') upcoming.push(t.raw);
      else if (t.t === 'num' || t.t === 'nag' || t.t === 'ellipsis') continue;
      else break;
    }
    // Descriptive books write "P×P; B×P" for a recapture: when several captures fit, the one on
    // the square of the previous capture is meant. Flagged, so the user can check it.
    const recapture = (list: Move[]) => {
      if (!node.parent || !list.every((m) => m.captured)) return null;
      const prevTo = node.uci.slice(2, 4);
      const prevWasCapture = new Chess(node.parent.fen).get(prevTo as never) !== undefined;
      const hits = list.filter((m) => m.to === prevTo);
      return prevWasCapture && hits.length === 1 ? hits[0] : null;
    };
    if (!upcoming.length) {
      const r = recapture(cands);
      return r ? { kind: 'ok', move: r, conf: 0.7, flag: `read as the recapture ${r.san} (also possible: ${cands.filter((c) => c !== r).map((c) => c.san).join(', ')})` } : null;
    }
    const score = (m: Move) => {
      const c = new Chess(node.fen);
      c.move(m.san);
      let n = 0;
      for (const raw of upcoming) {
        const r = resolveMove(raw, c, { language: opts.language, style: opts.style, glyphs });
        if (r.kind !== 'ok') break;
        c.move(r.move.san); n++;
      }
      return n;
    };
    const scored = cands.map((m) => ({ m, s: score(m) })).sort((a, b) => b.s - a.s);
    if (scored[0].s > 0 && scored[0].s > scored[1].s) return { kind: 'ok', move: scored[0].m, conf: 0.7, flag: `chosen from ${cands.map((c) => c.san).join('/')} because only it fits the following moves` };
    const top = scored.filter((x) => x.s === scored[0].s).map((x) => x.m);
    const r = recapture(top);
    if (r) return { kind: 'ok', move: r, conf: 0.7, flag: `read as the recapture ${r.san} (also possible: ${cands.filter((c) => c !== r).map((c) => c.san).join(', ')})` };
    return null;
  };

  /** Find where a run that starts with the move at token index `idx` belongs. */
  const findAnchor = (before: number | null, idx: number, tok: Extract<Token, { t: 'move' }>): { node: MoveNode; res: Extract<Resolution, { kind: 'ok' }> } | { fail: Resolution; node: MoveNode } | null => {
    const g = ctx.game;
    if (!g) return null;
    const seen = new Set<MoveNode>();
    const order: MoveNode[] = [];
    const push = (n: MoveNode | null | undefined) => { if (n && !seen.has(n) && (before === null || n.ply === before)) { seen.add(n); order.push(n); } };
    const mainEnd = g.tree.lineEnd(g.tree.root);
    const path = ctx.cursor ? [g.tree.root, ...g.tree.pathTo(ctx.cursor)].reverse() : [];
    const inParen = ctx.parens.length > 0;
    if (mainRun && opts.boldMain) { push(mainEnd); g.tree.mainline().reverse().forEach(push); push(g.tree.root); }
    else if (inParen) { path.forEach(push); }
    else { push(ctx.cursor); push(mainEnd); path.forEach(push); }
    if (!mainRun || !opts.boldMain) {
      [...g.tree.mainline()].reverse().forEach(push); push(g.tree.root);
      g.tree.all().sort((a, b) => b.id - a.id).forEach(push);
    }
    let firstFail: { fail: Resolution; node: MoveNode } | null = null;
    for (const n of order) {
      const r = resolveAt(n, tok, idx);
      if (r.kind === 'ok') return { node: n, res: r };
      if (!firstFail) firstFail = { fail: r, node: n };
      if (before === null) break; // without a move number only the current position is tried
    }
    return firstFail;
  };

  const startGame = (tree: GameTree, ref: SourceRef, type: 'game' | 'fragment') => {
    const prose = ctx.text.join(' ').trim();
    ctx.text = [];
    finish();
    const g = newDraft(tree, ref, type);
    if (ctx.headers) { Object.assign(tree.headers, ctx.headers); ctx.headers = null; }
    if (prose) tree.root.comment = prose.slice(-2000);
    games.push(g);
    ctx.game = g; ctx.cursor = tree.root; ctx.sinceGameText = 0;
    return g;
  };

  const play = (node: MoveNode, res: Extract<Resolution, { kind: 'ok' }>, tok: Extract<Token, { t: 'move' }>) => {
    const g = ctx.game!;
    flushText(ctx);
    const conf = Math.min(res.conf, tok.conf);
    const child = g.tree.addMove(node, res.move.san, { conf, raw: tok.raw, ...(res.flag ? { flag: res.flag } : {}) });
    if (opts.boldMain && tok.bold && node.children[0] !== child) {
      // A bold (main-game) move outranks analysis that was printed first.
      node.children.splice(node.children.indexOf(child), 1);
      node.children.unshift(child);
    }
    for (const n of tok.nags) if (!child.nags.includes(n)) child.nags.push(n);
    g.anchors.push({ path: g.tree.pathKey(child), ref: tok.ref });
    g.lastRef = tok.ref;
    g.confSum += conf; g.confN++;
    if (res.flag) g.issues.push({ kind: 'repaired', message: res.flag, raw: tok.raw, ref: tok.ref, fen: node.fen, at: g.tree.pathKey(node) });
    const glyph = /^piece symbol "(.+)" read as ([KQRBN])/.exec(res.flag ?? '');
    if (glyph) {
      const votes = glyphVotes.get(glyph[1]) ?? new Map<string, number>();
      votes.set(glyph[2], (votes.get(glyph[2]) ?? 0) + 1);
      glyphVotes.set(glyph[1], votes);
      // Three consistent readings teach the glyph for the rest of the book.
      const total = [...votes.values()].reduce((a, b) => a + b, 0);
      if (total >= 3 && votes.size === 1) glyphs.set(glyph[1], glyph[2]);
    }
    ctx.cursor = child;
    ctx.sinceGameText = 0;
  };

  const report = (iss: Issue) => { if (ctx.game) ctx.game.issues.push(iss); else orphans.push(iss); };

  for (; i < tokens.length; i++) {
    const tok = tokens[i];
    switch (tok.t) {
      case 'heading':
        finish(); ctx.text = []; ctx.headers = null; ctx.diagram = null; inRun = false;
        break;
      case 'header':
        finish();
        ctx.headers = { ...(ctx.headers ?? {}), ...tok.headers };
        ctx.diagram = null; inRun = false; ctx.text = [];
        break;
      case 'diagram': {
        inRun = false;
        ctx.diagram = tok.d;
        // Link the diagram to a node of the current game that shows the same position.
        if (ctx.game && tok.d.fen) {
          const key = placementKey(tok.d.fen);
          const hit = (ctx.cursor && placementKey(ctx.cursor.fen) === key ? ctx.cursor : null)
            ?? ctx.game.tree.all().find((n) => placementKey(n.fen) === key);
          if (hit) { ctx.game.diagrams[tok.d.id] = ctx.game.tree.pathKey(hit); ctx.diagram = null; }
        }
        break;
      }
      case 'text':
        inRun = false;
        ctx.text.push(tok.raw);
        ctx.sinceGameText += tok.raw.length + 1;
        if (!ctx.game && ctx.text.length > 400) ctx.text.splice(0, ctx.text.length - 300);
        break;
      case 'open':
        ctx.parens.push(ctx.cursor);
        ctx.text.push('(');
        break;
      case 'close':
        if (ctx.parens.length) { flushText(ctx, ')'); ctx.cursor = ctx.parens.pop() ?? ctx.cursor; } else ctx.text.push(')');
        inRun = false;
        break;
      case 'result':
        if (ctx.game && ctx.parens.length === 0 && inRun) {
          ctx.game.tree.headers.Result = tok.v;
          finish(); inRun = false;
        } else ctx.text.push(tok.raw);
        break;
      case 'ellipsis':
        if (inRun && expectBefore !== null && expectBefore % 2 === 0) expectBefore += 1;
        else if (!inRun) { inRun = true; expectBefore = ctx.cursor ? ctx.cursor.ply : null; }
        break;
      case 'nag':
        if (inRun && ctx.cursor && ctx.cursor.parent) { for (const n of tok.nags) if (!ctx.cursor.nags.includes(n)) ctx.cursor.nags.push(n); }
        else ctx.text.push(tok.raw);
        break;
      case 'num': {
        const next = tokens[i + 1];
        const black = tok.black || next?.t === 'ellipsis';
        if (!next || (next.t !== 'move' && next.t !== 'ellipsis')) { ctx.text.push(tok.raw); inRun = false; break; }
        expectBefore = (tok.n - 1) * 2 + (black ? 1 : 0);
        if (next.t === 'ellipsis') i++;
        inRun = true;
        mainRun = false;
        break;
      }
      case 'move': {
        // A line that opens with a move and goes straight on in words is prose ("P × P is
        // preferable…"), not the continuation of the moves on the line before.
        if (inRun && tok.bol && expectBefore === null && tokens[i + 1]?.t === 'text' && !/^[,.;:]+$/.test((tokens[i + 1] as { raw: string }).raw)) inRun = false;
        if (!inRun) { ctx.text.push(tok.raw); ctx.sinceGameText += tok.raw.length + 1; break; }
        mainRun = tok.bold;
        const before = expectBefore;
        expectBefore = null;
        // 1) Continue the current line when the number (if any) agrees.
        if (ctx.game && ctx.cursor && (before === null || before === ctx.cursor.ply) && !(opts.boldMain && tok.bold && !ctx.game.tree.isMainline(ctx.cursor))) {
          const r = resolveAt(ctx.cursor, tok, i);
          if (r.kind === 'ok') { play(ctx.cursor, r, tok); break; }
          if (before === null) { // continuation without a number: report and stop this run
            report(issueFrom(r, tok, ctx.cursor, ctx.game.tree));
            inRun = false; break;
          }
        }
        // 2) A move numbered 1 after a header, a finished game or a long stretch of prose starts a new game.
        const freshStart = before === 0 && (!ctx.game || ctx.headers !== null || ctx.sinceGameText > 400);
        if (freshStart) {
          const tree = new GameTree(START_FEN);
          const r = resolveAt(tree.root, tok, i);
          if (r.kind === 'ok') { startGame(tree, tok.ref, 'game'); play(tree.root, r, tok); break; }
        }
        // 3) Somewhere earlier in the current game (a variation, or the main line resuming).
        const a = findAnchor(before, i, tok);
        if (a && 'res' in a) { play(a.node, a.res, tok); break; }
        // 4) From the last diagram: the move number also tells us who is to move.
        if (ctx.diagram?.fen && before !== null) {
          const fen = diagramFen(ctx.diagram.fen, before);
          if (fen) {
            const tree = new GameTree(fen);
            const r = resolveAt(tree.root, tok, i);
            if (r.kind === 'ok') {
              const g = startGame(tree, { page: ctx.diagram.page, rect: ctx.diagram.rect }, 'fragment');
              g.diagrams[ctx.diagram.id] = '';
              ctx.diagram = null;
              play(tree.root, r, tok);
              break;
            }
          }
        }
        // 5) Move 1 from the starting position even without a header.
        if (before === 0 && !freshStart) {
          const tree = new GameTree(START_FEN);
          const r = resolveAt(tree.root, tok, i);
          if (r.kind === 'ok') { startGame(tree, tok.ref, 'game'); play(tree.root, r, tok); break; }
        }
        // Nothing fits: report it where it was printed, and skip the rest of this run.
        if (a && 'fail' in a && ctx.game) report(issueFrom(a.fail, tok, a.node, ctx.game.tree));
        else report({ kind: 'unplaced', message: `Moves starting "${numLabel(before)}${tok.raw}" could not be attached to any position (no matching game or diagram).`, raw: tok.raw, ref: tok.ref });
        inRun = false;
        break;
      }
    }
  }
  finish();
  for (const g of games) g.confidence = g.confN ? Math.round((g.confSum / g.confN) * 100) / 100 * (g.issues.some((x) => x.kind !== 'repaired') ? 0.8 : 1) : 0;
  return { games: games.filter((g) => g.tree.size() > 0).map(({ confSum: _a, confN: _b, ended: _c, ...rest }) => rest), orphans };
}

function numLabel(before: number | null): string {
  if (before === null) return '';
  const n = Math.floor(before / 2) + 1;
  return before % 2 === 0 ? `${n}.` : `${n}...`;
}

function issueFrom(r: Resolution, tok: Extract<Token, { t: 'move' }>, node: MoveNode, tree: GameTree): Issue {
  if (r.kind === 'ambiguous') return { kind: 'ambiguous', message: r.reason, raw: tok.raw, ref: tok.ref, fen: node.fen, at: tree.pathKey(node), candidates: r.candidates.map((c) => c.san) };
  return { kind: 'illegal', message: r.kind === 'none' ? r.reason : 'unreadable move', raw: tok.raw, ref: tok.ref, fen: node.fen, at: tree.pathKey(node) };
}

/** Complete a diagram's placement with the side to move and move number implied by the text. */
export function diagramFen(fen: string, before: number): string | null {
  const parts = fen.split(/\s+/);
  const b = boardFromFen(fen);
  const turn = before % 2 === 0 ? 'w' : 'b';
  const full = Math.floor(before / 2) + 1;
  // Castling rights only if the diagram's own FEN says so (unknown otherwise).
  const castling = parts[2] && parts[2] !== '-' ? parts[2] : '-';
  void b;
  const out = `${parts[0]} ${turn} ${castling} - 0 ${full}`;
  try { new Chess(out); return out; } catch { return null; }
}

function flushText(ctx: Ctx, closing?: string): void {
  if (!ctx.text.length) return;
  let s = ctx.text.join(' ').replace(/\s+([,.;:!?)])/g, '$1').replace(/\(\s+/g, '(').trim();
  ctx.text = [];
  if (closing) s = s.replace(/\($/, '');
  s = s.replace(/^\)+|\(+$/g, '').trim();
  if (!s || /^[()\s,.;:]*$/.test(s) || !ctx.game || !ctx.cursor) return;
  const n = ctx.cursor;
  n.comment = n.comment ? `${n.comment} ${s}` : s;
}
