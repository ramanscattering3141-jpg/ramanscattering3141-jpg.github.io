// Stockfish running in a Web Worker, spoken to over UCI. One search at a time: a new request
// stops the running search first. Positions that are already over never reach the engine.
import { Chess } from 'chess.js';
import { parseInfo, type PvLine, type Score } from './uci';
import { vendorUrl } from '../paths';

export type Flavor = 'lite-single' | 'lite' | 'full-single' | 'full';

export const FLAVORS: Record<Flavor, { file: string; label: string; size: string; threads: boolean }> = {
  'lite-single': { file: 'stockfish-19-lite-single.js', label: 'Stockfish 19 lite (single thread)', size: '1.8 MB', threads: false },
  lite: { file: 'stockfish-19-lite.js', label: 'Stockfish 19 lite (multi-threaded)', size: '1.7 MB', threads: true },
  'full-single': { file: 'stockfish-19-single.js', label: 'Stockfish 19 full NNUE (single thread)', size: '99 MB', threads: false },
  full: { file: 'stockfish-19.js', label: 'Stockfish 19 full NNUE (multi-threaded)', size: '99 MB', threads: true },
};

export interface SearchLimits { depth?: number; movetime?: number; nodes?: number; infinite?: boolean }

export interface AnalysisResult {
  fen: string;
  lines: PvLine[];
  depth: number;
  nodes: number;
  nps: number;
  time: number;
  bestmove: string | null;
  done: boolean;
  /** Search settings, shown next to every evaluation so a shallow search is never taken as final. */
  settings: { flavor: Flavor; multipv: number; threads: number; hash: number; limits: SearchLimits };
  /** Set for positions that are already decided (mate/stalemate); no search was run. */
  terminal?: 'checkmate' | 'stalemate' | 'insufficient';
}

export function canUseThreads(): boolean {
  return typeof SharedArrayBuffer !== 'undefined' && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
}

/** Result for a finished position, or null if the engine is needed. */
export function terminalResult(fen: string, settings: AnalysisResult['settings']): AnalysisResult | null {
  const c = new Chess(fen);
  let score: Score | null = null;
  let terminal: AnalysisResult['terminal'];
  if (c.isCheckmate()) { score = { mate: 0, winner: c.turn() === 'w' ? 'b' : 'w' }; terminal = 'checkmate'; }
  else if (c.isStalemate()) { score = { cp: 0 }; terminal = 'stalemate'; }
  else if (c.isInsufficientMaterial()) { score = { cp: 0 }; terminal = 'insufficient'; }
  if (!score) return null;
  return { fen, lines: [{ multipv: 1, depth: 0, score, pv: [] }], depth: 0, nodes: 0, nps: 0, time: 0, bestmove: null, done: true, settings, terminal };
}

type Waiter = { test: (l: string) => boolean; resolve: (l: string) => void };

export class Engine {
  readonly flavor: Flavor;
  private worker: Worker;
  private waiters: Waiter[] = [];
  private lineHandler: ((l: string) => void) | null = null;
  private busy: Promise<void> = Promise.resolve();
  private searching = false;
  private stopRequested = false;
  threads = 1;
  maxThreads = 1;
  hash = 64;
  multipv = 1;
  name = '';
  ready: Promise<void>;

  constructor(flavor: Flavor) {
    this.flavor = flavor;
    this.worker = new Worker(vendorUrl(`stockfish/${FLAVORS[flavor].file}`));
    this.worker.onmessage = (e: MessageEvent) => this.onLine(String(e.data));
    this.worker.onerror = (e) => { console.error('Stockfish worker error', e.message); };
    this.ready = this.init();
  }

  private onLine(line: string) {
    for (const w of [...this.waiters]) if (w.test(line)) { this.waiters.splice(this.waiters.indexOf(w), 1); w.resolve(line); }
    this.lineHandler?.(line);
  }

  private send(cmd: string) { this.worker.postMessage(cmd); }

  private waitFor(test: (l: string) => boolean, timeoutMs = 60000): Promise<string> {
    return new Promise((resolve, reject) => {
      const w: Waiter = { test, resolve: (l) => { clearTimeout(t); resolve(l); } };
      const t = setTimeout(() => { this.waiters.splice(this.waiters.indexOf(w), 1); reject(new Error('Engine did not answer')); }, timeoutMs);
      this.waiters.push(w);
    });
  }

  private async init() {
    const opts: string[] = [];
    const prev = this.lineHandler;
    this.lineHandler = (l) => { if (l.startsWith('option ')) opts.push(l); if (l.startsWith('id name ')) this.name = l.slice(8); };
    this.send('uci');
    await this.waitFor((l) => l === 'uciok', 120000);
    this.lineHandler = prev;
    const th = opts.find((o) => /name Threads /.test(o));
    const max = th ? Number(/max (\d+)/.exec(th)?.[1] ?? 1) : 1;
    this.maxThreads = FLAVORS[this.flavor].threads && canUseThreads() ? Math.min(max, navigator.hardwareConcurrency || 2) : 1;
    this.threads = Math.max(1, Math.min(this.maxThreads, (navigator.hardwareConcurrency || 2) - 1));
    if (this.maxThreads > 1) this.send(`setoption name Threads value ${this.threads}`);
    this.send(`setoption name Hash value ${this.hash}`);
    this.send('setoption name UCI_ShowWDL value false');
    await this.isReady();
  }

  private async isReady() { this.send('isready'); await this.waitFor((l) => l === 'readyok'); }

  async configure(o: { threads?: number; hash?: number }) {
    await this.ready;
    await this.stop();
    if (o.threads && this.maxThreads > 1) { this.threads = Math.max(1, Math.min(this.maxThreads, o.threads)); this.send(`setoption name Threads value ${this.threads}`); }
    if (o.hash) { this.hash = o.hash; this.send(`setoption name Hash value ${o.hash}`); }
    await this.isReady();
  }

  async newGame() { await this.ready; await this.stop(); this.send('ucinewgame'); await this.isReady(); }

  /** Stop the running search (if any) and wait until the engine has reported its best move. */
  async stop(): Promise<void> {
    if (!this.searching) return;
    this.stopRequested = true;
    this.send('stop');
    await this.busy;
  }

  /**
   * Analyse a position. `onUpdate` receives the lines as they deepen (throttled); the promise
   * resolves with the final result once the search ends (limit reached or stopped).
   */
  async analyze(fen: string, limits: SearchLimits, multipv: number, onUpdate?: (r: AnalysisResult) => void): Promise<AnalysisResult> {
    await this.ready;
    await this.stop();
    const settings = { flavor: this.flavor, multipv, threads: this.threads, hash: this.hash, limits };
    const term = terminalResult(fen, settings);
    if (term) { onUpdate?.(term); return term; }
    const whiteToMove = fen.split(' ')[1] === 'w';
    const lines = new Map<number, PvLine>();
    const res: AnalysisResult = { fen, lines: [], depth: 0, nodes: 0, nps: 0, time: 0, bestmove: null, done: false, settings };
    let last = 0;
    let finish!: () => void;
    this.busy = new Promise<void>((r) => { finish = r; });
    this.searching = true;
    this.stopRequested = false;
    if (multipv !== this.multipv) { this.send(`setoption name MultiPV value ${multipv}`); this.multipv = multipv; }
    await this.isReady();
    return new Promise<AnalysisResult>((resolve) => {
      this.lineHandler = (l) => {
        if (l.startsWith('info ')) {
          const pv = parseInfo(l, whiteToMove);
          if (!pv || pv.bound) return; // bound scores are provisional; wait for the exact one
          // A new depth for PV 1 starts a fresh set of lines.
          if (pv.multipv === 1 && pv.depth > res.depth) {
            for (const [k, v] of lines) if (v.depth < pv.depth - 1) lines.delete(k);
          }
          lines.set(pv.multipv, pv);
          res.depth = Math.max(res.depth, lines.get(1)?.depth ?? 0);
          res.nodes = pv.nodes ?? res.nodes; res.nps = pv.nps ?? res.nps; res.time = pv.time ?? res.time;
          res.lines = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          const now = performance.now();
          if (onUpdate && now - last > 120) { last = now; onUpdate({ ...res }); }
        } else if (l.startsWith('bestmove')) {
          res.bestmove = l.split(/\s+/)[1] ?? null;
          if (res.bestmove === '(none)') res.bestmove = null;
          res.done = true;
          res.lines = [...lines.values()].sort((a, b) => a.multipv - b.multipv);
          this.lineHandler = null;
          this.searching = false;
          onUpdate?.({ ...res });
          finish();
          resolve(res);
        }
      };
      this.send(`position fen ${fen}`);
      const parts: string[] = ['go'];
      if (limits.infinite) parts.push('infinite');
      else {
        if (limits.depth) parts.push('depth', String(limits.depth));
        if (limits.movetime) parts.push('movetime', String(limits.movetime));
        if (limits.nodes) parts.push('nodes', String(limits.nodes));
        if (parts.length === 1) parts.push('depth', '18');
      }
      this.send(parts.join(' '));
    });
  }

  get isSearching() { return this.searching; }
  get wasStopped() { return this.stopRequested; }

  terminate() { this.worker.terminate(); this.searching = false; }
}

let shared: Engine | null = null;

/** The app-wide engine instance, recreated when the flavour changes. */
export function getEngine(flavor: Flavor): Engine {
  if (shared && shared.flavor === flavor) return shared;
  shared?.terminate();
  shared = new Engine(flavor);
  return shared;
}
