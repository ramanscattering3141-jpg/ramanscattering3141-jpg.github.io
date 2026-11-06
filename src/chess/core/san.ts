// Turning a move as printed in a book into a legal move in a given position.
//
// Handles standard and figurine algebraic, long algebraic ("Ng1-f3"), localized piece letters,
// English descriptive notation ("P-K4", "KtxP") and common OCR damage. Every result is checked
// against the legal moves of the position; nothing is guessed when more than one move fits.
import { Chess, type Move } from 'chess.js';

export type NotationLanguage = 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'pt' | 'sv' | 'cs' | 'pl' | 'hu';

/** Piece letters per language, in K Q R B N order. */
export const PIECE_LETTERS: Record<NotationLanguage, string> = {
  en: 'KQRBN', de: 'KDTLS', fr: 'RDTFC', es: 'RDTAC', it: 'RDTAC', nl: 'KDTLP', pt: 'RDTBC',
  sv: 'KDTLS', cs: 'KDVSJ', pl: 'KHWGS', hu: 'KVBFH',
};

const FIGURINES: Record<string, string> = {
  '♔': 'K', '♚': 'K', '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N', '♙': '', '♟': '',
  // Some figurine fonts map to these Unicode chess symbols in the Miscellaneous Symbols block variants.
  '\u{1FA00}': 'K', '\u{1FA01}': 'Q', '\u{1FA02}': 'R', '\u{1FA03}': 'B', '\u{1FA04}': 'N',
};

export type Resolution =
  | { kind: 'ok'; move: Move; conf: number; flag?: string }
  | { kind: 'ambiguous'; candidates: Move[]; reason: string }
  | { kind: 'none'; reason: string };

export interface ResolveContext {
  language?: NotationLanguage;
  /** 'algebraic' | 'descriptive' | 'auto' */
  style?: 'algebraic' | 'descriptive' | 'auto';
  /** Learned glyph → piece letter map for figurines that OCR reads as stray characters. */
  glyphs?: Map<string, string>;
  /** Allow OCR repairs (only for text that came from OCR or a text layer with odd encoding). */
  fuzzy?: boolean;
}

/** Clean typography so the move can be parsed: figurines, dashes, ×, localized letters. */
export function normalizeMoveText(raw: string, language: NotationLanguage = 'en'): string {
  let s = raw.normalize('NFKC').trim();
  s = s.replace(/[♔♚♕♛♖♜♗♝♘♞♙♟\u{1FA00}-\u{1FA04}]/gu, (c) => FIGURINES[c] ?? c);
  s = s.replace(/[‐‑‒–—−]/g, '-').replace(/[×:]/g, 'x').replace(/[‡]/g, '#').replace(/e\.?p\.?$/i, '');
  s = s.replace(/^[oO0]-[oO0]-[oO0]/, 'O-O-O').replace(/^[oO0]-[oO0]/, 'O-O');
  s = s.replace(/[!?±∓⩲⩱∞□]+$/u, '');
  if (language !== 'en') {
    const from = PIECE_LETTERS[language];
    const to = PIECE_LETTERS.en;
    // Only the leading piece letter and a promotion letter are translated.
    s = s.replace(/^[A-Z]/, (c) => { const i = from.indexOf(c); return i >= 0 ? to[i] : c; });
    s = s.replace(/(=|\/|\()?([A-Z])\)?([+#]?)$/, (m, eq, c, chk) => { const i = from.indexOf(c); return i >= 0 && i > 0 ? `=${to[i]}${chk}` : m; });
  }
  // Promotion written as e8Q, e8/Q, e8(Q).
  s = s.replace(/^([a-h](?:x[a-h])?[18])(?:\/|\(|)?([QRBN])\)?([+#]?)$/, '$1=$2$3');
  return s;
}

const SAN_RE = /^(?:[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?|O-O(?:-O)?)[+#]?$/;
const LAN_RE = /^([KQRBN])?([a-h][1-8])[-x]([a-h][1-8])(?:=?([QRBN]))?[+#]?$/;
const DESCRIPTIVE_RE = /^(?:[KQ]?(?:R|N|Kt|B)|[KQ]?(?:R|N|Kt|B)?P|K|Q)(?:\([^)]*\))?\s*[-x]\s*[KQRBNPt\d()]+(?:=?\(?[QRBN]t?\)?)?\s*(?:ch|dis\.? ?ch|mate|\+|#)?$/;

export function looksLikeSan(s: string): boolean { return SAN_RE.test(s); }
export function looksLikeDescriptive(s: string): boolean { return DESCRIPTIVE_RE.test(s.replace(/\s+/g, '')) || /^castles/i.test(s); }

/** A loose shape test used by the tokenizer: could this word be a move (possibly OCR-damaged)? */
export function couldBeMove(raw: string): boolean {
  const s = normalizeMoveText(raw);
  if (!s || s.length > 12) return false;
  if (SAN_RE.test(s) || LAN_RE.test(s)) return true;
  if (/^(?:O-O(?:-O)?|castles)/i.test(s)) return true;
  if (looksLikeDescriptive(s)) return true;
  // Damaged figurine + square, e.g. "&f3", "®xe5", "Nf3!"; or digit confusions "e4" → "e+".
  return /^.{0,2}x?[a-h][1-8lISB](?:=?[QRBN])?[+#]?$/.test(s);
}

function tryMove(chess: Chess, m: string | { from: string; to: string; promotion?: string }): Move | null {
  try { const c = new Chess(chess.fen()); return c.move(m as never); } catch { return null; }
}

function legal(chess: Chess): Move[] { return chess.moves({ verbose: true }); }

/** Resolve a printed move in the position held by `chess` (which is not modified). */
export function resolveMove(raw: string, chess: Chess, ctx: ResolveContext = {}): Resolution {
  const lang = ctx.language ?? 'en';
  const s = normalizeMoveText(raw, lang);
  const style = ctx.style ?? 'auto';
  if (!s) return { kind: 'none', reason: 'empty' };

  if (style !== 'descriptive') {
    if (SAN_RE.test(s)) {
      const m = tryMove(chess, s);
      if (m) return { kind: 'ok', move: m, conf: 1, ...(s !== raw.trim() && /[0o]-[0o]/i.test(raw) ? {} : {}) };
      // A check sign that does not match the position is a printing slip, not a different move.
      const bare = s.replace(/[+#]$/, '');
      const m2 = tryMove(chess, bare);
      if (m2) return { kind: 'ok', move: m2, conf: 0.9, flag: `check sign does not match (${raw})` };
    }
    const lan = LAN_RE.exec(s);
    if (lan) {
      const m = tryMove(chess, { from: lan[2], to: lan[3], ...(lan[4] ? { promotion: lan[4].toLowerCase() } : {}) });
      if (m && (!lan[1] || m.piece === lan[1].toLowerCase())) return { kind: 'ok', move: m, conf: 1 };
    }
  }
  if (style !== 'algebraic' && (looksLikeDescriptive(s) || style === 'descriptive')) {
    const r = resolveDescriptive(raw, chess);
    if (r.kind !== 'none' || style === 'descriptive') return r;
  }
  if (ctx.fuzzy) return resolveFuzzy(s, raw, chess, ctx);
  return { kind: 'none', reason: `"${raw}" is not a legal move here` };
}

const DIGIT_FIX: Record<string, string> = { l: '1', I: '1', i: '1', '|': '1', '!': '1', Z: '2', z: '2', S: '5', s: '5', G: '6', b: '6', B: '8', '&': '8', O: '0', o: '0' };
const FILE_FIX: Record<string, string> = { '6': 'b', o: 'c', '0': 'c', n: 'h', '1': 'f' };

/** OCR repair: match by destination square and piece kind; accept only a unique legal move. */
function resolveFuzzy(s: string, raw: string, chess: Chess, ctx: ResolveContext): Resolution {
  if (/^[0oO]-?[0oO](-?[0oO])?/.test(raw.trim())) {
    const long = /^[0oO]-?[0oO]-?[0oO]/.test(raw.trim());
    const m = tryMove(chess, long ? 'O-O-O' : 'O-O');
    if (m) return { kind: 'ok', move: m, conf: 0.8, flag: `castling read as "${raw}"` };
  }
  const t = s.replace(/[+#]$/, '');
  const mm = /^(.{0,2}?)(x?)([a-h0-9on])([1-8lIiZzSsGbB&])(?:=?([QRBN]))?$/.exec(t);
  if (!mm) return { kind: 'none', reason: `"${raw}" could not be read as a move` };
  const [, lead, , f0, r0, promo] = mm;
  const file = /[a-h]/.test(f0) ? f0 : FILE_FIX[f0];
  const rank = /[1-8]/.test(r0) ? r0 : DIGIT_FIX[r0];
  if (!file || !rank || !/[1-8]/.test(rank)) return { kind: 'none', reason: `"${raw}" has no readable square` };
  const to = file + rank;
  let pieceSet: string[] | null = null; // null = any piece
  let disamb = '';
  let glyphKey = '';
  if (!lead) pieceSet = ['p'];
  else if (/^[KQRBN]$/.test(lead)) pieceSet = [lead.toLowerCase()];
  else if (/^[KQRBN][a-h1-8]$/.test(lead)) { pieceSet = [lead[0].toLowerCase()]; disamb = lead[1]; }
  else if (/^[a-h]$/.test(lead)) { pieceSet = ['p']; disamb = lead; }
  else {
    glyphKey = lead.replace(/[a-h1-8]$/, '');
    disamb = /[a-h1-8]$/.test(lead) && lead.length === 2 ? lead[1] : '';
    const learned = ctx.glyphs?.get(glyphKey);
    pieceSet = learned ? [learned.toLowerCase()] : ['n', 'b', 'r', 'q', 'k'];
  }
  let cands = legal(chess).filter((m) => m.to === to && (!pieceSet || pieceSet.includes(m.piece)));
  if (disamb) cands = cands.filter((m) => m.from.includes(disamb));
  if (promo) cands = cands.filter((m) => m.promotion === promo.toLowerCase());
  else cands = cands.filter((m) => !m.promotion || m.promotion === 'q');
  if (cands.length === 1) {
    const flag = glyphKey ? `piece symbol "${glyphKey}" read as ${cands[0].piece.toUpperCase()}` : `OCR repair: "${raw}" → ${cands[0].san}`;
    return { kind: 'ok', move: cands[0], conf: glyphKey ? 0.7 : 0.75, flag };
  }
  if (cands.length > 1) return { kind: 'ambiguous', candidates: cands, reason: `"${raw}" fits ${cands.map((c) => c.san).join(', ')}` };
  return { kind: 'none', reason: `"${raw}" is not a legal move here` };
}

// ---------- English descriptive notation ----------

const DESC_FILES: Record<string, string> = { QR: 'a', QN: 'b', QB: 'c', Q: 'd', K: 'e', KB: 'f', KN: 'g', KR: 'h' };

function descSquares(spec: string, white: boolean): string[] {
  // spec like "K4", "KB3", "QN5", "B3" (wing omitted), "N5".
  const m = /^([KQ]?)([RNB]?)([1-8])$/.exec(spec);
  if (!m) return [];
  const [, wing, piece, rk] = m;
  const rank = white ? Number(rk) : 9 - Number(rk);
  const names = wing ? [wing + piece] : piece ? ['K' + piece, 'Q' + piece] : [];
  if (!wing && !piece) return [];
  return names.filter((n) => DESC_FILES[n]).map((n) => DESC_FILES[n] + rank);
}

function descPieceMatches(spec: string, sq: string, type: string): boolean {
  // spec: "P", "KP", "QBP", "N", "KN", "QR", "B", "Q", "K".
  const s = spec.replace(/Kt/g, 'N');
  const last = s[s.length - 1];
  if (last.toLowerCase() !== type) {
    if (!(s === 'K' && type === 'k') && !(s === 'Q' && type === 'q')) return false;
  }
  if (s.length === 1 || (s === 'K' || s === 'Q')) return true;
  const qual = s.slice(0, -1);
  const file = sq[0];
  if (last === 'P') {
    // Pawn qualifier names the file it stands on: KBP = f-pawn, QP = d-pawn, NP = b- or g-pawn.
    const files = qual.length === 2 ? [DESC_FILES[qual]] : qual === 'K' || qual === 'Q' ? [DESC_FILES[qual]] : [DESC_FILES['K' + qual], DESC_FILES['Q' + qual]];
    return files.includes(file);
  }
  // Piece qualifier K/Q: king's side (e–h) or queen's side (a–d) — the piece's home side,
  // approximated by where it stands now.
  const kingSide = file >= 'e';
  return qual === 'K' ? kingSide : qual === 'Q' ? !kingSide : true;
}

export function resolveDescriptive(raw: string, chess: Chess): Resolution {
  let s = raw.normalize('NFKC').replace(/[‐‑‒–—−]/g, '-').replace(/×/g, 'x').trim();
  s = s.replace(/\b(dis\.?\s*)?ch\b\.?|mate|[+#!?]+$/gi, '').replace(/e\.?\s?p\.?/i, '').replace(/\s+/g, '').replace(/Kt/g, 'N');
  if (/^(castles|O-O(-O)?|0-0(-0)?)/i.test(s)) {
    const long = /QR|-O-O|-0-0|Q-?side/i.test(s);
    const m = tryMove(chess, long ? 'O-O-O' : 'O-O');
    return m ? { kind: 'ok', move: m, conf: 1 } : { kind: 'none', reason: 'castling is not legal here' };
  }
  const white = chess.turn() === 'w';
  const mm = /^([KQ]?[RNB]?P?|K|Q)(?:\(([^)]*)\))?([-x])([KQRNBP\d]+?)(?:=?\(?([QRBN])\)?)?$/.exec(s);
  if (!mm) return { kind: 'none', reason: `"${raw}" is not descriptive notation` };
  const [, mover, paren, op, target, promo] = mm;
  if (!mover) return { kind: 'none', reason: `"${raw}" has no piece` };
  let cands = legal(chess).filter((m) => descPieceMatches(mover, m.from, m.piece));
  if (op === '-') {
    const squares = descSquares(target, white);
    if (!squares.length) return { kind: 'none', reason: `"${raw}" has no readable square` };
    cands = cands.filter((m) => squares.includes(m.to) && !m.captured);
  } else {
    const sq = descSquares(target, white);
    if (sq.length) cands = cands.filter((m) => m.captured && sq.includes(m.to));
    else cands = cands.filter((m) => m.captured && descPieceMatches(target, m.to, m.captured));
  }
  if (promo) cands = cands.filter((m) => m.promotion === promo.toLowerCase());
  else cands = cands.filter((m) => !m.promotion || m.promotion === 'q');
  if (paren && cands.length > 1) {
    // "R(Q1)-Q2" or "N(5)-B3": disambiguation by the starting square or rank.
    const sqs = descSquares(paren, white);
    const narrowed = cands.filter((m) => (sqs.length ? sqs.includes(m.from) : m.from[1] === String(white ? Number(paren) : 9 - Number(paren))));
    if (narrowed.length) cands = narrowed;
  }
  // Qualifiers like KR/QN name the piece's original side; if that filter removed everything, retry without it.
  if (!cands.length && /^[KQ][RNB]$/.test(mover)) return resolveDescriptive(raw.replace(/^(\s*)[KQ](?=[RNB]|Kt)/, '$1'), chess);
  if (cands.length === 1) return { kind: 'ok', move: cands[0], conf: 0.95 };
  if (cands.length > 1) return { kind: 'ambiguous', candidates: cands, reason: `"${raw}" fits ${cands.map((c) => c.san).join(', ')}` };
  return { kind: 'none', reason: `"${raw}" is not a legal move here` };
}

/** Guess the piece-letter language from tokens like "Sf3", "Dd1", "Te1". */
export function guessLanguage(words: string[]): NotationLanguage {
  const counts: Record<string, number> = {};
  for (const w of words) {
    const m = /^([A-Z])x?[a-h][1-8]/.exec(w.trim());
    if (m) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
  }
  let best: NotationLanguage = 'en';
  let bestScore = 0;
  for (const [lang, letters] of Object.entries(PIECE_LETTERS) as Array<[NotationLanguage, string]>) {
    let score = 0;
    for (const [c, n] of Object.entries(counts)) score += letters.includes(c) ? n : -2 * n;
    if (score > bestScore) { best = lang; bestScore = score; }
  }
  return best;
}
