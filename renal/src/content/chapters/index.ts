import type { ChapterContent } from './types';

const mods = import.meta.glob<{ chapter: ChapterContent }>('./ch*.ts', { eager: true });

export const CHAPTERS: ChapterContent[] = Object.values(mods)
  .map((m) => m.chapter)
  .sort((a, b) => a.n - b.n);

export const chapterByN = (n: number) => CHAPTERS.find((c) => c.n === n);
export type { ChapterContent };
