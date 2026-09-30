import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Sources, BarRow, Tabs } from '../ui/kit';
import { NephronDiagram, TUBE_PATHS, FULL_TUBE } from '../ui/NephronDiagram';
import { acute, makeParams } from '../sim/hooks';
import { SEGMENTS, type ParamPatch, type SegmentId, type SoluteId } from '../engine/types';
import { SEGMENT_INFO } from '../content/segments';
import { depletedBody } from '../engine/scenarios';
import { initialBody } from '../engine/body';

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

const SCENARIOS: { id: string; label: string; patch: ParamPatch; depleted?: number; hco3?: number }[] = [
  { id: 'normal', label: 'Normal', patch: {} },
  { id: 'loop', label: 'Loop diuretic', patch: { drugs: { furosemide: 1 } } },
  { id: 'thiazide', label: 'Thiazide', patch: { drugs: { thiazide: 1 } } },
  { id: 'sglt2i', label: 'SGLT2 inhibitor', patch: { drugs: { sglt2i: 1 } } },
  { id: 'dm', label: 'Glucose 22 mmol/L', patch: { glucose: 400 } }, // engine glucose is mg/dL
  { id: 'volume', label: 'Volume depletion', patch: {}, depleted: 3 },
  { id: 'aldo', label: 'High aldosterone', patch: { aldoAutonomous: 5 } },
  { id: 'acid', label: 'Metabolic acidosis', patch: {}, hco3: 13 },
  { id: 'noadh', label: 'No ADH (central DI)', patch: { centralDI: 1 } },
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
const LEAVE_T = 1.4; // seconds a reabsorbed particle takes to cross into the capillary
const ENTER_T = 0.9;

export default function FlowSimulator() {
  const [solute, setSolute] = useState<SoluteId>('Na');
  const [scen, setScen] = useState('normal');
  const reduce = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [playing, setPlaying] = useState(!reduce);
  const [speed, setSpeed] = useState(1);
  const [resetKey, setResetKey] = useState(0);
  const sc = SCENARIOS.find((s) => s.id === scen)!;
  const ev = useMemo(() => {
    const p = makeParams(sc.patch);
    let body = sc.depleted ? depletedBody(p, sc.depleted) : undefined;
    if (sc.hco3) body = { ...(body ?? initialBody(p)), hco3: sc.hco3 };
    return acute(p, body);
  }, [scen]);
  const segs = ev.kidney.segments;
  const filtered = Math.max(segs.PT.in[solute], 1e-12);
  // Fraction of the filtered load reabsorbed (positive) or added (negative) in each segment.
  const perSeg = SEGMENTS.map((id) => ({ id, delta: (segs[id].in[solute] - segs[id].out[solute]) / filtered, out: segs[id].out[solute] / filtered }));
  const excreted = segs.IMCD.out[solute] / filtered;
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
  const cfg = useRef({ perSeg, solute, color, playing, speed });
  cfg.current = { perSeg, solute, color, playing, speed };
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
    const segOf = (id: SegmentId) => bounds.find((b) => b.id === id)!;
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

    /** Decide where a particle filtered at the glomerulus will leave, following segment fractions. */
    const plan = (): number => {
      let remaining = 1;
      for (const b of bounds) {
        const d = cfg.current.perSeg.find((p) => p.id === b.id)!;
        if (d.delta > 0 && remaining > 1e-9) {
          const pExit = Math.min(1, d.delta / remaining);
          if (Math.random() < pExit) return b.start + Math.random() * (b.end - b.start);
          remaining -= d.delta;
        } else if (d.delta < 0) remaining -= d.delta; // secretion adds to what remains
      }
      return Infinity;
    };

    let ps: Particle[] = [];
    const dots: SVGCircleElement[] = [];
    const trails: SVGLineElement[] = [];
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
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
        spawnAcc += dt * 16;
        while (spawnAcc > 1) {
          spawnAcc -= 1;
          ps.push({ s: 0, exitAt: plan(), leaving: 0, entering: 0, x: 0, y: 0, ox: 0, oy: 0, nx: 0, ny: 0 });
        }
        // Secretion: particles cross in from the blood partway along, in proportion to the amount added.
        for (const d of cfg.current.perSeg) {
          if (d.delta < -0.001) {
            const b = segOf(d.id);
            if (Math.random() < Math.min(1, -d.delta) * dt * 14) {
              const s0 = b.start + Math.random() * (b.end - b.start);
              const w = wall(s0);
              ps.push({ s: s0, exitAt: Infinity, leaving: 0, entering: ENTER_T, x: w.x + w.nx * 34, y: w.y + w.ny * 34, ox: w.x + w.nx * 34, oy: w.y + w.ny * 34, nx: w.nx, ny: w.ny });
            }
          }
        }
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
  }, [resetKey]);

  const label = SOLUTES.find((s) => s.id === solute)!.label;
  return (
    <div>
      <PageHead path="/flow" lede="Every particle entering the proximal tubule was filtered at the glomerulus. Follow one solute: particles cross out through the tubule wall into the blood where a segment reabsorbs it, cross in where a segment secretes it, and whatever is left reaches the urine. The green band under each segment shows how much of the filtered load it takes back." />
      <div class="grid grid-main-side" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(0, 1fr)' }}>
        <div class="sticky-figure">
          <Panel title={`Where does filtered ${label} go?`}>
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
          <Panel title={`Fate of filtered ${label}`} note="Share of the filtered load reabsorbed or added in each segment, first hours of the scenario.">
            <p class="muted" style={{ fontSize: '0.85rem' }}>
              Filtered: {solute === 'water' ? `${(filtered * 1.44).toFixed(0)} L/day` : solute === 'glucose' ? `${((filtered * 1440) / 180.16).toFixed(0)} mmol/day` : solute === 'creat' ? `${((filtered * 1440) / 113.12).toFixed(1)} mmol/day` : `${(filtered * 1440).toFixed(0)} mmol/day`}
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
            <BarRow label="Excreted in the urine" value={excreted * 100} max={Math.max(100, excreted * 100)} unit="%" color="var(--c-amber)" />
          </Panel>
          <Panel title="Reading the pattern">
            <ul class="muted" style={{ fontSize: '0.88rem' }}>
              <li>Na⁺ and water: the proximal tubule takes the bulk; the loop takes NaCl without water; the collecting duct fine-tunes both, water only with ADH.</li>
              <li>Glucose, amino acids, HCO₃⁻: almost all gone early in the proximal tubule — unless the load or the carriers change.</li>
              <li>K⁺: nearly all reabsorbed by the end of the loop; what reaches the urine was mostly secreted in the connecting tubule and collecting duct.</li>
              <li>Urea: more leaves the loop than entered it — medullary recycling adds it back.</li>
              <li>Creatinine: filtered plus a little secreted; so its clearance slightly exceeds GFR.</li>
              <li>NH₄⁺: not filtered at all — made in the proximal tubule and trapped in the collecting duct.</li>
            </ul>
            <Sources cite={{ rose: [1, 3, 4, 5], evidence: 'physiology' }} />
          </Panel>
        </div>
      </div>
      <Related paths={['/nephron', '/transport', '/diuretics', '/potassium']} />
    </div>
  );
}

function fmtPct(f: number) {
  const p = f * 100;
  return `${p < 10 ? p.toFixed(1) : p.toFixed(0)}%`;
}
