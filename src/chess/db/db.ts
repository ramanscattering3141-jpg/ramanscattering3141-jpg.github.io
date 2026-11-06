// Local database (IndexedDB). Everything a user uploads or creates stays in their browser;
// nothing is sent to a server. PGN is the stored form of every game; the structured fields are
// indexes for lists and search.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { DiagramMarker, SourceRef, TextLine } from '../core/notation';
import type { Anchor, Issue } from '../core/reconstruct';
import type { NotationLanguage } from '../core/san';
import type { AnalysisResult } from '../engine/engine';

export type Status = 'auto' | 'needs-review' | 'corrected';

export interface BookSettings { language: NotationLanguage | 'auto'; style: 'algebraic' | 'descriptive' | 'auto'; boldMain: 'auto' | 'yes' | 'no'; forceOcr: boolean }

export interface Book {
  id: string;
  title: string; author: string; edition: string; publisher: string; year: string;
  fileName: string; fileSize: number; pageCount: number; addedAt: number;
  status: 'queued' | 'processing' | 'paused' | 'done' | 'error';
  processedPages: number;
  error?: string;
  cover?: Blob;
  settings: BookSettings;
  /** Glyph → piece letters learned from OCR'd figurines. */
  glyphs?: Record<string, string>;
  lastExtract?: number;
}

export interface PageRec {
  key: [string, number]; // [bookId, page]
  bookId: string; page: number;
  status: 'pending' | 'done' | 'error';
  ocr: boolean; garbled: boolean;
  width: number; height: number;
  items: Array<TextLine | DiagramMarker>;
  headings: string[];
  textLength: number;
  error?: string;
}

export interface DiagramRec {
  id: string; bookId: string; page: number;
  rect: [number, number, number, number];
  /** Pieces as printed, rank 8→1 top to bottom on the page (before orientation). */
  visual: string;
  orientation: 'white' | 'black'; orientationCertain: boolean;
  turn: 'w' | 'b' | null;
  fen: string | null;
  conf: number; cellConf: number[];
  status: Status;
  caption?: string;
  source: 'vision' | 'font';
  errors: string[];
  /** Serialized descriptors of occupied squares (for learning from corrections). */
  cells?: Array<{ i: number; d: unknown } | null>;
}

export interface ChapterRec { id: string; bookId: string; index: number; title: string; startPage: number; endPage: number; source: 'outline' | 'heading' | 'manual' | 'whole' }

export interface GameRec {
  id: string; bookId: string | null; chapterId: string | null;
  page: number | null;
  pgn: string;
  white: string; black: string; event: string; date: string; result: string; eco: string; opening: string;
  type: 'game' | 'fragment' | 'imported';
  confidence: number;
  issues: Issue[];
  anchors: Anchor[];
  diagrams: Record<string, string>;
  status: Status;
  firstRef?: SourceRef; lastRef?: SourceRef;
  plies: number;
  /** Edited by the user: re-extraction must not overwrite it. */
  manual: boolean;
  order: number;
  updatedAt: number;
}

export interface PosIndex { id?: number; key: string; placement: string; gameId: string; path: string; bookId: string | null }
export interface EngineCacheRec { key: string; result: AnalysisResult; depth: number; at: number }
export interface Bookmark { id: string; kind: 'game' | 'position' | 'variation' | 'chapter' | 'diagram' | 'page'; bookId?: string; gameId?: string; path?: string; fen?: string; page?: number; chapterId?: string; diagramId?: string; label: string; note: string; createdAt: number }
export interface NoteRec { id: string; bookId?: string; gameId?: string; path?: string; fen?: string; page?: number; text: string; updatedAt: number }
export interface Exercise { id: string; bookId?: string; gameId?: string; path?: string; diagramId?: string; fen: string; solution: string[]; kind: 'best-move' | 'tactic' | 'defence' | 'author-move' | 'predict' | 'mistake'; theme: string; prompt: string; comment?: string; createdAt: number; page?: number }
export interface Attempt { id: string; exerciseId: string; at: number; move: string; correct: boolean; loss: number | null; ms: number; hint: boolean }
export interface TemplateRec { id: string; bookId: string; piece: string; d: unknown }
export interface KV { key: string; value: unknown }

interface Schema extends DBSchema {
  books: { key: string; value: Book };
  files: { key: string; value: { bookId: string; blob: Blob } };
  pages: { key: [string, number]; value: PageRec; indexes: { byBook: string } };
  diagrams: { key: string; value: DiagramRec; indexes: { byBook: string; byPage: [string, number] } };
  chapters: { key: string; value: ChapterRec; indexes: { byBook: string } };
  games: { key: string; value: GameRec; indexes: { byBook: string; byChapter: string } };
  positions: { key: number; value: PosIndex; indexes: { byKey: string; byPlacement: string; byGame: string } };
  engine: { key: string; value: EngineCacheRec };
  bookmarks: { key: string; value: Bookmark };
  notes: { key: string; value: NoteRec; indexes: { byGame: string } };
  exercises: { key: string; value: Exercise; indexes: { byBook: string } };
  attempts: { key: string; value: Attempt; indexes: { byExercise: string } };
  templates: { key: string; value: TemplateRec; indexes: { byBook: string } };
  kv: { key: string; value: KV };
}

let dbp: Promise<IDBPDatabase<Schema>> | null = null;

export function db(): Promise<IDBPDatabase<Schema>> {
  dbp ??= openDB<Schema>('chess-book-reader', 1, {
    upgrade(d) {
      d.createObjectStore('books', { keyPath: 'id' });
      d.createObjectStore('files', { keyPath: 'bookId' });
      d.createObjectStore('pages', { keyPath: 'key' }).createIndex('byBook', 'bookId');
      const dg = d.createObjectStore('diagrams', { keyPath: 'id' });
      dg.createIndex('byBook', 'bookId'); dg.createIndex('byPage', ['bookId', 'page']);
      d.createObjectStore('chapters', { keyPath: 'id' }).createIndex('byBook', 'bookId');
      const g = d.createObjectStore('games', { keyPath: 'id' });
      g.createIndex('byBook', 'bookId'); g.createIndex('byChapter', 'chapterId');
      const p = d.createObjectStore('positions', { keyPath: 'id', autoIncrement: true });
      p.createIndex('byKey', 'key'); p.createIndex('byPlacement', 'placement'); p.createIndex('byGame', 'gameId');
      d.createObjectStore('engine', { keyPath: 'key' });
      d.createObjectStore('bookmarks', { keyPath: 'id' });
      d.createObjectStore('notes', { keyPath: 'id' }).createIndex('byGame', 'gameId');
      d.createObjectStore('exercises', { keyPath: 'id' }).createIndex('byBook', 'bookId');
      d.createObjectStore('attempts', { keyPath: 'id' }).createIndex('byExercise', 'exerciseId');
      d.createObjectStore('templates', { keyPath: 'id' }).createIndex('byBook', 'bookId');
      d.createObjectStore('kv', { keyPath: 'key' });
    },
  });
  return dbp;
}

export const uid = (): string => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const r = await (await db()).get('kv', key);
  return r ? (r.value as T) : fallback;
}
export async function kvSet(key: string, value: unknown): Promise<void> { await (await db()).put('kv', { key, value }); }

/** Delete a book and everything extracted from it (games, diagrams, pages, indexes, exercises…). */
export async function deleteBook(bookId: string): Promise<void> {
  const d = await db();
  const games = await d.getAllFromIndex('games', 'byBook', bookId);
  const tx = d.transaction(['books', 'files', 'pages', 'diagrams', 'chapters', 'games', 'positions', 'exercises', 'attempts', 'templates', 'bookmarks', 'notes'], 'readwrite');
  const delIdx = async (store: 'pages' | 'diagrams' | 'chapters' | 'games' | 'exercises' | 'templates') => {
    let cur = await tx.objectStore(store).index('byBook').openCursor(bookId);
    while (cur) { await cur.delete(); cur = await cur.continue(); }
  };
  await Promise.all([delIdx('pages'), delIdx('diagrams'), delIdx('chapters'), delIdx('templates')]);
  const exIds = (await tx.objectStore('exercises').index('byBook').getAllKeys(bookId)) as string[];
  for (const ex of exIds) {
    let c = await tx.objectStore('attempts').index('byExercise').openCursor(ex);
    while (c) { await c.delete(); c = await c.continue(); }
  }
  await delIdx('exercises');
  for (const g of games) {
    let c = await tx.objectStore('positions').index('byGame').openCursor(g.id);
    while (c) { await c.delete(); c = await c.continue(); }
    let n = await tx.objectStore('notes').index('byGame').openCursor(g.id);
    while (n) { await n.delete(); n = await n.continue(); }
  }
  await delIdx('games');
  let bm = await tx.objectStore('bookmarks').openCursor();
  while (bm) { if (bm.value.bookId === bookId) await bm.delete(); bm = await bm.continue(); }
  await tx.objectStore('files').delete(bookId);
  await tx.objectStore('books').delete(bookId);
  await tx.done;
}
