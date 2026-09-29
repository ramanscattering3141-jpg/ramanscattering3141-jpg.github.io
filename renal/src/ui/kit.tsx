// Shared interface pieces: sliders, readouts, evidence badges, cascades, charts.
// Every simulator is assembled from these, so the whole laboratory reads as one instrument.

import { type ComponentChildren, type JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EVIDENCE_DESCRIPTION, EVIDENCE_LABEL, formatRef, ref, refUrl, type Citation, type Evidence } from '../content/sources';

export function Panel(props: { title?: string; note?: string; children: ComponentChildren; actions?: ComponentChildren; id?: string }) {
  return (
    <section class="panel" id={props.id}>
      {(props.title || props.actions) && (
        <div class="panel-title">
          {props.title ? <h3>{props.title}</h3> : <span />}
          {props.actions}
        </div>
      )}
      {props.note && <p class="panel-note">{props.note}</p>}
      {props.children}
    </section>
  );
}

export function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  format?: (v: number) => string;
  onInput: (v: number) => void;
  /** marks the normal value on the track */
  normal?: number;
}) {
  const { min, max, value } = props;
  const pct = ((value - min) / (max - min)) * 100;
  const shown = props.format ? props.format(value) : value.toFixed(props.step && props.step < 1 ? 2 : 0);
  return (
    <div class="control">
      <div class="control-head">
        <label for={`s-${props.label}`}>{props.label}</label>
        <span class="control-value">
          {shown}
          {props.unit ? ` ${props.unit}` : ''}
        </span>
      </div>
      <input
        id={`s-${props.label}`}
        type="range"
        min={min}
        max={max}
        step={props.step ?? 1}
        value={value}
        style={{ '--pct': `${pct}%` } as JSX.CSSProperties}
        onInput={(e) => props.onInput(parseFloat((e.target as HTMLInputElement).value))}
      />
      {props.hint && <div class="control-hint">{props.hint}</div>}
    </div>
  );
}

export type ReadoutTone = 'normal' | 'high' | 'low' | 'danger' | 'good';

/** Decide how to colour a value against its reference range. */
export function toneFor(value: number, low?: number, high?: number, danger?: [number, number]): ReadoutTone {
  if (danger && (value <= danger[0] || value >= danger[1])) return 'danger';
  if (high !== undefined && value > high) return 'high';
  if (low !== undefined && value < low) return 'low';
  return 'normal';
}

export function Readout(props: {
  label: string;
  value: number | string;
  unit?: string;
  digits?: number;
  refRange?: string;
  tone?: ReadoutTone;
  /** shows a small bar: [value, min, max] */
  bar?: [number, number, number];
  delta?: number;
  deltaDigits?: number;
  title?: string;
}) {
  const v = typeof props.value === 'number' ? props.value.toFixed(props.digits ?? 0) : props.value;
  const d = props.delta;
  const dClass = d === undefined ? '' : Math.abs(d) < 1e-9 ? 'same' : d > 0 ? 'up' : 'down';
  return (
    <div class={`readout ${props.tone ?? 'normal'}`} title={props.title}>
      <div class="label">{props.label}</div>
      <div class="value">
        {v}
        {props.unit && <span class="unit">{props.unit}</span>}
        {d !== undefined && (
          <span class={`delta ${dClass}`}>
            {d > 0 ? '▲' : d < 0 ? '▼' : '='} {Math.abs(d).toFixed(props.deltaDigits ?? props.digits ?? 0)}
          </span>
        )}
      </div>
      {props.refRange && <div class="ref">{props.refRange}</div>}
      {props.bar && (
        <div class="bar">
          <i style={{ left: '0%', width: `${Math.max(2, Math.min(100, ((props.bar[0] - props.bar[1]) / (props.bar[2] - props.bar[1])) * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

export function EvidenceBadge({ evidence }: { evidence: Evidence }) {
  return (
    <span class={`badge ${evidence}`} title={EVIDENCE_DESCRIPTION[evidence]}>
      {EVIDENCE_LABEL[evidence]}
    </span>
  );
}

/** Citation block: evidence grade, textbook chapters and verified external references. */
export function Sources({ cite, inline }: { cite?: Citation; inline?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!cite) return null;
  const refs = (cite.refs ?? []).map(ref).filter(Boolean);
  return (
    <div style={{ marginTop: inline ? 4 : 8 }}>
      <div class="chips" style={{ alignItems: 'center' }}>
        <EvidenceBadge evidence={cite.evidence} />
        {cite.rose?.length ? <span class="tag">Rose &amp; Post ch. {cite.rose.join(', ')}</span> : null}
        {cite.update ? <span class="badge update">Modern update</span> : null}
        {(refs.length > 0 || cite.update) && (
          <button class="ghost" style={{ padding: '0 6px', fontSize: '0.74rem' }} onClick={() => setOpen(!open)}>
            {open ? 'Hide sources' : 'Sources'}
          </button>
        )}
      </div>
      {open && (
        <div style={{ marginTop: 6, fontSize: '0.82rem' }} class="muted">
          {cite.update && (
            <p class="note update" style={{ marginBottom: 8 }}>
              <strong>Where this differs from the 2001 text:</strong> {cite.update}
            </p>
          )}
          {refs.map((r) => (
            <div key={r!.pmid} style={{ marginBottom: 5 }}>
              {formatRef(r!)}{' '}
              <a href={refUrl(r!)} target="_blank" rel="noreferrer noopener">
                {r!.doi ? 'DOI' : 'PubMed'}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** A causal chain, rendered as an ordered list of consequences. */
export function Chain({ steps }: { steps: { text: string; direction?: 1 | -1 | 0; mechanism?: string }[] }) {
  return (
    <ul class="cascade">
      {steps.map((s, i) => (
        <li key={i} class={s.direction === 1 ? 'up' : s.direction === -1 ? 'down' : ''}>
          <span class="arrow">{s.direction === 1 ? '↑' : s.direction === -1 ? '↓' : '→'}</span>
          {s.text}
          {s.mechanism && <span class="mech">{s.mechanism}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Simple responsive line chart. Series share one y-scale unless `scales` is given. */
export interface Series {
  label: string;
  points: { x: number; y: number }[];
  color?: string;
  dashed?: boolean;
}

/** Width of an element, tracked as it resizes (charts draw at their real pixel width). */
export function useWidth<T extends Element>(fallback = 640) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && Math.abs(cw - w) > 1) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return [ref, w] as const;
}

/** Round axis ticks (1, 2, 2.5, 5 × 10ⁿ). */
export function niceTicks(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  return out;
}

const fmtTick = (v: number) => (Math.abs(v) >= 100 || Number.isInteger(v) ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(Math.abs(v) < 1 ? 2 : 1));

export function LineChart(props: {
  series: Series[];
  xLabel?: string;
  yLabel?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  /** horizontal reference bands, e.g. the normal range */
  bands?: { from: number; to: number; label?: string; color?: string }[];
  /** vertical marker, e.g. "now" */
  marker?: number;
  /** format x tick labels (e.g. undo a log scale) */
  xFormat?: (x: number) => string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const h = props.height ?? 200;
  const pad = { l: 44, r: 12, t: 10, b: props.xLabel ? 38 : 22 };
  const all = props.series.flatMap((s) => s.points).filter((p) => Number.isFinite(p.y));
  if (all.length === 0) return <div ref={ref} />;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  let y0 = props.yMin ?? Math.min(...ys, ...(props.bands ?? []).map((b) => b.from));
  let y1 = props.yMax ?? Math.max(...ys, ...(props.bands ?? []).map((b) => b.to));
  if (y1 - y0 < 1e-9) {
    y0 -= 1;
    y1 += 1;
  } else if (props.yMax === undefined) y1 += (y1 - y0) * 0.06;
  const w = Math.max(240, width);
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0 || 1)) * (w - pad.l - pad.r);
  const sy = (y: number) => h - pad.b - ((Math.max(y0, Math.min(y1, y)) - y0) / (y1 - y0 || 1)) * (h - pad.t - pad.b);
  const palette = ['#5ecfba', '#f2b134', '#6aa9e8', '#b08ee0', '#7bc47f', '#e4696b'];
  const yt = niceTicks(y0, y1, 4);
  const xt = niceTicks(x0, x1, Math.max(3, Math.floor(w / 110)));
  return (
    <figure ref={ref}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label={`${props.yLabel ?? 'value'} against ${props.xLabel ?? 'x'}`}>
        {(props.bands ?? []).map((b, i) => (
          <rect key={i} x={pad.l} y={sy(b.to)} width={w - pad.l - pad.r} height={Math.max(1, sy(b.from) - sy(b.to))} fill={b.color ?? '#7bc47f'} opacity="0.09" />
        ))}
        {yt.map((y) => (
          <g key={`y${y}`}>
            <line x1={pad.l} x2={w - pad.r} y1={sy(y)} y2={sy(y)} stroke="#ffffff12" />
            <text class="svg-label" x={pad.l - 6} y={sy(y) + 3} textAnchor="end">
              {fmtTick(y)}
            </text>
          </g>
        ))}
        {xt.map((x) => (
          <text key={`x${x}`} class="svg-label" x={sx(x)} y={h - pad.b + 14} textAnchor="middle">
            {props.xFormat ? props.xFormat(x) : fmtTick(x)}
          </text>
        ))}
        {props.marker !== undefined && <line x1={sx(props.marker)} x2={sx(props.marker)} y1={pad.t} y2={h - pad.b} stroke="#ffffff55" strokeDasharray="3 3" />}
        {props.series.map((s, i) => (
          <polyline
            key={s.label}
            points={s.points
              .filter((p) => Number.isFinite(p.y))
              .map((p) => `${sx(p.x)},${sy(p.y)}`)
              .join(' ')}
            fill="none"
            stroke={s.color ?? palette[i % palette.length]}
            strokeWidth="2"
            strokeDasharray={s.dashed ? '5 4' : undefined}
            strokeLinejoin="round"
            opacity={s.dashed ? 0.6 : 1}
          />
        ))}
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke="#ffffff25" />
        {props.xLabel && (
          <text class="svg-label" x={(w + pad.l) / 2} y={h - 4} textAnchor="middle">
            {props.xLabel}
          </text>
        )}
      </svg>
      {props.series.length > 1 && (
        <div class="chips" style={{ marginTop: 2 }}>
          {props.series.map((s, i) => (
            <span key={s.label} class="tag" style={{ color: s.color ?? palette[i % palette.length] }}>
              {s.dashed ? '┅' : '■'} {s.label}
            </span>
          ))}
        </div>
      )}
      {props.yLabel && <figcaption>{props.yLabel}</figcaption>}
    </figure>
  );
}

/** Horizontal bar comparison, for things like segmental reabsorption. */
export function BarRow(props: { label: string; value: number; max: number; unit?: string; color?: string; sub?: string }) {
  const pct = Math.max(0, Math.min(100, (props.value / props.max) * 100));
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.83rem' }}>
        <span>{props.label}</span>
        <span class="mono">
          {props.value.toFixed(props.value < 10 ? 2 : 0)}
          {props.unit ? ` ${props.unit}` : ''}
        </span>
      </div>
      <div style={{ height: 6, background: '#ffffff12', borderRadius: 4, marginTop: 3, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: props.color ?? 'var(--accent)', borderRadius: 4 }} />
      </div>
      {props.sub && <div class="control-hint">{props.sub}</div>}
    </div>
  );
}

/** A question the learner answers before seeing the simulation. */
export function Predict(props: { question: string; options: string[]; correct: number; explanation: ComponentChildren }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div class="panel" style={{ borderColor: 'var(--accent-dim)' }}>
      <h4 style={{ color: 'var(--accent)', marginBottom: 6 }}>Predict first</h4>
      <p style={{ marginBottom: 8 }}>{props.question}</p>
      <div class="btn-row">
        {props.options.map((o, i) => (
          <button
            key={o}
            class={picked === null ? '' : i === props.correct ? 'primary' : picked === i ? '' : 'ghost'}
            style={picked !== null && picked === i && i !== props.correct ? { borderColor: 'var(--danger)' } : undefined}
            onClick={() => setPicked(i)}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div class="note" style={{ marginBottom: 0 }}>
          <strong>{picked === props.correct ? 'That is right.' : 'Not quite.'}</strong> {props.explanation}
        </div>
      )}
    </div>
  );
}

/** Collapsible detail, used to keep dense pages readable. */
export function Expand(props: { summary: string; children: ComponentChildren; open?: boolean }) {
  const [open, setOpen] = useState(props.open ?? false);
  return (
    <div style={{ marginBottom: 10 }}>
      <button class="ghost" style={{ width: '100%', textAlign: 'left', borderStyle: 'dashed' }} onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? '▾' : '▸'} {props.summary}
      </button>
      {open && <div style={{ padding: '9px 2px 2px' }}>{props.children}</div>}
    </div>
  );
}

/** Tabs, used where a module has several related views. */
export function Tabs<T extends string>(props: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div class="btn-row" role="tablist">
      {props.tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={props.active === t.id} class={props.active === t.id ? 'active' : ''} onClick={() => props.onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Shows a live equation with the learner's numbers substituted in. */
export function Equation(props: { formula: string; substituted?: string; result?: string; note?: string }) {
  return (
    <div class="equation">
      <div>{props.formula}</div>
      {props.substituted && <div style={{ color: 'var(--ink-dim)', marginTop: 4 }}>{props.substituted}</div>}
      {props.result && (
        <div class="res" style={{ marginTop: 4 }}>
          = {props.result}
        </div>
      )}
      {props.note && <div class="control-hint">{props.note}</div>}
    </div>
  );
}

/** Formats a number for display without pretending to more precision than the model has. */
export function useFormat() {
  return useMemo(
    () => ({
      n: (v: number, d = 0) => (Number.isFinite(v) ? v.toFixed(d) : '—'),
      pct: (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—'),
    }),
    [],
  );
}
