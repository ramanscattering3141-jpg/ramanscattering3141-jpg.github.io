import { useMemo, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { EQUATIONS, type EquationDef } from '../content/equations';
import { href } from '../router';

const GROUPS: EquationDef['group'][] = [
  'Units & osmolality',
  'Filtration & clearance',
  'Water & sodium',
  'Potassium',
  'Acid–base',
  'Respiratory',
  'Minerals',
];

function matches(e: EquationDef, q: string): boolean {
  if (!q) return true;
  const hay = `${e.name} ${e.formula} ${e.explain} ${e.group} ${(e.keywords ?? []).join(' ')}`.toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .every((t) => hay.includes(t));
}

export default function Equations({ query }: { query: URLSearchParams }) {
  const [q, setQ] = useState(query.get('q') ?? '');
  const [group, setGroup] = useState<EquationDef['group'] | 'all'>('all');
  const [withCase, setWithCase] = useState(false);
  const shown = useMemo(
    () => EQUATIONS.filter((e) => (group === 'all' || e.group === group) && (!withCase || !!e.patient) && matches(e, q)),
    [q, group, withCase],
  );
  const nCases = EQUATIONS.filter((e) => e.patient).length;
  const byGroup = useMemo(() => {
    const m = new Map<EquationDef['group'], EquationDef[]>();
    for (const g of GROUPS) m.set(g, []);
    for (const e of shown) m.get(e.group)!.push(e);
    return m;
  }, [shown]);

  return (
    <div>
      <PageHead
        path="/equations"
        lede="Every equation the lab uses, live. Move a variable and the number recomputes, so a formula is something you turn rather than memorise. Each is the book's, in SI units, with its assumptions and the traps that come with it — and, where one exists, a link to the simulator that shows the same physiology dynamically."
      />
      <Panel title="Find an equation">
        <input
          type="search"
          aria-label="Search equations"
          value={q}
          placeholder="Search — osmolality, clearance, anion gap, TTKG…"
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          style={{ width: '100%', marginBottom: 10 }}
        />
        <div class="btn-row">
          <button class={group === 'all' ? 'active' : ''} onClick={() => setGroup('all')}>All</button>
          {GROUPS.map((g) => (
            <button key={g} class={group === g ? 'active' : ''} onClick={() => setGroup(g)}>{g}</button>
          ))}
        </div>
        <div class="btn-row" style={{ marginTop: 8 }}>
          <button class={withCase ? 'active' : ''} aria-pressed={withCase} onClick={() => setWithCase(!withCase)}>
            Only those with a worked patient ({nCases})
          </button>
        </div>
        <p class="control-hint" style={{ marginTop: 8, marginBottom: 0 }}>
          {shown.length} of {EQUATIONS.length} equations. For patients that chain several equations together, see{' '}
          <a href={href('/bedside')}>equations at the bedside</a>.
        </p>
      </Panel>

      {GROUPS.filter((g) => byGroup.get(g)!.length > 0).map((g) => (
        <section key={g} style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 10 }}>{g}</h3>
          <div class="grid grid-2">
            {byGroup.get(g)!.map((e) => (
              <EquationCard key={e.id} eq={e} />
            ))}
          </div>
        </section>
      ))}

      {shown.length === 0 && (
        <Panel title="Nothing matches">
          <p class="muted" style={{ marginBottom: 0 }}>No equation matches “{q}”. Try a shorter term, or clear the filter.</p>
        </Panel>
      )}

      <Related paths={['/bedside', '/clearance', '/fractional-excretion', '/acid-base', '/free-water', '/creatinine', '/labs']} />
    </div>
  );
}
