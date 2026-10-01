import { useState } from 'preact/hooks';
import { equationById, initialValues, type EquationDef, type PatientCase } from '../content/equations';
import { href } from '../router';
import { readyRoute } from '../routes';
import { Panel, Sources } from './kit';
import { analyteOf, displayRange, fromDisplay, round, toDisplay, unitLabel, useUnits, varLabel, type Analyte } from './unitPref';

/** A live equation: every term is a slider, the result updates as you move it. */
export function EquationCard(props: { eq: EquationDef | string; compact?: boolean; values?: Record<string, number>; hideCase?: boolean }) {
  const eq = typeof props.eq === 'string' ? equationById.get(props.eq) : props.eq;
  const [vals, setVals] = useState<Record<string, number>>(() => ({ ...(eq ? initialValues(eq) : {}), ...(props.values ?? {}) }));
  const [showHow, setShowHow] = useState(false);
  const [showCase, setShowCase] = useState(false);
  const { units } = useUnits();
  if (!eq) return null;
  const r = eq.compute(vals);
  const pc = eq.patient;
  const onCase = !!pc && eq.vars.every((v) => vals[v.key] === (pc.values[v.key] ?? vals[v.key]));
  return (
    <div class="eq-card">
      <div class="eq-head">
        <h4>{eq.name}</h4>
        {eq.route && readyRoute(eq.route) && !props.compact && (
          <a href={href(eq.route)} class="tag">
            open simulator →
          </a>
        )}
      </div>
      <div class="equation" style={{ marginBottom: 8 }}>
        <div>{eq.formula}</div>
        <div style={{ color: 'var(--ink-dim)', marginTop: 4 }}>= {eq.show(vals)}</div>
        <div class="res" style={{ marginTop: 4, fontSize: '1.05rem' }}>
          = {Number.isFinite(r.value) ? r.value.toFixed(r.digits ?? 0) : '—'} {r.unit}
          {r.analyte && units === 'us' && Number.isFinite(r.value) && (
            <span class="muted">
              {' '}
              (= {toDisplay(r.analyte as Analyte, r.value, units).toFixed(1)} {unitLabel(r.analyte as Analyte, r.unit, units)})
            </span>
          )}
        </div>
        {r.read && <div class="control-hint" style={{ color: 'var(--ink-dim)' }}>{r.read}</div>}
      </div>
      <div class="eq-vars">
        {eq.vars.map((v) => {
          const a = analyteOf(v.key, v.unit);
          const rg = displayRange(a, v.min, v.max, v.step, units);
          const shown = round(toDisplay(a, vals[v.key], units), rg.digits);
          const setShown = (x: number) => {
            if (!Number.isFinite(x)) return;
            const siVal = Math.min(v.max, Math.max(v.min, fromDisplay(a, x, units)));
            setVals({ ...vals, [v.key]: a && units === 'us' ? siVal : round(siVal, rg.digits) });
          };
          const label = varLabel(a, v.label, units);
          const unit = unitLabel(a, v.unit, units);
          return (
            <div key={v.key} class="eq-var">
              <span class="eq-var-head">
                <span>{label}</span>
                <span>
                  <input
                    type="number"
                    class="eq-num"
                    value={shown}
                    min={rg.min}
                    max={rg.max}
                    step={rg.step}
                    aria-label={`${label}${unit ? ` (${unit})` : ''}`}
                    onChange={(e) => setShown(parseFloat((e.target as HTMLInputElement).value))}
                  />{' '}
                  {unit}
                </span>
              </span>
              <input
                type="range"
                min={rg.min}
                max={rg.max}
                step={rg.step}
                value={shown}
                aria-label={label}
                style={{ '--pct': `${((vals[v.key] - v.min) / (v.max - v.min)) * 100}%` }}
                onInput={(e) => setShown(parseFloat((e.target as HTMLInputElement).value))}
              />
            </div>
          );
        })}
      </div>
      {units === 'us' && eq.vars.some((v) => analyteOf(v.key, v.unit)) && (
        <p class="control-hint" style={{ marginTop: 4 }}>You enter US units; the formula above is worked in SI, as the lab calculates.</p>
      )}
      {!props.compact && <p class="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>{eq.explain}</p>}
      {!props.compact && eq.caveat && <p class="note caution" style={{ fontSize: '0.82rem' }}>{eq.caveat}</p>}
      {props.compact && (
        <div class="eq-more">
          <button class="ghost eq-toggle" aria-expanded={showHow} onClick={() => setShowHow(!showHow)}>
            {showHow ? '▾' : '▸'} How it works and when it misleads
          </button>
          {showHow && (
            <div class="eq-more-body">
              <p class="muted" style={{ fontSize: '0.85rem', margin: '0 0 8px' }}>{eq.explain}</p>
              {eq.caveat && <p class="note caution" style={{ fontSize: '0.82rem' }}>{eq.caveat}</p>}
            </div>
          )}
        </div>
      )}
      {pc && !props.hideCase && (
        <div class="eq-more eq-case">
          <button class="ghost eq-toggle" aria-expanded={showCase} onClick={() => setShowCase(!showCase)}>
            {showCase ? '▾' : '▸'} Try it on a patient: {pc.title}
          </button>
          {showCase && <PatientCaseView pc={pc} loaded={onCase} onLoad={() => setVals({ ...vals, ...pc.values })} onReset={() => setVals(initialValues(eq))} />}
        </div>
      )}
      {!props.compact && <Sources cite={eq.cite ?? { rose: eq.chapters, evidence: 'physiology' }} />}
    </div>
  );
}

/** A worked bedside example: the story, a button that loads its numbers, then the reasoning. */
export function PatientCaseView(props: { pc: PatientCase; loaded: boolean; onLoad?: () => void; onReset?: () => void }) {
  const { pc } = props;
  return (
    <div class="eq-more-body">
      <p style={{ fontSize: '0.88rem', margin: '0 0 8px' }}>{pc.story}</p>
      {props.onLoad && (
        <div class="btn-row" style={{ marginBottom: 8 }}>
          <button class={props.loaded ? 'active' : ''} onClick={props.onLoad}>
            {props.loaded ? '✓ Patient’s numbers loaded' : 'Load this patient’s numbers'}
          </button>
          {props.loaded && props.onReset && (
            <button class="ghost" onClick={props.onReset}>
              Back to defaults
            </button>
          )}
        </div>
      )}
      <ol class="case-steps">
        {pc.steps.map((st, i) => (
          <li key={i}>{st}</li>
        ))}
      </ol>
      <p class="note" style={{ fontSize: '0.86rem', marginBottom: 0 }}>
        <b>Takeaway:</b> {pc.takeaway}
      </p>
    </div>
  );
}

/** The equations a module leans on at the bedside, each with a worked patient case. */
export function BedsideEquations(props: { ids: string[]; intro: string }) {
  return (
    <Panel title="Equations at the bedside" note={props.intro} actions={<a class="tag" href={href('/bedside')}>worked patients →</a>}>
      <div class="grid grid-2">
        {props.ids.map((id) => (
          <EquationCard key={id} eq={id} compact />
        ))}
      </div>
    </Panel>
  );
}
