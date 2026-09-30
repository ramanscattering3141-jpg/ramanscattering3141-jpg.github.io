import { useMemo, useState } from 'preact/hooks';
import { PageHead, FiveQuestions, WhatIf, Related, Toggle } from '../ui/page';
import { Panel, Readout, Slider, Chain, Sources, Predict, toneFor } from '../ui/kit';
import { EquationCard } from '../ui/EquationCard';
import { FiltrationAnimation } from '../ui/FiltrationAnimation';
import { GLOM_DEFAULT, intactKidney, isolatedGlomerulus, type GlomControls } from '../sim/glomerular';
import { useMode } from '../ui/mode';
import type { ProfilePoint } from '../engine/glomerulus';

function ProfileChart({ profile, base }: { profile: ProfilePoint[]; base?: ProfilePoint[] }) {
  const W = 640;
  const H = 290;
  const pad = { l: 52, r: 16, t: 30, b: 48 };
  const yMax = 80;
  const sx = (x: number) => pad.l + x * (W - pad.l - pad.r);
  const sy = (y: number) => H - pad.b - (Math.max(0, Math.min(yMax, y)) / yMax) * (H - pad.t - pad.b);
  const resist = profile.map((p) => ({ x: p.x, y: p.Pbs + p.pi }));
  const area = profile.map((p) => `${sx(p.x)},${sy(p.Pgc)}`).join(' ') + ' ' + [...resist].reverse().map((p) => `${sx(p.x)},${sy(Math.min(p.y, profile[0].Pgc))}`).join(' ');
  const eq = profile.find((p) => p.nfp <= 0.5 && p.x < 0.98);
  const axis = 'color-mix(in srgb, var(--mix) 40%, transparent)';
  // Label the net filtration pressure where the gap is widest (the afferent end).
  const mid = profile[Math.min(profile.length - 1, Math.round(profile.length * 0.08))];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Pressure (mmHg) against position along the glomerular capillary">
        {[0, 20, 40, 60, 80].map((y) => (
          <g key={y}>
            <line x1={pad.l} x2={W - pad.r} y1={sy(y)} y2={sy(y)} stroke="color-mix(in srgb, var(--mix) 9%, transparent)" />
            <text x={pad.l - 7} y={sy(y) + 4} class="svg-label" text-anchor="end">
              {y}
            </text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((x) => (
          <g key={x}>
            <line x1={sx(x)} x2={sx(x)} y1={H - pad.b} y2={H - pad.b + 4} stroke={axis} />
            <text x={sx(x)} y={H - pad.b + 17} class="svg-label" text-anchor={x === 0 ? 'start' : x === 1 ? 'end' : 'middle'}>
              {x === 0 ? '0% (afferent end)' : x === 1 ? '100% (efferent end)' : `${x * 100}%`}
            </text>
          </g>
        ))}
        <polygon points={area} fill="color-mix(in srgb, var(--c-teal) 22%, transparent)" />
        {base && (
          <>
            <polyline points={base.map((p) => `${sx(p.x)},${sy(p.Pgc)}`).join(' ')} fill="none" stroke="var(--c-red)" stroke-dasharray="4 4" opacity="0.5" />
            <polyline points={base.map((p) => `${sx(p.x)},${sy(p.Pbs + p.pi)}`).join(' ')} fill="none" stroke="var(--c-blue)" stroke-dasharray="4 4" opacity="0.5" />
          </>
        )}
        <polyline points={profile.map((p) => `${sx(p.x)},${sy(p.Pgc)}`).join(' ')} fill="none" stroke="var(--c-red)" stroke-width="2.6" />
        <polyline points={resist.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke="var(--c-blue)" stroke-width="2.6" />
        <polyline points={profile.map((p) => `${sx(p.x)},${sy(p.Pbs)}`).join(' ')} fill="none" stroke="var(--ink-dim)" stroke-width="1.4" stroke-dasharray="2 3" />
        {mid && mid.nfp > 3 && (
          <text x={sx(mid.x) + 6} y={(sy(mid.Pgc) + sy(mid.Pbs + mid.pi)) / 2 + 4} class="svg-label svg-halo" style={{ fill: 'var(--c-teal)', fontWeight: 600 }}>
            net filtration pressure {mid.nfp.toFixed(0)} mmHg
          </text>
        )}
        {!eq && (
          <text x={W - pad.r - 4} y={pad.t + 12} text-anchor="end" class="svg-label svg-halo" style={{ fill: 'var(--c-amber)', fontWeight: 600 }}>
            no equilibrium: still filtering at the efferent end
          </text>
        )}
        {eq && (
          <g>
            <line x1={sx(eq.x)} x2={sx(eq.x)} y1={pad.t} y2={H - pad.b} stroke="var(--c-amber)" stroke-dasharray="3 3" />
            <text x={eq.x > 0.6 ? sx(eq.x) - 5 : sx(eq.x) + 5} y={pad.t + 12} text-anchor={eq.x > 0.6 ? 'end' : 'start'} class="svg-label svg-halo" style={{ fill: 'var(--c-amber)', fontWeight: 600 }}>
              filtration stops here ({Math.round(eq.x * 100)}% along)
            </text>
          </g>
        )}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} stroke={axis} />
        <line x1={pad.l} x2={pad.l} y1={pad.t - 6} y2={H - pad.b} stroke={axis} />
        <text x={pad.l - 7} y={14} class="svg-label axis-title">
          ↑ Pressure (mmHg)
        </text>
        <text x={(W + pad.l) / 2} y={H - 6} class="svg-label axis-title" text-anchor="middle">
          Position along the glomerular capillary (% of its length) →
        </text>
      </svg>
      <div class="legend-row" style={{ marginTop: 4 }}>
        <span>
          <i style={{ background: 'var(--c-red)' }} /> Pgc: hydraulic pressure in the capillary, pushing fluid out
        </span>
        <span>
          <i style={{ background: 'var(--c-blue)' }} /> Pbs + π: Bowman&apos;s space pressure plus plasma oncotic pressure, holding fluid in
        </span>
        <span>
          <i style={{ background: 'var(--ink-dim)', height: 3 }} /> Pbs alone
        </span>
        <span>
          <i style={{ background: 'color-mix(in srgb, var(--c-teal) 45%, transparent)' }} /> shaded gap = net filtration pressure
        </span>
        {base && (
          <span>
            <i style={{ background: 'transparent', borderTop: '2px dashed var(--ink-faint)', height: 0 }} /> dashed = normal kidney
          </span>
        )}
      </div>
    </figure>
  );
}

const WHATIFS: { label: string; c: Partial<GlomControls>; explain: string }[] = [
  { label: 'Afferent constricts', c: { aff: 1.6 }, explain: 'Less of the arterial pressure reaches the glomerulus: Pgc, RPF and GFR all fall together. Filtration fraction barely changes.' },
  { label: 'Efferent constricts (moderate)', c: { eff: 1.8 }, explain: 'Pgc rises while plasma flow falls. GFR rises, so the filtration fraction rises steeply — and the blood leaving is more concentrated in protein.' },
  { label: 'Efferent constricts (severe)', c: { eff: 5 }, explain: 'Pgc keeps rising but plasma flow falls so far that oncotic pressure reaches equilibrium early: GFR stops rising and begins to fall.' },
  { label: 'Plasma protein rises (haemoconcentration)', c: { protein: 85 }, explain: 'Starting oncotic pressure is higher, so equilibrium is reached sooner and GFR falls — one contributor to reduced GFR in vomiting or diarrhoea.' },
  { label: 'Ureter obstructed', c: { pbs: 30 }, explain: "Bowman's space pressure opposes filtration directly: the net filtration pressure collapses." },
  { label: 'Glomerulonephritis (↓ surface area)', c: { area: 0.3 }, explain: 'A modest fall in Kf does little while equilibrium is still reached; a large fall prevents equilibrium, and then GFR falls in proportion.' },
  { label: 'Blood pressure falls to 65', c: { map: 65 }, explain: 'With the arterioles held fixed, GFR falls steeply. In the intact kidney autoregulation dilates the afferent arteriole — until it runs out below ~70 mmHg.' },
];

export default function Gfr() {
  const { mode } = useMode();
  const [c, setC] = useState<GlomControls>(GLOM_DEFAULT);
  const [intact, setIntact] = useState(false);
  const set = (k: keyof GlomControls) => (v: number) => setC({ ...c, [k]: v });

  const g = useMemo(() => isolatedGlomerulus(c), [c]);
  const base = useMemo(() => isolatedGlomerulus(GLOM_DEFAULT), []);
  const k = useMemo(() => intactKidney(c), [c]);
  const kBase = useMemo(() => intactKidney(GLOM_DEFAULT), []);

  const GFR = intact ? k.GFR : g.GFR;
  const RPF = intact ? k.RPF : g.RPF;
  const RBF = intact ? k.RBF : g.RBF;
  const Pgc = intact ? k.Pgc : g.Pgc;
  const FF = RPF > 0 ? GFR / RPF : 0;
  const bGFR = intact ? kBase.GFR : base.GFR;
  const bRPF = intact ? kBase.RPF : base.RPF;
  const profile = g.profile;

  return (
    <div>
      <PageHead path="/gfr" lede="Filtration is a balance of pressures along a capillary. Change any Starling force and watch the net filtration pressure, filtration equilibrium and GFR respond — then switch on the kidney’s own control systems and see how much they give back." />

      <WhatIf
        options={WHATIFS.map((w) => ({ label: w.label, explain: w.explain }))}
        onApply={(o) => setC({ ...GLOM_DEFAULT, ...WHATIFS.find((w) => w.label === o.label)!.c })}
        onReset={() => setC(GLOM_DEFAULT)}
      />

      <div class="grid grid-sidebar">
        <div>
          <Panel title="Controls">
            <Slider label="Renal artery pressure" value={c.map} min={30} max={200} unit="mmHg" onInput={set('map')} normal={93} />
            <Slider label="Afferent resistance" value={c.aff} min={0.4} max={3} step={0.05} unit="× normal" onInput={set('aff')} normal={1} />
            <Slider label="Efferent resistance" value={c.eff} min={0.3} max={8} step={0.05} unit="× normal" onInput={set('eff')} normal={1} />
            <Slider label="Plasma protein" value={c.protein} min={30} max={100} step={1} unit="g/L" onInput={set('protein')} normal={70} hint={`Afferent oncotic pressure ≈ ${g.piAff.toFixed(0)} mmHg`} />
            <Slider label="Bowman's space pressure" value={c.pbs} min={0} max={50} step={0.5} unit="mmHg" onInput={set('pbs')} normal={10} />
            <Slider label="Hydraulic conductivity (Lp)" value={c.lp} min={0.1} max={2} step={0.05} unit="× normal" onInput={set('lp')} />
            <Slider label="Filtration surface area (S)" value={c.area} min={0.1} max={2} step={0.05} unit="× normal" onInput={set('area')} />
            {mode === 'quantitative' && <Slider label="Renal venous pressure" value={c.venous} min={2} max={30} step={0.5} unit="mmHg" onInput={set('venous')} normal={4} />}
            <Toggle label="Intact kidney: let autoregulation and TGF respond" checked={intact} onChange={setIntact} hint="Off: arteriolar tones held exactly where you set them. On: the myogenic response and tubuloglomerular feedback adjust afferent tone on top of your setting." />
          </Panel>
          <Panel title="Results">
            <div class="readout-grid">
              <Readout label="GFR" value={GFR} unit="mL/min" delta={GFR - bGFR} tone={toneFor(GFR, 90, 160)} />
              <Readout label="Renal plasma flow" value={RPF} unit="mL/min" delta={RPF - bRPF} />
              <Readout label="Renal blood flow" value={RBF} unit="mL/min" />
              <Readout label="Filtration fraction" value={FF * 100} digits={1} unit="%" tone={toneFor(FF, 0.15, 0.25)} />
              <Readout label="Pgc" value={Pgc} digits={1} unit="mmHg" />
              <Readout label="NFP, afferent end" value={g.nfpAff} digits={1} unit="mmHg" />
              {mode === 'quantitative' && <Readout label="NFP, mean" value={g.meanNFP} digits={1} unit="mmHg" />}
              {mode === 'quantitative' && <Readout label="Efferent oncotic π" value={g.piEff} digits={1} unit="mmHg" />}
              {mode === 'quantitative' && <Readout label="Kf" value={34 * c.lp * c.area} digits={1} unit="mL/min/mmHg" />}
              {mode === 'quantitative' && <Readout label="Renal vascular resistance" value={g.RVR} digits={3} unit="mmHg·min/mL" />}
              {intact && <Readout label="Urine flow" value={k.urine.volumePerDay} digits={2} unit="L/day" />}
              {intact && <Readout label="Urine Na⁺ excretion" value={k.urine.exc.Na} unit="mmol/day" />}
            </div>
            <p class="control-hint" style={{ marginTop: 8 }}>
              Δ values compare with normal ({intact ? 'intact kidney' : 'isolated glomerulus'}). {intact ? 'Hormones are held at normal so you see only the kidney’s intrinsic responses.' : ''}
            </p>
          </Panel>
        </div>
        <div>
          <Panel title="Forces along the glomerular capillary" note="Read left to right as blood travels from the afferent to the efferent end of one glomerular capillary. The hydraulic pressure pushing fluid out (red) stays nearly flat. The pressure holding fluid in (blue) climbs, because protein-free fluid leaves and the plasma proteins left behind become more concentrated. Filtration stops where the two meet.">
            <ProfileChart profile={profile} base={base.profile} />
            <FiltrationAnimation profile={profile} flow={g.RPF / base.RPF} barrierLeak={0} />
          </Panel>
          <div class="grid grid-2">
            <Panel title="Causal chain">
              <Chain
                steps={[
                  { text: `Pgc ${Pgc.toFixed(0)} mmHg (normal ${base.Pgc.toFixed(0)})`, direction: Math.sign(Pgc - base.Pgc) as 1 | -1 | 0 },
                  { text: `Plasma flow ${RPF.toFixed(0)} mL/min`, direction: Math.abs(RPF - bRPF) < 5 ? 0 : (Math.sign(RPF - bRPF) as 1 | -1) },
                  { text: g.equilibrium ? `Filtration equilibrium reached ${Math.round(g.xEq * 100)}% along the capillary: flow-limited` : 'No equilibrium: filtration continues to the efferent end (Kf- or pressure-limited)' },
                  { text: `GFR ${GFR.toFixed(0)} mL/min`, direction: Math.abs(GFR - bGFR) < 3 ? 0 : (Math.sign(GFR - bGFR) as 1 | -1) },
                  { text: `Filtration fraction ${(FF * 100).toFixed(0)}% → peritubular oncotic pressure ${g.piEff.toFixed(0)} mmHg (drives proximal reabsorption)` },
                ]}
              />
            </Panel>
            <Predict
              question="Plasma flow falls 30% while glomerular pressure is held constant. What happens to GFR?"
              options={['No change', 'Falls roughly in proportion', 'Rises']}
              correct={1}
              explanation="Because filtration normally reaches equilibrium, the rise in oncotic pressure — not the membrane — is what stops it. Less plasma reaches equilibrium just as fast, so GFR falls with flow. Try it: raise efferent resistance a lot and watch equilibrium move toward the afferent end."
            />
          </div>
        </div>
      </div>

      <div class="grid grid-2">
        <EquationCard eq="nfp" />
        <EquationCard eq="ff" />
      </div>

      <Panel title="The five questions">
        <FiveQuestions
          normal={<p>About a fifth of the plasma reaching the glomerulus is filtered (~125 mL/min). The net filtration pressure starts near 13 mmHg and falls to zero before the efferent end.</p>}
          why={<p>Glomerular capillary pressure (~45 mmHg) is set by two resistances in series; protein-free filtrate leaves behind rising oncotic pressure that eventually balances it.</p>}
          change={<p>Afferent tone moves Pgc and flow together; efferent tone moves them in opposite directions; flow matters because of equilibrium; Kf matters only once equilibrium is lost.</p>}
          abnormal={<p>Obstruction (↑ Pbs), glomerulonephritis (↓ surface area), haemoconcentration (↑ π) and loss of perfusion pressure each reduce GFR by a different term of the same equation.</p>}
          clinical={<p>GFR is the index of functioning renal mass; its fall may be the first sign of kidney disease. Follow it with creatinine, remembering creatinine’s lag and its dependence on muscle mass.</p>}
        />
        <Sources cite={{ rose: [2], evidence: 'physiology', refs: ['deen1972'] }} />
      </Panel>
      <Related paths={['/arterioles', '/autoregulation', '/glomerular', '/obstruction', '/clearance', '/creatinine']} />
    </div>
  );
}
