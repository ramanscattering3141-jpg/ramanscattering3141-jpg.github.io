import { h } from './dom';

let uid = 0;
const nid = (): string => `c${++uid}`;

export interface SliderOpts {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit?: string;
  help?: string;
  format?: (v: number) => string;
  onInput: (v: number) => void;
}

export function slider(o: SliderOpts): HTMLDivElement {
  const id = nid();
  const fmt = o.format ?? ((v: number) => `${+v.toFixed(3)}${o.unit ? ` ${o.unit}` : ''}`);
  const out = h('output', { for: id, class: 'ctl-val' }, fmt(o.value));
  const input = h('input', { id, type: 'range', min: o.min, max: o.max, step: o.step ?? 1, value: o.value });
  input.addEventListener('input', () => {
    const v = parseFloat(input.value);
    out.textContent = fmt(v);
    o.onInput(v);
  });
  return h('div', { class: 'ctl' }, h('label', { for: id }, h('span', null, o.label), out), input, o.help ? h('small', { class: 'ctl-help' }, o.help) : null);
}

export interface SelectOpts<T extends string> {
  label: string;
  value: T;
  options: [T, string][];
  help?: string;
  onChange: (v: T) => void;
}

export function select<T extends string>(o: SelectOpts<T>): HTMLDivElement {
  const id = nid();
  const sel = h('select', { id }, ...o.options.map(([v, t]) => h('option', { value: v, selected: v === o.value }, t)));
  sel.addEventListener('change', () => o.onChange(sel.value as T));
  return h('div', { class: 'ctl' }, h('label', { for: id }, h('span', null, o.label)), sel, o.help ? h('small', { class: 'ctl-help' }, o.help) : null);
}

export function toggle(label: string, value: boolean, onChange: (v: boolean) => void, help?: string): HTMLDivElement {
  const id = nid();
  const cb = h('input', { id, type: 'checkbox', checked: value });
  cb.addEventListener('change', () => onChange(cb.checked));
  return h('div', { class: 'ctl ctl-toggle' }, h('label', { for: id }, cb, h('span', null, label)), help ? h('small', { class: 'ctl-help' }, help) : null);
}

export function segmented<T extends string>(options: [T, string][], value: T, onChange: (v: T) => void, label?: string): HTMLDivElement {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label ?? 'options' });
  const btns = options.map(([v, t]) => {
    const b = h('button', { type: 'button', class: v === value ? 'on' : '', role: 'radio', 'aria-checked': String(v === value) }, t);
    b.addEventListener('click', () => {
      btns.forEach((x) => {
        x.classList.remove('on');
        x.setAttribute('aria-checked', 'false');
      });
      b.classList.add('on');
      b.setAttribute('aria-checked', 'true');
      onChange(v);
    });
    return b;
  });
  wrap.append(...btns);
  return label ? h('div', { class: 'ctl' }, h('span', { class: 'ctl-lab' }, label), wrap) : wrap;
}

export function button(text: string, onClick: () => void, cls = ''): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `btn ${cls}` }, text);
  b.addEventListener('click', onClick);
  return b;
}

export function group(title: string, ...children: (Node | null)[]): HTMLElement {
  return h('fieldset', { class: 'ctl-group' }, h('legend', null, title), ...children.filter((c): c is Node => !!c));
}

export function details(title: string, open: boolean, ...children: (Node | null)[]): HTMLDetailsElement {
  const d = h('details', { class: 'ctl-details' }, h('summary', null, title), ...children.filter((c): c is Node => !!c));
  d.open = open;
  return d;
}
