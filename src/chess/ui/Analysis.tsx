// The analysis workspace: board, move tree with variations, engine, evaluation graph,
// commentary and position information. Used on its own and inside the study view.
import type { ComponentChildren } from 'preact';
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { GameTree, positionStatus, type MoveNode } from '../core/tree';
import { parsePgn, writePgn } from '../core/pgn';
import { materialCount } from '../core/fen';
import { NAG_NAMES } from '../core/nag';
import { Board } from './Board';
import { MoveList } from './MoveList';
import { EnginePanel, useLiveEngine } from './EnginePanel';
import { EvalGraph } from './EvalGraph';
import { PositionEditor } from './PositionEditor';
import { Modal } from './Modal';
import { useSettings } from './settings';
import { copy, download, toast } from './toast';
import { analyzeGame, annotateTree, loadGameAnalysis, pvToSan, type GameAnalysis } from '../engine/gameAnalysis';
import { formatScore, winPercent, graphValue } from '../engine/uci';
import { db, kvSet, uid, type GameRec } from '../db/db';
import { saveGame, treeOf } from '../db/games';

export interface AnalysisApi { tree: GameTree; current: MoveNode; select: (n: MoveNode) => void }

interface Props {
  game?: GameRec | null;
  initialPgn?: string;
  initialFen?: string;
  /** Path key to show first (and whenever `jumpNonce` changes). */
  jump?: { path: string; nonce: number } | null;
  onCurrent?: (api: AnalysisApi) => void;
  left?: ComponentChildren;
  compact?: boolean;
}

export function Analysis(p: Props) {
  const s = useSettings();
  const [tree, setTree] = useState<GameTree>(() => (p.game ? treeOf(p.game) : p.initialPgn ? parsePgn(p.initialPgn)[0]?.tree ?? new GameTree() : new GameTree(p.initialFen)));
  const [current, setCurrent] = useState<MoveNode>(tree.root);
  const [version, setVersion] = useState(0);
  const [flip, setFlip] = useState(false);
  const [engineOn, setEngineOn] = useState(false);
  const [ga, setGa] = useState<GameAnalysis | null>(null);
  const [gaProgress, setGaProgress] = useState<string | null>(null);
  const stopGa = useRef({ stop: false });
  const [modal, setModal] = useState<null | 'fen' | 'pgn' | 'setup' | 'headers'>(null);
  const rec = useRef<GameRec | null>(p.game ?? null);
  const dirty = useRef(false);

  // Load a different game when the record changes.
  useEffect(() => {
    if (!p.game || p.game.id === rec.current?.id && version > 0) return;
    rec.current = p.game;
    const t = treeOf(p.game);
    setTree(t); setCurrent(t.root); setGa(null); setVersion((v) => v + 1);
    void loadGameAnalysis(p.game.id).then((a) => { if (a && rec.current?.id === p.game!.id) setGa(a); });
  }, [p.game?.id]);

  useEffect(() => {
    if (!p.jump) return;
    const n = tree.findByPathKey(p.jump.path);
    if (n) setCurrent(n);
  }, [p.jump?.nonce, tree]);

  const select = useCallback((n: MoveNode) => setCurrent(n), []);
  useEffect(() => { p.onCurrent?.({ tree, current, select }); }, [current, tree, version]);

  const changed = () => {
    setVersion((v) => v + 1);
    dirty.current = true;
    if (rec.current) {
      const r = rec.current;
      window.clearTimeout((changed as unknown as { t?: number }).t);
      (changed as unknown as { t?: number }).t = window.setTimeout(async () => {
        try { rec.current = await saveGame({ ...r, manual: true, status: r.status }, tree); dirty.current = false; } catch (e) { toast(`Not saved: ${(e as Error).message}`); }
      }, 700);
    }
  };

  const play = (m: string | { from: string; to: string; promotion?: string }, from = current) => {
    try {
      const n = tree.addMove(from, m);
      setCurrent(n); changed();
      return n;
    } catch { return null; }
  };

  const playUci = (ucis: string[]) => {
    let n = current;
    for (const u of ucis) {
      const next = (() => { try { return tree.addMove(n, { from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return null; } })();
      if (!next) break;
      n = next;
    }
    if (n !== current) { setCurrent(ucis.length > 1 ? current.children.find((c) => c.uci === ucis[0]) ?? n : n); changed(); }
  };

  // Navigation
  const back = () => current.parent && setCurrent(current.parent);
  const fwd = () => current.children[0] && setCurrent(current.children[0]);
  const first = () => setCurrent(tree.root);
  const last = () => setCurrent(tree.lineEnd(current));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.key === 'ArrowLeft') { back(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { fwd(); e.preventDefault(); }
      else if (e.key === 'ArrowUp' || e.key === 'Home') { first(); e.preventDefault(); }
      else if (e.key === 'ArrowDown' || e.key === 'End') { last(); e.preventDefault(); }
      else if (e.key === 'f') setFlip((f) => !f);
      else if (e.key === ' ' && !e.repeat) { setEngineOn((o) => !o); e.preventDefault(); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });
  useEffect(() => { document.querySelector('.moves .mv.cur')?.scrollIntoView({ block: 'nearest' }); }, [current]);

  const live = useLiveEngine(current.fen, engineOn);
  const st = positionStatus(tree, current);
  const mat = materialCount(current.fen);
  const orientation = flip ? 'black' : 'white';
  const bestShapes = useMemo(() => {
    if (!s.showArrows || !live.res?.lines.length || live.res.fen !== current.fen) return [];
    return live.res.lines.slice(0, 3).filter((l) => l.pv[0]).map((l, i) => ({ orig: l.pv[0].slice(0, 2) as never, dest: l.pv[0].slice(2, 4) as never, brush: i === 0 ? 'paleBlue' : 'paleGrey' }));
  }, [live.res, current.fen, s.showArrows]);

  const runGameAnalysis = async () => {
    if (gaProgress) { stopGa.current.stop = true; return; }
    stopGa.current = { stop: false };
    setGaProgress('starting');
    try {
      const a = await analyzeGame(tree, { gameId: rec.current?.id, depth: s.gameDepth, flavor: s.flavor, signal: stopGa.current, onProgress: (d, t, partial) => { setGaProgress(`${d}/${t}`); setGa({ ...partial }); } });
      setGa(a);
      toast(a.complete ? 'Game analysed' : 'Analysis stopped');
    } catch (e) { toast(`Analysis failed: ${(e as Error).message}`); }
    setGaProgress(null);
  };

  const annotate = () => {
    if (!ga) return;
    const n = annotateTree(tree, ga, formatScore);
    changed();
    toast(n ? `Added engine comments to ${n} move${n > 1 ? 's' : ''}` : 'No mistakes to annotate');
  };

  const exportPgn = () => download(`${pgnName(tree)}.pgn`, writePgn(tree));

  const saveAsNew = async () => {
    const r = await saveGame({ ...(rec.current ?? blank()), id: uid(), manual: true, type: rec.current?.type ?? 'imported', bookId: rec.current?.bookId ?? null, chapterId: rec.current?.chapterId ?? null }, tree);
    rec.current = r;
    toast('Saved to your library');
    location.hash = `#/analysis/${r.id}`;
  };

  const bookmark = async () => {
    const d = await db();
    const label = `${tree.headers.White && tree.headers.White !== '?' ? `${tree.headers.White} – ${tree.headers.Black}` : 'Position'}${current.parent ? ` after ${moveLabel(current)}` : ''}`;
    await d.put('bookmarks', { id: uid(), kind: current.parent ? (tree.isMainline(current) ? 'position' : 'variation') : 'game', bookId: rec.current?.bookId ?? undefined, gameId: rec.current?.id, path: tree.pathKey(current), fen: current.fen, page: rec.current?.page ?? undefined, label, note: '', createdAt: Date.now() });
    toast('Bookmarked');
  };

  const makeExercise = async () => {
    const next = current.children[0];
    const best = live.res?.fen === current.fen ? live.res.bestmove : null;
    const solution = next ? [next.uci] : best ? [best] : [];
    if (!solution.length) { toast('Play the solution move first, or let the engine find one'); return; }
    const d = await db();
    await d.put('exercises', {
      id: uid(), bookId: rec.current?.bookId ?? undefined, gameId: rec.current?.id, path: tree.pathKey(current), fen: current.fen, solution,
      kind: next ? 'author-move' : 'best-move', theme: tree.headers.Opening ?? '', prompt: `${st.turn === 'w' ? 'White' : 'Black'} to move${next ? ' — find the move played in the book' : ' — find the best move'}`,
      comment: next?.comment, createdAt: Date.now(), page: rec.current?.page ?? undefined,
    });
    toast('Exercise added to Training');
  };

  // Book move vs engine.
  const bookMove = current.children[0];
  const compare = (() => {
    if (!bookMove || !live.res || live.res.fen !== current.fen || !live.res.lines.length) return null;
    const best = live.res.lines[0];
    const inLines = live.res.lines.find((l) => l.pv[0] === bookMove.uci);
    return { bestSan: pvToSan(current.fen, best.pv, 1)[0], best: best.score, book: inLines?.score ?? null, same: best.pv[0] === bookMove.uci, depth: live.res.depth };
  })();
  const gaBook = bookMove ? ga?.verdicts[tree.pathKey(bookMove)] : undefined;
  const nodeEval = ga?.evals[tree.pathKey(current)];
  const barVal = live.res?.fen === current.fen && live.res.lines[0] ? live.res.lines[0].score : nodeEval?.score;
  const lastUci = current.uci || undefined;

  return (
    <div class={`ws${p.left ? '' : ' nolist'}`}>
      {p.left && <aside class="left">{p.left}</aside>}
      <section class="center" aria-label="Board">
        <Captured fen={current.fen} side={flip ? 'w' : 'b'} diff={flip ? mat.diff : -mat.diff} />
        <div class="boardwrap">
          <div class={`evalbar${flip ? ' flip' : ''}`} title={barVal ? formatScore(barVal) : 'No evaluation yet'} aria-hidden="true">
            <i style={`height:${barVal ? winPercent(barVal) : 50}%`} />
          </div>
          <Board fen={current.fen} orientation={orientation} lastMove={lastUci} onMove={(m) => play(m)} shapes={bestShapes} coords={s.coords} />
        </div>
        <Captured fen={current.fen} side={flip ? 'b' : 'w'} diff={flip ? -mat.diff : mat.diff} />
        <div class="controls" role="toolbar" aria-label="Move navigation">
          <button class="btn icon" onClick={first} aria-label="Start" title="Start (↑)">⏮</button>
          <button class="btn icon" onClick={back} aria-label="Back" title="Back (←)" disabled={!current.parent}>◀</button>
          <button class="btn icon" onClick={fwd} aria-label="Forward" title="Forward (→)" disabled={!current.children.length}>▶</button>
          <button class="btn icon" onClick={last} aria-label="End" title="End of line (↓)">⏭</button>
          <button class="btn icon" onClick={() => setFlip(!flip)} aria-label="Flip board" title="Flip board (f)">⇅</button>
          <button class="btn" onClick={() => copy(current.fen, 'FEN')} title="Copy FEN">FEN</button>
          <button class="btn" onClick={() => copy(writePgn(tree), 'PGN')} title="Copy PGN">PGN</button>
          <Menu label="More">
            <button class="btn" onClick={() => setModal('fen')}>Load FEN…</button>
            <button class="btn" onClick={() => setModal('pgn')}>Load PGN…</button>
            <button class="btn" onClick={() => setModal('setup')}>Set up position…</button>
            <button class="btn" onClick={() => setModal('headers')}>Game details…</button>
            <button class="btn" onClick={exportPgn}>Download PGN</button>
            <button class="btn" onClick={() => download(`position-${current.ply}.fen`, current.fen + '\n', 'text/plain')}>Download FEN</button>
            <button class="btn" onClick={bookmark}>Bookmark this position</button>
            <button class="btn" onClick={makeExercise}>Make a training exercise</button>
            {!rec.current && <button class="btn" onClick={saveAsNew}>Save game to library</button>}
            {current.parent && !tree.isMainline(current) && <button class="btn" onClick={() => { tree.promote(current); changed(); }}>Promote variation</button>}
            {current.parent && <button class="btn danger" onClick={() => { const par = current.parent!; tree.remove(current); setCurrent(par); changed(); }}>Delete from here</button>}
            <button class="btn" onClick={() => { const t = new GameTree(); setTree(t); setCurrent(t.root); setGa(null); rec.current = null; setVersion((v) => v + 1); location.hash = '#/analysis'; }}>New board</button>
          </Menu>
        </div>
        <div class="posinfo" aria-live="polite">
          <span><b>{st.turn === 'w' ? 'White' : 'Black'}</b> to move</span>
          <span>Move <b>{current.fen.split(' ')[5]}</b></span>
          {st.checkmate ? <span class="tag bad">Checkmate</span> : st.check ? <span class="tag warn">Check</span> : null}
          {st.stalemate && <span class="tag">Stalemate</span>}
          {st.insufficient && <span class="tag">Insufficient material</span>}
          {st.threefold && <span class="tag">Threefold repetition</span>}
          {st.fiftyMove && <span class="tag">50-move rule</span>}
          <span>Material <b>{mat.diff === 0 ? 'equal' : `${mat.diff > 0 ? 'White' : 'Black'} +${Math.abs(mat.diff)}`}</b></span>
        </div>
      </section>
      <section class="right">
        <EnginePanel fen={current.fen} on={engineOn} onToggle={() => setEngineOn(!engineOn)} res={live.res?.fen === current.fen ? live.res : null} running={live.running} error={live.error} onPlay={playUci} />
        <section class="panel" aria-label="Commentary">
          <h3>Commentary</h3>
          {current.startComment && <div class="commentary">{current.startComment}</div>}
          {current.nags.length > 0 && <div class="small">{current.nags.map((g) => NAG_NAMES[g]).filter(Boolean).join(' · ')}</div>}
          {current.comment ? <div class="commentary">{current.comment}</div> : <div class="muted small">{current.parent ? 'No comment on this move.' : (tree.root.comment ? '' : 'No introduction.')}</div>}
          {!current.parent && tree.root.comment && <div class="commentary">{tree.root.comment}</div>}
          {current.meta?.flag && <div class="notice warn small" style="margin-top:.4rem">Read from the book with a repair: {current.meta.flag}. Printed as “{current.meta.raw}”.</div>}
          {bookMove && (compare || gaBook) && (
            <div class="notice small" style="margin-top:.5rem">
              <b>Book:</b> {moveLabel(bookMove)}{' '}
              {compare && (compare.same ? <span class="tag good">engine agrees (d{compare.depth})</span> :
                <>· <b>Engine:</b> {compare.bestSan} {formatScore(compare.best)}{compare.book ? `, book move ${formatScore(compare.book)}` : ', book move not in the engine’s top lines'} (d{compare.depth})</>)}
              {!compare && gaBook && (gaBook.playedBest ? <span class="tag good">engine’s choice (d{ga!.depth})</span> : <> · engine preferred {gaBook.bestSan}; {gaBook.judgement !== 'good' ? <span class={`tag ${gaBook.judgement === 'inaccuracy' ? 'warn' : 'bad'}`}>{gaBook.judgement}</span> : 'small difference'} (d{ga!.depth})</>)}
            </div>
          )}
          <details style="margin-top:.5rem"><summary class="small muted">Edit comment</summary>
            <textarea class="input" rows={3} style="font-family:var(--serif)" value={current.comment ?? ''} onChange={(e) => { current.comment = (e.target as HTMLTextAreaElement).value || undefined; changed(); }} />
          </details>
        </section>
        {p.game?.issues?.length ? <IssuesNote game={p.game} /> : null}
      </section>
      <section class="bottom">
        <div class="panel">
          <h3>Moves {rec.current && <span class="tag">{dirty.current ? 'saving…' : 'saved'}</span>}</h3>
          <MoveList tree={tree} current={current} onSelect={select} verdicts={ga?.verdicts} version={version} />
        </div>
        <div class="panel">
          <h3>Evaluation
            <span class="grow" />
            <button class="btn" onClick={runGameAnalysis}>{gaProgress ? `Stop (${gaProgress})` : ga ? 'Re-analyse game' : 'Analyse game'}</button>
            {ga && !gaProgress && <button class="btn" onClick={annotate} title="Write blunders, mistakes and the engine's lines into the game">Annotate</button>}
          </h3>
          <EvalGraph tree={tree} analysis={ga} current={current} onSelect={select} />
          {ga && <Summary tree={tree} ga={ga} onSelect={select} />}
          {nodeEval && <div class="small muted">This position: {formatScore(nodeEval.score)} at depth {nodeEval.depth} (bar: {graphValue(nodeEval.score).toFixed(1)})</div>}
        </div>
      </section>
      {modal === 'fen' && <LoadText title="Load FEN" placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1" onClose={() => setModal(null)} onLoad={(t) => {
        try { const g = new GameTree(t.trim()); setTree(g); setCurrent(g.root); setGa(null); rec.current = null; setVersion((v) => v + 1); setModal(null); } catch (e) { toast(`Invalid FEN: ${(e as Error).message}`); }
      }} />}
      {modal === 'pgn' && <LoadText title="Load PGN" big placeholder="Paste a PGN, or choose a file" file=".pgn,text/plain" onClose={() => setModal(null)} onLoad={(t) => {
        const games = parsePgn(t);
        if (!games.length) { toast('No game found in that PGN'); return; }
        const g = games[0];
        if (g.errors.length) toast(`Loaded with problems: ${g.errors[0].message}`);
        setTree(g.tree); setCurrent(g.tree.root); setGa(null); rec.current = null; setVersion((v) => v + 1); setModal(null);
        if (games.length > 1) toast(`This file has ${games.length} games; the first is shown. Import the file from the Library to keep all of them.`);
      }} />}
      {modal === 'setup' && <Modal title="Set up a position" onClose={() => setModal(null)} wide><PositionEditor fen={current.fen} onCancel={() => setModal(null)} onSave={(f) => { const g = new GameTree(f); setTree(g); setCurrent(g.root); setGa(null); rec.current = null; setVersion((v) => v + 1); setModal(null); }} /></Modal>}
      {modal === 'headers' && <Headers tree={tree} onClose={() => setModal(null)} onSave={() => { changed(); setModal(null); }} />}
    </div>
  );
}

function blank(): GameRec {
  return { id: uid(), bookId: null, chapterId: null, page: null, pgn: '', white: '', black: '', event: '', date: '', result: '*', eco: '', opening: '', type: 'imported', confidence: 1, issues: [], anchors: [], diagrams: {}, status: 'auto', plies: 0, manual: true, order: Date.now(), updatedAt: Date.now() };
}

export function moveLabel(n: MoveNode): string {
  const num = Math.floor((n.ply - 1) / 2) + 1;
  return `${num}${n.ply % 2 === 1 ? '.' : '…'}${n.san}`;
}

function pgnName(t: GameTree) {
  const h = t.headers;
  return h.White && h.White !== '?' ? `${h.White}-${h.Black}${h.Date ? `-${h.Date.slice(0, 4)}` : ''}` : 'game';
}

function Captured({ fen, side, diff }: { fen: string; side: 'w' | 'b'; diff: number }) {
  // Pieces the other side has lost, shown next to the player who took them.
  const m = materialCount(fen);
  const start: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const opp = side === 'w' ? m.b : m.w;
  const oppColor = side === 'w' ? 'b' : 'w';
  const list: string[] = [];
  for (const k of ['q', 'r', 'b', 'n', 'p']) for (let i = 0; i < Math.max(0, start[k] - opp[k]); i++) list.push(k);
  return (
    <div class="captured" aria-label={`${side === 'w' ? 'White' : 'Black'} has captured`}>
      {list.map((k, i) => <span key={i} class={`pc pc-${oppColor}${k.toUpperCase()}`} />)}
      {diff > 0 && <span>+{diff}</span>}
    </div>
  );
}

function Summary({ tree, ga, onSelect }: { tree: GameTree; ga: GameAnalysis; onSelect: (n: MoveNode) => void }) {
  const rows = tree.mainline().map((n) => ({ n, v: ga.verdicts[tree.pathKey(n)] })).filter((x) => x.v && ['blunder', 'mistake', 'inaccuracy'].includes(x.v.judgement));
  const count = (side: number, j: string) => rows.filter((r) => r.n.ply % 2 === side && r.v!.judgement === j).length;
  if (!Object.keys(ga.verdicts).length) return null;
  return (
    <div class="small" style="margin-top:.4rem">
      <table class="list"><thead><tr><th></th><th>Inaccuracies</th><th>Mistakes</th><th>Blunders</th></tr></thead>
        <tbody><tr><td>White</td><td>{count(1, 'inaccuracy')}</td><td>{count(1, 'mistake')}</td><td>{count(1, 'blunder')}</td></tr>
          <tr><td>Black</td><td>{count(0, 'inaccuracy')}</td><td>{count(0, 'mistake')}</td><td>{count(0, 'blunder')}</td></tr></tbody></table>
      <div class="row" style="margin-top:.3rem">{rows.map(({ n, v }) => <button class="btn small" key={n.id} onClick={() => onSelect(n)} title={`Best was ${v!.bestSan}`}>{moveLabel(n)} <span class={`tag ${v!.judgement === 'inaccuracy' ? 'warn' : 'bad'}`}>{v!.judgement}</span></button>)}</div>
    </div>
  );
}

function IssuesNote({ game }: { game: GameRec }) {
  const real = game.issues.filter((i) => i.kind !== 'repaired');
  return (
    <section class="panel">
      <h3>Extraction notes</h3>
      <div class="small">{real.length ? `${real.length} problem${real.length > 1 ? 's' : ''} where the book text could not be turned into legal moves.` : 'All moves were read and checked.'} {game.issues.length - real.length > 0 && `${game.issues.length - real.length} move(s) needed an OCR repair (underlined in the move list).`}</div>
      {real.slice(0, 6).map((i, k) => <div key={k} class="notice warn small" style="margin-top:.3rem">p. {i.ref.page}: {i.message}{i.at !== undefined ? ` (after ${i.at || 'the start'})` : ''}</div>)}
      {game.bookId && <a class="small" href={`#/review/${game.bookId}/game/${game.id}`}>Correct this game →</a>}
    </section>
  );
}

function Menu({ label, children }: { label: string; children: ComponentChildren }) {
  const [open, setOpen] = useState(false);
  return (
    <span style="position:relative">
      <button class="btn" aria-expanded={open} onClick={() => setOpen(!open)}>{label} ▾</button>
      {open && <div class="card col" style="position:absolute;right:0;top:110%;z-index:30;padding:.4rem;min-width:220px" onClick={() => setOpen(false)}>{children}</div>}
    </span>
  );
}

export function LoadText({ title, placeholder, onLoad, onClose, big, file }: { title: string; placeholder: string; onLoad: (t: string) => void; onClose: () => void; big?: boolean; file?: string }) {
  const [t, setT] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <textarea class="input" rows={big ? 12 : 2} placeholder={placeholder} value={t} onInput={(e) => setT((e.target as HTMLTextAreaElement).value)} />
      <div class="row" style="margin-top:.5rem">
        <button class="btn primary" onClick={() => onLoad(t)} disabled={!t.trim()}>Load</button>
        {file && <label class="btn">Choose file…<input type="file" accept={file} class="sr" onChange={async (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onLoad(await f.text()); }} /></label>}
      </div>
    </Modal>
  );
}

function Headers({ tree, onClose, onSave }: { tree: GameTree; onClose: () => void; onSave: () => void }) {
  const keys = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'ECO', 'Opening', 'Annotator', 'Source', 'Page', 'Chapter'];
  const [h, setH] = useState<Record<string, string>>({ ...tree.headers });
  return (
    <Modal title="Game details" onClose={onClose}>
      <div class="row" style="align-items:flex-end">
        {keys.map((k) => <label class="field" key={k} style="min-width:180px;flex:1">{k}<input class="input" value={h[k] ?? ''} onInput={(e) => setH({ ...h, [k]: (e.target as HTMLInputElement).value })} /></label>)}
      </div>
      <div class="row" style="margin-top:.6rem"><button class="btn primary" onClick={() => { for (const k of keys) { if (h[k]) tree.headers[k] = h[k]; else delete tree.headers[k]; } onSave(); }}>Save</button></div>
    </Modal>
  );
}

// Keep the "continue where you left off" pointer up to date.
export function rememberPlace(place: Record<string, unknown>) { void kvSet('last', { ...place, at: Date.now() }); }

