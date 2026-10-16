// A generic epithelial cell: apical carriers on the left (lumen), basolateral carriers on the
// right (blood), paracellular routes through the tight junction below. Each carrier's opacity and
// arrow weight follow its activity, so switching one off is visible at a glance.

import { wrapText } from './kit';

export interface CellCarrier {
  label: string;
  /** what it moves, shown beside it */
  moves: string;
  /** 'in' = lumen→cell (apical) or cell→blood (basolateral); 'out' the reverse */
  dir: 'in' | 'out' | 'both';
  activity: number;
  color?: string;
  /** a drug or defect acting here */
  blocked?: string;
  onClick?: () => void;
}

export function CellDiagram(props: {
  apical: CellCarrier[];
  basolateral: CellCarrier[];
  paracellular?: { label: string; activity: number }[];
  lumenVoltage?: string;
  title?: string;
  cellNote?: string;
}) {
  const rows = Math.max(props.apical.length, props.basolateral.length, 1);
  const rowH = 58;
  const top = 42;
  const cellH = rows * rowH + 20;
  const H = top + cellH + (props.paracellular?.length ? 52 + props.paracellular.length * 14 : 20);
  const x0 = 170;
  const x1 = 430;
  const carrier = (c: CellCarrier, i: number, side: 'a' | 'b') => {
    const y = top + 20 + i * rowH + rowH / 2 - 10;
    const x = side === 'a' ? x0 : x1;
    const on = Math.max(0, Math.min(1.5, c.activity));
    const color = c.blocked ? 'var(--c-violet)' : c.color ?? 'var(--c-teal)';
    const arrowIn = side === 'a' ? c.dir !== 'out' : c.dir === 'out';
    // Arrow runs horizontally through the carrier.
    const ax0 = side === 'a' ? x - 70 : x + 70;
    const ax1 = side === 'a' ? x + 40 : x - 40;
    const [from, to] = side === 'a' ? (c.dir === 'out' ? [ax1, ax0] : [ax0, ax1]) : c.dir === 'out' ? [ax0, ax1] : [ax1, ax0];
    void arrowIn;
    return (
      <g
        key={`${side}${i}`}
        style={{ cursor: c.onClick ? 'pointer' : undefined }}
        onClick={c.onClick}
        role={c.onClick ? 'button' : undefined}
        tabindex={c.onClick ? 0 : undefined}
        onKeyDown={c.onClick ? (e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), c.onClick!()) : undefined}
        aria-label={c.onClick ? `Toggle ${c.label}` : undefined}
      >
        <line x1={from} x2={to} y1={y} y2={y} stroke={color} stroke-width={1 + 3 * on} opacity={0.25 + 0.6 * Math.min(1, on)} marker-end="url(#cell-arr)" />
        {c.dir === 'both' && <line x1={to} x2={from} y1={y + 7} y2={y + 7} stroke={color} stroke-width={1 + 2 * on} opacity={0.2 + 0.5 * Math.min(1, on)} marker-end="url(#cell-arr)" />}
        {/* tinted with the panel colour rather than faded, so the name stays legible in both themes */}
        <circle cx={x} cy={y} r="23" fill={`color-mix(in srgb, ${color} ${Math.round(18 + 52 * Math.min(1, on))}%, var(--panel))`} stroke={color} stroke-width="1.5" />
        <text x={x} y={y + 4} text-anchor="middle" style={{ fontSize: c.label.length > 6 ? 8.5 : c.label.length > 4 ? 10 : 11.5, fontWeight: 700, fill: 'var(--ink)' }}>
          {c.label}
        </text>
        {/* what it moves, wrapped so it stays between the margin and the carrier instead of running over it */}
        {wrapText(c.moves, 22).map((line, k, all) => (
          <text key={k} x={side === 'a' ? 4 : 596} y={y - 9 - (all.length - 1 - k) * 13} text-anchor={side === 'a' ? 'start' : 'end'} class="svg-label" style={{ fontSize: 11 }}>
            {line}
          </text>
        ))}
        {c.blocked && (
          <text x={side === 'a' ? 4 : 596} y={y + 18} text-anchor={side === 'a' ? 'start' : 'end'} class="svg-label" style={{ fontSize: 10.5, fill: 'var(--c-violet)' }}>
            ✕ {c.blocked}
          </text>
        )}
        {on < 0.05 && (
          <text x={x} y={y - 22} text-anchor="middle" style={{ fontSize: 10.5, fill: 'var(--c-red)' }}>
            off
          </text>
        )}
      </g>
    );
  };
  return (
    <div class="svg-scroll">
    <svg viewBox={`0 0 600 ${H}`} width="100%" role="img" aria-label={props.title ?? 'Tubular epithelial cell with apical and basolateral transporters'}>
      <defs>
        <marker id="cell-arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--ink-dim)" />
        </marker>
      </defs>
      <text x="80" y="22" text-anchor="middle" class="svg-label" style={{ letterSpacing: '0.08em' }}>
        LUMEN {props.lumenVoltage ? `(${props.lumenVoltage})` : ''}
      </text>
      <text x="300" y="22" text-anchor="middle" class="svg-label" style={{ letterSpacing: '0.08em' }}>
        CELL
      </text>
      <text x="520" y="22" text-anchor="middle" class="svg-label" style={{ letterSpacing: '0.08em' }}>
        BLOOD / INTERSTITIUM
      </text>
      <rect x={x0} y={top} width={x1 - x0} height={cellH} rx="14" fill="var(--panel-2)" stroke="var(--accent-dim)" stroke-width="1.5" />
      {props.cellNote && (
        <text x="300" y={top + cellH - 8} text-anchor="middle" class="svg-label" style={{ fontSize: 10.5 }}>
          {props.cellNote}
        </text>
      )}
      {props.apical.map((c, i) => carrier(c, i, 'a'))}
      {props.basolateral.map((c, i) => carrier(c, i, 'b'))}
      {props.paracellular?.length ? (
        <g>
          <rect x={x0} y={top + cellH + 6} width={x1 - x0} height="8" fill="var(--c-deep)" stroke="color-mix(in srgb, var(--accent-dim) 40%, transparent)" />
          <text x="300" y={top + cellH + 30} text-anchor="middle" class="svg-label">
            tight junction / paracellular route
          </text>
          {props.paracellular.map((pc, i) => (
            <g key={pc.label}>
              <line x1={x0 - 40} x2={x1 + 40} y1={top + cellH + 44 + i * 14} y2={top + cellH + 44 + i * 14} stroke="var(--c-amber)" stroke-width={0.5 + 2.5 * Math.min(1, pc.activity)} opacity={0.2 + 0.7 * Math.min(1, pc.activity)} marker-end="url(#cell-arr)" />
              <text x={x0 - 46} y={top + cellH + 48 + i * 14} text-anchor="end" class="svg-label">
                {pc.label}
              </text>
            </g>
          ))}
        </g>
      ) : null}
    </svg>
    </div>
  );
}
