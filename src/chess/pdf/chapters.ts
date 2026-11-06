// Chapters from the PDF outline (bookmarks) when there is one, otherwise from headings found on
// the pages. Running heads (the same text at the top of many pages) are not chapters.
import type { ChapterRec } from '../db/db';

export function chaptersFrom(bookId: string, pageCount: number, outline: Array<{ title: string; page: number }>, headings: Array<{ page: number; text: string }>, uid: () => string): ChapterRec[] {
  let marks: Array<{ title: string; page: number; source: ChapterRec['source'] }> = [];
  if (outline.length >= 2) marks = outline.map((o) => ({ ...o, source: 'outline' as const }));
  else {
    const freq = new Map<string, number>();
    for (const h of headings) { const k = norm(h.text); freq.set(k, (freq.get(k) ?? 0) + 1); }
    const running = (t: string) => (freq.get(norm(t)) ?? 0) > Math.max(3, pageCount * 0.05);
    const named = headings.filter((h) => /^(chapter|part|lesson|section|kapitel|chapitre|cap[ií]tulo)\b/i.test(h.text.trim()) && !running(h.text));
    const pick = named.length >= 2 ? named : headings.filter((h) => !running(h.text) && h.text.trim().length >= 4);
    const seen = new Set<number>();
    for (const h of pick) {
      if (seen.has(h.page)) continue; // one chapter start per page
      seen.add(h.page);
      marks.push({ title: h.text.trim().slice(0, 120), page: h.page, source: 'heading' });
    }
  }
  if (!marks.length || marks[0].page > 1) marks.unshift({ title: marks.length ? 'Front matter' : 'Whole book', page: 1, source: marks.length ? 'heading' : 'whole' });
  return marks.map((m, i) => ({
    id: uid(), bookId, index: i, title: m.title, startPage: m.page,
    endPage: i + 1 < marks.length ? Math.max(m.page, marks[i + 1].page - 1) : pageCount, source: m.source,
  }));
}

function norm(s: string) { return s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim(); }
