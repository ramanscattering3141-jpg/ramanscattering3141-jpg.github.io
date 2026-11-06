# Chess Book Reader — TODO

Status of the brief's phases. `[x]` done and tested, `[~]` works with documented limits, `[ ]` open.

## Phase 1 — Architecture
- [x] Stack chosen for a static GitHub Pages host (see ARCHITECTURE.md for the reasons)
- [x] IndexedDB schema; module boundaries (core / engine / pdf / vision / db / ui)

## Phase 2 — Chess foundation
- [x] Variation tree; PGN read/write with nested variations, comments, NAGs, SetUp/FEN; round-trip validation
- [x] FEN validation for diagrams; castling, en passant, promotion, mate, stalemate, threefold, 50-move, insufficient material
- [x] Interactive board (drag and click, promotion dialog, flip, legal-move dots, check and last-move highlight)
- [x] Move list with variations; promote/delete; keyboard navigation; captured pieces and material

## Phase 3 — Stockfish
- [x] Stockfish 19 WASM in a worker (lite single-thread default; lite multi-thread when cross-origin isolated; full NNUE 99 MB opt-in)
- [x] Depth / time / infinite, MultiPV 1–5, hash, threads; score, mate, depth, nodes, nps, status
- [x] Engine cache (IndexedDB); finished positions never sent to the engine
- [x] Whole-game analysis, judgements, graph (click to navigate, mates and swings marked), annotate PGN
- [x] Book move vs engine comparison; batch analysis per chapter/book and for selected diagrams
- [ ] Full multi-threaded NNUE build (another 99 MB file; left out to keep the deploy small)

## Phase 4 — PDF processing
- [x] Multi-file drag-and-drop upload, validation, size limit, cover, metadata, delete with cascade
- [x] Background page queue with progress, pause/resume, resume after reload, reprocess selected pages
- [x] Text layer with fonts and bold; multi-column reading order; headings; captions
- [x] OCR for scanned or garbled pages (self-hosted Tesseract)
- [x] Notation: SAN, figurines, long algebraic, 11 languages, descriptive (incl. spaced "Kt - Q B 3"), NAGs, results, headers
- [~] Figurine fonts that map pieces to arbitrary characters: inferred from legal moves and learned per book (needs ≥3 consistent readings)

## Phase 5 — Diagram recognition
- [x] Detection (framed/unframed, hatched/grey squares, scans with grey paper)
- [x] Square classification with confidence; king-count repair; orientation from coordinates/pawns; side to move from captions/move numbers/check
- [x] Chess-font diagrams decoded exactly from the text layer (Linares encoding)
- [x] Manual correction editor; corrections become per-book reference pieces
- [~] Unusual vintage piece drawings: low accuracy until a diagram or two are corrected (see TESTING.md numbers)

## Phase 6 — Book integration
- [x] Games and fragments with Source/Page/Chapter tags; variations; author comments kept
- [x] Diagrams linked to game positions; PDF ⇄ board sync both ways; chapter TOC
- [x] Export game / chapter / book PGN (validated), FEN downloads, copy FEN/PGN

## Phase 7 — Study and training
- [x] Study mode with focus mode; bookmarks; notes; progress remembered ("continue where you left off")
- [x] Exercises chosen by the user; Stockfish-checked answers (alternatives accepted); stats, weak themes, history

## Phase 8 — Polish
- [x] Light/dark themes, phone layout, accessibility labels
- [x] Unit tests; browser end-to-end test on a generated book
- [ ] Book-level undo history for corrections
- [ ] Recognise diagrams printed with coordinates inside the squares' border on both sides (labels only read on the left/bottom)
