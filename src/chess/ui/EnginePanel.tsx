import { useEffect, useRef, useState } from 'preact/hooks';
import { getEngine, FLAVORS, canUseThreads, type AnalysisResult, type SearchLimits } from '../engine/engine';
import { cached, store } from '../engine/cache';
import { formatScore } from '../engine/uci';
import { pvToSan } from '../engine/gameAnalysis';
import { setSettings, useSettings, type Settings } from './settings';

export function limitsOf(s: Settings): SearchLimits {
  return s.mode === 'depth' ? { depth: s.depth } : s.mode === 'time' ? { movetime: s.movetime } : { infinite: true };
}

/** Live analysis of `fen` while `on` is true; cached results show at once and are replaced as the search deepens. */
export function useLiveEngine(fen: string, on: boolean) {
  const s = useSettings();
  const [res, setRes] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const cur = useRef(fen);
  cur.current = fen;
  useEffect(() => {
    if (!on) { setRunning(false); const e = getEngine(s.flavor); void e.stop(); return; }
    let alive = true;
    const engine = getEngine(s.flavor);
    setRes(null);
    void (async () => {
      try {
        await engine.ready;
        if (s.threads && engine.maxThreads > 1 && s.threads !== engine.threads) await engine.configure({ threads: s.threads });
        if (s.hash !== engine.hash) await engine.configure({ hash: s.hash });
        const c = await cached(fen, s.flavor, s.multipv);
        if (alive && c && cur.current === fen) setRes(c);
        const lim = limitsOf(s);
        if (c && lim.depth && c.depth >= lim.depth) return;
        setRunning(true);
        const r = await engine.analyze(fen, lim, s.multipv, (u) => { if (alive && cur.current === fen && (!c || u.depth >= c.depth || u.terminal)) setRes(u); });
        if (!r.superseded) await store(r);
        if (alive && cur.current === fen) setRunning(false);
      } catch (e) { if (alive) { setError((e as Error).message); setRunning(false); } }
    })();
    return () => { alive = false; };
  }, [fen, on, s.flavor, s.mode, s.depth, s.movetime, s.multipv, s.threads, s.hash]);
  return { res, running, error };
}

interface Props {
  fen: string; on: boolean; onToggle: () => void;
  res: AnalysisResult | null; running: boolean; error: string | null;
  onPlay: (uci: string[]) => void;
}

export function EnginePanel({ fen, on, onToggle, res, running, error, onPlay }: Props) {
  const s = useSettings();
  const [open, setOpen] = useState(false);
  const top = res?.lines[0];
  const engineName = FLAVORS[s.flavor].label;
  return (
    <section class="panel" aria-label="Engine">
      <h3>
        <button class={`switch${on ? ' on' : ''}`} onClick={onToggle} aria-pressed={on} aria-label="Engine on/off" />
        Stockfish
        <span class="grow" />
        <button class="btn icon" onClick={() => setOpen(!open)} aria-expanded={open} title="Engine settings">⚙</button>
      </h3>
      {open && <EngineSettings />}
      {error && <div class="notice bad small">Engine error: {error}</div>}
      {!on && !res && <div class="muted small">Switch on for a live evaluation of the board position. {engineName}.</div>}
      {res && (
        <>
          <div class="eng-head">
            <span class="eng-score" title={res.terminal ? '' : 'Positive = White is better, negative = Black is better; M = forced mate'}>
              {res.terminal === 'checkmate' ? 'Checkmate' : res.terminal ? 'Draw' : top ? formatScore(top.score) : '…'}
            </span>
            <span class="muted small">
              {res.terminal ? (res.terminal === 'stalemate' ? 'stalemate' : res.terminal === 'insufficient' ? 'insufficient material' : 'no engine search needed') :
                top ? describeScore(top.score) : ''}
            </span>
          </div>
          {!res.terminal && (
            <div class="eng-meta">
              depth {res.depth}{running ? '…' : ''} · {fmtNodes(res.nodes)} nodes · {fmtNodes(res.nps)}/s · {res.settings.multipv} line{res.settings.multipv > 1 ? 's' : ''} · {res.settings.threads} thread{res.settings.threads > 1 ? 's' : ''} · {res.settings.hash} MB
              {running ? ' · thinking' : res.done ? ' · finished' : ''}
              {!running && res.depth < 18 && <span class="tag warn" style="margin-left:.4rem">shallow search</span>}
            </div>
          )}
          <div class="eng-lines">
            {res.lines.map((l) => {
              const sans = pvToSan(res.fen, l.pv, 14);
              return (
                <div class="eng-line" key={l.multipv} onClick={() => onPlay(l.pv.slice(0, 1))} title="Click to play the first move; double-click to add the whole line" onDblClick={() => onPlay(l.pv.slice(0, sans.length))}>
                  <span class="sc">{formatScore(l.score)}</span>
                  <span class="pv">{sans.length ? <><b>{numbered(res.fen, sans)[0]}</b> {numbered(res.fen, sans).slice(1).join(' ')}</> : ''}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
      {on && !res && !error && <div class="muted small">Starting {engineName}…</div>}
      <span class="sr" aria-live="polite">{res && top && !running ? `Evaluation ${formatScore(top.score)} at depth ${res.depth}` : ''}</span>
    </section>
  );
}

export function describeScore(sc: { cp?: number; mate?: number }): string {
  if (sc.mate !== undefined) return sc.mate === 0 ? 'checkmate' : `${sc.mate > 0 ? 'White' : 'Black'} mates in ${Math.abs(sc.mate)}`;
  const cp = sc.cp ?? 0;
  if (Math.abs(cp) < 25) return 'about equal';
  return `${cp > 0 ? 'White' : 'Black'} is about ${(Math.abs(cp) / 100).toFixed(2)} pawns better`;
}

function numbered(fen: string, sans: string[]): string[] {
  const parts = fen.split(' ');
  let num = Number(parts[5]);
  let white = parts[1] === 'w';
  return sans.map((s, i) => {
    const lab = white ? `${num}.${s}` : i === 0 ? `${num}…${s}` : s;
    if (!white) num++;
    white = !white;
    return lab;
  });
}

function fmtNodes(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}G`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

export function EngineSettings() {
  const s = useSettings();
  const threadsOk = canUseThreads();
  return (
    <div class="col" style="margin-bottom:.6rem;padding:.6rem;background:var(--panel-2);border-radius:8px">
      <div class="row">
        <label class="field grow">Engine
          <select class="input" value={s.flavor} onChange={(e) => setSettings({ flavor: (e.target as HTMLSelectElement).value as Settings['flavor'] })}>
            {(Object.keys(FLAVORS) as Array<keyof typeof FLAVORS>).filter((f) => f !== 'full').map((f) => (
              <option value={f} key={f} disabled={FLAVORS[f].threads && !threadsOk}>{FLAVORS[f].label} — {FLAVORS[f].size}{FLAVORS[f].threads && !threadsOk ? ' (needs isolation)' : ''}</option>
            ))}
          </select>
        </label>
      </div>
      <div class="row">
        <label class="field">Search
          <select class="input" value={s.mode} onChange={(e) => setSettings({ mode: (e.target as HTMLSelectElement).value as Settings['mode'] })}>
            <option value="infinite">Until stopped</option><option value="depth">To a depth</option><option value="time">For a time</option>
          </select>
        </label>
        {s.mode === 'depth' && <label class="field">Depth<input class="input" type="number" min={1} max={60} value={s.depth} style="width:5rem" onChange={(e) => setSettings({ depth: clamp(+(e.target as HTMLInputElement).value, 1, 60) })} /></label>}
        {s.mode === 'time' && <label class="field">Seconds<input class="input" type="number" min={0.1} max={600} step={0.5} value={s.movetime / 1000} style="width:5rem" onChange={(e) => setSettings({ movetime: clamp(+(e.target as HTMLInputElement).value * 1000, 100, 600000) })} /></label>}
        <label class="field">Lines (MultiPV)<input class="input" type="number" min={1} max={5} value={s.multipv} style="width:5rem" onChange={(e) => setSettings({ multipv: clamp(+(e.target as HTMLInputElement).value, 1, 5) })} /></label>
        <label class="field">Hash (MB)<select class="input" value={s.hash} onChange={(e) => setSettings({ hash: +(e.target as HTMLSelectElement).value })}>{[16, 32, 64, 128, 256].map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
        <label class="field">Threads<input class="input" type="number" min={1} max={32} value={s.threads || ''} placeholder="auto" disabled={!FLAVORS[s.flavor].threads} style="width:5rem" onChange={(e) => setSettings({ threads: clamp(+(e.target as HTMLInputElement).value, 1, 32) })} /></label>
      </div>
      {!threadsOk && <div class="small muted">Multi-threaded builds need a cross-origin isolated page. Turn on “Multi-threaded engine” in Settings and reload.</div>}
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => (Number.isFinite(v) ? Math.max(a, Math.min(b, v)) : a);
