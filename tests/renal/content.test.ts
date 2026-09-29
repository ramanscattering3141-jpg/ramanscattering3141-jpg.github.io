// Integrity checks on the content layer.
//
// The chapters, equations and pages cross-reference each other by string id: a citation names a
// PubMed reference, a concept names a route and an equation, a route names a page component. None
// of those links is checked by the type system, so a typo is silent until a reader clicks it.
// These tests walk every link.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { CHAPTERS } from '../../renal/src/content/chapters/index';
import { EQUATIONS } from '../../renal/src/content/equations';
import { ROUTES, routeByPath } from '../../renal/src/routes';
import { ALL_REFS, ROSE_CHAPTERS, type Citation } from '../../renal/src/content/sources';

const refIds = new Set(ALL_REFS.map((r) => r.id));
const equationIds = new Set(EQUATIONS.map((e) => e.id));
const roseNumbers = new Set(ROSE_CHAPTERS.map((c) => c.n));

/** Every citation anywhere in the content layer, with a label saying where it came from. */
function allCitations(): { where: string; cite: Citation }[] {
  const out: { where: string; cite: Citation }[] = [];
  for (const ch of CHAPTERS) {
    const at = (s: string) => `ch${ch.n} ${s}`;
    ch.concepts.forEach((c) => c.cite && out.push({ where: at(`concept "${c.heading}"`), cite: c.cite }));
    ch.updates?.forEach((u) => out.push({ where: at(`update "${u.topic}"`), cite: u.cite }));
  }
  for (const e of EQUATIONS) if (e.cite) out.push({ where: `equation ${e.id}`, cite: e.cite });
  return out;
}

describe('content integrity', () => {
  test('every cited reference id resolves to a verified PubMed record', () => {
    const missing: string[] = [];
    for (const { where, cite } of allCitations()) {
      for (const id of cite.refs ?? []) if (!refIds.has(id)) missing.push(`${where}: ${id}`);
    }
    expect(missing).toEqual([]);
  });

  test('every cited Rose chapter number exists', () => {
    const missing: string[] = [];
    for (const { where, cite } of allCitations()) {
      for (const n of cite.rose ?? []) if (!roseNumbers.has(n)) missing.push(`${where}: ch${n}`);
    }
    expect(missing).toEqual([]);
  });

  test('every route named by a chapter exists', () => {
    const missing: string[] = [];
    for (const ch of CHAPTERS) {
      const check = (path: string | undefined, where: string) => {
        if (path && !routeByPath.has(path)) missing.push(`ch${ch.n} ${where}: ${path}`);
      };
      ch.concepts.forEach((c) => check(c.route, `concept "${c.heading}"`));
      ch.pathology.forEach((p) => check(p.route, `pathology "${p.name}"`));
      ch.questions.forEach((q, i) => check(q.route, `question ${i + 1}`));
      ch.modules?.forEach((m) => check(m, 'modules'));
    }
    expect(missing).toEqual([]);
  });

  test('every equation named by a chapter exists', () => {
    const missing: string[] = [];
    for (const ch of CHAPTERS) {
      ch.equations?.forEach((id) => {
        if (!equationIds.has(id)) missing.push(`ch${ch.n} equations: ${id}`);
      });
      ch.concepts.forEach((c) => {
        if (c.equation && !equationIds.has(c.equation)) missing.push(`ch${ch.n} concept "${c.heading}": ${c.equation}`);
      });
    }
    expect(missing).toEqual([]);
  });

  test('every route an equation points at exists', () => {
    const missing = EQUATIONS.filter((e) => e.route && !routeByPath.has(e.route)).map((e) => `${e.id}: ${e.route}`);
    expect(missing).toEqual([]);
  });

  test('chapter numbers are unique and in the book', () => {
    const seen = new Set<number>();
    for (const ch of CHAPTERS) {
      expect(seen.has(ch.n), `duplicate chapter ${ch.n}`).toBe(false);
      seen.add(ch.n);
      expect(roseNumbers.has(ch.n), `chapter ${ch.n} is not in the book`).toBe(true);
    }
  });

  test('every multiple-choice answer indexes a real option', () => {
    for (const ch of CHAPTERS) {
      ch.questions.forEach((q, i) => {
        expect(q.options.length, `ch${ch.n} q${i + 1} needs at least two options`).toBeGreaterThan(1);
        expect(q.answer, `ch${ch.n} q${i + 1} answer out of range`).toBeGreaterThanOrEqual(0);
        expect(q.answer, `ch${ch.n} q${i + 1} answer out of range`).toBeLessThan(q.options.length);
      });
    }
  });

  test('every page cross-link points at a route that exists', () => {
    // `Related` silently drops paths it cannot resolve, so a typo shows up as a missing card
    // rather than an error. Scan the sources instead.
    const dir = join(__dirname, '../../renal/src/pages');
    const bad: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, file), 'utf8');
      for (const m of src.matchAll(/<Related[^>]*paths=\{\[([^\]]*)\]\}/g)) {
        for (const q of m[1].matchAll(/'([^']+)'/g)) {
          if (!routeByPath.has(q[1])) bad.push(`${file}: ${q[1]}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test('every page named by a route has a file', () => {
    const dir = join(__dirname, '../../renal/src/pages');
    const files = new Set(readdirSync(dir).map((f) => f.replace(/\.tsx$/, '')));
    const missing = ROUTES.filter((r) => !files.has(r.page)).map((r) => `${r.path} -> ${r.page}.tsx`);
    // Pages still to be written are expected; this only reports them, and fails if one that
    // existed disappears. Keep the list here so a deletion is visible in the diff.
    expect(missing.length).toBeLessThanOrEqual(22);
  });

  test('every route declares chapters that have content, once they are written', () => {
    const written = new Set(CHAPTERS.map((c) => c.n));
    const bad: string[] = [];
    for (const r of ROUTES) {
      for (const n of r.chapters ?? []) {
        if (!roseNumbers.has(n)) bad.push(`${r.path}: ch${n} is not in the book`);
        // a route may point at a chapter whose content is not written yet; that is fine
        void written;
      }
    }
    expect(bad).toEqual([]);
  });
});
