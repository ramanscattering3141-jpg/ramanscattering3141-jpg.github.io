import { useEffect, useState } from 'preact/hooks';
import { setSettings, useSettings } from './settings';
import { EngineSettings } from './EnginePanel';
import { canUseThreads } from '../engine/engine';
import { db } from '../db/db';
import { saveGame, treeOf } from '../db/games';
import { download, toast } from './toast';

export function SettingsPage() {
  const s = useSettings();
  const [usage, setUsage] = useState<string>('');
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1024 / 1024).toFixed(1)} MB used of about ${((e.quota ?? 0) / 1024 / 1024 / 1024).toFixed(1)} GB available`));
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);
  const backup = async (withPdfs: boolean) => {
    const d = await db();
    const out: Record<string, unknown[]> = {};
    for (const st of ['books', 'pages', 'diagrams', 'chapters', 'games', 'bookmarks', 'notes', 'exercises', 'attempts', 'templates', 'kv'] as const) {
      const rows = await d.getAll(st);
      out[st] = st === 'books' ? rows.map((b) => ({ ...(b as object), cover: undefined })) : rows;
    }
    if (withPdfs) {
      out.files = [];
      for (const f of await d.getAll('files')) {
        const buf = new Uint8Array(await f.blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        out.files.push({ bookId: f.bookId, b64: btoa(bin) });
      }
    }
    download(`chess-library-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ format: 'chess-book-reader-backup', version: 1, data: out }), 'application/json');
  };
  const restore = async (file: File) => {
    try {
      const j = JSON.parse(await file.text());
      if (j.format !== 'chess-book-reader-backup') throw new Error('not a backup from this app');
      const d = await db();
      for (const [st, rows] of Object.entries(j.data as Record<string, unknown[]>)) {
        if (st === 'files') {
          for (const f of rows as Array<{ bookId: string; b64: string }>) { const bin = atob(f.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await d.put('files', { bookId: f.bookId, blob: new Blob([u], { type: 'application/pdf' }) }); }
          continue;
        }
        if (st === 'positions') continue;
        for (const r of rows) await d.put(st as never, r as never);
      }
      // Rebuild the position index from the restored games.
      for (const g of await d.getAll('games')) await saveGame(g, treeOf(g));
      toast('Backup restored');
    } catch (e) { toast(`Could not restore: ${(e as Error).message}`, 5000); }
  };
  return (
    <div class="page" style="max-width:900px">
      <h1>Settings</h1>
      <div class="panel col">
        <h3>Appearance</h3>
        <div class="row">
          <label class="field">Theme<select class="input" value={s.theme} onChange={(e) => setSettings({ theme: (e.target as HTMLSelectElement).value as never })}><option value="auto">Follow the system</option><option value="light">Light</option><option value="dark">Dark</option></select></label>
          <label class="field">Pieces<select class="input" value={s.pieces} onChange={(e) => setSettings({ pieces: (e.target as HTMLSelectElement).value as never })}><option value="cburnett">Classic (cburnett)</option><option value="merida">Merida</option></select></label>
          <label class="row small"><input type="checkbox" checked={s.coords} onChange={(e) => setSettings({ coords: (e.target as HTMLInputElement).checked })} /> Board coordinates</label>
          <label class="row small"><input type="checkbox" checked={s.showArrows} onChange={(e) => setSettings({ showArrows: (e.target as HTMLInputElement).checked })} /> Engine arrows</label>
        </div>
      </div>
      <div class="panel col" style="margin-top:.8rem">
        <h3>Engine</h3>
        <EngineSettings />
        <label class="field" style="max-width:260px">Depth for whole-game and batch analysis<input class="input" type="number" min={8} max={30} value={s.gameDepth} onChange={(e) => setSettings({ gameDepth: Math.max(8, Math.min(30, +(e.target as HTMLInputElement).value || 16)) })} /></label>
        <label class="row small"><input type="checkbox" checked={s.isolation} onChange={(e) => { setSettings({ isolation: (e.target as HTMLInputElement).checked }); toast('Reload the page to apply'); }} /> Multi-threaded engine (installs a small service worker that makes the page cross-origin isolated)</label>
        <div class="small muted">This page is {canUseThreads() ? 'cross-origin isolated: multi-threaded engines are available' : 'not cross-origin isolated: only single-threaded engines can run'}. {navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} CPU threads detected.` : ''}</div>
      </div>
      <div class="panel col" style="margin-top:.8rem">
        <h3>Storage and backup</h3>
        <div class="small">{usage} {persisted === false && <button class="btn small" onClick={async () => setPersisted(await navigator.storage.persist())}>Ask the browser to keep this data</button>}{persisted && <span class="tag good">protected from automatic clean-up</span>}</div>
        <div class="small muted">Your books, games and progress are stored only in this browser profile. Clearing site data deletes them; make a backup to move them to another device.</div>
        <div class="row">
          <button class="btn" onClick={() => backup(false)}>Back up (without PDFs)</button>
          <button class="btn" onClick={() => backup(true)}>Back up including PDFs</button>
          <label class="btn">Restore from backup…<input type="file" accept="application/json,.json" class="sr" onChange={(e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) void restore(f); }} /></label>
          <button class="btn" onClick={async () => { await (await db()).clear('engine'); toast('Engine cache cleared'); }}>Clear engine cache</button>
        </div>
      </div>
    </div>
  );
}

export function About() {
  const libs: Array<[string, string, string]> = [
    ['Stockfish 19 (stockfish.js by Nathan Rugg)', 'GPL-3.0', 'https://github.com/nmrugg/stockfish.js'],
    ['Chessground (lichess.org)', 'GPL-3.0-or-later', 'https://github.com/lichess-org/chessground'],
    ['chess.js', 'BSD-2-Clause', 'https://github.com/jhlywa/chess.js'],
    ['pdf.js (Mozilla)', 'Apache-2.0', 'https://github.com/mozilla/pdf.js'],
    ['Tesseract.js and tesseract.js-core', 'Apache-2.0', 'https://github.com/naptha/tesseract.js'],
    ['Tesseract English model (tessdata_best, int)', 'Apache-2.0', 'https://github.com/tesseract-ocr/tessdata_best'],
    ['Lichess chess-openings (ECO names)', 'CC0-1.0', 'https://github.com/lichess-org/chess-openings'],
    ['Pieces: cburnett (Colin M.L. Burnett)', 'GPL-2.0-or-later', 'https://github.com/lichess-org/lila/tree/master/public/piece/cburnett'],
    ['Pieces: merida (Armando Hernandez Marroquin)', 'GPL-2.0-or-later', 'https://github.com/lichess-org/lila/tree/master/public/piece/merida'],
    ['Pieces: chessnut (Alexis Luengas) — recogniser reference only', 'Apache-2.0', 'https://github.com/LexLuengas/chessnut-pieces'],
    ['idb (Jake Archibald)', 'ISC', 'https://github.com/jakearchibald/idb'],
    ['Preact', 'MIT', 'https://github.com/preactjs/preact'],
  ];
  return (
    <div class="page" style="max-width:900px">
      <h1>About, privacy and licences</h1>
      <div class="panel col">
        <h3>Privacy and copyright</h3>
        <p>Everything happens in your browser. PDFs, extracted games, notes and training data are stored in this browser's IndexedDB and are never uploaded; there is no account and no server. Only process books you own or have the right to use. The app has no sharing or publishing features, and exported files are for your own study.</p>
        <h3>How reliable is it?</h3>
        <p>Every extracted move is checked against the rules from the position it is played in; moves that cannot be read are reported, never guessed. Diagram recognition is image-based and can misread unusual piece fonts — positions with low confidence are marked for checking, and each correction teaches the recogniser that book's pieces. Engine evaluations always show the search depth: a shallow search is not a final verdict.</p>
      </div>
      <div class="panel" style="margin-top:.8rem">
        <h3>Open-source components</h3>
        <table class="list"><thead><tr><th>Component</th><th>Licence</th><th>Source</th></tr></thead>
          <tbody>{libs.map(([n, l, u]) => <tr key={n}><td>{n}</td><td>{l}</td><td><a href={u} target="_blank" rel="noopener noreferrer">{u.replace('https://', '')}</a></td></tr>)}</tbody></table>
        <p class="small">Because it includes GPL-licensed components (Stockfish, Chessground), this chess app is distributed under the GNU GPL version 3. Its complete source code is at <a href="https://github.com/ramanscattering3141-jpg/ramanscattering3141-jpg.github.io" target="_blank" rel="noopener noreferrer">github.com/ramanscattering3141-jpg/ramanscattering3141-jpg.github.io</a> (folders <code>src/chess</code>, <code>chess</code>, <code>tools/chess-*</code>). The Stockfish licence text ships at <a href="../chess-vendor/stockfish/Copying.txt">chess-vendor/stockfish/Copying.txt</a>.</p>
      </div>
    </div>
  );
}
