# Chess Book Reader — testing

## Unit tests (`npx vitest run tests/chess`)

| File | Covers |
|---|---|
| `pgn.test.ts` | PGN parse/export, nested variations, comments, NAGs, SetUp/FEN, promotion, castling with zeros, en passant, checkmate, stalemate, threefold repetition, tree editing (promote/delete), illegal moves reported, ECO by position |
| `fen.test.ts` | FEN validity for diagrams (kings, pawns on back ranks, adjacent kings, side not to move in check, too many promoted pieces), orientation guess, captions, side to move from check |
| `notation.test.ts` | Figurines, long algebraic, German letters, language detection, descriptive notation, ambiguity reporting, OCR repair and glyph learning, header lines, game reconstruction (comments, NAGs, results, numbered and parenthesised variations, diagrams as starting positions, diagram ↔ position links, several games, bold main line, "13 Nf3" numbering), and a real game from Capablanca's *Chess Fundamentals* (1921, public domain) in spaced descriptive notation with inline variations |
| `uci.test.ts` | UCI info parsing, White-perspective scores, bounds, score formatting, move judgements, terminal positions never searched |
| `layout.test.ts` | Two-column reading order, headings, diagrams in reading order, captions, coordinate labels, bold words, chess-font diagram decoding, garbled text layers |
| `vision.test.ts` | Board detection (none on text-only pages), exact square reading with hatched and grey squares, an unseen piece set, small noisy prints, learning from one corrected diagram |

Synthetic diagrams (`tests/chess/synth.ts`) are composed from the bundled piece sets, so tests
are deterministic and need no binary fixtures.

## Measured recognition accuracy

Synthetic book diagrams, recognising a piece set that was **excluded** from the references
(3 positions, 192 squares each):

| Set | Hatched dark squares | Grey dark squares |
|---|---|---|
| cburnett | 100 % | 100 % |
| merida | 100 % | 100 % |
| chessnut (stylised) | 91.7 % (pieces 82 %) | 91.1 % (pieces 81 %) |

With the set's own references, and after learning from one corrected diagram, all squares are read
correctly. On real 1921 letterpress scans (Gutenberg images of *Chess Fundamentals*), boards are
found in 20 of 20 figures; piece reading without corrections is unreliable on those vintage
drawings (roughly half the squares), which is why low-confidence diagrams are sent for review and
corrections teach the recogniser. Modern typeset books are a much easier case: diagrams set in a
chess font are decoded exactly, and clean vector/raster diagrams behave like the synthetic set.

## End-to-end (`tools/chess-e2e.mjs`)

`tools/chess-make-sample-pdf.mjs` generates `tests/chess/fixtures/sample-book.pdf`: a four-page book
with figurine notation, a bold main line with analysis in parentheses, vector diagrams with
captions, two chapters and one image-only (scanned) page. All its moves and positions are
validated with chess.js when it is generated. The e2e script serves a production build, uploads the
book in Chromium and checks extraction, diagrams, OCR, chapters, PDF-to-board synchronisation, a
live Stockfish search, whole-game analysis, PGN export, the phone layout and console errors.

```
npx vite build --outDir /tmp/dist && npx vite preview --outDir /tmp/dist --port 4190 &
node tools/chess-e2e.mjs http://localhost:4190/ test-results/chess-e2e
```

Last run: see DEVELOPMENT_LOG.md.

## Manual checks still worth doing with your own books

- A figurine-font book whose text layer maps pieces to private characters (check the Problems tab).
- Two-column books with diagrams straddling columns.
- Very large books (500+ pages): processing is page-by-page and resumable; expect a few seconds
  per page with diagrams, much longer per page if OCR is needed.
