import { useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Sources } from '../ui/kit';
import { CELLS, DRUGS, OTHER_DRUGS, TRANSPORTERS, type Action, type CellId, type Drug, type Transporter } from '../content/drugmap';
import { href } from '../router';

// ---------------------------------------------------------------- geometry of the drawing
const W = 1400;
const COL_W = 266;
const GAP = 12;
const colX = (i: number) => 10 + i * (COL_W + GAP);
const LUMEN_TOP = 108;
const APICAL = 192;
const BASO = 420;
const BLOOD_BOTTOM = 504;
const TOP_ROWS = [6, 38, 70];
const BOTTOM_ROWS = [516, 548, 580, 612];
const H = 646;
const PILL_H = 26;

const cellIndex = (c: CellId) => CELLS.findIndex((x) => x.id === c);
const glyphW = (t: Transporter) => Math.max(46, t.short.length * 7.4 + 14);

function anchorOf(t: Transporter) {
  const x0 = colX(cellIndex(t.cell));
  if (t.side === 'para') return { x: x0 + COL_W - 14, y: (APICAL + BASO) / 2 };
  if (t.side === 'intra') return { x: x0 + t.x * COL_W, y: APICAL + (t.y ?? 0.5) * (BASO - APICAL) };
  return { x: x0 + t.x * COL_W, y: t.side === 'apical' ? APICAL : BASO };
}

interface Pill {
  drug: Drug;
  x: number;
  y: number;
  w: number;
  band: 'top' | 'bottom';
}

/** Place each drug's badge above or below the cells, near its targets, without overlaps. */
function layoutPills(): Pill[] {
  const items = DRUGS.map((d) => {
    const ts = d.targets.map((t) => TRANSPORTERS.find((x) => x.id === t.t)!);
    const band: 'top' | 'bottom' = ts.length ? (ts[0].side === 'apical' || ts[0].side === 'para' ? 'top' : 'bottom') : d.anchor?.side === 'baso' ? 'bottom' : 'top';
    const ax = ts.length ? ts.reduce((a, t) => a + anchorOf(t).x, 0) / ts.length : colX(cellIndex(d.anchor!.cell)) + COL_W * 0.55;
    const w = d.name.length * 7.6 + 22;
    return { drug: d, ax, w, band };
  });
  const out: Pill[] = [];
  for (const band of ['top', 'bottom'] as const) {
    const rows = band === 'top' ? TOP_ROWS : BOTTOM_ROWS;
    const ends = rows.map(() => -Infinity);
    for (const it of items.filter((i) => i.band === band).sort((a, b) => a.ax - b.ax)) {
      let left = Math.max(4, Math.min(W - it.w - 4, it.ax - it.w / 2));
      let r = ends.findIndex((e) => left > e + 8);
      if (r < 0) {
        r = ends.indexOf(Math.min(...ends));
        left = Math.min(W - it.w - 4, ends[r] + 8);
      }
      ends[r] = left + it.w;
      out.push({ drug: it.drug, x: left, y: rows[r], w: it.w, band });
    }
  }
  return out;
}

const PILLS = layoutPills();

const ACTION_COLOR: Record<Action, string> = { block: 'var(--c-red)', activate: 'var(--c-green)', reduce: 'var(--c-amber)' };
const ACTION_WORD: Record<Action, string> = { block: 'blocks', activate: 'activates', reduce: 'reduces' };
const GROUPS: { id: 'all' | Drug['group']; label: string }[] = [
  { id: 'all', label: 'All drugs' },
  { id: 'diuretic', label: 'Diuretics' },
  { id: 'potassium', label: 'Potassium' },
  { id: 'magnesium', label: 'Magnesium' },
  { id: 'water', label: 'Water & sodium' },
];

export default function DrugMap({ query }: { query: URLSearchParams }) {
  const [drug, setDrug] = useState<string | null>(query.get('d'));
  const [tr, setTr] = useState<string | null>(null);
  const [group, setGroup] = useState<'all' | Drug['group']>('all');
  const selDrug = DRUGS.find((d) => d.id === drug) ?? null;
  const selTr = TRANSPORTERS.find((t) => t.id === tr) ?? null;
  const pick = (d: string | null, t: string | null) => {
    setDrug(d);
    setTr(t);
  };
  const drugActive = (d: Drug) => (group === 'all' || d.group === group) && (!selDrug || selDrug.id === d.id) && (!selTr || d.targets.some((x) => x.t === selTr.id));
  const targetOf = (t: Transporter) => (selDrug ? selDrug.targets.find((x) => x.t === t.id)?.action : undefined);

  return (
    <div>
      <PageHead
        path="/drug-map"
        lede="Every major transporter along the nephron, drawn on the cell that carries it, with the drugs that act on it wired to their targets. Click a drug to see what it blocks and what that does to Na⁺, K⁺, Mg²⁺, Ca²⁺, acid–base and water; click a transporter to see what it does and which drugs reach it."
      />
      <Panel>
        <div class="legend-row" style={{ justifyContent: 'space-between' }}>
          <div class="legend-row" style={{ marginBottom: 0 }}>
            <span>
              <b style={{ color: 'var(--c-green)' }}>↓</b> towards the blood (reabsorbed)
            </span>
            <span>
              <b style={{ color: 'var(--c-amber)' }}>↑</b> towards the urine (secreted)
            </span>
            <span>
              <i style={{ background: 'var(--c-red)' }} /> blocks
            </span>
            <span>
              <i style={{ background: 'var(--c-green)' }} /> activates
            </span>
            <span>
              <i style={{ background: 'var(--c-amber)' }} /> reduces
            </span>
          </div>
          <div class="btn-row" style={{ marginBottom: 0 }}>
            {GROUPS.map((g) => (
              <button key={g.id} class={group === g.id ? 'active' : ''} onClick={() => setGroup(g.id)}>
                {g.label}
              </button>
            ))}
            {(selDrug || selTr) && (
              <button class="ghost" onClick={() => pick(null, null)}>
                ✕ Clear selection
              </button>
            )}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ minWidth: 900 }} role="img" aria-label="Transporters along the nephron and the drugs that act on them">
            <defs>
              <marker id="dm-act" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="var(--c-green)" />
              </marker>
            </defs>
            {/* cells */}
            {CELLS.map((c, i) => {
              const x = colX(i);
              return (
                <g key={c.id}>
                  <rect x={x} y={LUMEN_TOP} width={COL_W} height={APICAL - LUMEN_TOP} fill="color-mix(in srgb, var(--c-amber) 9%, transparent)" />
                  <rect x={x} y={BASO} width={COL_W} height={BLOOD_BOTTOM - BASO} fill="color-mix(in srgb, var(--c-red) 8%, transparent)" />
                  <rect x={x + 2} y={APICAL} width={COL_W - 4} height={BASO - APICAL} rx={16} fill="var(--well)" stroke="var(--line)" stroke-width="1.5" />
                  <line x1={x + 6} x2={x + COL_W - 6} y1={APICAL} y2={APICAL} stroke="var(--c-dim)" stroke-width="3" />
                  <line x1={x + 6} x2={x + COL_W - 6} y1={BASO} y2={BASO} stroke="var(--c-dim)" stroke-width="3" />
                  <text x={x + 8} y={LUMEN_TOP + 14} class="svg-label" style={{ fontSize: 12, fill: 'var(--ink-faint)' }}>
                    lumen (urine side){c.voltage ? ' · ' : ''}
                    {c.voltage && <tspan style={{ fontWeight: 700, fill: c.voltage.includes('+') ? 'var(--c-amber)' : 'var(--c-blue)' }}>{c.voltage}</tspan>}
                  </text>
                  <text x={x + 8} y={BLOOD_BOTTOM - 6} class="svg-label" style={{ fontSize: 12, fill: 'var(--ink-faint)' }}>
                    blood side
                  </text>
                  <text x={x + COL_W / 2} y={APICAL + 58} text-anchor="middle" class="svg-label" style={{ fontSize: 17, fontWeight: 700, fill: 'var(--ink)' }}>
                    {c.name}
                  </text>
                  {wrapText(c.load, 34).map((l, k) => (
                    <text key={k} x={x + COL_W / 2} y={APICAL + 80 + k * 16} text-anchor="middle" class="svg-label" style={{ fontSize: 13, fill: 'var(--ink-dim)' }}>
                      {l}
                    </text>
                  ))}
                </g>
              );
            })}
            {/* drug lines (under the glyphs) */}
            {PILLS.map((p) => {
              const on = drugActive(p.drug);
              const cx = p.x + p.w / 2;
              const cy = p.band === 'top' ? p.y + PILL_H : p.y;
              if (!p.drug.targets.length) {
                return <line key={p.drug.id} x1={cx} y1={cy} x2={cx} y2={APICAL - 30} stroke="var(--c-violet)" stroke-dasharray="3 3" opacity={on ? 0.9 : 0.15} />;
              }
              return p.drug.targets.map((t) => {
                const tt = TRANSPORTERS.find((x) => x.id === t.t)!;
                const a = anchorOf(tt);
                const ty = tt.side === 'intra' ? a.y + 22 : tt.side === 'para' ? APICAL - 4 : tt.side === 'apical' ? a.y - 13 : a.y + 13;
                const tx = a.x;
                const dx = tx - cx;
                const dy = ty - cy;
                const len = Math.hypot(dx, dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const col = ACTION_COLOR[t.action];
                const hot = selDrug?.id === p.drug.id || (selTr?.id === tt.id && on);
                return (
                  <g key={`${p.drug.id}-${t.t}`} opacity={on ? 1 : 0.12}>
                    <line x1={cx} y1={cy} x2={tx - (dx / len) * 3} y2={ty - (dy / len) * 3} stroke={col} stroke-width={hot ? 3 : 1.6} stroke-dasharray={t.action === 'reduce' ? '5 4' : undefined} marker-end={t.action === 'activate' ? 'url(#dm-act)' : undefined} />
                    {t.action !== 'activate' && <line x1={tx - (dx / len) * 3 + nx * 8} y1={ty - (dy / len) * 3 + ny * 8} x2={tx - (dx / len) * 3 - nx * 8} y2={ty - (dy / len) * 3 - ny * 8} stroke={col} stroke-width={hot ? 4 : 3} />}
                  </g>
                );
              });
            })}
            {/* transporters */}
            {TRANSPORTERS.map((t) => {
              const a = anchorOf(t);
              const act = targetOf(t);
              const sel = selTr?.id === t.id;
              const ring = act ? ACTION_COLOR[act] : sel ? 'var(--c-orange)' : 'var(--line)';
              const fill = t.kind === 'pump' ? 'var(--c-teal)' : t.kind === 'channel' ? 'var(--c-blue)' : t.kind === 'receptor' ? 'var(--c-violet)' : t.kind === 'enzyme' ? 'var(--c-amber)' : t.kind === 'junction' ? 'var(--c-grey)' : 'var(--c-green)';
              const click = { class: 'hit', role: 'button' as const, tabIndex: 0, 'aria-label': t.name, onClick: () => pick(null, t.id), onKeyDown: (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(null, t.id)) };
              if (t.side === 'para') {
                return (
                  <g key={t.id} {...click}>
                    <line x1={a.x} x2={a.x} y1={LUMEN_TOP + 20} y2={BLOOD_BOTTOM - 20} stroke={act ? ring : fill} stroke-width={sel || act ? 5 : 3} stroke-dasharray="6 4" />
                    <text x={a.x - 8} y={(APICAL + BASO) / 2 + 70} text-anchor="middle" transform={`rotate(-90 ${a.x - 8} ${(APICAL + BASO) / 2 + 70})`} class="svg-label svg-halo" style={{ fontSize: 12, fontWeight: 600, fill: 'var(--ink)' }}>
                      {t.short}: {t.fluxes.map((f) => f.ion).join(' ')} ↓
                    </text>
                  </g>
                );
              }
              if (t.side === 'intra') {
                return (
                  <g key={t.id} {...click}>
                    <circle cx={a.x} cy={a.y} r={20} fill={`color-mix(in srgb, ${fill} 22%, var(--panel))`} stroke={act || sel ? ring : fill} stroke-width={act || sel ? 3.5 : 1.8} />
                    <text x={a.x} y={a.y + 4} text-anchor="middle" class="svg-label" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>
                      {t.short}
                    </text>
                    {act === 'block' && <path d={`M${a.x - 14},${a.y - 14} L${a.x + 14},${a.y + 14}`} stroke="var(--c-red)" stroke-width="3" />}
                  </g>
                );
              }
              const w = glyphW(t);
              // Each ion on its own line, stacked away from the membrane.
              const fy = (k: number) => (t.side === 'apical' ? APICAL - 22 - k * 16 : BASO + 30 + k * 16);
              return (
                <g key={t.id} {...click}>
                  <rect x={a.x - w / 2} y={a.y - 13} width={w} height={26} rx={13} fill={`color-mix(in srgb, ${fill} 22%, var(--panel))`} stroke={act || sel ? ring : fill} stroke-width={act || sel ? 3.5 : 1.8} />
                  <text x={a.x} y={a.y + 5} text-anchor="middle" class="svg-label" style={{ fontSize: 13.5, fontWeight: 700, fill: 'var(--ink)' }}>
                    {t.short}
                  </text>
                  {act === 'block' && <path d={`M${a.x - w / 2 + 4},${a.y - 10} L${a.x + w / 2 - 4},${a.y + 10}`} stroke="var(--c-red)" stroke-width="3" />}
                  {t.fluxes.map((f, k) => (
                    <text key={k} x={a.x} y={fy(k)} text-anchor="middle" class="svg-label svg-halo" style={{ fontSize: 13.5, fontWeight: 600, fill: f.dir === 'down' ? 'var(--c-green)' : 'var(--c-amber)' }}>
                      {f.ion} {f.dir === 'down' ? '↓' : '↑'}
                    </text>
                  ))}
                </g>
              );
            })}
            {/* drug badges */}
            {PILLS.map((p) => {
              const on = drugActive(p.drug);
              const sel = selDrug?.id === p.drug.id;
              return (
                <g key={p.drug.id} class="hit" role="button" tabIndex={0} aria-label={p.drug.name} opacity={on ? 1 : 0.25} onClick={() => pick(sel ? null : p.drug.id, null)} onKeyDown={(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(sel ? null : p.drug.id, null))}>
                  <rect x={p.x} y={p.y} width={p.w} height={PILL_H} rx={13} fill={sel ? 'var(--c-violet)' : 'color-mix(in srgb, var(--c-violet) 16%, var(--panel))'} stroke="var(--c-violet)" stroke-width={sel ? 2.5 : 1.4} />
                  <text x={p.x + p.w / 2} y={p.y + 17.5} text-anchor="middle" class="svg-label" style={{ fontSize: 13.5, fontWeight: 600, fill: sel ? 'var(--c-deep)' : 'var(--ink)' }}>
                    {p.drug.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </Panel>

      <div class="grid grid-2">
        <Panel title={selDrug ? selDrug.name : selTr ? selTr.name : 'Pick a drug or a transporter'}>
          {selDrug ? <DrugDetail d={selDrug} /> : selTr ? <TransporterDetail t={selTr} onDrug={(id) => pick(id, null)} /> : <p class="muted">Click any purple drug badge or any transporter on the drawing. The lines show which transporter each drug acts on: a bar for block, an arrowhead for activate, a dashed bar for reduce.</p>}
        </Panel>
        <Panel title="Where the Na⁺ goes when a site is blocked">
          <p style={{ fontSize: '0.9rem' }}>
            Blocking a transporter never simply removes its share of sodium reabsorption: the Na⁺ it would have taken flows on to the next segment, which takes some of it back. What reaches the principal cell sets the K⁺ story; whether the medullary gradient survives sets the water story. Try each class in the{' '}
            <a href={href('/diuretics')}>diuretic laboratory</a>, which runs these drugs through the whole-kidney model.
          </p>
          <ul style={{ fontSize: '0.88rem' }}>
            <li>
              <strong>Upstream of the principal cell</strong> (acetazolamide, SGLT2 inhibitors, mannitol, loop, thiazide): more Na⁺ and flow reach ENaC and ROMK/BK → <strong>K⁺ wasting</strong>, and volume loss adds aldosterone.
            </li>
            <li>
              <strong>At the principal cell</strong> (amiloride, trimethoprim, MR blockers, less aldosterone): less Na⁺ enters, the lumen is less negative → <strong>K⁺ and H⁺ retained</strong>.
            </li>
          </ul>
        </Panel>
      </div>

      <div class="grid grid-2">
        <Panel title="Why furosemide lowers K⁺ but rarely lowers Na⁺">
          <ol style={{ fontSize: '0.9rem' }}>
            <li>
              <strong>K⁺ falls</strong> because the NaCl that NKCC2 no longer takes reaches the connecting tubule and collecting duct. More Na⁺ entering through ENaC makes the lumen more negative; faster flow opens BK channels and washes secreted K⁺ away; the volume loss raises aldosterone. K⁺ recycling through ROMK in the TAL is lost too. A metabolic alkalosis follows for the same reasons.
            </li>
            <li>
              <strong>Na⁺ usually holds</strong> because the thick ascending limb is also what loads the medullary interstitium with NaCl. With it blocked, the medulla loses its hypertonicity, so even with ADH the collecting duct cannot concentrate the urine: it stays close to isotonic, and the NaCl leaves carrying its share of water. Some free water is excreted along with the salt, which protects the plasma Na⁺.
            </li>
            <li>That is why a loop diuretic plus salt tablets can be used to raise the Na⁺ in SIADH — and why hyponatraemia on a loop diuretic points to something else (heart failure, cirrhosis, a thiazide added, or large hypotonic intake).</li>
          </ol>
          <Sources cite={{ rose: [15, 23, 27], evidence: 'physiology', refs: ['ellison2017'] }} />
        </Panel>
        <Panel title="Why thiazides do cause hyponatraemia">
          <ol style={{ fontSize: '0.9rem' }}>
            <li>NCC sits in the cortex. Blocking it impairs dilution (the cortical diluting segment can no longer strip NaCl from the fluid) but leaves the medullary gradient intact.</li>
            <li>The mild volume depletion stimulates ADH, and with an intact gradient ADH can concentrate the urine fully: water is kept while Na⁺ and K⁺ are lost.</li>
            <li>K⁺ loss adds to it: as cells lose K⁺, Na⁺ moves in (Edelman), lowering plasma Na⁺ further. Older, small patients with a low solute intake and a high water intake are most at risk, typically in the first weeks.</li>
            <li>Urine Ca²⁺ falls (thiazides are used against calcium stones) mainly because the contracted volume raises passive proximal Ca²⁺ reabsorption, while TRPM6 is downregulated — hypomagnesaemia with hypocalciuria, as in Gitelman syndrome.</li>
          </ol>
          <Sources cite={{ rose: [15, 23], evidence: 'physiology', refs: ['nijenhuis2005', 'spasovski2014'] }} />
        </Panel>
      </div>

      <div class="grid grid-2">
        <Panel title="Magnesium: where it is reabsorbed, and why it matters for K⁺">
          <ul style={{ fontSize: '0.9rem' }}>
            <li>
              <strong>Proximal tubule ≈15–25%</strong> (passive). <strong>Thick ascending limb ≈60–70%</strong>, between the cells through claudin-16/19, pushed by the lumen-positive voltage that ROMK creates. <strong>DCT ≈10%</strong>, through TRPM6: small but it sets the final urinary Mg²⁺.
            </li>
            <li>
              <strong>Loop diuretics, Bartter syndrome, aminoglycosides and hypercalcaemia</strong> (CaSR activation) all abolish the TAL voltage: Mg²⁺ and Ca²⁺ are wasted together (hypercalciuria).
            </li>
            <li>
              <strong>Thiazides, Gitelman syndrome, calcineurin inhibitors, cisplatin and EGFR antibodies</strong> act through TRPM6 in the DCT: Mg²⁺ is wasted but urinary Ca²⁺ is low (except with calcineurin inhibitors).
            </li>
            <li>
              <strong>Low Mg²⁺ keeps K⁺ low.</strong> Intracellular Mg²⁺ normally blocks outward K⁺ movement through ROMK; when it falls, K⁺ secretion rises — especially with high distal Na⁺ delivery or aldosterone (diuretics, again). Hypokalaemia then resists K⁺ replacement until Mg²⁺ is repleted. Low Mg²⁺ also impairs PTH release and action, so hypocalcaemia follows.
            </li>
            <li>
              <strong>Proton-pump inhibitors</strong> lower Mg²⁺ by reducing gut absorption, not by renal loss: the urine Mg²⁺ is appropriately low.
            </li>
          </ul>
          <Sources cite={{ rose: [4, 5, 27], evidence: 'physiology', refs: ['simon1999', 'schlingmann2002', 'huang2007', 'groenestege2007'] }} />
        </Panel>
        <Panel title="Vaptans: water out, sodium stays">
          <ul style={{ fontSize: '0.9rem' }}>
            <li>Tolvaptan (oral) and conivaptan (IV, also blocks V1a) block the V2 receptor on the principal cell. Aquaporin-2 is withdrawn, the collecting duct becomes water-tight, and the kidney excretes dilute urine with little Na⁺ or K⁺ — an aquaresis, not a diuresis.</li>
            <li>They raise plasma Na⁺ in euvolaemic and hypervolaemic hyponatraemia (SIADH, heart failure), where the problem is water retention driven by ADH. They are wrong for hypovolaemic hyponatraemia, where ADH is appropriate and volume is the treatment.</li>
            <li>The danger is over-correction: start in hospital, measure Na⁺ at 6–8 h and often after, keep correction within the safe limit (about 10 mmol/L in 24 h), and do not combine with fluid restriction at the start. Tolvaptan also carries a liver-injury warning; higher doses slow cyst growth in ADPKD.</li>
            <li>
              Compare it with water restriction and saline in the <a href={href('/hyponatremia')}>hyponatraemia simulator</a>.
            </li>
          </ul>
          <Sources cite={{ rose: [23], evidence: 'clinical', refs: ['schrier2006', 'spasovski2014', 'sterns1986'], update: 'Vasopressin receptor antagonists were introduced after the 2001 text.' }} />
        </Panel>
      </div>

      <Panel title="Drugs and the electrolytes they disturb" note="Click a row to show that drug on the map. ↑ raised, ↓ lowered in plasma unless urine is stated.">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Drug</th>
                <th>Acts on</th>
                <th>Na⁺ / water</th>
                <th>K⁺</th>
                <th>Mg²⁺</th>
                <th>Ca²⁺</th>
                <th>Acid–base</th>
              </tr>
            </thead>
            <tbody>
              {DRUGS.map((d) => (
                <tr key={d.id} class={selDrug?.id === d.id ? 'row-hit' : ''} onClick={() => (pick(d.id, null), window.scrollTo({ top: 0, behavior: 'smooth' }))} style={{ cursor: 'pointer' }}>
                  <td>
                    <strong>{d.name}</strong>
                    <div class="faint" style={{ fontSize: '0.78rem' }}>
                      {d.examples}
                    </div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{d.targets.length ? d.targets.map((t) => `${ACTION_WORD[t.action]} ${TRANSPORTERS.find((x) => x.id === t.t)!.short}`).join('; ') : 'osmotic (no carrier)'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{[d.effects.na, d.effects.water].filter(Boolean).join(' · ') || '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{d.effects.k ?? '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{d.effects.mg ?? '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{d.effects.ca ?? '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{d.effects.ab ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h4 style={{ marginTop: 14 }}>Not through a renal transporter</h4>
        <ul style={{ fontSize: '0.88rem' }}>
          {OTHER_DRUGS.map((o) => (
            <li key={o.name}>
              <strong>{o.name}:</strong> {o.effect}
            </li>
          ))}
        </ul>
        <Sources cite={{ rose: [15, 23, 24, 27, 28], evidence: 'clinical', refs: ['velazquez1993', 'hoorn2011', 'huang2007'] }} />
      </Panel>
      <Related paths={['/diuretics', '/transport', '/potassium', '/minerals', '/hyponatremia', '/inherited']} />
    </div>
  );
}

function DrugDetail({ d }: { d: Drug }) {
  const rows: [string, string | undefined][] = [
    ['Na⁺', d.effects.na],
    ['Water', d.effects.water],
    ['K⁺', d.effects.k],
    ['Mg²⁺', d.effects.mg],
    ['Ca²⁺', d.effects.ca],
    ['Acid–base', d.effects.ab],
  ];
  return (
    <div>
      <p class="muted" style={{ marginBottom: 6 }}>
        {d.examples}
      </p>
      <p style={{ fontSize: '0.92rem' }}>
        {d.targets.length > 0 && (
          <strong>
            {d.targets.map((t) => `${ACTION_WORD[t.action]} ${TRANSPORTERS.find((x) => x.id === t.t)!.name}`).join('; ')}.{' '}
          </strong>
        )}
        {d.mech}
      </p>
      <table>
        <tbody>
          {rows
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <tr key={k}>
                <th scope="row" style={{ width: 110 }}>
                  {k}
                </th>
                <td>{v}</td>
              </tr>
            ))}
        </tbody>
      </table>
      <Sources cite={d.cite} />
    </div>
  );
}

function TransporterDetail({ t, onDrug }: { t: Transporter; onDrug: (id: string) => void }) {
  const cell = CELLS.find((c) => c.id === t.cell)!;
  const drugs = DRUGS.filter((d) => d.targets.some((x) => x.t === t.id));
  return (
    <div>
      <p class="muted" style={{ marginBottom: 6 }}>
        {cell.name} · {t.side === 'apical' ? 'luminal membrane' : t.side === 'baso' ? 'basolateral membrane' : t.side === 'para' ? 'between the cells' : 'inside the cell'}
        {t.fluxes.length ? ` · moves ${t.fluxes.map((f) => `${f.ion} ${f.dir === 'down' ? '↓' : '↑'}`).join(', ')}` : ''}
      </p>
      <p style={{ fontSize: '0.92rem' }}>{t.what}</p>
      {t.genetics && (
        <p style={{ fontSize: '0.88rem' }}>
          <strong>Genetics:</strong> {t.genetics}
        </p>
      )}
      <h4>Drugs acting here</h4>
      {drugs.length ? (
        <div class="chips">
          {drugs.map((d) => (
            <button key={d.id} onClick={() => onDrug(d.id)}>
              {d.name} ({ACTION_WORD[d.targets.find((x) => x.t === t.id)!.action]})
            </button>
          ))}
        </div>
      ) : (
        <p class="faint">None in common use.</p>
      )}
    </div>
  );
}

function wrapText(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > n) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
