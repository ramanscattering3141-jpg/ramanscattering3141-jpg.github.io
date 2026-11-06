# Chess Book Reader — development log

## Session 1 (2026-11-06)

- **Architecture.** The repository deploys to GitHub Pages, so there is no server. Chose a fully
  client-side design: pdf.js, Tesseract.js, Stockfish WASM, IndexedDB, Preact in the existing Vite build.
  Rationale in ARCHITECTURE.md.
- **Core chess.** Variation tree, PGN reader/writer (nested variations, comments, NAGs, SetUp),
  FEN legality checks for diagrams, ECO by position (Lichess CC0 table, 3,865 positions).
- **Book notation.** A tokenizer that keeps page positions, and a reconstructor that anchors each
  numbered run of moves to the right position (continuation, variation, earlier position, diagram,
  new game). Handles bold main lines, parentheses, "13 Nf3" and "13...Nf3" numbering, dotted
  placeholders. Tested on a real 1921 text (Capablanca, *Chess Fundamentals*, Project Gutenberg).
  That text exposed spaced descriptive moves ("Kt - Q B 3"), move numbers glued to ranks
  ("Kt × Kt 8. P × Kt"), prose lines starting with a move ("P × P is preferable…"), and genuinely
  ambiguous captures ("10 B × P", Bxc4 or Bxh7). The last is resolved by a flagged recapture rule.
- **Diagrams.** Board detection by connected components plus a frame/gap scan and checkerboard
  score; per-square recognition against three reference piece sets; per-book learning from
  corrections; flat-field correction for scans with grey paper. Measured on synthetic diagrams and on
  the 1921 scans (see TESTING.md). After the user said their books are modern typeset ones (Kasparov's
  *My Great Predecessors*, R.B. Ramesh), priority went to clean digital diagrams (100 % on the
  synthetic set), chess-font diagrams (decoded exactly) and figurine-font notation. An extra
  hatch-smoothing step that hurt clean diagrams was dropped.
- **Engine.** Request queue so a new search always stops the old one before starting; terminal
  positions answered without the engine; IndexedDB cache; whole-game analysis and annotation.
- **UI.** Library, book page, study (PDF ⇄ board), analysis workspace, correction screens, training,
  search, bookmarks, settings (backup/restore), About (licences).
- **Testing.** Unit tests for core, notation, engine parsing, layout and vision; a generated
  modern-style test book; an end-to-end Playwright script.
