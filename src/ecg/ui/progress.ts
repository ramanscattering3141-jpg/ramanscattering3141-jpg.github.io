// Per-browser learning progress (which diagnosis pages the learner has marked as reviewed).
// Stored in localStorage only; the app works normally when storage is unavailable.

import { storageGet, storageSet } from './dom';

const KEY = 'ecg.progress.reviewed';

export function reviewedSet(): Set<string> {
  const v = storageGet<string[]>(KEY, []);
  return new Set(Array.isArray(v) ? v : []);
}

export function isReviewed(id: string): boolean {
  return reviewedSet().has(id);
}

export function setReviewed(id: string, on: boolean): void {
  const s = reviewedSet();
  if (on) s.add(id);
  else s.delete(id);
  storageSet(KEY, [...s]);
}

export function resetProgress(): void {
  storageSet(KEY, []);
}
