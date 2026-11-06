// Re-runs notation reconstruction for a whole book from its stored pages. Cheap compared with
// page processing, so it runs after every correction (diagram fixed, settings changed…).
import { tokenize, type DiagramMarker, type TextLine } from '../core/notation';
import { reconstruct, type Issue } from '../core/reconstruct';
import { guessLanguage } from '../core/san';
import { db, type Book, type ChapterRec, type DiagramRec } from '../db/db';
import { saveExtracted, deleteGame } from '../db/games';
import { runningHeadFilter, markParagraphsFromRects } from './layout';

/** Bump when the reconstruction changes, so stored books are rebuilt once with the new rules. */
export const EXTRACT_VERSION = 2;

export interface ExtractSummary { games: number; fragments: number; moves: number; issues: number; orphans: Issue[]; language: string; boldMain: boolean }

export async function extractBook(bookId: string): Promise<ExtractSummary> {
  const d = await db();
  const book = (await d.get('books', bookId)) as Book;
  const pages = (await d.getAllFromIndex('pages', 'byBook', bookId)).filter((p) => p.status === 'done').sort((a, b) => a.page - b.page);
  const diagrams = new Map<string, DiagramRec>((await d.getAllFromIndex('diagrams', 'byBook', bookId)).map((x) => [x.id, x]));
  const chapters = (await d.getAllFromIndex('chapters', 'byBook', bookId)).sort((a, b) => a.index - b.index);
  const chapterOf = (page: number): ChapterRec | undefined => chapters.find((c) => page >= c.startPage && page <= c.endPage);

  // Running heads and footers would otherwise read as chapter headings at page breaks and end games.
  const isRunningHead = runningHeadFilter(pages);

  // Current diagram positions (they may have been corrected since the page was read).
  const itemsByChapter = new Map<string, Array<TextLine | DiagramMarker>>();
  const allWords: string[] = [];
  let bold = 0, moveWords = 0;
  for (const p of pages) {
    markParagraphsFromRects(p.items.filter((it) => !('kind' in it && it.kind === 'diagram') ? !isRunningHead(it as TextLine) : true));
    const ch = chapterOf(p.page)?.id ?? '';
    const list = itemsByChapter.get(ch) ?? [];
    for (const it of p.items) {
      if ('kind' in it && it.kind === 'diagram') {
        const rec = diagrams.get(it.id);
        // Invalid positions are still passed: they can be matched to a position the moves reach.
        list.push({ ...it, fen: rec?.fen ?? null });
      } else {
        const line = it as TextLine;
        if (isRunningHead(line)) continue;
        list.push(line);
        for (const [i, w] of line.text.split(/\s+/).entries()) {
          if (/^(\d+\.+)?[KQRBNDTLSCF]?x?[a-h][1-8]/.test(w)) { allWords.push(w.replace(/^\d+\.+/, '')); moveWords++; if (line.boldWords ? line.boldWords[i] : line.bold) bold++; }
        }
      }
    }
    itemsByChapter.set(ch, list);
  }
  const language = book.settings.language === 'auto' ? guessLanguage(allWords) : book.settings.language;
  const boldMain = book.settings.boldMain === 'yes' || (book.settings.boldMain === 'auto' && moveWords > 30 && bold / moveWords > 0.15 && bold / moveWords < 0.85);
  const glyphs = new Map(Object.entries(book.glyphs ?? {}));

  // Replace earlier automatic extractions; games the user edited are kept.
  for (const g of await d.getAllFromIndex('games', 'byBook', bookId)) if (!g.manual) await deleteGame(g.id);

  const sum: ExtractSummary = { games: 0, fragments: 0, moves: 0, issues: 0, orphans: [], language, boldMain };
  let order = 0;
  const source = book.title || book.fileName;
  for (const ch of chapters.length ? chapters : [{ id: '' } as ChapterRec]) {
    const items = itemsByChapter.get(ch.id) ?? [];
    if (!items.length) continue;
    const { games, orphans } = reconstruct(tokenize(items), { language, style: book.settings.style, boldMain, glyphs });
    sum.orphans.push(...orphans);
    for (const g of games) {
      // A single isolated move is far more likely a stray reference in prose than a game.
      if (g.tree.size() < 2 && g.type === 'game') continue;
      if (ch.title) g.tree.headers.Chapter = ch.title;
      await saveExtracted(g, bookId, ch.id || null, order++, source);
      for (const iss of g.issues) {
        if (iss.kind !== 'diagram' || !iss.diagramId) continue;
        const dg = diagrams.get(iss.diagramId);
        if (dg && dg.status === 'auto') await d.put('diagrams', { ...dg, status: 'needs-review' });
      }
      if (g.type === 'game') sum.games++; else sum.fragments++;
      sum.moves += g.tree.size();
      sum.issues += g.issues.filter((i) => i.kind !== 'repaired' && i.kind !== 'diagram').length;
    }
  }
  await d.put('books', { ...book, glyphs: Object.fromEntries(glyphs), lastExtract: Date.now(), orphans: sum.orphans, extractVersion: EXTRACT_VERSION });
  return sum;
}
