import type { JSX } from 'preact';
import type { GameTree, MoveNode } from '../core/tree';
import { NAG_SYMBOLS } from '../core/nag';
import type { MoveVerdict } from '../engine/gameAnalysis';

interface Props { tree: GameTree; current: MoveNode; onSelect: (n: MoveNode) => void; verdicts?: Record<string, MoveVerdict>; version: number }

export function MoveList({ tree, current, onSelect, verdicts }: Props) {
  const label = (n: MoveNode, force: boolean) => {
    const num = Math.floor((n.ply - 1) / 2) + 1;
    return n.ply % 2 === 1 ? `${num}.` : force ? `${num}…` : '';
  };
  const mv = (n: MoveNode, force: boolean): JSX.Element => {
    const v = verdicts?.[tree.pathKey(n)];
    const lab = label(n, force);
    return (
      <>
        {lab && <span class="num">{lab}</span>}
        <span class={`mv${n === current ? ' cur' : ''}${n.meta?.flag ? ' flag' : ''}${v && v.judgement !== 'good' && v.judgement !== 'best' ? ` j-${v.judgement}` : ''}`}
          onClick={() => onSelect(n)} title={n.meta?.flag ?? (v ? `${v.judgement}${v.bestSan && !v.playedBest ? ` — best was ${v.bestSan}` : ''}` : undefined)}
          role="button" tabIndex={-1} data-path={tree.pathKey(n)}>
          {n.san}{n.nags.map((g) => <span class="nag" key={g}>{NAG_SYMBOLS[g] ?? ''}</span>)}
        </span>{' '}
        {n.comment && <span class="cmt">{n.comment}</span>}
      </>
    );
  };
  const line = (from: MoveNode, force: boolean, depth: number): JSX.Element[] => {
    const out: JSX.Element[] = [];
    let node = from;
    let need = force;
    while (node.children.length) {
      const main = node.children[0];
      if (main.startComment) out.push(<span class="cmt">{main.startComment}</span>);
      out.push(<span key={main.id}>{mv(main, need)}</span>);
      need = !!main.comment;
      for (const alt of node.children.slice(1)) {
        out.push(
          <span class="var" key={`v${alt.id}`}>
            {alt.startComment && <span class="cmt">{alt.startComment}</span>}
            {mv(alt, true)}
            {line(alt, !!alt.comment, depth + 1)}
          </span>,
        );
        need = true;
      }
      node = main;
    }
    return out;
  };
  return (
    <div class="moves" aria-label="Moves">
      {tree.root.comment && <div class="cmt" style="display:block;margin-bottom:.3rem">{tree.root.comment}</div>}
      {tree.size() === 0 ? <span class="muted">No moves yet. Make a move on the board.</span> : line(tree.root, tree.root.ply % 2 === 1, 0)}
      {tree.headers.Result && tree.headers.Result !== '*' && <b> {tree.headers.Result}</b>}
    </div>
  );
}
