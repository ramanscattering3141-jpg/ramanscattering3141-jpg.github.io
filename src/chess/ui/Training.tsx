// Active recall: positions the user chose become exercises. Answers are checked against the
// book's move and judged by Stockfish, so a different but equally good move also counts.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Chess } from 'chess.js';
import { db, uid, type Attempt, type Exercise } from '../db/db';
import { Board } from './Board';
import { getEngine, type AnalysisResult } from '../engine/engine';
import { cached, store } from '../engine/cache';
import { formatScore, winPercent } from '../engine/uci';
import { pvToSan, uciToSan } from '../engine/gameAnalysis';
import { getSettings } from './settings';
import { toast } from './toast';

const KINDS: Record<Exercise['kind'], string> = { 'best-move': 'Find the best move', tactic: 'Find the combination', defence: 'Find the defence', 'author-move': "Find the book's move", predict: 'Predict the next move', mistake: 'Spot the mistake' };

export function Training() {
  const [ex, setEx] = useState<Exercise[]>([]);
  const [att, setAtt] = useState<Attempt[]>([]);
  const [active, setActive] = useState<Exercise | null>(null);
  const [filter, setFilter] = useState('all');
  const load = async () => { const d = await db(); setEx(await d.getAll('exercises')); setAtt(await d.getAll('attempts')); };
  useEffect(() => { void load(); }, []);
  const stats = useMemo(() => {
    const tried = new Set(att.map((a) => a.exerciseId));
    const solved = new Set(att.filter((a) => a.correct).map((a) => a.exerciseId));
    const byTheme = new Map<string, { n: number; ok: number }>();
    for (const a of att) {
      const e = ex.find((x) => x.id === a.exerciseId);
      const t = e?.theme || 'Unlabelled';
      const r = byTheme.get(t) ?? { n: 0, ok: 0 };
      r.n++; if (a.correct) r.ok++;
      byTheme.set(t, r);
    }
    return { tried: tried.size, solved: solved.size, acc: att.length ? Math.round((att.filter((a) => a.correct).length / att.length) * 100) : 0, weak: [...byTheme.entries()].filter(([, r]) => r.n >= 2).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).slice(0, 5) };
  }, [ex, att]);
  const list = ex.filter((e) => filter === 'all' || (filter === 'unsolved' ? !att.some((a) => a.exerciseId === e.id && a.correct) : e.kind === filter)).sort((a, b) => b.createdAt - a.createdAt);
  const nextOf = (cur: Exercise) => {
    const pool = list.filter((e) => e.id !== cur.id && !att.some((a) => a.exerciseId === e.id && a.correct));
    return pool[0] ?? null;
  };
  if (active) return <Solve ex={active} onDone={() => void load()} onNext={() => { const n = nextOf(active); setActive(n); if (!n) toast('No more unsolved exercises'); }} onBack={() => { setActive(null); void load(); }} />;
  return (
    <div class="page">
      <h1>Training</h1>
      <p class="muted">Turn positions into exercises from the analysis board (<i>More → Make a training exercise</i>) or from a book's diagram list. Only positions you choose become exercises.</p>
      <div class="stats" style="margin-bottom:1rem">
        <div class="stat"><span class="small muted">Exercises</span><b>{ex.length}</b></div>
        <div class="stat"><span class="small muted">Attempted</span><b>{stats.tried}</b></div>
        <div class="stat"><span class="small muted">Solved</span><b>{stats.solved}</b></div>
        <div class="stat"><span class="small muted">Accuracy</span><b>{stats.acc}%</b></div>
      </div>
      {stats.weak.length > 0 && <div class="notice small" style="margin-bottom:1rem"><b>Weakest themes:</b> {stats.weak.map(([t, r]) => `${t} (${r.ok}/${r.n})`).join(' · ')}</div>}
      <div class="row" style="margin-bottom:.6rem">
        <select class="input" value={filter} onChange={(e) => setFilter((e.target as HTMLSelectElement).value)}>
          <option value="all">All exercises</option><option value="unsolved">Not yet solved</option>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button class="btn primary" disabled={!list.length} onClick={() => setActive(list.find((e) => !att.some((a) => a.exerciseId === e.id && a.correct)) ?? list[0])}>Start</button>
      </div>
      {list.length === 0 ? <div class="empty">No exercises yet.</div> : (
        <table class="list">
          <thead><tr><th>Position</th><th>Task</th><th>Theme</th><th>Attempts</th><th></th></tr></thead>
          <tbody>{list.map((e) => {
            const a = att.filter((x) => x.exerciseId === e.id);
            return (
              <tr key={e.id} class="click" onClick={() => setActive(e)}>
                <td class="small">{e.prompt}{e.page ? <span class="muted"> · p. {e.page}</span> : null}</td>
                <td class="small">{KINDS[e.kind]}</td>
                <td class="small">{e.theme}</td>
                <td>{a.length ? `${a.filter((x) => x.correct).length}/${a.length}` : '—'}</td>
                <td><button class="btn small danger" onClick={async (ev) => { ev.stopPropagation(); await (await db()).delete('exercises', e.id); void load(); }}>Delete</button></td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
      {att.length > 0 && <details style="margin-top:1rem"><summary>History ({att.length} attempts)</summary>
        <table class="list"><tbody>{att.sort((a, b) => b.at - a.at).slice(0, 100).map((a) => <tr key={a.id}><td class="small">{new Date(a.at).toLocaleString()}</td><td>{a.move}</td><td>{a.correct ? <span class="tag good">correct</span> : <span class="tag bad">missed</span>}</td><td class="small">{a.loss !== null ? `−${a.loss.toFixed(0)}% winning chances` : ''}</td></tr>)}</tbody></table>
      </details>}
    </div>
  );
}

function Solve({ ex, onDone, onNext, onBack }: { ex: Exercise; onDone: () => void; onNext: () => void; onBack: () => void }) {
  const [fen, setFen] = useState(ex.fen);
  const [last, setLast] = useState<string | undefined>();
  const [result, setResult] = useState<null | { correct: boolean; move: string; text: string; best: AnalysisResult | null; loss: number | null }>(null);
  const [checking, setChecking] = useState(false);
  const [hint, setHint] = useState(false);
  const [t0] = useState(Date.now());
  useEffect(() => { setFen(ex.fen); setResult(null); setLast(undefined); setHint(false); }, [ex.id]);
  const turn = new Chess(ex.fen).turn();
  const solutionSan = ex.solution[0] ? uciToSan(ex.fen, ex.solution[0]) : null;

  const answer = async (m: { from: string; to: string; promotion?: string }) => {
    if (result || checking) return;
    const c = new Chess(ex.fen);
    let mv;
    try { mv = c.move(m); } catch { return; }
    setFen(c.fen()); setLast(mv.from + mv.to);
    setChecking(true);
    const uci = mv.from + mv.to + (mv.promotion ?? '');
    const s = getSettings();
    const eng = getEngine(s.flavor);
    const depth = Math.max(14, Math.min(s.gameDepth, 20));
    let before = await cached(ex.fen, s.flavor, 3);
    if (!before || before.depth < depth) { before = await eng.analyze(ex.fen, { depth }, 3); await store(before); }
    let after = await cached(c.fen(), s.flavor, 1);
    if (!after || after.depth < depth - 1) { after = await eng.analyze(c.fen(), { depth: depth - 1 }, 1); await store(after); }
    const bestScore = before.lines[0]?.score ?? { cp: 0 };
    const afterScore = after.lines[0]?.score ?? { cp: 0 };
    const w = turn === 'w';
    const loss = Math.max(0, w ? winPercent(bestScore) - winPercent(afterScore) : winPercent(afterScore) - winPercent(bestScore));
    const matchesBook = ex.solution[0] === uci;
    const matchesEngine = before.bestmove === uci;
    // A move counts if it is the book's/engine's move, or loses almost nothing against the best line.
    const correct = matchesBook || matchesEngine || loss <= 4;
    const text = matchesBook ? 'That is the move in the book.' : matchesEngine ? "That is Stockfish's first choice." : correct ? `Also good: it keeps the evaluation (${formatScore(afterScore)}).` : `This drops the evaluation from ${formatScore(bestScore)} to ${formatScore(afterScore)}.`;
    setResult({ correct, move: mv.san, text, best: before, loss });
    setChecking(false);
    await (await db()).put('attempts', { id: uid(), exerciseId: ex.id, at: Date.now(), move: mv.san, correct, loss, ms: Date.now() - t0, hint });
    onDone();
  };

  const hintSq = hint && ex.solution[0] ? [{ orig: ex.solution[0].slice(0, 2) as never, brush: 'green' }] : [];
  return (
    <div class="page">
      <div class="row" style="margin-bottom:.6rem"><button class="btn" onClick={onBack}>← All exercises</button><h2 class="grow" style="margin:0">{KINDS[ex.kind]}</h2></div>
      <div class="ws nolist">
        <section class="center">
          <div class="boardwrap"><Board fen={fen} orientation={turn === 'w' ? 'white' : 'black'} lastMove={last} onMove={answer} viewOnly={!!result || checking} shapes={hintSq} /></div>
        </section>
        <section class="right">
          <div class="panel">
            <h3>Task</h3>
            <div style="font-size:1.1rem"><b>{turn === 'w' ? 'White' : 'Black'} to move.</b> {ex.prompt}</div>
            {ex.theme && <div class="small muted">Theme: {ex.theme}</div>}
            <div class="row" style="margin-top:.6rem">
              {!result && <button class="btn" onClick={() => setHint(true)} disabled={hint || !ex.solution[0]}>Hint</button>}
              {!result && <button class="btn" onClick={() => { const u = ex.solution[0]; if (u) void answer({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); }} disabled={!ex.solution[0]}>Show solution</button>}
              {result && <button class="btn" onClick={() => { setResult(null); setFen(ex.fen); setLast(undefined); }}>Try again</button>}
              <button class="btn primary" onClick={onNext}>Next exercise</button>
            </div>
            {checking && <div class="small muted" style="margin-top:.5rem">Checking with Stockfish…</div>}
          </div>
          {result && (
            <div class={`panel`}>
              <h3>{result.correct ? '✓ Correct' : '✗ Not quite'}</h3>
              <div><b>{result.move}</b> — {result.text}</div>
              {result.loss !== null && <div class="small muted">Change in winning chances: −{result.loss.toFixed(1)} points (Stockfish depth {result.best?.depth}).</div>}
              {solutionSan && <div style="margin-top:.4rem">Book move: <b>{solutionSan}</b></div>}
              {result.best && <div style="margin-top:.4rem"><div class="small muted">Stockfish's best lines:</div>
                {result.best.lines.map((l) => <div key={l.multipv} class="small mono">{formatScore(l.score)} {pvToSan(ex.fen, l.pv, 8).join(' ')}</div>)}</div>}
              {ex.comment && <div class="commentary" style="margin-top:.5rem">{ex.comment}</div>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
