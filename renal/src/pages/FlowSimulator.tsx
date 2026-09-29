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
  { id: 'Na', label: 'Na⁺', color: '#5ecfba' },
  { id: 'water', label: 'Water', color: '#6aa9e8' },
  { id: 'K', label: 'K⁺', color: '#7bc47f' },
  { id: 'Cl', label: 'Cl⁻', color: '#9fd8a3' },
  { id: 'HCO3', label: 'HCO₃⁻', color: '#b08ee0' },
  { id: 'glucose', label: 'Glucose', color: '#f2b134' },
  { id: 'aa', label: 'Amino acids', color: '#e4a26b' },
  { id: 'urea', label: 'Urea', color: '#d0d0d0' },
  { id: 'Pi', label: 'Phosphate', color: '#e0c060' },
  { id: 'Ca', label: 'Ca²⁺', color: '#ffd28a' },
  { id: 'Mg', label: 'Mg²⁺', color: '#c9a0ff' },
  { id: 'creat', label: 'Creatinine', color: '#ff9a9a' },
  { id: 'NH4', label: 'NH₄⁺', color: '#e4696b' },
];

const SCENARIOS: { id: string; label: string; patch: ParamPatch; depleted?: number; hco3?: number }[] = [
  { id: 'normal', label: 'Normal', patch: {} },
  { id: 'loop', label: 'Loop diuretic', patch: { drugs: { furosemide: 1 } } },
  { id: 'thiazide', label: 'Thiazide', patch: { drugs: { thiazide: 1 } } },
  { id: 'sglt2i', label: 'SGLT2 inhibitor', patch: { drugs: { sglt2i: 1 } } },
  { id: 'dm', label: 'Glucose 400 mg/dL', patch: { glucose: 400 } },
  { id: 'volume', label: 'Volume depletion', patch: {}, depleted: 3 },
  { id: 'aldo', label: 'High aldosterone', patch: { aldoAutonomous: 5 } },
  { id: 'acid', label: 'Metabolic acidosis', patch: {}, hco3: 13 },
  { id: 'noadh', label: 'No ADH (central DI)', patch: { centralDI: 1 } },
];

interface Particle {
  s: number; // distance along the tube
  exitAt: number; // distance at which it leaves (Infinity = excreted)
  leaving: number; // >0 while fading out into the interstitium
  born: number;
  x: number;
  y: number;
}

export default function FlowSimulator() {
  const [solute, setSolute] = useState<SoluteId>('Na');
  const [scen, setScen] = useState('normal');
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

  // ------------------------------------------------ particle animation
  const svgRef = useRef<HTMLDivElement>(null);
  const cfg = useRef({ perSeg, solute });
  cfg.current = { perSeg, solute };
  useEffect(() => {
    const host = svgRef.current?.querySelector('svg');
    const layer = host?.querySelector('g.flow-particles') as SVGGElement | null;
    if (!host || !layer) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
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
    const nodes: SVGCircleElement[] = [];
    let raf = 0;
    let last = performance.now();
    let spawnAcc = 0;
    const speed = total / 9; // seconds to traverse the whole nephron
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      spawnAcc += dt * 18;
      while (spawnAcc > 1) {
        spawnAcc -= 1;
        ps.push({ s: 0, exitAt: plan(), leaving: 0, born: now, x: 0, y: 0 });
      }
      // Secretion: new particles appear partway along, in proportion to the amount added.
      for (const d of cfg.current.perSeg) {
        if (d.delta < -0.001) {
          const b = segOf(d.id);
          if (Math.random() < Math.min(1, -d.delta) * dt * 14) {
            const s0 = b.start + Math.random() * (b.end - b.start);
            ps.push({ s: s0, exitAt: Infinity, leaving: 0, born: now, x: 0, y: 0 });
          }
        }
      }
      for (const p of ps) {
        if (p.leaving > 0) {
          p.leaving += dt;
          p.x += 18 * dt;
          p.y += 6 * dt;
          continue;
        }
        p.s += speed * dt;
        if (p.s >= p.exitAt) {
          p.leaving = 0.001;
          const pt = full.getPointAtLength(p.exitAt);
          p.x = pt.x + 8;
          p.y = pt.y;
          continue;
        }
        const pt = full.getPointAtLength(Math.min(p.s, total));
        p.x = pt.x + (Math.random() - 0.5) * 2;
        p.y = pt.y + (Math.random() - 0.5) * 2;
      }
      ps = ps.filter((p) => (p.leaving === 0 ? p.s < total + 30 : p.leaving < 1.2));
      while (nodes.length < ps.length) {
        const c = document.createElementNS(ns, 'circle');
        layer.appendChild(c);
        nodes.push(c);
      }
      const color = SOLUTES.find((x) => x.id === cfg.current.solute)!.color;
      nodes.forEach((c, i) => {
        const p = ps[i];
        if (!p) {
          c.setAttribute('r', '0');
          return;
        }
        const outOfTube = p.s >= total;
        c.setAttribute('cx', String(outOfTube ? 462 : p.x));
        c.setAttribute('cy', String(outOfTube ? 676 + (p.s - total) : p.y));
        c.setAttribute('r', p.leaving > 0 ? '3' : '4.2');
        c.setAttribute('stroke', '#0b1b27');
        c.setAttribute('stroke-width', '1.2');
        c.setAttribute('fill', p.leaving > 0 ? '#ffffff' : color);
        c.setAttribute('opacity', p.leaving > 0 ? String(Math.max(0, 0.8 - p.leaving / 1.5)) : '0.95');
      });
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      host.removeChild(full);
      layer.innerHTML = '';
    };
  }, []);

  const label = SOLUTES.find((s) => s.id === solute)!.label;
  return (
    <div>
      <PageHead path="/flow" lede="Every particle entering the proximal tubule was filtered at the glomerulus. Follow one solute: particles leave the tubule (fading to white) in proportion to how much each segment reabsorbs, appear where the tubule secretes, and whatever is left reaches the urine. Change the scenario and the traffic changes." />
      <Tabs tabs={SOLUTES.map((s) => ({ id: s.id, label: s.label }))} active={solute} onChange={(id) => setSolute(id as SoluteId)} />
      <div class="btn-row">
        {SCENARIOS.map((s) => (
          <button key={s.id} class={scen === s.id ? 'active' : ''} onClick={() => setScen(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      <div class="grid grid-main-side" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <Panel title={`Where does filtered ${label} go?`}>
          <div ref={svgRef}>
            <NephronDiagram vessels={false} labels medullaOsm={ev.kidney.medullaTarget} overlay={<g class="flow-particles" />} />
          </div>
        </Panel>
        <div>
          <Panel title={`Fate of filtered ${label}`} note="Share of the filtered load reabsorbed (−) or added (+) in each segment, first hours of the scenario.">
            <p class="muted" style={{ fontSize: '0.85rem' }}>
              Filtered: {solute === 'water' ? `${(filtered * 1.44).toFixed(0)} L/day` : solute === 'glucose' || solute === 'creat' ? `${((filtered * 1440) / 1000).toFixed(1)} g/day` : `${(filtered * 1440).toFixed(0)} mmol/day`}
            </p>
            {perSeg.map((d) => (
              <BarRow
                key={d.id}
                label={`${SEGMENT_INFO[d.id].name} ${d.delta >= 0 ? 'reabsorbs' : 'adds'}`}
                value={Math.abs(d.delta) * 100}
                max={100}
                unit="%"
                color={d.delta >= 0 ? '#5ecfba' : '#e4696b'}
              />
            ))}
            <BarRow label="Excreted in the urine" value={excreted * 100} max={Math.max(100, excreted * 100)} unit="%" color="#f2b134" />
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
