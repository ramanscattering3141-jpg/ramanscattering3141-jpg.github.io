// Numeric Annotation Glyphs (PGN standard, section 10) and the symbols books print for them.

export const NAG_SYMBOLS: Record<number, string> = {
  1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!', 7: '□', 10: '=', 13: '∞',
  14: '⩲', 15: '⩱', 16: '±', 17: '∓', 18: '+−', 19: '−+', 22: '⨀', 32: '⟳', 36: '→', 40: '↑', 132: '⇆', 138: '⊕', 146: 'N',
};

export const NAG_NAMES: Record<number, string> = {
  1: 'good move', 2: 'mistake', 3: 'brilliant move', 4: 'blunder', 5: 'interesting move', 6: 'dubious move',
  7: 'only move', 10: 'equal position', 13: 'unclear position', 14: 'White is slightly better', 15: 'Black is slightly better',
  16: 'White is better', 17: 'Black is better', 18: 'White is winning', 19: 'Black is winning', 22: 'zugzwang',
  32: 'development advantage', 36: 'initiative', 40: 'attack', 132: 'counterplay', 138: 'time trouble', 146: 'novelty',
};

/** Book symbol (ASCII or typographic) → NAG. Longest symbols first so "!!" wins over "!". */
const SYMBOL_TO_NAG: Array<[string, number]> = [
  ['+/-', 16], ['-/+', 17], ['+/=', 14], ['=/+', 15], ['+-', 18], ['-+', 19], ['+−', 18], ['−+', 19],
  ['!!', 3], ['??', 4], ['!?', 5], ['?!', 6], ['+=', 14], ['=+', 15], ['=/∞', 13],
  ['⩲', 14], ['⩱', 15], ['±', 16], ['∓', 17], ['∞', 13], ['□', 7], ['⨀', 22], ['⟳', 32], ['↑', 40], ['→', 36], ['⇆', 132], ['⊕', 138],
  ['!', 1], ['?', 2], ['=', 10],
];

export function symbolToNag(sym: string): number | null {
  const s = sym.trim();
  for (const [k, v] of SYMBOL_TO_NAG) if (s === k) return v;
  const m = /^\$(\d{1,3})$/.exec(s);
  return m ? Number(m[1]) : null;
}

/** Split a run of annotation characters ("!?±") into NAGs. Returns null if any part is not an annotation. */
export function parseAnnotationRun(run: string): number[] | null {
  const out: number[] = [];
  let s = run.trim();
  while (s.length) {
    let hit = false;
    for (const [k, v] of SYMBOL_TO_NAG) {
      if (s.startsWith(k)) { out.push(v); s = s.slice(k.length).trimStart(); hit = true; break; }
    }
    if (!hit) return null;
  }
  return out;
}

/** Move-quality NAGs (1–6) are written glued to the move in PGN export readability; others as $n. */
export function isMoveAssessment(nag: number): boolean { return nag >= 1 && nag <= 6; }
