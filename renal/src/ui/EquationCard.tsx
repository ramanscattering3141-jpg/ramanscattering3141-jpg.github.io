import { useState } from 'preact/hooks';
import { equationById, initialValues, type EquationDef } from '../content/equations';
import { href } from '../router';
import { Sources } from './kit';

/** A live equation: every term is a slider, the result updates as you move it. */
export function EquationCard(props: { eq: EquationDef | string; compact?: boolean; values?: Record<string, number> }) {
  const eq = typeof props.eq === 'string' ? equationById.get(props.eq) : props.eq;
  const [vals, setVals] = useState<Record<string, number>>(() => ({ ...(eq ? initialValues(eq) : {}), ...(props.values ?? {}) }));
  if (!eq) return null;
  const r = eq.compute(vals);
  return (
    <div class="eq-card">
      <div class="eq-head">
        <h4>{eq.name}</h4>
        {eq.route && !props.compact && (
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
        </div>
        {r.read && <div class="control-hint" style={{ color: 'var(--ink-dim)' }}>{r.read}</div>}
      </div>
      <div class="eq-vars">
        {eq.vars.map((v) => (
          <label key={v.key} class="eq-var">
            <span>
              {v.label} <b class="mono">{vals[v.key]}</b> {v.unit}
            </span>
            <input
              type="range"
              min={v.min}
              max={v.max}
              step={v.step}
              value={vals[v.key]}
              style={{ '--pct': `${((vals[v.key] - v.min) / (v.max - v.min)) * 100}%` }}
              onInput={(e) => setVals({ ...vals, [v.key]: parseFloat((e.target as HTMLInputElement).value) })}
            />
          </label>
        ))}
      </div>
      {!props.compact && <p class="muted" style={{ fontSize: '0.85rem', marginTop: 6 }}>{eq.explain}</p>}
      {!props.compact && eq.caveat && <p class="note caution" style={{ fontSize: '0.82rem' }}>{eq.caveat}</p>}
      {!props.compact && <Sources cite={eq.cite ?? { rose: eq.chapters, evidence: 'physiology' }} />}
    </div>
  );
}
