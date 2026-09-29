import type { GraphEdge } from '../content/graph';
import { getNode } from '../content/graph';
import { href } from '../router';
import { EvidenceBadge } from './kit';

/** Renders a knowledge-graph path as a chain: node —mechanism→ node … with the net direction. */
export function CausalPath({ path, startDirection = 1 }: { path: GraphEdge[]; startDirection?: 1 | -1 }) {
  let dir: number = startDirection;
  const first = getNode(path[0]?.from);
  return (
    <ol class="cpath">
      {first && (
        <li class={dir > 0 ? 'up' : 'down'}>
          <span class="arrow">{dir > 0 ? '↑' : '↓'}</span>
          <NodeLink id={first.id} />
        </li>
      )}
      {path.map((e, i) => {
        dir = e.sign === 0 ? 0 : dir * e.sign;
        const n = getNode(e.to);
        return (
          <li key={i} class={dir > 0 ? 'up' : dir < 0 ? 'down' : ''}>
            <span class="mech">
              {e.mechanism} <EvidenceBadge evidence={e.evidence} />
            </span>
            <span class="arrow">{dir > 0 ? '↑' : dir < 0 ? '↓' : '~'}</span>
            {n ? <NodeLink id={n.id} /> : e.to}
          </li>
        );
      })}
    </ol>
  );
}

export function NodeLink({ id }: { id: string }) {
  const n = getNode(id);
  if (!n) return <span>{id}</span>;
  return (
    <a href={href('/graph', { n: id })} title={n.summary}>
      {n.label}
    </a>
  );
}
