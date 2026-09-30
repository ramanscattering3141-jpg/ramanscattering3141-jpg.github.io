// The nephron drawing used across the laboratory. One geometry, many uses: clickable anatomy in
// the explorer, highlighted drug sites in the diuretic lab, annotated segment flows, and the
// path the flow simulator's particles travel along.

import { type ComponentChildren } from 'preact';

export type StructureId =
  | 'PT' | 'DTL' | 'ATL' | 'TAL' | 'DCT' | 'CNT' | 'CCD' | 'OMCD' | 'IMCD'
  | 'glomerulus' | 'bowman' | 'afferent' | 'efferent' | 'renalArtery' | 'renalVein' | 'peritubular' | 'vasaRecta' | 'maculaDensa' | 'jgCells' | 'mesangium';

/** Tubular path geometry, in flow order. Coordinates in a 600 × 700 box. */
export const TUBE_PATHS: { id: StructureId; d: string; label: string; lx: number; ly: number; anchor?: 'start' | 'end' | 'middle'; rotate?: boolean; nx: number; ny: number; nAnchor?: 'start' | 'end' }[] = [
  { id: 'PT', d: 'M168,142 C196,168 236,150 224,186 C212,218 252,214 246,246 L246,300', label: 'Proximal tubule', lx: 196, ly: 290, anchor: 'end', nx: 196, ny: 304, nAnchor: 'end' },
  { id: 'DTL', d: 'M246,300 L246,600', label: 'Thin descending limb', lx: 236, ly: 450, anchor: 'middle', rotate: true, nx: 226, ny: 620, nAnchor: 'end' },
  { id: 'ATL', d: 'M246,600 C246,652 300,652 300,600 L300,430', label: 'Thin ascending limb', lx: 316, ly: 520, anchor: 'middle', rotate: true, nx: 312, ny: 668 },
  { id: 'TAL', d: 'M300,430 L300,150 C300,110 250,88 204,94', label: 'Thick ascending limb', lx: 316, ly: 300, anchor: 'middle', rotate: true, nx: 322, ny: 160 },
  { id: 'DCT', d: 'M204,94 C232,46 322,36 348,70 C368,100 396,62 420,96', label: 'Distal convoluted tubule', lx: 300, ly: 16, anchor: 'middle', nx: 268, ny: 30 },
  { id: 'CNT', d: 'M420,96 C442,116 462,122 462,152', label: 'Connecting tubule', lx: 474, ly: 112, nx: 474, ny: 125 },
  { id: 'CCD', d: 'M462,152 L462,228', label: 'Cortical collecting duct', lx: 474, ly: 190, nx: 474, ny: 203 },
  { id: 'OMCD', d: 'M462,228 L462,430', label: 'Outer medullary CD', lx: 474, ly: 330, nx: 474, ny: 343 },
  { id: 'IMCD', d: 'M462,430 L462,676', label: 'Inner medullary CD', lx: 474, ly: 560, nx: 474, ny: 573 },
];

/** The whole tubule as a single path (used for particle motion). */
export const FULL_TUBE = 'M168,142 C196,168 236,150 224,186 C212,218 252,214 246,246 L246,300 L246,600 C246,652 300,652 300,600 L300,430 L300,150 C300,110 250,88 204,94 C232,46 322,36 348,70 C368,100 396,62 420,96 C442,116 462,122 462,152 L462,228 L462,430 L462,676';

export const ZONES = [
  { name: 'Cortex', y0: 0, y1: 228 },
  { name: 'Outer medulla', y0: 228, y1: 430 },
  { name: 'Inner medulla', y0: 430, y1: 700 },
];

export type Mark = 'drug' | 'defect' | 'active' | 'dim' | 'up' | 'down';

const MARK_COLOR: Record<Mark, string> = {
  drug: 'var(--c-violet)',
  defect: 'var(--c-red)',
  active: 'var(--c-orange)',
  dim: 'var(--c-dim)',
  up: 'var(--c-amber)',
  down: 'var(--c-blue)',
};

const VESSEL_D: Partial<Record<StructureId, string>> = {
  renalArtery: 'M20,300 L20,250 C20,220 40,205 70,200',
  afferent: 'M70,200 C98,194 114,170 128,152',
  efferent: 'M126,96 C104,70 86,58 64,56',
  vasaRecta: 'M372,240 L372,630 C372,660 402,660 402,630 L402,240',
  renalVein: 'M90,180 C70,220 50,240 46,300',
  peritubular: 'M64,56 C52,30 150,18 176,24 C200,28 214,60 196,130',
};

/** A point on (or next to) each structure, where a callout's leader line ends. */
export const ANCHOR: Record<StructureId, [number, number]> = {
  PT: [232, 200], DTL: [246, 470], ATL: [300, 540], TAL: [300, 320], DCT: [348, 68], CNT: [448, 124],
  CCD: [462, 190], OMCD: [462, 330], IMCD: [462, 580], glomerulus: [150, 122], bowman: [150, 122],
  afferent: [96, 190], efferent: [100, 70], jgCells: [116, 170], maculaDensa: [206, 96], mesangium: [150, 122],
  peritubular: [70, 120], vasaRecta: [387, 470], renalArtery: [20, 270], renalVein: [52, 270],
};

export interface Callout {
  id: StructureId;
  text: string;
  /** colour of the box edge and leader: stimulation, inhibition or neutral */
  tone?: 'up' | 'down' | 'info' | 'drug';
  title?: string;
}

const TONE_COLOR = { up: 'var(--c-orange)', down: 'var(--c-blue)', info: 'var(--ink-dim)', drug: 'var(--c-violet)' };

/** Break text into lines of at most `n` characters, on word boundaries. */
export function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && (line + ' ' + w).length > n) {
      out.push(line);
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}

const CALLOUT_W = 250;
const CALLOUT_FONT = 14;
const CALLOUT_LINE = 17;
const CALLOUT_CHARS = 26;

/** Stack callouts in the left and right gutters without overlap, each as near its anchor as possible. */
function layoutCallouts(callouts: Callout[]) {
  const items = callouts.map((c) => {
    const lines = wrap(c.text, CALLOUT_CHARS);
    const titleLines = c.title ? 1 : 0;
    const h = (lines.length + titleLines) * CALLOUT_LINE + 12;
    const [ax, ay] = ANCHOR[c.id];
    // Structures right of the loop go to the right gutter, the rest to the left.
    const side: 'L' | 'R' = ax >= 330 || c.id === 'TAL' || c.id === 'ATL' ? 'R' : 'L';
    return { c, lines, h, ax, ay, side, y: 0 };
  });
  for (const side of ['L', 'R'] as const) {
    const col = items.filter((i) => i.side === side).sort((a, b) => a.ay - b.ay);
    let y = 4;
    for (const it of col) {
      it.y = Math.max(y, it.ay - it.h / 2);
      y = it.y + it.h + 8;
    }
    // If the column overflows the bottom, push it back up.
    let over = y - 8 - 696;
    for (let k = col.length - 1; k >= 0 && over > 0; k--) {
      const room = k > 0 ? col[k].y - (col[k - 1].y + col[k - 1].h + 8) : col[k].y - 4;
      const shift = Math.min(over, Math.max(0, room));
      for (let m = k; m < col.length; m++) col[m].y -= shift;
      over -= shift;
    }
  }
  return items;
}

export interface NephronDiagramProps {
  selected?: StructureId | null;
  onSelect?: (id: StructureId) => void;
  marks?: Partial<Record<StructureId, Mark>>;
  /** small text shown beside a segment, e.g. "65% Na⁺" */
  notes?: Partial<Record<StructureId, string>>;
  labels?: boolean;
  vessels?: boolean;
  /** papillary interstitial osmolality: shades the medulla */
  medullaOsm?: number;
  height?: number | string;
  children?: ComponentChildren;
  /** extra svg drawn on top (particles) */
  overlay?: ComponentChildren;
  title?: string;
  /** Grey out every structure that is not marked, so the marked ones stand out. */
  dimUnmarked?: boolean;
  /** Boxes in the side gutters with a leader line to the structure they describe. */
  callouts?: Callout[];
  /** Base colour of the tubule where nothing is marked (default: the theme's tubule colour). */
  tubeColor?: string;
  /** A translucent band under each segment, width and opacity scaled by w (0–1): e.g. how much it reabsorbs. */
  heat?: Partial<Record<StructureId, { color: string; w: number }>>;
}

export function NephronDiagram(props: NephronDiagramProps) {
  const sel = props.selected;
  const labels = props.labels ?? true;
  const vessels = props.vessels ?? true;
  const osm = props.medullaOsm ?? 1200;
  const intensity = Math.max(0, Math.min(1, (osm - 290) / 1000));
  const click = (id: StructureId) => (props.onSelect ? () => props.onSelect!(id) : undefined);
  const key = (id: StructureId) =>
    props.onSelect
      ? (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            props.onSelect!(id);
          }
        }
      : undefined;
  const interactive = (id: StructureId, name: string) =>
    props.onSelect ? { role: 'button' as const, tabIndex: 0, 'aria-label': name, 'aria-pressed': sel === id, onClick: click(id), onKeyDown: key(id), class: 'hit' } : {};
  const colorFor = (id: StructureId, base: string) => {
    const m = props.marks?.[id];
    if (sel === id) return 'var(--c-orange)';
    if (m) return MARK_COLOR[m];
    return props.dimUnmarked ? 'var(--c-dim)' : base;
  };
  const callouts = props.callouts?.length ? layoutCallouts(props.callouts) : null;
  const hasL = !!callouts?.some((c) => c.side === 'L');
  const hasR = !!callouts?.some((c) => c.side === 'R');
  const vx0 = hasL ? -250 : 0;
  const vx1 = hasR ? 910 : 640;
  const viewBox = `${vx0} 0 ${vx1 - vx0} 700`;
  const glow = (id: StructureId) => {
    if (sel === id) return 'var(--c-orange)';
    const m = props.marks?.[id];
    return m && m !== 'dim' ? MARK_COLOR[m] : null;
  };

  return (
    <svg viewBox={viewBox} width="100%" style={{ maxHeight: props.height ?? 640 }} role="img" aria-label={props.title ?? 'Diagram of a juxtamedullary nephron and its blood supply'}>
      <defs>
        <linearGradient id="medulla-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--c-zone)" stop-opacity="0.15" />
          <stop offset="1" stop-color="var(--c-amber)" stop-opacity={0.08 + 0.3 * intensity} />
        </linearGradient>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-dim)" />
        </marker>
      </defs>
      {/* zones */}
      <rect x="0" y="0" width="640" height="228" fill="color-mix(in srgb, var(--c-zone) 40%, transparent)" />
      <rect x="0" y="228" width="640" height="472" fill="url(#medulla-grad)" />
      <line x1="0" x2="640" y1="228" y2="228" stroke="color-mix(in srgb, var(--mix) 13%, transparent)" stroke-dasharray="4 4" />
      <line x1="0" x2="640" y1="430" y2="430" stroke="color-mix(in srgb, var(--mix) 13%, transparent)" stroke-dasharray="4 4" />
      {ZONES.map((z) => (
        <text key={z.name} x="628" y={(z.y0 + z.y1) / 2} text-anchor="middle" transform={`rotate(-90 628 ${(z.y0 + z.y1) / 2})`} class="svg-label svg-halo" style={{ fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, fill: 'var(--ink-faint)' }}>
          {z.name}
        </text>
      ))}
      <text x="632" y="690" text-anchor="end" class="svg-label" style={{ fontSize: 12 }}>
        papilla ≈ {Math.round(osm)} mOsm/kg
      </text>

      {/* glow under marked vessels and small structures, so a highlighted site cannot be missed */}
      {(Object.keys(VESSEL_D) as StructureId[]).filter((id) => glow(id) && (vessels || id === 'afferent' || id === 'efferent')).map((id) => (
        <path key={`g-${id}`} d={VESSEL_D[id]} fill="none" stroke={glow(id)!} stroke-opacity="0.3" stroke-width="20" stroke-linecap="round" pointer-events="none" />
      ))}
      {(['glomerulus', 'bowman', 'jgCells', 'maculaDensa', 'mesangium'] as StructureId[]).filter((id) => glow(id)).map((id) => (
        <circle key={`g-${id}`} cx={ANCHOR[id][0]} cy={ANCHOR[id][1]} r={id === 'glomerulus' || id === 'bowman' ? 44 : 15} fill={glow(id)!} opacity="0.25" pointer-events="none" />
      ))}
      {vessels && (
        <g>
          {/* renal artery → afferent */}
          <path d="M20,300 L20,250 C20,220 40,205 70,200" fill="none" stroke={colorFor('renalArtery', 'var(--c-blood)')} stroke-width="9" stroke-linecap="round" {...interactive('renalArtery', 'Renal artery')} />
          <path d="M70,200 C98,194 114,170 128,152" fill="none" stroke={colorFor('afferent', 'var(--c-blood)')} stroke-width="6" stroke-linecap="round" {...interactive('afferent', 'Afferent arteriole')} />
          {/* JG cells on the afferent arteriole */}
          <circle cx="116" cy="170" r="6" fill={colorFor('jgCells', 'var(--c-amber)')} stroke="var(--c-deep)" stroke-width="1.5" {...interactive('jgCells', 'Juxtaglomerular cells')} />
          {/* efferent → peritubular + vasa recta */}
          <path d="M126,96 C104,70 86,58 64,56" fill="none" stroke={colorFor('efferent', 'var(--c-vessel)')} stroke-width="5" stroke-linecap="round" {...interactive('efferent', 'Efferent arteriole')} />
          <path
            d="M64,56 C40,56 30,90 60,110 C90,130 60,160 90,180 M196,130 C176,160 206,190 196,214 C188,236 226,236 218,262 M266,178 C282,200 268,230 284,250"
            fill="none"
            stroke={colorFor('peritubular', 'var(--c-vessel)')}
            stroke-width="2.5"
            stroke-dasharray="5 4"
            {...interactive('peritubular', 'Peritubular capillaries')}
          />
          <path d="M64,56 C52,30 150,18 176,24 C200,28 214,60 196,130" fill="none" stroke={colorFor('peritubular', 'var(--c-vessel)')} stroke-width="2.5" stroke-dasharray="5 4" {...interactive('peritubular', 'Peritubular capillaries')} />
          <path d="M372,240 L372,630 C372,660 402,660 402,630 L402,240" fill="none" stroke={colorFor('vasaRecta', 'var(--c-vessel)')} stroke-width="4" {...interactive('vasaRecta', 'Vasa recta')} />
          <path d="M372,262 L372,300" stroke="color-mix(in srgb, var(--mix) 40%, transparent)" stroke-width="1" marker-end="url(#flow-arrow)" />
          <path d="M402,300 L402,262" stroke="color-mix(in srgb, var(--mix) 40%, transparent)" stroke-width="1" marker-end="url(#flow-arrow)" />
          {/* renal vein */}
          <path d="M90,180 C70,220 50,240 46,300" fill="none" stroke={colorFor('renalVein', 'var(--c-vein)')} stroke-width="9" stroke-linecap="round" {...interactive('renalVein', 'Renal vein')} />
          {labels && (
            <g class="svg-label svg-halo" style={{ fontSize: 12.5, fill: 'var(--ink-dim)' }}>
              <text x="4" y="318">Renal artery</text>
              <text x="4" y="334">Renal vein</text>
              <text x="36" y="214" text-anchor="start">Afferent</text>
              <text x="24" y="48">Efferent</text>
              <text x="387" y="234" text-anchor="middle">Vasa recta</text>
              <text x="8" y="140">Peritubular</text>
            </g>
          )}
        </g>
      )}

      {/* glomerulus and Bowman's capsule */}
      <circle cx="150" cy="122" r="34" fill="var(--panel)" stroke={colorFor('bowman', 'var(--tubule)')} stroke-width="3" {...interactive('bowman', "Bowman's space")} />
      <g {...interactive('glomerulus', 'Glomerulus')}>
        <circle cx="150" cy="122" r="22" fill={colorFor('glomerulus', 'var(--c-blood)')} opacity="0.85" />
        <path d="M136,114 q7,-9 14,0 q7,9 14,0 M136,126 q7,-9 14,0 q7,9 14,0 M138,136 q6,-6 12,0 q6,6 12,0" stroke="color-mix(in srgb, var(--mix) 67%, transparent)" stroke-width="1.4" fill="none" />
      </g>
      <circle cx="150" cy="122" r="5" fill={colorFor('mesangium', 'var(--c-amber)')} opacity="0.9" {...interactive('mesangium', 'Mesangium')} />

      {/* tubule */}
      {TUBE_PATHS.map((s) => {
        const mark = props.marks?.[s.id];
        const stroke = colorFor(s.id, props.tubeColor ?? 'var(--tubule)');
        const ht = props.heat?.[s.id];
        const g = glow(s.id);
        return (
          <g key={s.id}>
            {g && <path d={s.d} fill="none" stroke={g} stroke-opacity="0.28" stroke-width="26" stroke-linecap="round" stroke-linejoin="round" pointer-events="none" />}
            {ht && ht.w > 0.004 && (
              <path d={s.d} fill="none" stroke={ht.color} stroke-opacity={0.18 + 0.4 * Math.min(1, ht.w)} stroke-width={16 + 34 * Math.min(1, Math.sqrt(ht.w))} stroke-linecap="butt" stroke-linejoin="round" pointer-events="none" />
            )}
            <path d={s.d} fill="none" stroke="var(--c-deep)" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
            <path
              d={s.d}
              fill="none"
              stroke={stroke}
              stroke-width={sel === s.id ? 11 : s.id === 'TAL' || s.id === 'PT' ? 9 : s.id === 'DTL' || s.id === 'ATL' ? 5 : 8}
              stroke-linecap="round"
              stroke-linejoin="round"
              opacity={mark === 'dim' ? 0.45 : 1}
              {...interactive(s.id, s.label)}
            />
            {mark === 'drug' || mark === 'defect' ? (
              <path d={s.d} fill="none" stroke="var(--c-strong)" stroke-width="1.4" stroke-dasharray="3 5" pointer-events="none" />
            ) : null}
          </g>
        );
      })}
      {/* macula densa */}
      <circle cx="206" cy="96" r="7" fill={colorFor('maculaDensa', 'var(--c-amber)')} stroke="var(--c-deep)" stroke-width="1.5" {...interactive('maculaDensa', 'Macula densa')} />

      {callouts && (
        <g class="callouts">
          {callouts.map((it) => {
            const col = TONE_COLOR[it.c.tone ?? 'up'];
            const bx = it.side === 'L' ? -244 : 654;
            const edgeX = it.side === 'L' ? bx + CALLOUT_W : bx;
            const edgeY = it.y + it.h / 2;
            return (
              <g key={`${it.c.id}-${it.c.text}`}>
                <path d={`M${edgeX},${edgeY} L${it.side === 'L' ? edgeX + 14 : edgeX - 14},${edgeY} L${it.ax},${it.ay}`} fill="none" stroke={col} stroke-width="1.6" stroke-dasharray="4 3" opacity="0.9" />
                <circle cx={it.ax} cy={it.ay} r="5" fill={col} stroke="var(--c-deep)" stroke-width="1.5" />
                <rect x={bx} y={it.y} width={CALLOUT_W} height={it.h} rx="7" fill="var(--panel)" stroke={col} stroke-width="1.6" />
                <rect x={it.side === 'L' ? bx + CALLOUT_W - 5 : bx} y={it.y} width="5" height={it.h} rx="2" fill={col} />
                <text x={bx + (it.side === 'L' ? 10 : 14)} y={it.y + 18} style={{ fontSize: CALLOUT_FONT, fill: 'var(--ink)' }}>
                  {it.c.title && (
                    <tspan x={bx + (it.side === 'L' ? 10 : 14)} dy="0" style={{ fontWeight: 700, fill: col }}>
                      {it.c.title}
                    </tspan>
                  )}
                  {it.lines.map((l, i) => (
                    <tspan key={i} x={bx + (it.side === 'L' ? 10 : 14)} dy={i === 0 && !it.c.title ? 0 : CALLOUT_LINE}>
                      {l}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        </g>
      )}
      {labels && (
        <g>
          {TUBE_PATHS.map((s) => (
            <text
              key={s.id}
              x={s.lx}
              y={s.ly}
              text-anchor={s.anchor ?? 'start'}
              transform={s.rotate ? `rotate(-90 ${s.lx} ${s.ly})` : undefined}
              class="svg-label svg-halo"
              style={{ fill: sel === s.id ? 'var(--c-strong)' : 'var(--ink)', fontSize: 13, fontWeight: sel === s.id ? 700 : 500 }}
            >
              {s.label}
            </text>
          ))}
          {TUBE_PATHS.filter((s) => props.notes?.[s.id]).map((s) => {
            const text = props.notes![s.id]!;
            const w = text.length * 6.9 + 12;
            const anchor = s.nAnchor ?? 'start';
            const x0 = anchor === 'end' ? s.nx - w + 4 : s.nx - 4;
            return (
              <g key={`n-${s.id}`} pointer-events="none">
                <rect x={x0} y={s.ny - 12} width={w} height={17} rx={8.5} fill="var(--panel)" stroke="var(--line)" opacity="0.94" />
                <text x={anchor === 'end' ? s.nx - 2 : s.nx + 2} y={s.ny + 1} text-anchor={anchor} class="svg-value" style={{ fill: 'var(--ink)', fontSize: 11.5 }}>
                  {text}
                </text>
              </g>
            );
          })}
          <text x="150" y="176" text-anchor="middle" class="svg-label svg-halo" style={{ fontSize: 12.5, fill: 'var(--ink)' }}>
            Glomerulus
          </text>
          <text x="216" y="118" class="svg-label svg-halo" style={{ fontSize: 11.5 }}>
            macula densa
          </text>
          <text x="104" y="190" text-anchor="end" class="svg-label svg-halo" style={{ fontSize: 11.5 }}>
            JG cells
          </text>
        </g>
      )}
      {props.overlay}
      {props.children}
    </svg>
  );
}
