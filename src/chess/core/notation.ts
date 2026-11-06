// Book text → tokens. Lines come from the PDF text layer or OCR with their page and position,
// so every token can point back at the place it was printed.
import { couldBeMove, normalizeMoveText } from './san';
import { parseAnnotationRun } from './nag';

export interface SourceRef {
  page: number;
  /** Rectangle in page coordinates as fractions of the page size: x, y, w, h (0–1). */
  rect: [number, number, number, number];
}

export interface TextLine {
  text: string;
  page: number;
  rect: [number, number, number, number];
  /** 'heading' lines end games; 'caption' lines sit under diagrams. */
  kind?: 'body' | 'heading' | 'caption';
  bold?: boolean;
  /** OCR word confidence 0–1 (1 for a reliable text layer). */
  conf?: number;
  /** True when the text came from OCR or an unreliable text layer, which enables repairs. */
  ocr?: boolean;
  /** Per-word bold flags when the line mixes fonts (same length as whitespace-split words). */
  boldWords?: boolean[];
  /** First line of a paragraph (indented, after a short line or a gap, or after a heading/diagram). */
  para?: boolean;
}

export interface DiagramMarker { kind: 'diagram'; id: string; fen: string | null; page: number; rect: [number, number, number, number]; caption?: string }

export type Token =
  | { t: 'num'; n: number; black: boolean; ref: SourceRef; raw: string; para?: boolean }
  | { t: 'ellipsis'; ref: SourceRef; raw: string }
  | { t: 'move'; raw: string; nags: number[]; ref: SourceRef; bold: boolean; conf: number; ocr: boolean; bol?: boolean; para?: boolean }
  | { t: 'nag'; nags: number[]; ref: SourceRef; raw: string }
  | { t: 'result'; v: string; ref: SourceRef; raw: string }
  | { t: 'open'; ref: SourceRef; raw: string }
  | { t: 'close'; ref: SourceRef; raw: string }
  | { t: 'text'; raw: string; ref: SourceRef }
  | { t: 'header'; headers: Record<string, string>; ref: SourceRef; raw: string }
  | { t: 'heading'; raw: string; ref: SourceRef }
  | { t: 'diagram'; d: DiagramMarker; ref: SourceRef };

const RESULT_RE = /^(1[-–—]0|0[-–—]1|½[-–—]½|1\/2[-–—]1\/2|\*|1:0|0:1)$/;

function wordRef(line: TextLine, start: number, len: number): SourceRef {
  const n = Math.max(1, line.text.length);
  const [x, y, w, h] = line.rect;
  return { page: line.page, rect: [x + (w * start) / n, y, (w * len) / n, h] };
}

/**
 * Detect a game header line: "Capablanca – Marshall, New York 1918", "Game 12: J. R. Capablanca -
 * F. Marshall, New York 1909", "Carlsen,Magnus (2870) – Anand,Viswanathan (2775) [B30] Chennai 2013",
 * "Kasparov, Garry – Karpov, Anatoly, Moscow 1985", "White: Lasker", "White: X. Black: Y."
 */
export function parseHeaderLine(text: string): Record<string, string> | null {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length < 5 || t.length > 140) return null;
  if (/\b\d{1,3}\s*\.\s*(?:\.\.\s*)?[a-hKQRBNO0♔-♟]/.test(t)) return null; // has moves
  const both = /^White\s*:\s*(.+?)\.?\s+Black\s*:\s*(.+?)\.?$/i.exec(t);
  if (both) return { White: both[1].trim(), Black: both[2].trim() };
  const wb = /^(White|Black)\s*:\s*(.+)$/i.exec(t);
  if (wb) return { [wb[1][0].toUpperCase() + wb[1].slice(1).toLowerCase()]: wb[2].trim() };

  const m = /^(?:(?:Game|Partie|Partida|Partij)\s+(\d+)\s*[:.)]?\s+)?(.+?)\s*(?:\s[–—-]\s|[–—]|\svs\.?\s|\sv\.?\s)\s*(.+)$/u.exec(t);
  if (!m) return null;
  const gameNo = m[1];
  const stripRating = (x: string) => x.replace(/\s*\(\d{3,4}\)/g, '').replace(/\s+[12]\d{3}$/, '').trim();
  const white = stripRating(m[2].replace(/^(?:Game|Partie|Partida)\s+\d+\s*[:.)]?\s*/i, ''));
  let right = m[3].trim();
  let black: string;
  let rest = '';
  // Surname-first ("Kasparov, Garry") on the White side means Black is written the same way.
  const surnameFirst = /^[^,]+,\s?[A-ZÀ-ɏ][^,]*$/u.test(white);
  if (surnameFirst) {
    const parts = right.split(',');
    const second = parts[1] ?? '';
    const cut = second.search(/[\[(]|\s[12]\d{3}\b/);
    black = `${parts[0]},${cut < 0 ? second : second.slice(0, cut)}`;
    rest = (cut < 0 ? '' : second.slice(cut)) + (parts.length > 2 ? `,${parts.slice(2).join(',')}` : '');
  } else {
    const idx = right.search(/[,;\[(]|\s[12]\d{3}\b/);
    black = idx < 0 ? right : right.slice(0, idx);
    rest = idx < 0 ? '' : right.slice(idx);
  }
  // A rating written after Black's name: "Anand,Viswanathan (2775) [B30] Chennai 2013".
  const rr = /^\s*(?:\((\d{3,4})\)|[12]\d{3}(?=\s*[,\[(]))/.exec(rest);
  if (rr) rest = rest.slice(rr[0].length);
  black = stripRating(black);
  right = '';
  const nameOk = (n: string) => {
    const words = n.replace(/,/g, ' ').split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 6 || n.length > 45 || /\d/.test(n)) return false;
    return words.every((w) => /^[A-ZÀ-ɏ][\p{L}'’.\-]*$/u.test(w) || /^(de|van|von|der|den|da|di|du|le|la|of|and|&|dos|del|ter)$/i.test(w) || /^[A-Z]\.$/.test(w));
  };
  if (!nameOk(white) || !nameOk(black)) return null;
  if (/^(White|Black|The|This|After|In|If|But|And|Now|Here|Then|So|Thus|Note)$/i.test(white.split(/[\s,]/)[0])) return null;
  // With nothing after the names, demand short names (prose like "Black – the knight…" fails above).
  if (!rest.trim() && !gameNo && (white.split(/\s+/).length > 3 || black.split(/\s+/).length > 3)) return null;
  const h: Record<string, string> = { White: white, Black: black };
  if (gameNo) h.BookGame = gameNo;
  if (rest.trim()) {
    const year = /\b(1[4-9]\d\d|20\d\d)\b/.exec(rest);
    if (year) h.Date = `${year[1]}.??.??`;
    const res = /(1-0|0-1|½-½|1\/2-1\/2|1–0|0–1)/.exec(rest);
    if (res) h.Result = res[1].replace('–', '-').replace('½-½', '1/2-1/2');
    const eco = /\b([A-E]\d\d)\b/.exec(rest);
    if (eco) h.ECO = eco[1];
    const ev = rest.replace(/\b(1[4-9]\d\d|20\d\d)\b/g, '').replace(/(1-0|0-1|½-½|1\/2-1\/2|1–0|0–1)/, '').replace(/\b[A-E]\d\d\b/, '').replace(/[()\[\],;]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (ev) h.Event = ev;
  }
  return h;
}

/** Tokenise lines (in reading order) and diagram markers (inserted at their reading position). */
export function tokenize(items: Array<TextLine | DiagramMarker>): Token[] {
  const out: Token[] = [];
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if ('kind' in it && it.kind === 'diagram') { out.push({ t: 'diagram', d: it, ref: { page: it.page, rect: it.rect } }); continue; }
    const line = it as TextLine;
    const full = { page: line.page, rect: line.rect };
    if (line.kind === 'heading') {
      // Game headers are often set larger than the text; they start a game rather than a chapter.
      const h = parseHeaderLine(line.text);
      out.push(h ? { t: 'header', headers: h, ref: full, raw: line.text } : { t: 'heading', raw: line.text.trim(), ref: full });
      continue;
    }
    // Captions belong to their diagram (stored with it); they are not game text.
    if (line.kind === 'caption') continue;
    let hdr = parseHeaderLine(line.text);
    // A header that wraps: "Morphy – Duke of Brunswick and Count Isouard, Paris" / "1858".
    const next = items[k + 1] as TextLine | undefined;
    if ((!hdr || !hdr.Date) && next && !('kind' in next && (next as unknown as DiagramMarker).kind === 'diagram') && next.kind !== 'heading' && next.text.trim().length < 40 && !/\d+\s*\.\s*\S/.test(next.text)) {
      const joined = parseHeaderLine(`${line.text.trim()} ${next.text.trim()}`);
      if (joined && joined.Date && (!hdr || Object.keys(joined).length > Object.keys(hdr).length)) { hdr = joined; k++; }
    }
    if (hdr) { out.push({ t: 'header', headers: hdr, ref: full, raw: line.text }); continue; }
    tokenizeLine(line, out);
  }
  return out;
}

// Descriptive notation is often printed with spaces inside the move ("Kt - Q B 3", "B × B P",
// "O - O"). Closing them up lets the move be read as one word.
const D_PIECE = String.raw`(?:(?:[KQ] ?)?(?:Kt|[RBN]) ?P|(?:[KQ] ?)?(?:Kt|[RBN])|P|K|Q)`;
// A digit followed by ". <move>" is the next move number, not a rank ("Kt × Kt 8. P × Kt").
const D_SQ = String.raw`(?:(?:[KQ] ?)?(?:Kt|[RBN])? ?[1-8](?!\.+\s*(?:P|Kt|[KQRBN]|O)\s*[-×x(]))`;
const D_MOVE = new RegExp(String.raw`(?<![\w-])(${D_PIECE})(?:\s?\((?:[KQ]?\s?(?:Kt|[RBN])?\s?[1-8]|[1-8])\))?\s*([-×x])\s*(${D_SQ}|${D_PIECE})(?:\s?(?:\(?(?:dis\.?\s?)?ch\.?\)?|mate))?(?![\w])`, 'g');

export function compactDescriptive(text: string): string {
  let t = text.replace(/\b([O0])\s*[-–]\s*([O0])(?:\s*[-–]\s*([O0]))?\b/g, (_m, a, b, c) => (c ? `${a}-${b}-${c}` : `${a}-${b}`));
  t = t.replace(D_MOVE, (m) => m.replace(/\s+/g, ''));
  return t;
}

function tokenizeLine(orig: TextLine, out: Token[]): void {
  const line = { ...orig, text: compactDescriptive(orig.text) };
  const text = line.text;
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  let wi = 0;
  const conf = line.conf ?? 1;
  const ocr = !!line.ocr;
  const first = out.length;
  while ((m = re.exec(text))) {
    let w = m[0];
    let at = m.index;
    const bold = line.boldWords ? !!line.boldWords[wi] : !!line.bold;
    wi++;
    // Labels of lettered/numbered lines ("A)", "b)", "a1)", "(2)", "B12)") are text, not brackets.
    // "a1)"-style labels look like a pawn move, so they count as labels only at the start of a line.
    if (/^\(?(?:[A-Za-z]|[A-Z]\d{1,2}|\d{1,2})\)$/.test(w) || (wi === 1 && /^\(?[a-h]\d{1,2}\)$/.test(w))) {
      out.push({ t: 'text', raw: w, ref: wordRef(line, at, w.length) });
      continue;
    }
    // Leading brackets.
    while (/^[(\[]/.test(w)) { out.push({ t: 'open', ref: wordRef(line, at, 1), raw: w[0] }); w = w.slice(1); at++; }
    const closers: Token[] = [];
    let tail = '';
    // Trailing punctuation and brackets (but keep "..." and annotation glyphs).
    for (;;) {
      if (/[)\]]$/.test(w)) { closers.unshift({ t: 'close', ref: wordRef(line, at + w.length - 1, 1), raw: w.slice(-1) }); w = w.slice(0, -1); continue; }
      if (/[,;:]$/.test(w) && !/^\d+:\d+$/.test(w)) { tail = w.slice(-1) + tail; w = w.slice(0, -1); continue; }
      if (/[^.]\.$/.test(w) && !/^\d+\.$/.test(w) && w.length > 1) { tail = '.' + tail; w = w.slice(0, -1); continue; }
      break;
    }
    if (w) emitWord(w, at, line, out, bold, conf, ocr, tail);
    out.push(...closers);
  }
  const t0 = out[first];
  if (t0 && t0.t === 'move') t0.bol = true;
  if (line.para) {
    // The paragraph's first move number (or move), even after a label such as "B)".
    const lead = out.slice(first).find((t) => t.t === 'num' || t.t === 'move');
    if (lead && (lead.t === 'num' || lead.t === 'move')) lead.para = true;
  }
}

function emitWord(w: string, at: number, line: TextLine, out: Token[], bold: boolean, conf: number, ocr: boolean, tail: string): void {
  const ref = wordRef(line, at, w.length);
  if (RESULT_RE.test(w)) { const v = w.replace(/[–—:]/g, '-'); out.push({ t: 'result', v: v === '½-½' ? '1/2-1/2' : v, ref, raw: w }); return; }
  if (/^(\.{2,}|…+)$/.test(w)) { out.push({ t: 'ellipsis', ref, raw: w }); return; }
  // Move number, optionally glued to a move: "12.", "12...", "12…", "12.Nf3", "12...Nf3", "12 ...".
  const num = /^(\d{1,3})(\.\s?\.\s?\.|\.\.\.|…|\.|\s)(.*)$/.exec(w);
  if (num && Number(num[1]) > 0 && Number(num[1]) < 400) {
    const black = num[2].replace(/\s/g, '').length >= 2 || num[2] === '…' || /^(\.\.\.|…)/.test(num[3]);
    const nlen = num[1].length + num[2].length;
    out.push({ t: 'num', n: Number(num[1]), black, ref: wordRef(line, at, nlen), raw: num[1] + num[2] });
    let rest = num[3].replace(/^(\.\.\.|…|\.)+/, '');
    if (rest) emitWord(rest, at + w.length - rest.length, line, out, bold, conf, ocr, tail);
    return;
  }
  // Bare number before a move ("13 Nf3"): treated as a move number; the reconstructor ignores it otherwise.
  if (/^\d{1,3}$/.test(w) && Number(w) > 0) { out.push({ t: 'num', n: Number(w), black: false, ref, raw: w }); return; }
  const nagOnly = parseAnnotationRun(w);
  if (nagOnly && nagOnly.length) { out.push({ t: 'nag', nags: nagOnly, ref, raw: w }); return; }
  // Annotation glued to a move: split at the first glyph after the move body.
  const g = /^(.*?[a-h1-8OQRBNK0#+lIS])((?:[!?±∓⩲⩱∞□]|\+[-=\/]|=[+\/]|-\+)+)$/u.exec(w);
  let body = w;
  let nags: number[] = [];
  if (g) { const p = parseAnnotationRun(g[2]); if (p) { body = g[1]; nags = p; } }
  if (couldBeMove(body) || couldBeMove(normalizeMoveText(body))) {
    out.push({ t: 'move', raw: body, nags, ref, bold, conf, ocr });
    // A comma or semicolon after a move separates moves ("8...P×P; 9 B×BP, P-QKt3"); a full stop
    // ends the sentence, and so the run of moves.
    if (tail.includes('.')) out.push({ t: 'text', raw: tail, ref });
    return;
  }
  out.push({ t: 'text', raw: w + tail, ref });
}
