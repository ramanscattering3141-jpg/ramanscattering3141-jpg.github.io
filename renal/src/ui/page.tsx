// Page-level building blocks shared by every module: the header with its textbook provenance,
// the five-question frame, "what if?" buttons and links onwards.

import { type ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { href } from '../router';
import { ROUTES, routeByPath } from '../routes';
import { roseChapter } from '../content/sources';
import type { ParamPatch } from '../engine/types';

export function PageHead(props: { path: string; eyebrow?: string; lede?: ComponentChildren; children?: ComponentChildren }) {
  const r = routeByPath.get(props.path);
  return (
    <header class="page-head">
      <div class="eyebrow">{props.eyebrow ?? r?.group.replace(/^./, (c) => c.toUpperCase())}</div>
      <h1>{r?.title}</h1>
      <p class="lede">{props.lede ?? r?.blurb}</p>
      {r?.chapters?.length ? (
        <div class="chips" style={{ marginTop: -4 }}>
          {r.chapters.map((n) => (
            <a key={n} class="tag chapter-tag" href={href('/textbook', { ch: String(n) })} title={`Open chapter ${n} in the interactive textbook`}>
              Rose &amp; Post ch. {n}: {roseChapter(n)?.title}
            </a>
          ))}
        </div>
      ) : null}
      {props.children}
    </header>
  );
}

/** The five questions every concept should answer (normal → why → perturb → abnormal → clinical). */
export function FiveQuestions(props: { normal: ComponentChildren; why: ComponentChildren; change: ComponentChildren; abnormal: ComponentChildren; clinical: ComponentChildren }) {
  const items: [string, ComponentChildren][] = [
    ['What normally happens?', props.normal],
    ['Why does it happen?', props.why],
    ['What if I change the variable?', props.change],
    ['When the physiology fails', props.abnormal],
    ['How it shows up clinically', props.clinical],
  ];
  return (
    <div class="five">
      {items.map(([h, body], i) => (
        <div class="five-item" key={h}>
          <div class="five-n">{i + 1}</div>
          <div>
            <h4>{h}</h4>
            <div class="five-body">{body}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface WhatIfOption {
  label: string;
  patch?: ParamPatch;
  /** arbitrary local state change for pages whose controls are not engine parameters */
  apply?: () => void;
  explain?: string;
}

/** "WHAT IF I CHANGE THIS?" — a row of perturbations that set the page's own controls. */
export function WhatIf(props: { options: WhatIfOption[]; onApply: (o: WhatIfOption) => void; onReset?: () => void; active?: string }) {
  const [last, setLast] = useState<WhatIfOption | null>(null);
  return (
    <div class="whatif">
      <div class="whatif-title">What if I change this?</div>
      <div class="btn-row" style={{ marginBottom: last?.explain ? 6 : 0 }}>
        {props.options.map((o) => (
          <button
            key={o.label}
            class={props.active === o.label || last?.label === o.label ? 'active' : ''}
            onClick={() => {
              setLast(o);
              o.apply?.();
              props.onApply(o);
            }}
          >
            {o.label}
          </button>
        ))}
        {props.onReset && (
          <button
            class="ghost"
            onClick={() => {
              setLast(null);
              props.onReset!();
            }}
          >
            ↺ Normal
          </button>
        )}
      </div>
      {last?.explain && <p class="whatif-explain">{last.explain}</p>}
    </div>
  );
}

/** Links to related modules at the foot of a page. */
export function Related(props: { paths: string[]; title?: string }) {
  const rs = props.paths.map((p) => routeByPath.get(p)).filter(Boolean);
  if (!rs.length) return null;
  return (
    <section style={{ marginTop: 22 }}>
      <h3>{props.title ?? 'Keep exploring'}</h3>
      <div class="grid grid-3">
        {rs.map((r) => (
          <a key={r!.path} class="card-link" href={href(r!.path)}>
            <h4>{r!.title}</h4>
            <p>{r!.blurb}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export const allRoutes = ROUTES;

/** A labelled on/off switch. */
export function Toggle(props: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label class={`toggle ${props.checked ? 'on' : ''}`} title={props.hint}>
      <input type="checkbox" checked={props.checked} onChange={(e) => props.onChange((e.target as HTMLInputElement).checked)} />
      <span>{props.label}</span>
    </label>
  );
}

/** A small "busy" indicator for results still being computed in the worker. */
export function Busy({ on }: { on: boolean }) {
  return on ? <span class="busy">computing…</span> : null;
}
