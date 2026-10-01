import { si } from '../units';
import { useMemo, useState } from 'preact/hooks';
import { PageHead, Related } from '../ui/page';
import { Panel, Readout, Slider, Sources } from '../ui/kit';
import { NephronDiagram, type Callout, type Mark, type StructureId } from '../ui/NephronDiagram';
import { HORMONES, SITE_ACTIONS } from '../content/hormones';
import { acute, makeParams, NORMAL } from '../sim/hooks';
import { href } from '../router';
import { readyRoute } from '../routes';
import type { ParamPatch } from '../engine/types';

/** Which hormones can be driven directly in the engine, and how. */
const DRIVE: Record<string, { label: string; min: number; max: number; step: number; unit: string; patch: (v: number) => ParamPatch; base: number; format?: (v: number) => string }> = {
  adh: { label: 'Plasma ADH (fixed)', min: 0, max: 12, step: 0.25, unit: 'pmol/L', base: 1.5, format: (v) => si.adh(v).toFixed(1), patch: (v) => ({ adhAutonomous: v, centralDI: 1 }) },
  aldosterone: { label: 'Aldosterone (autonomous)', min: 0, max: 8, step: 0.25, unit: '× normal', base: 1, patch: (v) => ({ aldoAutonomous: v, aldoSynthesis: v < 0.2 ? 0.05 : 1 }) },
  angII: { label: 'Renin (autonomous)', min: 0, max: 8, step: 0.25, unit: '× normal', base: 1, patch: (v) => ({ reninAutonomous: v }) },
  catecholamines: { label: 'Sympathetic tone', min: 0.4, max: 4, step: 0.1, unit: '×', base: 1, patch: (v) => ({ snsOverride: v }) },
  pth: { label: 'PTH', min: 0, max: 2, step: 1, unit: '(0 low · 1 auto · 2 high)', base: 1, patch: (v) => ({ pthMode: v === 0 ? 'low' : v === 2 ? 'high' : 'auto' }) },
  pg: { label: 'NSAID (blocks prostaglandins)', min: 0, max: 1, step: 0.1, unit: '', base: 0, patch: (v) => ({ drugs: { nsaid: v }, cardiacFunction: 0.6 }) },
};

export default function Hormones({ query }: { query: URLSearchParams }) {
  const [id, setId] = useState(query.get('h') ?? 'adh');
  const all = id === 'all';
  const h = HORMONES.find((x) => x.id === id) ?? HORMONES[0];
  const short = (x: (typeof HORMONES)[number]) => x.name.split(' (')[0];

  // What goes on the drawing: one hormone's actions site by site, or every hormone at once.
  const { marks, callouts } = useMemo(() => {
    const marks: Partial<Record<StructureId, Mark>> = {};
    const callouts: Callout[] = [];
    if (all) {
      const bySite = new Map<StructureId, string[]>();
      for (const x of HORMONES) for (const s of x.sites) bySite.set(s, [...(bySite.get(s) ?? []), short(x)]);
      for (const [s, names] of bySite) {
        marks[s] = 'active';
        callouts.push({ id: s, text: names.join(' · '), tone: 'info' });
      }
    } else {
      const acts = SITE_ACTIONS[h.id] ?? {};
      for (const s of h.sites) {
        const a = acts[s];
        marks[s] = a?.tone === 'down' ? 'down' : 'active';
        callouts.push({ id: s, text: a?.text ?? 'Receptors present', tone: a?.tone ?? 'up' });
      }
    }
    return { marks, callouts };
  }, [id]);
  const drive = DRIVE[h.id];
  const [level, setLevel] = useState<Record<string, number>>({});
  const v = level[h.id] ?? drive?.base ?? 1;
  const ev = useMemo(() => (drive ? acute(makeParams(drive.patch(v))) : null), [h.id, v]);
  const n = NORMAL();

  return (
    <div>
      <PageHead path="/hormones" lede="Each hormone acts on particular cells through a particular second messenger. Pick one to see where it acts on the nephron, what controls it, what it does — and, where the model can, drive it and watch the kidney respond." />
      <div class="btn-row">
        <button class={all ? 'active' : ''} onClick={() => setId('all')}>
          All hormones
        </button>
        {HORMONES.map((x) => (
          <button key={x.id} class={x.id === id ? 'active' : ''} onClick={() => setId(x.id)}>
            {short(x)}
          </button>
        ))}
      </div>
      <Panel
        title={all ? 'Every hormone, site by site' : `Where ${short(h)} acts`}
        note={all ? 'Each box lists the hormones with receptors at that structure. Pick one hormone above to see what it does there.' : undefined}
      >
        {!all && (
          <div class="legend-row">
            <span>
              <i style={{ background: 'var(--c-orange)' }} /> stimulates transport or constricts
            </span>
            <span>
              <i style={{ background: 'var(--c-blue)' }} /> inhibits transport or dilates
            </span>
            <span>
              <i style={{ background: 'var(--ink-dim)' }} /> other action
            </span>
            <span>
              <i style={{ background: 'var(--c-dim)' }} /> no direct action
            </span>
          </div>
        )}
        <NephronDiagram labels dimUnmarked marks={marks} callouts={callouts} height={760} title={all ? 'Sites of hormone action along the nephron' : `Sites of ${short(h)} action along the nephron`} />
      </Panel>
      {!all && (
      <div class="grid grid-main-side" style={{ '--main-side': 'minmax(0, 1.1fr) minmax(0, 1fr)' }}>
        <Panel title={h.name}>
          <p class="muted">{h.source}</p>
          <p>
            <strong>Signal:</strong> {h.messenger}
          </p>
          <div class="grid grid-2">
            <div>
              <h4>Stimulated by</h4>
              <ul>{h.stimuli.map((s) => <li key={s}>{s}</li>)}</ul>
            </div>
            <div>
              <h4>Inhibited by</h4>
              <ul>{h.inhibitors.length ? h.inhibitors.map((s) => <li key={s}>{s}</li>) : <li class="faint">—</li>}</ul>
            </div>
          </div>
          <h4>Renal actions</h4>
          <ul>{h.actions.map((s) => <li key={s}>{s}</li>)}</ul>
          <div class="grid grid-2">
            <div class="note caution">
              <strong>Primary excess.</strong> {h.excess}
            </div>
            <div class="note">
              <strong>Deficiency or blockade.</strong> {h.deficiency}
            </div>
          </div>
          <h4>Drugs</h4>
          <div class="chips">{h.drugs.map((d) => <span key={d} class="tag">{d}</span>)}</div>
          <Sources cite={h.cite} />
          {h.route && readyRoute(h.route) && (
            <p style={{ marginTop: 10 }}>
              <a class="btn primary-link" href={href(h.route)}>
                Explore in depth →
              </a>
            </p>
          )}
        </Panel>
        <div>
          {drive && ev && (
            <Panel title="Drive it" note="Integrated model, first hours after the change.">
              <Slider label={drive.label} value={v} min={drive.min} max={drive.max} step={drive.step} unit={drive.unit} format={drive.format} onInput={(x) => setLevel({ ...level, [h.id]: x })} />
              <div class="readout-grid">
                <Readout label="Urine volume" value={ev.kidney.urine.volumePerDay} digits={2} unit="L/d" delta={ev.kidney.urine.volumePerDay - n.kidney.urine.volumePerDay} deltaDigits={2} />
                <Readout label="Urine osm" value={ev.kidney.urine.osm} unit="mOsm/kg" />
                <Readout label="Urine Na⁺" value={ev.kidney.urine.exc.Na} unit="mmol/d" delta={ev.kidney.urine.exc.Na - n.kidney.urine.exc.Na} />
                <Readout label="Urine K⁺" value={ev.kidney.urine.exc.K} unit="mmol/d" delta={ev.kidney.urine.exc.K - n.kidney.urine.exc.K} />
                <Readout label="GFR" value={ev.kidney.GFR} unit="mL/min" />
                <Readout label="RBF" value={ev.kidney.RBF} unit="mL/min" />
                <Readout label="Urine Ca²⁺" value={ev.kidney.urine.exc.Ca} digits={1} unit="mmol/d" />
                <Readout label="Urine phosphate" value={ev.kidney.urine.exc.Pi} unit="mmol/d" />
              </div>
            </Panel>
          )}
        </div>
      </div>
      )}
      <Panel title="Primary disorders at a glance (Rose ch. 6 summary)">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hormone</th>
                <th>Primary excess</th>
                <th>Deficiency or blockade</th>
              </tr>
            </thead>
            <tbody>
              {HORMONES.map((x) => (
                <tr key={x.id}>
                  <td>
                    <a href={href('/hormones', { h: x.id })} onClick={() => setId(x.id)}>
                      {x.name}
                    </a>
                  </td>
                  <td>{x.excess}</td>
                  <td>{x.deficiency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Related paths={['/raas', '/adh', '/minerals', '/sodium', '/potassium']} />
    </div>
  );
}
