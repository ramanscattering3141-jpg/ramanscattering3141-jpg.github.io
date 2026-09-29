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
  { id: 'DCT', d: 'M204,94 C232,46 322,36 348,70 C368,100 396,62 420,96', label: 'Distal convoluted tubule', lx: 300, ly: 26, anchor: 'middle', nx: 372, ny: 118, nAnchor: 'end' },
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
  drug: '#b08ee0',
  defect: '#e4696b',
  active: '#5ecfba',
  dim: '#35536a',
  up: '#f2b134',
  down: '#6aa9e8',
};

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
  height?: number;
  children?: ComponentChildren;
  /** extra svg drawn on top (particles) */
  overlay?: ComponentChildren;
  title?: string;
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
    if (sel === id) return '#ffffff';
    return m ? MARK_COLOR[m] : base;
  };

  return (
    <svg viewBox="0 0 600 700" width="100%" style={{ maxHeight: props.height ?? 640 }} role="img" aria-label={props.title ?? 'Diagram of a juxtamedullary nephron and its blood supply'}>
      <defs>
        <linearGradient id="medulla-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1b3a52" stop-opacity="0.15" />
          <stop offset="1" stop-color="#f2b134" stop-opacity={0.08 + 0.3 * intensity} />
        </linearGradient>
        <marker id="flow-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#a3b9c9" />
        </marker>
      </defs>
      {/* zones */}
      <rect x="0" y="0" width="600" height="228" fill="#12304466" />
      <rect x="0" y="228" width="600" height="472" fill="url(#medulla-grad)" />
      <line x1="0" x2="600" y1="228" y2="228" stroke="#ffffff22" stroke-dasharray="4 4" />
      <line x1="0" x2="600" y1="430" y2="430" stroke="#ffffff22" stroke-dasharray="4 4" />
      {ZONES.map((z) => (
        <text key={z.name} x="592" y={z.y0 + 16} text-anchor="end" class="svg-label" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {z.name}
        </text>
      ))}
      <text x="592" y="690" text-anchor="end" class="svg-label">
        papilla ≈ {Math.round(osm)} mOsm/kg
      </text>

      {vessels && (
        <g>
          {/* renal artery → afferent */}
          <path d="M20,300 L20,250 C20,220 40,205 70,200" fill="none" stroke={colorFor('renalArtery', '#c0504d')} stroke-width="9" stroke-linecap="round" {...interactive('renalArtery', 'Renal artery')} />
          <path d="M70,200 C98,194 114,170 128,152" fill="none" stroke={colorFor('afferent', '#d9605c')} stroke-width="6" stroke-linecap="round" {...interactive('afferent', 'Afferent arteriole')} />
          {/* JG cells on the afferent arteriole */}
          <circle cx="116" cy="170" r="6" fill={colorFor('jgCells', '#f2b134')} stroke="#0b1b27" stroke-width="1.5" {...interactive('jgCells', 'Juxtaglomerular cells')} />
          {/* efferent → peritubular + vasa recta */}
          <path d="M126,96 C104,70 86,58 64,56" fill="none" stroke={colorFor('efferent', '#b8566b')} stroke-width="5" stroke-linecap="round" {...interactive('efferent', 'Efferent arteriole')} />
          <path
            d="M64,56 C40,56 30,90 60,110 C90,130 60,160 90,180 M196,130 C176,160 206,190 196,214 C188,236 226,236 218,262 M266,178 C282,200 268,230 284,250"
            fill="none"
            stroke={colorFor('peritubular', '#8a5a78')}
            stroke-width="2.5"
            stroke-dasharray="5 4"
            {...interactive('peritubular', 'Peritubular capillaries')}
          />
          <path d="M64,56 C52,30 150,18 176,24 C200,28 214,60 196,130" fill="none" stroke={colorFor('peritubular', '#8a5a78')} stroke-width="2.5" stroke-dasharray="5 4" {...interactive('peritubular', 'Peritubular capillaries')} />
          <path d="M372,240 L372,630 C372,660 402,660 402,630 L402,240" fill="none" stroke={colorFor('vasaRecta', '#a0526a')} stroke-width="4" {...interactive('vasaRecta', 'Vasa recta')} />
          <path d="M372,262 L372,300" stroke="#ffffff66" stroke-width="1" marker-end="url(#flow-arrow)" />
          <path d="M402,300 L402,262" stroke="#ffffff66" stroke-width="1" marker-end="url(#flow-arrow)" />
          {/* renal vein */}
          <path d="M90,180 C70,220 50,240 46,300" fill="none" stroke={colorFor('renalVein', '#4a78b8')} stroke-width="9" stroke-linecap="round" {...interactive('renalVein', 'Renal vein')} />
          {labels && (
            <g class="svg-label">
              <text x="14" y="318">Renal artery</text>
              <text x="52" y="318" dy="12">Renal vein</text>
              <text x="36" y="214" text-anchor="start">Afferent</text>
              <text x="24" y="48">Efferent</text>
              <text x="387" y="234" text-anchor="middle">Vasa recta</text>
              <text x="8" y="140">Peritubular</text>
            </g>
          )}
        </g>
      )}

      {/* glomerulus and Bowman's capsule */}
      <circle cx="150" cy="122" r="34" fill="#12283a" stroke={colorFor('bowman', '#7fd1c1')} stroke-width="3" {...interactive('bowman', "Bowman's space")} />
      <g {...interactive('glomerulus', 'Glomerulus')}>
        <circle cx="150" cy="122" r="22" fill={colorFor('glomerulus', '#c0504d')} opacity="0.85" />
        <path d="M136,114 q7,-9 14,0 q7,9 14,0 M136,126 q7,-9 14,0 q7,9 14,0 M138,136 q6,-6 12,0 q6,6 12,0" stroke="#ffffffaa" stroke-width="1.4" fill="none" />
      </g>
      <circle cx="150" cy="122" r="5" fill={colorFor('mesangium', '#f2b134')} opacity="0.9" {...interactive('mesangium', 'Mesangium')} />

      {/* tubule */}
      {TUBE_PATHS.map((s) => {
        const mark = props.marks?.[s.id];
        const stroke = colorFor(s.id, '#7fd1c1');
        return (
          <g key={s.id}>
            <path d={s.d} fill="none" stroke="#0b1b27" stroke-width="15" stroke-linecap="round" stroke-linejoin="round" />
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
              <path d={s.d} fill="none" stroke="#ffffff" stroke-width="1.4" stroke-dasharray="3 5" pointer-events="none" />
            ) : null}
          </g>
        );
      })}
      {/* macula densa */}
      <circle cx="206" cy="96" r="7" fill={colorFor('maculaDensa', '#f2b134')} stroke="#0b1b27" stroke-width="1.5" {...interactive('maculaDensa', 'Macula densa')} />

      {labels && (
        <g>
          {TUBE_PATHS.map((s) => (
            <text
              key={s.id}
              x={s.lx}
              y={s.ly}
              text-anchor={s.anchor ?? 'start'}
              transform={s.rotate ? `rotate(-90 ${s.lx} ${s.ly})` : undefined}
              class="svg-label"
              style={{ fill: sel === s.id ? '#ffffff' : undefined, fontSize: 11 }}
            >
              {s.label}
            </text>
          ))}
          {TUBE_PATHS.filter((s) => props.notes?.[s.id]).map((s) => (
            <text key={`n-${s.id}`} x={s.nx} y={s.ny} text-anchor={s.nAnchor ?? 'start'} class="svg-value" style={{ fill: '#5ecfba', fontSize: 11 }}>
              {props.notes![s.id]}
            </text>
          ))}
          <text x="150" y="176" text-anchor="middle" class="svg-label">
            Glomerulus
          </text>
          <text x="214" y="118" class="svg-label" style={{ fontSize: 9.5 }}>
            macula densa
          </text>
          <text x="104" y="190" text-anchor="end" class="svg-label" style={{ fontSize: 9.5 }}>
            JG cells
          </text>
        </g>
      )}
      {props.overlay}
      {props.children}
    </svg>
  );
}
