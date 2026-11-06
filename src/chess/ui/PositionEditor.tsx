// Board editor: pick a piece from the palette and click squares (click again to clear).
// Used to set up positions and to correct recognised diagrams.
import { useState } from 'preact/hooks';
import { boardFromFen, buildFen, checkPosition, flipBoard, possibleCastling, type Board, type PieceChar } from '../core/fen';

const PAL: Array<PieceChar | ''> = ['K', 'Q', 'R', 'B', 'N', 'P', '', 'k', 'q', 'r', 'b', 'n', 'p', ''];
const key = (p: PieceChar) => `${p === p.toUpperCase() ? 'w' : 'b'}${p.toUpperCase()}`;

interface Props {
  fen: string;
  /** Per-square confidence (rank 8→1, file a→h); low ones are outlined. */
  conf?: number[];
  orientation?: 'white' | 'black';
  turnUnknown?: boolean;
  onSave: (fen: string, extra: { orientation: 'white' | 'black'; board: Board }) => void;
  onCancel?: () => void;
  saveLabel?: string;
  allowFlip?: boolean;
}

export function PositionEditor(p: Props) {
  const parts = p.fen.split(' ');
  const [board, setBoard] = useState<Board>(boardFromFen(p.fen));
  const [turn, setTurn] = useState<'w' | 'b'>((parts[1] as 'w' | 'b') ?? 'w');
  const [castling, setCastling] = useState(parts[2] && parts[2] !== '-' ? parts[2] : '');
  const [ep, setEp] = useState(parts[3] ?? '-');
  const [full, setFull] = useState(Number(parts[5] ?? 1) || 1);
  const [pick, setPick] = useState<PieceChar | ''>('P');
  const [view, setView] = useState<'white' | 'black'>(p.orientation ?? 'white');
  const fen = buildFen(board, { turn, castling: castling || '-', ep, fullmove: full });
  const check = checkPosition(fen);
  const possible = possibleCastling(board);
  const shown = view === 'white' ? board : flipBoard(board);
  const set = (vr: number, vf: number) => {
    const r = view === 'white' ? vr : 7 - vr, f = view === 'white' ? vf : 7 - vf;
    const b = board.map((row) => row.slice());
    b[r][f] = b[r][f] === pick ? '' : pick;
    setBoard(b);
    setCastling((c) => [...c].filter((ch) => possibleCastling(b).includes(ch)).join(''));
  };
  return (
    <div class="row" style="align-items:flex-start;gap:1rem">
      <div class="col" style="flex:1;min-width:260px;max-width:440px">
        <div class="editgrid" role="grid" aria-label="Board editor">
          {shown.map((row, vr) => row.map((pc, vf) => {
            const r = view === 'white' ? vr : 7 - vr, f = view === 'white' ? vf : 7 - vf;
            const low = p.conf && p.conf[r * 8 + f] < 0.5;
            return <div key={`${vr}${vf}`} role="gridcell" aria-label={`${'abcdefgh'[f]}${8 - r} ${pc || 'empty'}`} class={`${(vr + vf) % 2 ? 'd' : ''}${low ? ' low' : ''}${pc ? ` pc-${key(pc)}` : ''}`} onClick={() => set(vr, vf)} />;
          }))}
        </div>
        {p.conf && <div class="small muted">Dashed squares were read with low confidence.</div>}
      </div>
      <div class="col" style="min-width:250px">
        <div class="palette" role="toolbar" aria-label="Pieces">
          {PAL.map((pc, i) => <button key={i} class={`${pc ? `pc-${key(pc)}` : ''}${pick === pc ? ' on' : ''}`} onClick={() => setPick(pc)} aria-label={pc ? key(pc) : 'Eraser'} title={pc ? key(pc) : 'Empty square'}>{pc ? '' : '✕'}</button>)}
        </div>
        <div class="row">
          <label class="field">To move
            <select class="input" value={turn} onChange={(e) => setTurn((e.target as HTMLSelectElement).value as 'w' | 'b')}><option value="w">White</option><option value="b">Black</option></select>
          </label>
          <label class="field">Move number<input class="input" type="number" min={1} value={full} style="width:5rem" onChange={(e) => setFull(Math.max(1, +(e.target as HTMLInputElement).value || 1))} /></label>
          <label class="field">En passant<input class="input" value={ep} style="width:4rem" onChange={(e) => setEp((e.target as HTMLInputElement).value.trim() || '-')} /></label>
        </div>
        {p.turnUnknown && <div class="small tag warn">Side to move was not printed — check it.</div>}
        <div class="row small">Castling:
          {['K', 'Q', 'k', 'q'].map((c) => (
            <label key={c} class="row" style="gap:.2rem"><input type="checkbox" disabled={!possible.includes(c)} checked={castling.includes(c)} onChange={(e) => setCastling((s) => ((e.target as HTMLInputElement).checked ? s + c : s.replace(c, '')).split('').sort((a, b) => 'KQkq'.indexOf(a) - 'KQkq'.indexOf(b)).join(''))} />{{ K: 'White O-O', Q: 'White O-O-O', k: 'Black O-O', q: 'Black O-O-O' }[c]}</label>
          ))}
        </div>
        <div class="row">
          {p.allowFlip !== false && <button class="btn" onClick={() => setView(view === 'white' ? 'black' : 'white')} title="The diagram is printed from Black's side">⇅ {view === 'white' ? 'White at bottom' : 'Black at bottom'}</button>}
          <button class="btn" onClick={() => setBoard(boardFromFen('8/8/8/8/8/8/8/8 w - - 0 1'))}>Clear</button>
          <button class="btn" onClick={() => { const b = boardFromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); setBoard(b); setCastling('KQkq'); }}>Start position</button>
        </div>
        <input class="input mono small" value={fen} aria-label="FEN" onChange={(e) => {
          const v = (e.target as HTMLInputElement).value.trim(); const ps = v.split(/\s+/);
          if (ps[0]?.split('/').length === 8) { setBoard(boardFromFen(v)); setTurn((ps[1] as 'w' | 'b') ?? 'w'); setCastling(ps[2] && ps[2] !== '-' ? ps[2] : ''); setEp(ps[3] ?? '-'); setFull(Number(ps[5]) || 1); }
        }} />
        {check.errors.map((e) => <div class="notice bad small" key={e}>{e}</div>)}
        <div class="row">
          <button class="btn primary" disabled={!check.ok} onClick={() => p.onSave(fen, { orientation: view, board })}>{p.saveLabel ?? 'Use position'}</button>
          {p.onCancel && <button class="btn" onClick={p.onCancel}>Cancel</button>}
        </div>
      </div>
    </div>
  );
}
