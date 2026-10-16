import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Sources, BarRow, Tabs } from '../ui/kit';
import { NephronDiagram, TUBE_PATHS, FULL_TUBE } from '../ui/NephronDiagram';
import type { SegmentId, SoluteId } from '../engine/types';
import { SEGMENT_INFO } from '../content/segments';
import { FLOW_SCENARIOS as SCENARIOS, flowEvaluation, fmtPct, perDay, planExit, soluteFate, type SoluteFate } from '../sim/flow';

const SOLUTES: { id: SoluteId; label: string; color: string }[] = [
  { id: 'Na', label: 'Na⁺', color: 'var(--c-teal)' },
  { id: 'water', label: 'Water', color: 'var(--c-blue)' },
  { id: 'K', label: 'K⁺', color: 'var(--c-orange)' },
  { id: 'Cl', label: 'Cl⁻', color: 'var(--c-violet2)' },
  { id: 'HCO3', label: 'HCO₃⁻', color: 'var(--c-violet)' },
  { id: 'glucose', label: 'Glucose', color: 'var(--c-amber)' },
  { id: 'aa', label: 'Amino acids', color: 'var(--c-orange)' },
  { id: 'urea', label: 'Urea', color: 'var(--c-grey)' },
  { id: 'Pi', label: 'Phosphate', color: 'var(--c-yellow)' },
  { id: 'Ca', label: 'Ca²⁺', color: 'var(--c-amber2)' },
  { id: 'Mg', label: 'Mg²⁺', color: 'var(--c-violet2)' },
  { id: 'creat', label: 'Creatinine', color: 'var(--c-pink)' },
  { id: 'NH4', label: 'NH₄⁺', color: 'var(--c-vein)' },
];


interface Particle {
  s: number; // distance along the tube
  exitAt: number; // distance at which it leaves (Infinity = excreted)
  /** 0 while in the tubule; counts up (seconds) while leaving into the blood (reabsorbed) */
  leaving: number;
  /** >0 while a secreted particle is still crossing in from the blood */
  entering: number;
  x: number;
  y: number;
  /** exit or entry point on the tubule wall, and the outward direction there */
  ox: number;
  oy: number;
  nx: number;
  ny: number;
}

const SPEEDS = [0.1, 0.25, 0.5, 1, 2];
/** Particles per second (at 1×) for the whole reference load; segments get their share of it. */
const SPAWN_RATE = 16;
const LEAVE_T = 1.4; // seconds a reabsorbed particle takes to cross into the capillary
const ENTER_T = 0.9;

export default function FlowSimulator() {
  const [solute, setSolute] = useState<SoluteId>('Na');
  const [scen, setScen] = useState('normal');
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduce);
  const [speed, setSpeed] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const ev = useMemo(() => flowEvaluation(scen), [scen]);
  // Share of the reference load (normally the filtered load) reabsorbed or added in each segment.
  const fate = soluteFate(ev.kidney.segments, solute);
  const perSeg = fate.segments;
  const excreted = fate.excreted;
  const ofWhat = fate.basis === 'filtered' ? 'filtered' : 'tubular';
  const color = SOLUTES.find((x) => x.id === solute)!.color;

  // On the drawing: a band under each segment scaled by what it takes back (green) or adds (red),
  // and a pill with the number.
  const heat = Object.fromEntries(perSeg.map((d) => [d.id, { color: d.delta >= 0 ? 'var(--c-green)' : 'var(--c-red)', w: Math.abs(d.delta) }]));
  const notes = Object.fromEntries(
    perSeg
      .filter((d) => Math.abs(d.delta) >= 0.005)
      .map((d) => [d.id, d.delta >= 0 ? `${fmtPct(d.delta)} reabsorbed` : `+${fmtPct(-d.delta)} secreted`]),
  );

  // ------------------------------------------------ particle animation
  const svgRef = useRef<HTMLDivElement>(null);
  const cfg = useRef({ fate, color, playing, speed });
  cfg.current = { fate, color, playing, speed };
  useEffect(() => {
    const host = svgRef.current?.querySelector('svg');
    const layer = host?.querySelector('g.flow-particles') as SVGGElement | null;
    if (!host || !layer) return;
    const ns = 'http://www.w3.org/2000/svg';
    const full = document.createElementNS(ns, 'path');
    full.setAttribute('d', FULL_TUBE);
    host.appendChild(full);
    full.setAttribute('visibility', 'hidden');
    const total = full.getTotalLength();
    // Segment boundaries along the full path.
    const bounds: { id: SegmentId; start: number; end: number }[] = [];
    let acc = 0;
    for (const t of TUBE_PATHS) {
      const pth = document.createElementNS(ns, 'path');
      pth.setAttribute('d', t.d);
      host.appendChild(pth);
      const len = pth.getTotalLength();
      host.removeChild(pth);
      bounds.push({ id: t.id as SegmentId, start: acc, end: acc + len });
      acc += len;
    }
    const scale = total / acc;
    for (const b of bounds) {
      b.start *= scale;
      b.end *= scale;
    }
    /** A point on the tubule and the unit normal there (pointing away from the loop's centre line). */
    const wall = (at: number) => {
      const a = full.getPointAtLength(Math.max(0, at - 1));
      const b = full.getPointAtLength(Math.min(total, at + 1));
      const p = full.getPointAtLength(at);
      let nx = -(b.y - a.y);
      let ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      // Alternate sides so exits read as leaving through both walls.
      if (Math.random() < 0.5) {
        nx = -nx;
        ny = -ny;
      }
      return { x: p.x, y: p.y, nx, ny };
    };

    /**
     * Decide where a particle will leave the tubule, starting from segment `from`. Each segment
     * reabsorbs the same fraction of every particle that reaches it - filtered or secreted further
     * up - so on average the particles reproduce the engine's segment-by-segment mass balance.
     */
    const plan = (fate: SoluteFate, from: number): number => {
      const i = planExit(fate, from);
      if (i < 0) return Infinity;
      const b = bounds.find((x) => x.id === fate.segments[i].id)!;
      return b.start + Math.random() * (b.end - b.start);
    };

    let ps: Particle[] = [];
    const dots: SVGCircleElement[] = [];
    const trails: SVGLineElement[] = [];
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    const secreteAcc = new Map<SegmentId, number>();
    const flowSpeed = total / 9; // seconds to traverse the whole nephron at 1×
    const draw = () => {
      while (dots.length < ps.length) {
        const t = document.createElementNS(ns, 'line');
        const c = document.createElementNS(ns, 'circle');
        layer.appendChild(t);
        layer.appendChild(c);
        trails.push(t);
        dots.push(c);
      }
      const col = cfg.current.color;
      dots.forEach((c, i) => {
        const p = ps[i];
        const t = trails[i];
        if (!p) {
          c.setAttribute('r', '0');
          t.setAttribute('stroke-width', '0');
          return;
        }
        const outOfTube = p.s >= total;
        c.setAttribute('cx', String(outOfTube ? 462 : p.x));
        c.setAttribute('cy', String(outOfTube ? 676 + (p.s - total) : p.y));
        const moving = p.leaving > 0 || p.entering > 0;
        c.setAttribute('r', moving ? '4.6' : '4.4');
        c.setAttribute('fill', col);
        c.setAttribute('stroke', moving ? 'var(--c-strong)' : 'var(--c-deep)');
        c.setAttribute('stroke-width', moving ? '1.6' : '1.2');
        c.setAttribute('opacity', p.leaving > 0 ? String(Math.max(0, 1 - p.leaving / LEAVE_T)) : '0.95');
        if (moving) {
          t.setAttribute('x1', String(p.ox));
          t.setAttribute('y1', String(p.oy));
          t.setAttribute('x2', String(p.x));
          t.setAttribute('y2', String(p.y));
          t.setAttribute('stroke', col);
          t.setAttribute('stroke-width', '2');
          t.setAttribute('stroke-dasharray', '3 3');
          t.setAttribute('opacity', p.leaving > 0 ? String(Math.max(0, 0.8 - p.leaving / LEAVE_T)) : '0.8');
        } else t.setAttribute('stroke-width', '0');
      });
    };
    const tick = (now: number) => {
      const wallDt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const dt = cfg.current.playing ? wallDt * cfg.current.speed : 0;
      if (dt > 0) {
        const fate = cfg.current.fate;
        // Filtration: particles enter at the glomerulus in proportion to the filtered load.
        spawnAcc += dt * SPAWN_RATE * fate.filteredShare;
        while (spawnAcc >= 1) {
          spawnAcc -= 1;
          ps.push({ s: 0, exitAt: plan(fate, 0), leaving: 0, entering: 0, x: 0, y: 0, ox: 0, oy: 0, nx: 0, ny: 0 });
        }
        // Secretion: particles cross in from the blood partway along, on the same scale, so a
        // segment that adds 15% of the filtered load adds 15% as many particles as filtration.
        fate.segments.forEach((d, i) => {
          if (d.delta >= 0) return;
          let acc = (secreteAcc.get(d.id) ?? 0) + dt * SPAWN_RATE * -d.delta;
          const b = bounds.find((x) => x.id === d.id)!;
          while (acc >= 1) {
            acc -= 1;
            const s0 = b.start + Math.random() * (b.end - b.start);
            const w = wall(s0);
            // Once inside, it is subject to whatever the segments downstream take back.
            ps.push({ s: s0, exitAt: plan(fate, i + 1), leaving: 0, entering: ENTER_T, x: w.x + w.nx * 34, y: w.y + w.ny * 34, ox: w.x + w.nx * 34, oy: w.y + w.ny * 34, nx: w.nx, ny: w.ny });
          }
          secreteAcc.set(d.id, acc);
        });
        for (const p of ps) {
          if (p.leaving > 0) {
            // Out through the wall and on towards the peritubular capillary.
            p.leaving += dt;
            const d = 38 * Math.min(1, p.leaving / LEAVE_T) ** 0.7;
            p.x = p.ox + p.nx * d;
            p.y = p.oy + p.ny * d;
            continue;
          }
          if (p.entering > 0) {
            p.entering = Math.max(0, p.entering - dt);
            const f = p.entering / ENTER_T;
            const w = full.getPointAtLength(p.s);
            p.x = w.x + p.nx * 34 * f;
            p.y = w.y + p.ny * 34 * f;
            p.ox = w.x + p.nx * 34;
            p.oy = w.y + p.ny * 34;
            continue;
          }
          p.s += flowSpeed * dt;
          if (p.s >= p.exitAt) {
            const w = wall(p.exitAt);
            p.leaving = 0.001;
            p.ox = w.x;
            p.oy = w.y;
            p.nx = w.nx;
            p.ny = w.ny;
            p.x = w.x;
            p.y = w.y;
            continue;
          }
          const pt = full.getPointAtLength(Math.min(p.s, total));
          p.x = pt.x + (Math.random() - 0.5) * 2;
          p.y = pt.y + (Math.random() - 0.5) * 2;
        }
        ps = ps.filter((p) => (p.leaving === 0 ? p.s < total + 30 : p.leaving < LEAVE_T));
      }
      draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      host.removeChild(full);
      layer.innerHTML = '';
    };
    // A new solute or scenario starts from an empty tubule, so old particles never mix with new plans.
  }, [resetKey, solute, scen]);

  const label = SOLUTES.find((s) => s.id === solute)!.label;
  return (
    <div>
      <PageHead path="/flow" lede="Particles enter the proximal tubule from the glomerulus in proportion to the filtered load. Follow one solute: particles cross out through the tubule wall into the blood where a segment reabsorbs it, cross in where a segment secretes it, and whatever is left reaches the urine. The green band under each segment shows how much of the filtered load it takes back, the red band how much it adds." />
      <div class="grid grid-main-side" style={{ '--main-side': 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
        <div class="sticky-figure">
          <Panel title={fate.basis === 'filtered' ? `Where does filtered ${label} go?` : `Where does ${label} go?`}>
            <div class="player" style={{ marginBottom: 8 }}>
          <button class="primary play" onClick={() => setPlaying(!playing)} aria-pressed={!playing}>
            {playing ? '❚❚ Pause' : '▶ Play'}
          </button>
          <span class="ctl-label" style={{ margin: 0 }}>
            Speed
          </span>
          {SPEEDS.map((v) => (
            <button key={v} class={speed === v ? 'active' : ''} onClick={() => setSpeed(v)} aria-pressed={speed === v}>
              {v < 1 ? `${v}×` : `${v}×`}
            </button>
          ))}
          <button class="ghost" onClick={() => setResetKey(resetKey + 1)}>
            ↺ Clear particles
          </button>
        </div>
            <div class="legend-row">
              <span>
                <b class="dot" style={{ background: color }} /> {label} in the tubular fluid
              </span>
              <span>
                <b class="dot ring" style={{ background: color }} /> ⇢ crossing into the blood (reabsorbed) or into the tubule (secreted)
              </span>
              <span>
                <i style={{ background: 'var(--c-green)', opacity: 0.5 }} /> share reabsorbed here
              </span>
              <span>
                <i style={{ background: 'var(--c-red)', opacity: 0.5 }} /> share secreted here
              </span>
            </div>
            <div ref={svgRef}>
              <NephronDiagram vessels={false} labels tubeColor="var(--c-dim)" heat={heat} notes={notes} medullaOsm={ev.kidney.medullaTarget} height="calc(100vh - 170px)" overlay={<g class="flow-particles" />} />
            </div>
            {!playing && <p class="control-hint">Paused. Press ▶ Play{reduce ? ' (animation is paused by default because your system asks for reduced motion)' : ''}.</p>}
          </Panel>
        </div>
        <div>
          <Panel>
            <div class="flow-controls" style={{ padding: 0 }}>
        <div>
          <div class="ctl-label">Follow</div>
          <Tabs tabs={SOLUTES.map((s) => ({ id: s.id, label: s.label }))} active={solute} onChange={(id) => setSolute(id as SoluteId)} />
        </div>
        <div>
          <div class="ctl-label">Scenario</div>
          <div class="btn-row">
            {SCENARIOS.map((s) => (
              <button key={s.id} class={scen === s.id ? 'active' : ''} onClick={() => setScen(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
            </div>
          </Panel>
          <Panel
            title={fate.basis === 'filtered' ? `Fate of filtered ${label}` : `Fate of the ${label} entering the tubule`}
            note={
              fate.basis === 'filtered'
                ? 'Share of the filtered load reabsorbed or added in each segment, first hours of the scenario.'
                : `${label} is barely filtered, so shares are of everything entering the tubular fluid: the little filtered plus all that segments add.`
            }
          >
            <p class="muted" style={{ fontSize: '0.85rem' }}>
              {fate.basis === 'filtered' ? (
                <>Filtered: {perDay(solute, fate.filtered)}</>
              ) : (
                <>
                  Filtered: {perDay(solute, fate.filtered)} · entering the tubule in all: {perDay(solute, fate.ref)}
                </>
              )}
              <br />
              Excreted (at this rate): {perDay(solute, fate.excretedAmount)}
              {fate.basis === 'filtered' && solute !== 'NH4' ? ` (${fmtPct(excreted)} of the filtered load${excreted > 1 ? ': more than was filtered, because of secretion' : ''})` : ''}
            </p>
            {perSeg.map((d) => (
              <BarRow
                key={d.id}
                label={`${SEGMENT_INFO[d.id].name} ${d.delta >= 0 ? 'reabsorbs' : 'adds'}`}
                value={Math.abs(d.delta) * 100}
                max={100}
                unit="%"
                color={d.delta >= 0 ? 'var(--c-green)' : 'var(--c-red)'}
              />
            ))}
            <BarRow label={`Excreted in the urine (% of ${ofWhat} load)`} value={excreted * 100} max={Math.max(100, excreted * 100)} unit="%" color="var(--c-amber)" />
          </Panel>
          <Panel title="Reading the pattern">
            <ul class="muted" style={{ fontSize: '0.88rem' }}>
              <li>Na⁺ and water: the proximal tubule takes the bulk; the descending limb takes water, the ascending limbs NaCl without water; the collecting duct fine-tunes both, water only with ADH.</li>
              <li>Glucose, amino acids, HCO₃⁻: almost all gone early in the proximal tubule — unless the load or the carriers change.</li>
              <li>K⁺: nearly all reabsorbed by the end of the loop; what reaches the urine was mostly secreted in the connecting tubule and collecting duct.</li>
              <li>Urea: about half is reabsorbed proximally; more leaves the thin limbs than entered them — urea reabsorbed from the inner medullary collecting duct is secreted back in (medullary recycling).</li>
              <li>Creatinine: filtered plus a little secreted; so its clearance slightly exceeds GFR.</li>
              <li>NH₄⁺: barely filtered — made and secreted by the proximal tubule, partly reabsorbed in the thick ascending limb, then trapped in the collecting duct. Its shares are of all the NH₄⁺ entering the tubule.</li>
            </ul>
            <Sources cite={{ rose: [1, 3, 4, 5], evidence: 'physiology' }} />
          </Panel>
        </div>
      </div>
      <Related paths={['/nephron', '/transport', '/diuretics', '/potassium']} />
    </div>
  );
}
