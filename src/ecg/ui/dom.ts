// Tiny DOM helpers (no framework).

type Child = Node | string | number | null | undefined | false | Child[];
type Attrs = Record<string, unknown> & { class?: string; style?: string | Record<string, string>; html?: string };

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Attrs | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) applyAttrs(el, attrs);
  append(el, children);
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs?: Record<string, unknown> | null, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
      else el.setAttribute(k, String(v));
    }
  }
  append(el, children);
  return el;
}

function applyAttrs(el: HTMLElement, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = String(v);
    else if (k === 'style') {
      if (typeof v === 'string') el.setAttribute('style', v);
      else Object.assign(el.style, v);
    } else if (k === 'html') el.innerHTML = String(v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else if (k === 'value' && 'value' in el) (el as HTMLInputElement).value = String(v);
    else if (k === 'checked' && 'checked' in el) (el as HTMLInputElement).checked = Boolean(v);
    else el.setAttribute(k, String(v));
  }
}

export function append(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Render a small subset of inline markup: **bold**, *italic*, → arrows kept, [text](#/route) links. */
export function rich(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\((#[^)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (m[1]) frag.appendChild(h('strong', null, m[1]));
    else if (m[2]) frag.appendChild(h('em', null, m[2]));
    else if (m[3]) frag.appendChild(h('a', { href: m[4] }, m[3]));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

export function p(text: string, cls?: string): HTMLParagraphElement {
  const el = h('p', cls ? { class: cls } : null);
  el.appendChild(rich(text));
  return el;
}

export function ul(items: string[], cls?: string): HTMLUListElement {
  return h('ul', cls ? { class: cls } : null, ...items.map((t) => h('li', null, rich(t))));
}

export function css(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function debounce<T extends (...a: never[]) => void>(fn: T, ms: number): T {
  let id = 0;
  return ((...a: never[]) => {
    window.clearTimeout(id);
    id = window.setTimeout(() => fn(...a), ms);
  }) as T;
}

export function storageGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function storageSet(key: string, v: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* storage unavailable */
  }
}
