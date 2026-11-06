// Evaluation across the game. The vertical axis is White's winning chances, so the graph shows
// what matters (a swing from +0.5 to −2 looks big, from +8 to +6 does not). Mates are drawn as
// diamonds pinned to the edge; mistakes and blunders are marked.
import type { GameTree, MoveNode } from '../core/tree';
import type { GameAnalysis } from '../engine/gameAnalysis';
import { formatScore, winPercent } from '../engine/uci';

interface Props { tree: GameTree; analysis: GameAnalysis | null; current: MoveNode; onSelect: (n: MoveNode) => void }

export function EvalGraph({ tree, analysis, current, onSelect }: Props) {
  const nodes = [tree.root, ...tree.mainline()];
  const W = 600, H = 140;
  if (!analysis || nodes.length < 2) return <div class="muted small">Run <b>Analyse game</b> to draw the evaluation graph.</div>;
  const x = (i: number) => (i / Math.max(1, nodes.length - 1)) * W;
  const pts = nodes.map((n, i) => { const e = analysis.evals[tree.pathKey(n)]; return e ? { i, n, e, y: H - (winPercent(e.score) / 100) * H } : null; });
  const have = pts.filter(Boolean) as NonNullable<(typeof pts)[number]>[];
  const path = have.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = have.length ? `${path} L${x(have[have.length - 1].i)},${H} L${x(have[0].i)},${H} Z` : '';
  const ci = nodes.indexOf(current);
  const click = (e: MouseEvent) => {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (nodes.length - 1));
    onSelect(nodes[Math.max(0, Math.min(nodes.length - 1, i))]);
  };
  return (
    <div class="graph">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" onClick={click} role="img" aria-label="Evaluation graph; click to go to a move">
        <rect x="0" y="0" width={W} height={H} fill="#3a3a3a" />
        <path d={area} fill="#f2f2ee" />
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#888" stroke-dasharray="4 4" stroke-width="1" />
        <path d={path} fill="none" stroke="#c9a227" stroke-width="1.5" vector-effect="non-scaling-stroke" />
        {ci >= 0 && <line x1={x(ci)} x2={x(ci)} y1="0" y2={H} stroke="#52b788" stroke-width="2" vector-effect="non-scaling-stroke" />}
        {have.map((p) => {
          const v = analysis.verdicts[tree.pathKey(p.n)];
          const mate = p.e.score.mate !== undefined;
          const col = v?.judgement === 'blunder' ? '#e5484d' : v?.judgement === 'mistake' ? '#f08c28' : v?.judgement === 'inaccuracy' ? '#e3c000' : null;
          if (mate) return <path key={p.i} d={`M${x(p.i)},${p.y - 5} l4,5 l-4,5 l-4,-5 z`} fill="#c9a227" stroke="#000" stroke-width=".5"><title>{formatScore(p.e.score)}</title></path>;
          return col ? <circle key={p.i} cx={x(p.i)} cy={p.y} r="3.5" fill={col} stroke="#000" stroke-width=".5"><title>{`${v!.judgement}: ${formatScore(p.e.score)}`}</title></circle> : null;
        })}
      </svg>
      <div class="row small muted" style="justify-content:space-between">
        <span>Stockfish depth {analysis.depth}{analysis.complete ? '' : ' (incomplete)'} · White's winning chances</span>
        <span>◆ forced mate · <span style="color:#e5484d">●</span> blunder <span style="color:#f08c28">●</span> mistake <span style="color:#e3c000">●</span> inaccuracy</span>
      </div>
    </div>
  );
}
