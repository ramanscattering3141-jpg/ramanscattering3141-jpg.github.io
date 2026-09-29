import { useMemo, useState } from 'preact/hooks';
import { causalAnswer, nodesInQuery, search, upstream, type Hit, type HitKind } from '../content/search';
import { href, navigate } from '../router';
import { readyRoute } from '../routes';
import { Panel } from '../ui/kit';
import { CausalPath, NodeLink } from '../ui/CausalPath';
import { NODE_KIND_LABEL } from '../content/graph';

const KIND_LABEL: Record<HitKind, string> = { module: 'Simulators & modules', node: 'Concepts & mechanisms', equation: 'Equations', concept: 'Textbook explanations', segment: 'Anatomy' };
const EXAMPLES = ['why does loop diuretic cause hypokalemia', 'why is urine concentrated', 'why does ACE inhibitor increase creatinine', 'SIADH', 'anion gap', 'Bartter syndrome', 'why does vomiting cause metabolic alkalosis'];

export default function Search({ query }: { query: URLSearchParams }) {
  const q0 = query.get('q') ?? '';
  const [q, setQ] = useState(q0);
  const hits = useMemo(() => search(q0), [q0]);
  const causal = useMemo(() => (q0 ? causalAnswer(q0) : null), [q0]);
  const topNode = useMemo(() => (q0 && !causal ? nodesInQuery(q0)[0] : undefined), [q0, causal]);
  const causes = useMemo(() => (topNode && /\bwhy\b/i.test(q0) ? upstream(topNode.id, 2) : []), [topNode, q0]);
  const groups = (['module', 'node', 'equation', 'concept', 'segment'] as HitKind[]).map((k) => [k, hits.filter((h) => h.doc.kind === k)] as [HitKind, Hit[]]);

  return (
    <div>
      <header class="page-head">
        <div class="eyebrow">Search</div>
        <h1>Search the physiology</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate('/search', { q });
          }}
          role="search"
          style={{ display: 'flex', gap: 8, maxWidth: 720 }}
        >
          <input type="search" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} placeholder="Try: why does loop diuretic cause hypokalemia" aria-label="Search query" autoFocus />
          <button class="primary" type="submit">
            Search
          </button>
        </form>
        <div class="chips" style={{ marginTop: 8 }}>
          {EXAMPLES.map((e) => (
            <a key={e} class="tag" href={href('/search', { q: e })}>
              {e}
            </a>
          ))}
        </div>
      </header>

      {causal && (
        <Panel title={`How ${causal.from.label} leads to ${causal.to.label}`} note="Causal paths through the knowledge graph. Each arrow shows the direction of change if the first item increases (↑ amber, ↓ blue).">
          <div class="grid grid-2">
            {causal.paths.map((p, i) => (
              <div key={i} class="chain-box">
                <h4>Path {i + 1}</h4>
                <CausalPath path={p} />
              </div>
            ))}
          </div>
          <p class="muted" style={{ marginTop: 10, fontSize: '0.85rem' }}>
            {readyRoute('/tutor') && (
              <>
                Ask the <a href={href('/tutor', { q: q0 })}>AI tutor</a> for a full explanation.{' '}
              </>
            )}
            {causal.from.route && readyRoute(causal.from.route) && (
              <>
                Open <a href={href(causal.from.route)}>the {causal.from.label} simulator</a>.
              </>
            )}
          </p>
        </Panel>
      )}

      {topNode && causes.length > 0 && (
        <Panel title={`What determines ${topNode.label}?`} note="Direct and second-order causes from the knowledge graph.">
          <ul>
            {causes.map(({ edge, depth }) => (
              <li key={edge.from + edge.to} style={{ marginLeft: (depth - 1) * 18 }}>
                <NodeLink id={edge.from} /> {edge.sign > 0 ? 'raises' : edge.sign < 0 ? 'lowers' : 'modulates'} <NodeLink id={edge.to} />
                <span class="muted" style={{ fontSize: '0.83rem' }}> — {edge.mechanism}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {q0 && hits.length === 0 && <p class="muted">Nothing matched “{q0}”. Try a transporter, hormone, disease, drug or lab value.</p>}

      {groups
        .filter(([, hs]) => hs.length)
        .map(([k, hs]) => (
          <Panel key={k} title={KIND_LABEL[k]}>
            <div class="results">
              {hs.slice(0, 10).map((h) => (
                <a key={h.doc.id} class="result" href={h.doc.route ? href(h.doc.route, h.doc.query) : undefined}>
                  <strong>{h.doc.title}</strong>
                  {h.doc.sub && <span class="tag">{h.doc.kind === 'node' ? NODE_KIND_LABEL[h.doc.sub as keyof typeof NODE_KIND_LABEL] ?? h.doc.sub : h.doc.sub}</span>}
                  <span class="muted">{h.doc.text.length > 220 ? h.doc.text.slice(0, 220) + '…' : h.doc.text}</span>
                </a>
              ))}
            </div>
          </Panel>
        ))}
    </div>
  );
}
