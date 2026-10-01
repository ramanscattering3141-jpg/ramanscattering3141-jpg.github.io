import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { DRUGS, FX, MAPLBL, NA_SPLIT, ORDER, SEGS, type DrugId, type Effect, type SegId } from '../content/diureticMap';

// The interactive diuretic map: a nephron with every diuretic class labelled at its site by an
// inhibition bar (⊣). Hover, tap or focus a segment or a drug to see the transporters, the drugs
// that block them and the effect on Na⁺, K⁺, Ca²⁺, Mg²⁺, acid–base and water.

const SEG_COLOR: Record<SegId, string> = {
  glom: 'var(--c-blood)',
  pct: 'var(--c-teal)',
  tdl: 'var(--c-blue)',
  tal0: 'var(--c-grey)',
  tal: 'var(--c-coral)',
  dct: 'var(--c-amber)',
  ccd: 'var(--c-violet)',
  mcd: 'var(--c-violet2)',
};
const drugColor = (d: DrugId) => SEG_COLOR[DRUGS[d].sites[0]];
const DRUG_IDS = Object.keys(DRUGS) as DrugId[];

interface Sel {
  seg: SegId | null;
  drug: DrugId | null;
}

/** A T-bar from (x1,y1) to (x2,y2), the bar perpendicular to the line. */
function TBar({ b, color }: { b: [number, number, number, number]; color: string }) {
  const [x1, y1, x2, y2] = b;
  const L = Math.hypot(x2 - x1, y2 - y1);
  const px = (-(y2 - y1) / L) * 8;
  const py = ((x2 - x1) / L) * 8;
  return (
    <g style={{ stroke: color }} class="dmap-tb">
      <path d={`M${x1} ${y1}L${x2} ${y2}`} />
      <path class="bar" d={`M${x2 + px} ${y2 + py}L${x2 - px} ${y2 - py}`} />
    </g>
  );
}

const Arrow = ({ f }: { f: Effect }) => <span class={`dmap-ar ${f[0]}`}>{f[1]}</span>;

function CellDiagram({ seg, activeDrug }: { seg: SegId; activeDrug: DrugId | null }) {
  const items = SEGS[seg].transport;
  const top = 44;
  const rh = 38;
  const H = top + items.length * rh + 8;
  const c = SEG_COLOR[seg];
  const bar = (x1: number, x2: number, y: number, dc: string, op: number) => (
    <g style={{ stroke: dc, opacity: op }} stroke-linecap="round">
      <path d={`M${x1} ${y}H${x2}`} stroke-width="2" />
      <path d={`M${x2} ${y - 7}V${y + 7}`} stroke-width="3.5" />
    </g>
  );
  return (
    <svg viewBox={`0 0 400 ${H}`} class="dmap-cell" role="img" aria-label={`Transporters in the ${SEGS[seg].name.toLowerCase()}`}>
      <rect x="0" y="0" width="96" height={H} rx="8" style={{ fill: `color-mix(in srgb, ${c} 8%, transparent)` }} />
      <rect x="100" y="24" width="200" height={H - 28} rx="12" style={{ fill: `color-mix(in srgb, ${c} 5%, var(--panel))`, stroke: 'var(--line-soft)' }} />
      <rect x="304" y="0" width="96" height={H} rx="8" style={{ fill: 'color-mix(in srgb, var(--c-blood) 7%, transparent)' }} />
      <line x1="100" y1="24" x2="100" y2={H - 4} style={{ stroke: c }} stroke-width="3" />
      <line x1="300" y1="24" x2="300" y2={H - 4} style={{ stroke: c }} stroke-width="3" />
      <text class="tz" x="8" y="16">Lumen</text>
      <text class="tz" x="200" y="16" text-anchor="middle">Cell</text>
      <text class="tz" x="392" y="16" text-anchor="end">Blood</text>
      {items.map((it, i) => {
        const y = top + i * rh + 14;
        const d = it.t;
        const dc = d ? drugColor(d) : c;
        const op = d && (!activeDrug || activeDrug === d) ? 1 : 0.4;
        const ring = { fill: 'var(--panel)', stroke: dc, strokeWidth: d ? (op === 1 ? 3.5 : 2) : 2 };
        const tagW = d ? DRUGS[d].tag.length * 6.4 : 0;
        const left = (x2: number) =>
          d && (
            <>
              <text class="tx" x="8" y={y + 4} style={{ fill: dc, opacity: op }}>{DRUGS[d].tag}</text>
              {bar(8 + tagW + 6, x2, y, dc, op)}
            </>
          );
        const right = (x2: number) =>
          d && (
            <>
              <text class="tx" x="392" y={y + 4} text-anchor="end" style={{ fill: dc, opacity: op }}>{DRUGS[d].tag}</text>
              {bar(392 - tagW - 6, x2, y, dc, op)}
            </>
          );
        if (it.s === 'a' || it.s === 'p')
          return (
            <g key={i}>
              <circle cx="100" cy={y} r="9" style={ring} stroke-dasharray={it.s === 'p' ? '3 3' : undefined} />
              <text class="t1" x="116" y={y - 1}>{it.n}</text>
              <text class="t2" x="116" y={y + 12}>{it.m}</text>
              {left(88)}
            </g>
          );
        if (it.s === 'b')
          return (
            <g key={i}>
              <circle cx="300" cy={y} r="9" style={ring} />
              <text class="t1" x="284" y={y - 1} text-anchor="end">{it.n}</text>
              <text class="t2" x="284" y={y + 12} text-anchor="end">{it.m}</text>
              {right(312)}
            </g>
          );
        return (
          <g key={i}>
            <rect x="112" y={y - 14} width="176" height="32" rx="8" style={ring} />
            <text class="t1" x="200" y={y - 1} text-anchor="middle">{it.n}</text>
            <text class="t2" x="200" y={y + 12} text-anchor="middle">{it.m}</text>
            {it.from === 'b' ? right(291) : left(109)}
          </g>
        );
      })}
    </svg>
  );
}

function DrugCard({ d, hl }: { d: DrugId; hl: boolean }) {
  const x = DRUGS[d];
  return (
    <div class={`dmap-drug ${hl ? 'hl' : ''}`} style={{ '--c': drugColor(d) }}>
      <h4>
        {x.name} <small>{x.ex}</small>
      </h4>
      <div class="meta">
        Blocks <b>{x.target}</b> · {x.ceiling}
        {x.sites.length > 1 ? ` · acts in the ${x.sites.map((s) => SEGS[s].name.toLowerCase()).join(' and ')}` : ''}
      </div>
      <dl class="dmap-fx">
        {FX.map(([k, lab]) => (
          <Fragment key={k}>
            <dt>{lab}</dt>
            <dd>
              <Arrow f={x.fx[k]} />
            </dd>
            <dd>{x.fx[k][2]}</dd>
          </Fragment>
        ))}
      </dl>
      <div class="dmap-two">
        <div>
          <h5>Used for</h5>
          <ul>{x.uses.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
        <div>
          <h5>Watch for</h5>
          <ul>{x.cautions.map((u) => <li key={u}>{u}</li>)}</ul>
        </div>
      </div>
      <p class="dmap-pearl">{x.pearl}</p>
      {x.more.length > 0 && <ul class="dmap-more">{x.more.map((u) => <li key={u}>{u}</li>)}</ul>}
    </div>
  );
}

function Overview({ onSeg }: { onSeg: (s: SegId) => void }) {
  const total = NA_SPLIT.reduce((a, b) => a + b[1], 0);
  return (
    <div>
      <div class="eyebrow">Overview</div>
      <h3 style={{ margin: '2px 0 6px' }}>Where the filtered sodium goes</h3>
      <p class="muted" style={{ marginTop: 0 }}>
        About 25,000 mmol of Na⁺ is filtered a day and less than 1% reaches the urine. A diuretic’s strength depends on how much its segment handles, and how much the segments after it can catch.
      </p>
      <div class="dmap-nabar">
        {NA_SPLIT.map(([s, v, t]) => (
          <button
            key={t + s}
            disabled={!s}
            aria-label={`${s ? SEGS[s].name : 'Excreted'} ${t}`}
            style={{ background: s ? SEG_COLOR[s] : 'var(--line)', flex: v / total }}
            onClick={() => s && onSeg(s)}
          />
        ))}
      </div>
      <div class="dmap-legend">
        {NA_SPLIT.map(([s, , t]) => (
          <div key={t + s}>
            <i style={{ background: s ? SEG_COLOR[s] : 'var(--line)' }} />
            <span>{s ? SEGS[s].full : 'Excreted in urine'}</span>
            <b>{t}</b>
          </div>
        ))}
      </div>
      <div class="dmap-key">
        <span><Arrow f={['up', '↑', '']} /> rises</span>
        <span><Arrow f={['down', '↓', '']} /> falls</span>
        <span><Arrow f={['flat', '≈', '']} /> little change</span>
        <span><Arrow f={['mixed', '±', '']} /> depends on timing</span>
      </div>
    </div>
  );
}

export function DiureticMap() {
  const [sel, setSel] = useState<Sel>({ seg: null, drug: null });
  const timer = useRef<number>();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => {
    if (panel.current) panel.current.scrollTop = 0;
  }, [sel.seg, sel.drug]);

  const choose = (seg: SegId | null, drug: DrugId | null) => setSel({ seg, drug });
  // Hover intent: sweeping across the drawing on the way to the panel should not change it.
  const bind = (seg: SegId, drug: DrugId | null) => ({
    onMouseEnter: () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => choose(seg, drug), 120);
    },
    onMouseLeave: () => window.clearTimeout(timer.current),
    onFocus: () => choose(seg, drug),
    onClick: (e: Event) => {
      e.stopPropagation();
      window.clearTimeout(timer.current);
      choose(seg, drug);
    },
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        choose(seg, drug);
      }
      if (e.key === 'Escape') choose(null, null);
    },
  });

  const { seg, drug } = sel;
  const active = !!seg;
  const labelOn = (d: DrugId, site: SegId) => (drug ? d === drug : site === seg);
  const s = seg ? SEGS[seg] : null;
  const drugsHere = s ? (drug ? [drug, ...s.drugs.filter((x) => x !== drug)] : s.drugs) : [];

  return (
    <div class="dmap">
      <div class="chips dmap-chips" role="group" aria-label="Diuretic classes">
        {DRUG_IDS.map((d) => (
          <button key={d} class={`dmap-chip ${drug === d ? 'on' : ''}`} style={{ '--c': drugColor(d) }} aria-pressed={drug === d} {...bind(DRUGS[d].sites[0], d)}>
            <i />
            {DRUGS[d].short}
          </button>
        ))}
      </div>
      <div class="grid grid-main-side" style={{ '--main-side': 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
        <div class="dmap-figure">
          <div class="dmap-scroll">
            <svg viewBox="-150 0 940 640" class={`dmap-svg ${active ? 'active' : ''}`} role="group" aria-label="Nephron with the diuretic classes acting on each segment" onClick={() => choose(null, null)}>
              <defs>
                <linearGradient id="dmap-med" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--c-blue) 5%, var(--panel))' }} />
                  <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--c-blue) 20%, var(--panel))' }} />
                </linearGradient>
              </defs>
              <rect x="-150" y="0" width="940" height="275" style={{ fill: 'color-mix(in srgb, var(--c-amber) 6%, var(--panel))' }} />
              <rect x="-150" y="275" width="940" height="365" fill="url(#dmap-med)" />
              <line x1="-150" x2="790" y1="275" y2="275" style={{ stroke: 'var(--line)' }} stroke-width="1.5" stroke-dasharray="4 5" />
              <text class="zone" x="782" y="266" text-anchor="end">Cortex</text>
              <text class="zone" x="782" y="292" text-anchor="end">Medulla</text>
              <text class="osm" x="-144" y="296">300 mOsm/kg</text>
              <text class="osm" x="-144" y="628">1200 mOsm/kg</text>
              <path d="M302 72 L352 50" style={{ stroke: 'var(--c-blood)' }} stroke-width="7" stroke-linecap="round" fill="none" opacity=".75" />
              <path d="M304 86 L354 82" style={{ stroke: 'var(--c-blood)' }} stroke-width="5" stroke-linecap="round" fill="none" opacity=".55" />

              <g>
                {ORDER.map((id) =>
                  id === 'glom' ? (
                    <circle key={id} class={`wall ${seg === id ? 'on' : ''}`} cx="270" cy="92" r="38" style={{ stroke: SEG_COLOR[id], strokeWidth: 10, fill: 'var(--panel)' }} />
                  ) : (
                    <path key={id} class={`wall ${seg === id ? 'on' : ''}`} d={SEGS[id].path} style={{ stroke: SEG_COLOR[id] }} />
                  ),
                )}
              </g>
              <g>{ORDER.filter((id) => id !== 'glom').map((id) => <path key={id} class="lum" d={SEGS[id].path} />)}</g>
              <g>{ORDER.filter((id) => id !== 'glom').map((id) => <path key={id} class={`flow ${seg === id ? 'on' : ''}`} d={SEGS[id].path} style={{ stroke: SEG_COLOR[id] }} />)}</g>
              <g pointer-events="none">
                <path d="M252 86c-6-16 14-22 18-8 4-14 24-10 18 4 14 0 12 20-2 18 6 14-14 20-18 6-6 12-26 6-18-6-14-2-12-18 2-14z" fill="none" style={{ stroke: 'var(--c-blood)' }} stroke-width="3.2" stroke-linejoin="round" />
                <circle cx="270" cy="92" r="5" style={{ fill: 'var(--c-blood)' }} opacity=".6" />
              </g>
              <g>
                {ORDER.map((id) => {
                  const [lx, ly, lt, anchor, l2] = SEGS[id].label;
                  return (
                    <g key={id} class={`lbl ${seg === id ? 'on' : ''}`}>
                      <text x={lx} y={ly} text-anchor={anchor}>{lt}</text>
                      {l2 && <text x={lx} y={ly + 15} text-anchor={anchor}>{l2}</text>}
                    </g>
                  );
                })}
              </g>
              <g>
                {ORDER.map((id) => {
                  const call = SEGS[id].call;
                  if (!call) return null;
                  const [cx, cy, ct] = call;
                  return (
                    <g key={id} class={`call ${seg === id ? 'on' : ''}`}>
                      <rect x={cx} y={cy - 13} width={ct.length * 7 + 18} height="22" rx="11" style={{ stroke: SEG_COLOR[id] }} />
                      <text x={cx + 9} y={cy + 2}>{ct}</text>
                    </g>
                  );
                })}
              </g>
              <g>
                {ORDER.map((id) => (
                  <g key={id} class="seg" tabIndex={0} role="button" aria-label={SEGS[id].full} {...bind(id, null)}>
                    {id === 'glom' ? <circle cx="270" cy="92" r="50" class="hitc" /> : <path d={SEGS[id].path} class="hit" />}
                  </g>
                ))}
              </g>
              <g>
                {MAPLBL.map((m, i) => {
                  const c = drugColor(m.d);
                  const w = Math.max(...m.lines.map((t, j) => t.length * (j ? 6.2 : 7.4)), 0);
                  const h = m.lines.length * 14 + 6;
                  const focusable = m.lines.length > 0;
                  return (
                    <g
                      key={i}
                      class={`dl ${labelOn(m.d, m.site) ? 'on' : ''}`}
                      tabIndex={focusable ? 0 : undefined}
                      role={focusable ? 'button' : undefined}
                      aria-label={focusable ? `${DRUGS[m.d].name}: ${m.lines.slice(1).join(', ')}` : undefined}
                      {...bind(m.site, m.d)}
                    >
                      {focusable && <rect class="hitr" x={m.a === 'end' ? m.x - w - 4 : m.x - 4} y={m.y - 14} width={w + 8} height={h} rx="6" />}
                      {m.bars.map((b, j) => (
                        <TBar key={j} b={b} color={c} />
                      ))}
                      {m.lines.map((t, j) => (
                        <text key={j} x={m.x} y={m.y + (j ? 2 + j * 14 : 0)} class={j ? 'dx' : 'dn'} text-anchor={m.a} style={j ? undefined : { fill: c }}>
                          {t}
                        </text>
                      ))}
                    </g>
                  );
                })}
              </g>
              <path d="M580 598 L580 622" style={{ stroke: 'var(--c-violet2)' }} stroke-width="3" fill="none" />
              <path d="M573 614 L580 626 L587 614" style={{ stroke: 'var(--c-violet2)' }} stroke-width="3" fill="none" stroke-linejoin="round" />
              <text class="zone" x="596" y="622" style={{ textTransform: 'none', letterSpacing: 0 }}>Urine</text>
            </svg>
          </div>
          <div class="dmap-hint">
            <span>
              {s ? (
                <>
                  <b>{drug ? DRUGS[drug].name : s.name}</b> · {drug ? s.name : s.now}
                </>
              ) : (
                'Hover, tap or tab to a segment or drug. On a phone, swipe the drawing sideways for the collecting duct.'
              )}
            </span>
            <span class="dmap-legend-t">
              <svg viewBox="0 0 26 12" width="26" height="12" aria-hidden="true">
                <path d="M2 6H22M22 1V11" fill="none" style={{ stroke: 'var(--ink)' }} stroke-width="2" stroke-linecap="round" />
              </svg>
              blocks
            </span>
          </div>
        </div>

        <div class="dmap-panel" ref={panel} aria-live="off">
          {!s ? (
            <Overview onSeg={(x) => choose(x, null)} />
          ) : (
            <div>
              <div class="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i class="dmap-swatch" style={{ background: SEG_COLOR[seg!] }} />
                Segment {ORDER.indexOf(seg!) + 1} of 8
                <button class="ghost" style={{ marginLeft: 'auto', padding: '2px 10px' }} onClick={() => choose(null, null)}>
                  Overview
                </button>
              </div>
              <h3 style={{ margin: '4px 0 6px' }}>{s.full}</h3>
              <p class="muted" style={{ marginTop: 0 }}>{s.role}</p>
              <div class="dmap-stats">
                {s.stats.map(([v, l]) => (
                  <div key={l}>
                    <b>{v}</b>
                    <span>{l}</span>
                  </div>
                ))}
              </div>
              {s.transport.length > 0 && (
                <>
                  <h5 class="dmap-h">Transporters</h5>
                  <CellDiagram seg={seg!} activeDrug={drug} />
                </>
              )}
              <h5 class="dmap-h">Drugs acting here{drugsHere.length ? ` (${drugsHere.length})` : ''}</h5>
              {drugsHere.length ? drugsHere.map((d) => <DrugCard key={d} d={d} hl={d === drug} />) : <p class="muted">No diuretic targets this segment directly.</p>}
              <h5 class="dmap-h">Worth knowing</h5>
              <ul class="dmap-notes">{s.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <div class="table-wrap" style={{ marginTop: 14 }}>
        <table class="dmap-table">
          <thead>
            <tr>
              <th>Class</th>
              <th>Site</th>
              <th>Target</th>
              <th>Natriuresis</th>
              <th>Serum Na⁺</th>
              <th>Serum K⁺</th>
              <th>Serum Ca²⁺</th>
              <th>Serum Mg²⁺</th>
              <th>Acid–base</th>
              <th>Urine volume</th>
            </tr>
          </thead>
          <tbody>
            {DRUG_IDS.map((d) => {
              const x = DRUGS[d];
              return (
                <tr key={d} class={drug === d ? 'on' : ''} tabIndex={0} onClick={() => choose(x.sites[0], d)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), choose(x.sites[0], d))}>
                  <td class="cls">
                    <i style={{ background: drugColor(d) }} />
                    {x.short}
                    <span class="ex">{x.ex}</span>
                  </td>
                  <td>{x.sites.map((q) => SEGS[q].name).join(', ')}</td>
                  <td>{x.tgt}</td>
                  <td>{x.natri}</td>
                  {(['na', 'k', 'ca', 'mg', 'ab', 'vol'] as const).map((k) => (
                    <td key={k}>
                      <Arrow f={x.fx[k]} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
