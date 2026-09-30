// Search across every layer of the laboratory: modules, knowledge-graph nodes, equations,
// textbook concepts and nephron anatomy. A question phrased as "why does X cause Y" is also
// answered causally, by finding the paths between X and Y in the knowledge graph.

import { EDGES, NODES, getNode, type GraphEdge, type GraphNode } from './graph';
import { EQUATIONS } from './equations';
import { CHAPTERS } from './chapters';
import { SEGMENT_INFO, STRUCTURES } from './segments';
import { ROUTES, isReady, readyRoute } from '../routes';

export type HitKind = 'module' | 'node' | 'equation' | 'concept' | 'segment';

export interface SearchDoc {
  id: string;
  kind: HitKind;
  title: string;
  text: string;
  route?: string;
  /** extra query string for the route (e.g. textbook chapter) */
  query?: Record<string, string>;
  tags: string[];
  nodeId?: string;
  sub?: string;
}

const STOP = new Set(
  'a an the of to in on and or is are be does do did why how what when which that this it its as by for with from into at can cause causes caused make makes lead leads result results happen happens occur occurs there than then i me my you your we our will would should could'.split(
    ' ',
  ),
);

/** Normalise British/American spelling and strip simple suffixes. */
export function normaliseWord(w: string): string {
  let s = w
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[⁺⁻₀₁₂₃₄₅₆₇₈₉²³]/g, '')
    .replace(/[^a-z0-9]/g, '');
  s = s
    .replace(/aem/g, 'em')
    .replace(/oedem/g, 'edem')
    .replace(/haem/g, 'hem')
    .replace(/oes/g, 'es')
    .replace(/isation/g, 'ization')
    .replace(/yse/g, 'yze');
  for (const suf of ['ations', 'ation', 'ings', 'ing', 'ities', 'ity', 'ies', 'ed', 'es', 's']) {
    if (s.length > suf.length + 3 && s.endsWith(suf)) {
      s = s.slice(0, -suf.length);
      break;
    }
  }
  return s;
}

export function tokens(text: string): string[] {
  return text
    .split(/[\s,.;:()/–—-]+/)
    .map((w) => w.trim())
    .filter((w) => w && !STOP.has(w.toLowerCase()))
    .map(normaliseWord)
    .filter((w) => w.length > 1);
}

let docsCache: SearchDoc[] | null = null;

export function buildDocs(): SearchDoc[] {
  if (docsCache) return docsCache;
  const docs: SearchDoc[] = [];
  for (const r of ROUTES) {
    if (r.path === '/search' || !isReady(r)) continue;
    docs.push({ id: `route:${r.path}`, kind: 'module', title: r.title, text: r.blurb, route: r.path, tags: [...(r.keywords ?? []), ...(r.nodes ?? []).map((n) => getNode(n)?.label ?? '')] });
  }
  for (const n of NODES) {
    docs.push({ id: `node:${n.id}`, kind: 'node', title: n.label, text: n.summary, route: n.route && readyRoute(n.route) ? n.route : undefined, tags: n.aliases ?? [], nodeId: n.id, sub: n.kind });
  }
  for (const e of EQUATIONS) {
    // until the equation explorer is written, an equation leads to the module that uses it
    const explorer = !!readyRoute('/equations');
    const route = explorer ? '/equations' : e.route && readyRoute(e.route) ? e.route : undefined;
    docs.push({ id: `eq:${e.id}`, kind: 'equation', title: e.name, text: `${e.formula}. ${e.explain}`, route, query: explorer ? { eq: e.id } : undefined, tags: e.keywords ?? [], sub: e.group });
  }
  for (const ch of CHAPTERS) {
    ch.concepts.forEach((c, i) => {
      docs.push({
        id: `concept:${ch.n}:${i}`,
        kind: 'concept',
        title: c.heading,
        text: c.body.join(' ') + ' ' + (c.points ?? []).join(' ') + ' ' + (c.chain ?? []).join(' '),
        route: '/textbook',
        query: { ch: String(ch.n) },
        tags: [],
        sub: `Chapter ${ch.n}: ${ch.title}`,
      });
    });
  }
  for (const s of Object.values(SEGMENT_INFO)) {
    docs.push({
      id: `seg:${s.id}`,
      kind: 'segment',
      title: s.name,
      text: [s.tagline, ...s.handles, s.waterPermeability, s.drivingForce].join(' '),
      route: '/nephron',
      query: { s: s.id },
      tags: [...s.transporters.map((t) => t.name), ...s.diuretics, ...s.disorders, ...s.hormones],
    });
  }
  for (const s of STRUCTURES) {
    docs.push({ id: `struct:${s.id}`, kind: 'segment', title: s.name, text: [s.tagline, ...s.detail].join(' '), route: '/nephron', query: { s: s.id }, tags: [] });
  }
  docsCache = docs;
  return docs;
}

interface Indexed {
  doc: SearchDoc;
  title: Set<string>;
  tags: Set<string>;
  body: Map<string, number>;
  phrases: string;
}

let index: Indexed[] | null = null;
function getIndex(): Indexed[] {
  if (index) return index;
  index = buildDocs().map((doc) => {
    const body = new Map<string, number>();
    for (const t of tokens(doc.text)) body.set(t, (body.get(t) ?? 0) + 1);
    return {
      doc,
      title: new Set(tokens(doc.title)),
      tags: new Set(doc.tags.flatMap(tokens)),
      body,
      phrases: [doc.title, ...doc.tags].join(' | ').toLowerCase(),
    };
  });
  return index;
}

export interface Hit {
  doc: SearchDoc;
  score: number;
}

export function search(query: string, limit = 40): Hit[] {
  const qt = tokens(query);
  if (!qt.length) return [];
  const qLower = query.toLowerCase();
  const hits: Hit[] = [];
  for (const ix of getIndex()) {
    let score = 0;
    let matched = 0;
    for (const t of qt) {
      let s = 0;
      if (ix.title.has(t)) s += 6;
      if (ix.tags.has(t)) s += 4;
      const b = ix.body.get(t);
      if (b) s += Math.min(3, 1 + Math.log(b));
      if (!s && t.length > 4) {
        // prefix match (e.g. "natriur" in "natriuresis")
        for (const w of ix.title) if (w.startsWith(t) || t.startsWith(w)) s += w.length > 3 ? 3 : 0;
      }
      if (s) matched++;
      score += s;
    }
    if (!matched) continue;
    // Reward documents that match most of the query, and exact phrase hits.
    score *= 0.4 + 0.6 * (matched / qt.length);
    if (ix.phrases.includes(qLower.trim())) score += 8;
    const kindBoost: Record<HitKind, number> = { node: 1.15, module: 1.1, equation: 1, concept: 0.9, segment: 1 };
    hits.push({ doc: ix.doc, score: score * kindBoost[ix.doc.kind] });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

// ---------------------------------------------------------------- causal answers

/** Nodes the query mentions, best first. */
export function nodesInQuery(query: string): GraphNode[] {
  return search(query, 60)
    .filter((h) => h.doc.kind === 'node')
    .map((h) => getNode(h.doc.nodeId!)!)
    .filter(Boolean);
}

/** All simple paths from → to up to maxDepth edges (shortest first). */
export function allPaths(from: string, to: string, maxDepth = 6, limit = 5): GraphEdge[][] {
  const out: GraphEdge[][] = [];
  const byFrom = new Map<string, GraphEdge[]>();
  for (const e of EDGES) (byFrom.get(e.from) ?? byFrom.set(e.from, []).get(e.from)!).push(e);
  // Iterative deepening so shorter explanations come first.
  for (let depth = 1; depth <= maxDepth && out.length < limit; depth++) {
    const walk = (node: string, trail: GraphEdge[], seen: Set<string>) => {
      if (out.length >= limit) return;
      if (trail.length === depth) {
        if (node === to) out.push([...trail]);
        return;
      }
      for (const e of byFrom.get(node) ?? []) {
        if (seen.has(e.to)) continue;
        seen.add(e.to);
        trail.push(e);
        walk(e.to, trail, seen);
        trail.pop();
        seen.delete(e.to);
      }
    };
    walk(from, [], new Set([from]));
  }
  return out;
}

/** Causes of a node, walking the graph backwards. */
export function upstream(id: string, depth = 2): { edge: GraphEdge; depth: number }[] {
  const out: { edge: GraphEdge; depth: number }[] = [];
  const seen = new Set([id]);
  let frontier = [id];
  for (let d = 1; d <= depth; d++) {
    const next: string[] = [];
    for (const n of frontier) {
      for (const e of EDGES.filter((x) => x.to === n)) {
        if (seen.has(e.from)) continue;
        seen.add(e.from);
        out.push({ edge: e, depth: d });
        next.push(e.from);
      }
    }
    frontier = next;
  }
  return out;
}

export interface CausalAnswer {
  from: GraphNode;
  to: GraphNode;
  paths: GraphEdge[][];
}

const CAUSE_KINDS = new Set(['drug', 'disease', 'transporter', 'hormone', 'concept', 'wholeBody', 'organ', 'segment', 'force']);

/** Try to read the query as "why does A lead to B" and return the causal paths. */
export function causalAnswer(query: string): CausalAnswer | null {
  const nodes = nodesInQuery(query).slice(0, 6);
  if (nodes.length < 2) return null;
  let best: CausalAnswer | null = null;
  for (const a of nodes) {
    if (!CAUSE_KINDS.has(a.kind)) continue;
    for (const b of nodes) {
      if (a.id === b.id) continue;
      const paths = allPaths(a.id, b.id, 7, 4);
      if (!paths.length) continue;
      // prefer answers whose endpoints both ranked highly and whose path is short
      const rank = nodes.indexOf(a) + nodes.indexOf(b) + paths[0].length * 0.3;
      if (!best || rank < (best as CausalAnswer & { rank: number }).rank) best = Object.assign({ from: a, to: b, paths }, { rank });
    }
  }
  return best;
}

/** Net direction of change along a path, relative to an increase in its first node. */
export function pathSign(path: GraphEdge[]): 1 | -1 | 0 {
  let s: number = 1;
  for (const e of path) s *= e.sign;
  return s as 1 | -1 | 0;
}
