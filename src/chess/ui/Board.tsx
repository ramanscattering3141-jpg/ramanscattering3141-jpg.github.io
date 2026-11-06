// Chessground board driven by chess.js legality: only legal moves can be made, promotion asks
// which piece, and drag-and-drop and click-click both work (touch included).
import { useEffect, useRef, useState } from 'preact/hooks';
import { Chessground } from '@lichess-org/chessground';
import type { Api } from '@lichess-org/chessground/api';
import type { Key } from '@lichess-org/chessground/types';
import type { DrawShape } from '@lichess-org/chessground/draw';
import { Chess, SQUARES } from 'chess.js';

export interface BoardProps {
  fen: string;
  orientation: 'white' | 'black';
  lastMove?: string; // uci
  onMove?: (m: { from: string; to: string; promotion?: string }) => void;
  shapes?: DrawShape[];
  viewOnly?: boolean;
  coords?: boolean;
}

function dests(fen: string): Map<Key, Key[]> {
  const c = new Chess(fen);
  const m = new Map<Key, Key[]>();
  for (const s of SQUARES) {
    const ms = c.moves({ square: s, verbose: true });
    if (ms.length) m.set(s as Key, ms.map((x) => x.to as Key));
  }
  return m;
}

export function Board(p: BoardProps) {
  const el = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const onMove = useRef(p.onMove);
  onMove.current = p.onMove;
  const [promo, setPromo] = useState<{ from: string; to: string; color: 'w' | 'b' } | null>(null);

  useEffect(() => {
    if (!el.current) return;
    api.current = Chessground(el.current, { animation: { duration: 160 }, highlight: { lastMove: true, check: true }, drawable: { enabled: true } });
    return () => api.current?.destroy();
  }, []);

  useEffect(() => {
    const c = new Chess(p.fen);
    const turn = c.turn() === 'w' ? 'white' : 'black';
    api.current?.set({
      fen: p.fen, orientation: p.orientation, turnColor: turn, check: c.inCheck() ? turn : false,
      lastMove: p.lastMove ? [p.lastMove.slice(0, 2) as Key, p.lastMove.slice(2, 4) as Key] : undefined,
      coordinates: p.coords !== false, viewOnly: !!p.viewOnly,
      movable: {
        free: false, color: p.viewOnly ? undefined : turn, dests: p.viewOnly ? new Map() : dests(p.fen), showDests: true,
        events: {
          after: (from: Key, to: Key) => {
            const piece = c.get(from as never);
            if (piece?.type === 'p' && (to[1] === '8' || to[1] === '1')) { setPromo({ from, to, color: piece.color }); return; }
            onMove.current?.({ from, to });
          },
        },
      },
      drawable: { autoShapes: p.shapes ?? [] },
    });
  }, [p.fen, p.orientation, p.lastMove, p.viewOnly, p.coords, JSON.stringify(p.shapes ?? [])]);

  return (
    <div class="boardbox">
      <div ref={el} class="cg-wrap" />
      {promo && (
        <div class="promo" onClick={() => { setPromo(null); api.current?.set({ fen: p.fen }); }}>
          <div role="dialog" aria-label="Choose promotion piece">
            {(['q', 'r', 'b', 'n'] as const).map((r) => (
              <button key={r} class={`pc-${promo.color}${r.toUpperCase()}`} aria-label={{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[r]}
                onClick={(e) => { e.stopPropagation(); setPromo(null); onMove.current?.({ from: promo.from, to: promo.to, promotion: r }); }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
