import { useMemo, useState } from 'preact/hooks';
import { PageHead } from '../ui/page';
import { Panel } from '../ui/kit';
import { GROUPS, ROUTES, isReady } from '../routes';
import { href } from '../router';

// The knowledge map: every module, grouped by area, following the path fluid takes and the
// questions the book asks — from the glomerulus, through the tubule, to balance and its disorders.
const ORDER = GROUPS.map((g) => g.id).filter((id) => id !== 'start' && id !== 'lab');

function matches(text: string, q: string): boolean {
  if (!q) return true;
  const h = text.toLowerCase();
  return q.toLowerCase().split(/\s+/).every((t) => h.includes(t));
}

export default function Graph({ query }: { query: URLSearchParams }) {
  void query;
  const [q, setQ] = useState('');
  const ready = useMemo(() => ROUTES.filter((r) => isReady(r) && r.group !== 'start'), []);
  const byGroup = useMemo(() => {
    const m = new Map<string, typeof ROUTES>();
    for (const r of ready) {
      if (!matches(`${r.title} ${r.blurb} ${(r.keywords ?? []).join(' ')}`, q)) continue;
      const arr = m.get(r.group) ?? [];
      arr.push(r);
      m.set(r.group, arr);
    }
    return m;
  }, [ready, q]);
  const total = Array.from(byGroup.values()).reduce((n, a) => n + a.length, 0);

  return (
    <div>
      <PageHead
        path="/graph"
        lede="The whole subject on one map. The modules are laid out in the order the physiology builds — the glomerulus first, then the tubule segment by segment, then the balances the kidney keeps and the disorders that break them. Follow it top to bottom, or jump to anything."
      />
      <Panel title="Search the map">
        <input
          type="search"
          value={q}
          placeholder="Search every module — countercurrent, aldosterone, RTA, FENa…"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          style={{ width: '100%' }}
        />
        <p class="control-hint" style={{ marginTop: 8, marginBottom: 0 }}>{total} modules{q ? ` matching “${q}”` : ''}</p>
      </Panel>

      <div>
        {ORDER.map((gid) => {
          const items = byGroup.get(gid);
          if (!items || items.length === 0) return null;
          const label = GROUPS.find((g) => g.id === gid)?.label ?? gid;
          return (
            <section key={gid} style={{ marginTop: 18 }}>
              <h3 style={{ marginBottom: 10 }}>{label}</h3>
              <div class="grid grid-3">
                {items.map((r) => (
                  <a key={r.path} class="card-link" href={href(r.path)}>
                    <h4>{r.title}</h4>
                    <p>{r.blurb}</p>
                  </a>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {total === 0 && (
        <Panel title="Nothing matches">
          <p class="muted" style={{ marginBottom: 0 }}>No module matches “{q}”. Try a broader term.</p>
        </Panel>
      )}
    </div>
  );
}
