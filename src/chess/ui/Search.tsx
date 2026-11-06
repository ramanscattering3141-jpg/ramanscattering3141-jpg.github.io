// Library search: text fields, opening, result, exact position (transpositions included),
// move sequence, motifs in the commentary and engine evaluation.
import { useEffect, useState } from 'preact/hooks';
import { Chess } from 'chess.js';
import { db, type Book, type GameRec } from '../db/db';
import { positionKey, placementKey } from '../core/fen';
import { loadGameAnalysis } from '../engine/gameAnalysis';
import { winPercent } from '../engine/uci';
import { gameTitle } from './Study';
import { useRoute, go } from './router';

interface Hit { g: GameRec; path?: string; why: string }

export function Search() {
  const r = useRoute();
  const [q, setQ] = useState({ text: r.query.get('q') ?? '', player: '', opening: '', eco: '', book: '', chapter: '', page: '', result: '', fen: r.query.get('fen') ?? '', sameSide: true, moves: '', motif: '', evalMin: '', evalMax: '' });
  const [books, setBooks] = useState<Book[]>([]);
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void db().then((d) => d.getAll('books')).then(setBooks); }, []);
  useEffect(() => { if (r.query.get('q') !== null || r.query.get('fen')) void run(); }, []);

  const run = async () => {
    setErr(null);
    const d = await db();
    let games = await d.getAll('games');
    const chapters = await d.getAll('chapters');
    const lc = (s: string) => s.toLowerCase();
    const has = (s: string | undefined, t: string) => !t || lc(s ?? '').includes(lc(t));
    games = games.filter((g) => has(`${g.white} ${g.black}`, q.player) && has(`${g.opening}`, q.opening) && (!q.eco || lc(g.eco).startsWith(lc(q.eco))) && (!q.result || g.result === q.result)
      && (!q.book || g.bookId === q.book) && (!q.page || String(g.page) === q.page.trim())
      && (!q.chapter || has(chapters.find((c) => c.id === g.chapterId)?.title, q.chapter))
      && (!q.text || has(`${g.white} ${g.black} ${g.event} ${g.opening} ${g.eco} ${g.date}`, q.text) || has(g.pgn, q.text)));
    let out: Hit[] = games.map((g) => ({ g, why: '' }));
    // Position (from FEN or from a move sequence).
    let target = q.fen.trim();
    if (q.moves.trim()) {
      const c = new Chess();
      for (const tok of q.moves.replace(/\d+\.(\.\.)?/g, ' ').split(/\s+/).filter(Boolean)) {
        try { c.move(tok); } catch { setErr(`“${tok}” is not legal in that sequence`); return; }
      }
      target = c.fen();
    }
    if (target) {
      let key: string;
      try { key = q.sameSide ? positionKey(new Chess(target).fen()) : placementKey(target); } catch { setErr('That FEN is not a legal position'); return; }
      const idx = q.sameSide ? await d.getAllFromIndex('positions', 'byKey', key) : await d.getAllFromIndex('positions', 'byPlacement', key);
      const ok = new Map(idx.map((p) => [p.gameId, p.path]));
      out = out.filter((h) => ok.has(h.g.id)).map((h) => ({ ...h, path: ok.get(h.g.id), why: `position after ${ok.get(h.g.id) || 'the start'}` }));
    }
    if (q.motif.trim()) {
      const words = q.motif.toLowerCase().split(/[,\s]+/).filter(Boolean);
      out = out.filter((h) => { const t = (h.g.pgn.match(/\{[^}]*\}/g) ?? []).join(' ').toLowerCase(); return words.every((w) => t.includes(w)); }).map((h) => ({ ...h, why: h.why || `commentary mentions “${q.motif}”` }));
    }
    if (q.evalMin || q.evalMax) {
      const lo = q.evalMin ? +q.evalMin : -Infinity, hi = q.evalMax ? +q.evalMax : Infinity;
      const kept: Hit[] = [];
      for (const h of out) {
        const a = await loadGameAnalysis(h.g.id);
        if (!a) continue;
        const last = Object.values(a.evals).pop();
        if (!last) continue;
        const pawns = last.score.mate !== undefined ? (last.score.mate > 0 ? 99 : -99) : (last.score.cp ?? 0) / 100;
        if (pawns >= lo && pawns <= hi) kept.push({ ...h, why: `final evaluation ${pawns > 0 ? '+' : ''}${Math.abs(pawns) === 99 ? 'mate' : pawns.toFixed(2)} (${winPercent(last.score).toFixed(0)}% for White)` });
      }
      out = kept;
    }
    setHits(out.slice(0, 500));
  };

  const f = (k: keyof typeof q, label: string, ph = '', w = 160) => <label class="field" style={`min-width:${w}px;flex:1`}>{label}<input class="input" value={String(q[k])} placeholder={ph} onInput={(e) => setQ({ ...q, [k]: (e.target as HTMLInputElement).value })} onKeyDown={(e) => { if (e.key === 'Enter') void run(); }} /></label>;
  return (
    <div class="page">
      <h1>Search</h1>
      <div class="panel col">
        <div class="row">{f('text', 'Anything', 'name, event, word in comments', 220)}{f('player', 'Player')}{f('opening', 'Opening')}{f('eco', 'ECO', 'e.g. C6', 90)}</div>
        <div class="row">
          <label class="field" style="min-width:200px;flex:1">Book<select class="input" value={q.book} onChange={(e) => setQ({ ...q, book: (e.target as HTMLSelectElement).value })}><option value="">Any book</option>{books.map((b) => <option key={b.id} value={b.id}>{b.title}</option>)}</select></label>
          {f('chapter', 'Chapter')}{f('page', 'Page', '', 80)}
          <label class="field">Result<select class="input" value={q.result} onChange={(e) => setQ({ ...q, result: (e.target as HTMLSelectElement).value })}><option value="">Any</option><option>1-0</option><option>0-1</option><option>1/2-1/2</option><option>*</option></select></label>
        </div>
        <div class="row">{f('fen', 'Position (FEN)', 'finds the position in any game, also by transposition', 320)}
          <label class="row small"><input type="checkbox" checked={q.sameSide} onChange={(e) => setQ({ ...q, sameSide: (e.target as HTMLInputElement).checked })} /> same side to move</label></div>
        <div class="row">{f('moves', 'Move sequence', '1.e4 e5 2.Nf3 Nc6 3.Bb5', 260)}{f('motif', 'Motif in commentary', 'e.g. pin, sacrifice, zugzwang', 200)}{f('evalMin', 'Final eval ≥ (pawns)', '', 100)}{f('evalMax', 'Final eval ≤', '', 100)}</div>
        <div class="row"><button class="btn primary" onClick={run}>Search</button>{err && <span style="color:var(--bad)">{err}</span>}</div>
        <div class="small muted">Move sequences are matched by the position they reach, so transpositions are found too. Evaluation filters use games you have analysed.</div>
      </div>
      {hits && (
        <div class="panel" style="margin-top:1rem">
          <h3>{hits.length} result{hits.length === 1 ? '' : 's'}</h3>
          <table class="list"><thead><tr><th>Game</th><th>Book</th><th>Page</th><th>Why</th></tr></thead>
            <tbody>{hits.map((h) => (
              <tr class="click" key={h.g.id} onClick={() => go(h.g.bookId ? `study/${h.g.bookId}/${h.g.id}${h.path ? `?path=${encodeURIComponent(h.path)}` : ''}` : `analysis/${h.g.id}${h.path ? `?path=${encodeURIComponent(h.path)}` : ''}`)}>
                <td>{gameTitle(h.g)} <span class="small muted">{h.g.eco} {h.g.opening}</span></td>
                <td class="small">{books.find((b) => b.id === h.g.bookId)?.title ?? 'Imported'}</td>
                <td>{h.g.page ?? ''}</td><td class="small muted">{h.why}</td>
              </tr>
            ))}</tbody></table>
        </div>
      )}
    </div>
  );
}
