# Chess Book Reader — architecture

The fourth app in this repository, served at `/chess/`. It turns chess books in PDF into
playable, searchable games with Stockfish analysis. Source: `src/chess/`, entry `chess/index.html`.

## Why it runs entirely in the browser

The brief suggested Next.js + FastAPI + PostgreSQL + object storage. This repository deploys to
**GitHub Pages**, which serves static files only: no server process, no database. A backend would
need separate hosting, and every uploaded book would have to leave the user's machine. So the
pipeline runs client-side instead:

| Brief | Used here | Why |
|---|---|---|
| Next.js / React / Tailwind | Vite + Preact (React API) + hand-written CSS | The repo already builds three Vite apps; Preact has the same component model at a fraction of the size. |
| FastAPI + PyMuPDF | pdf.js (in its own worker) | Same capabilities (text with positions and fonts, rendering, outline), no server. |
| Tesseract | Tesseract.js (WASM), self-hosted model | The same engine, compiled to WebAssembly. |
| PostgreSQL + object storage | IndexedDB (via `idb`) | Durable per-browser storage; PDFs are stored as Blobs. |
| Background task queue | Page-by-page queue with progress saved after each page; vision in a Web Worker | Resumable after reload; the UI stays responsive. |
| Authentication | None needed | Nothing leaves the device: each browser profile *is* a private library. Backups are explicit files. |

Trade-off: a library lives in one browser profile; moving it uses the backup/restore in Settings.

## Modules

```
src/chess/
  core/          pure chess logic, no DOM (all unit-tested)
    tree.ts        variation tree (GameTree / MoveNode), threefold detection, position status
    pgn.ts         PGN reader/writer: nested variations, comments, NAGs, SetUp/FEN, round-trip validation
    fen.ts         FEN ⇄ board, legality checks for diagrams (kings, pawns, counts, side not to move in check)
    nag.ts         annotation glyphs ⇄ NAGs (!, ?!, ±, +−, …)
    san.ts         printed move → legal move: SAN, figurines, long algebraic, 11 piece-letter languages,
                   English descriptive (P-K4, KtxP, R(Q1)-Q2), OCR repair; ambiguity is reported, not guessed
    notation.ts    book lines → tokens (move numbers, moves, annotations, brackets, headers, diagrams), with
                   page positions; closes up spaced descriptive moves ("Kt - Q B 3")
    reconstruct.ts tokens → games: anchors each run of moves to the position it belongs to (main line,
                   variation, diagram), keeps prose as comments, reports every unreadable/illegal move
    eco.ts         opening names by position (Lichess chess-openings, CC0), transpositions included
  engine/
    engine.ts      Stockfish 19 WASM in a Worker over UCI; request queue (newer search stops older)
    uci.ts         info parsing, White-perspective scores, win %, move judgements
    cache.ts       engine results cached in IndexedDB by position + engine + MultiPV
    gameAnalysis.ts whole-game analysis, verdicts (Lichess thresholds), annotate PGN
  pdf/
    pdf.ts         pdf.js wrapper: validation, render, text items with font names/bold, outline
    layout.ts      text items → lines in reading order: columns, headings, captions, coordinate labels,
                   chess-font diagrams (Linares encoding), figurine-font detection, garbled-layer test
    ocr.ts         Tesseract.js wrapper (self-hosted worker, core and model)
    pipeline.ts    upload, page queue (resume/pause/reprocess), OCR decision, diagram records
    chapters.ts    chapters from the PDF outline, else from headings (running heads ignored)
    extract.ts     re-runs notation reconstruction for a book from stored pages (after any correction)
  vision/          pure image code (unit-tested) + worker
    image.ts       grayscale ops, components, Otsu, flat-field correction for scans
    board.ts       diagram detection (component search, frame/gap scan, checkerboard score)
    classify.ts    64-square recognition: empty-square model per colour, piece outline + ink descriptors,
                   nearest reference piece; per-book learned references from user corrections
    position.ts    orientation (coordinates, pawn structure), side to move from captions, FEN
    vision.worker.ts / client.ts
  db/              IndexedDB schema, game save (PGN validated, position index), deletion cascade
  ui/              Preact components (Library, BookView, Study, Analysis, Review, Training, Search, …)
  data/            eco.json (generated), piece-templates.json (generated)
```

## Data model (IndexedDB `chess-book-reader`)

`books` (metadata, status, reading settings, learned glyphs) · `files` (PDF Blob) ·
`pages` ([bookId, page]: lines in reading order + diagram markers, OCR flag) ·
`diagrams` (page rect, pieces as printed, orientation, side to move, FEN, per-square confidence,
status, descriptors for learning) · `chapters` · `games` (**PGN is authoritative**; indexed fields;
issues; anchors = page rectangle of every move; diagram links; status; `manual` if user-edited) ·
`positions` (position key → game + path, for position search) · `engine` (cache) · `bookmarks` ·
`notes` · `exercises` · `attempts` · `templates` (learned piece drawings per book) · `kv`.

Every game keeps its book, chapter, page, confidence, validation status and the page location
of each move (anchors), which drives the PDF ⇄ board synchronisation.

## Processing pipeline

1. **Upload**: header and size check, pdf.js opens it (no script execution), cover rendered, PDF stored.
2. **Per page** (resumable): render at 150 dpi; text items with fonts; chess-font diagrams decoded from
   text; raster/vector diagrams found and recognised in the vision worker; OCR at 300 dpi if the page has
   no or an unreadable text layer (diagram areas blanked first); layout into reading order.
3. **Chapters** from the outline or headings.
4. **Extraction**: tokens → games, validated move by move; PGN written and re-parsed; ECO classified;
   position index built. Re-run cheaply after any correction; user-edited games are preserved.

## Correctness rules

- A move enters a game only if it is legal in the position it is played from.
- Unreadable, illegal or ambiguous moves become issues with page location; the line stops there.
- OCR repairs, figurine inference and disambiguation by later moves are flagged on the move.
- Diagram FENs must pass `checkPosition`; castling rights are only those the placement allows;
  side to move comes from the caption, the following move number, or check — else it is marked unknown.
- Exports are validated by re-parsing before download.

## Licensing

Stockfish and Chessground are GPL-3.0, so the chess app is distributed under GPL-3.0; the source is
this public repository. Attributions are on the in-app About page. Vendored files are copied from
`node_modules` at build time (`vite.config.ts`), never fetched from a CDN at run time.
