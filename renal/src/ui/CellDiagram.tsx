// A generic epithelial cell: apical carriers on the left (lumen), basolateral carriers on the
// right (blood), paracellular routes through the tight junction below. Each carrier's opacity and
// arrow weight follow its activity, so switching one off is visible at a glance.

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
    const color = c.blocked ? '#b08ee0' : c.color ?? '#5ecfba';
    const arrowIn = side === 'a' ? c.dir !== 'out' : c.dir === 'out';
    // Arrow runs horizontally through the carrier.
    const ax0 = side === 'a' ? x - 70 : x + 70;
    const ax1 = side === 'a' ? x + 40 : x - 40;
    const [from, to] = side === 'a' ? (c.dir === 'out' ? [ax1, ax0] : [ax0, ax1]) : c.dir === 'out' ? [ax0, ax1] : [ax1, ax0];
    void arrowIn;
    return (
      <g key={`${side}${i}`} style={{ cursor: c.onClick ? 'pointer' : undefined }} onClick={c.onClick} role={c.onClick ? 'button' : undefined} aria-label={c.onClick ? `Toggle ${c.label}` : undefined}>
        <line x1={from} x2={to} y1={y} y2={y} stroke={color} stroke-width={1 + 3 * on} opacity={0.25 + 0.6 * Math.min(1, on)} marker-end="url(#cell-arr)" />
        {c.dir === 'both' && <line x1={to} x2={from} y1={y + 7} y2={y + 7} stroke={color} stroke-width={1 + 2 * on} opacity={0.2 + 0.5 * Math.min(1, on)} marker-end="url(#cell-arr)" />}
        <circle cx={x} cy={y} r="21" fill={color} opacity={0.25 + 0.75 * Math.min(1, on)} stroke="#0b1b27" />
        <text x={x} y={y + 3.5} text-anchor="middle" style={{ fontSize: c.label.length > 6 ? 7.5 : c.label.length > 4 ? 8.5 : 10, fontWeight: 700, fill: '#0b1b27' }}>
          {c.label}
        </text>
        <text x={side === 'a' ? 4 : 596} y={y - 9} text-anchor={side === 'a' ? 'start' : 'end'} class="svg-label" style={{ fontSize: 10 }}>
          {c.moves}
        </text>
        {c.blocked && (
          <text x={side === 'a' ? 4 : 596} y={y + 18} text-anchor={side === 'a' ? 'start' : 'end'} class="svg-label" style={{ fontSize: 9.5, fill: '#b08ee0' }}>
            ✕ {c.blocked}
          </text>
        )}
        {on < 0.05 && (
          <text x={x} y={y - 22} text-anchor="middle" style={{ fontSize: 9, fill: '#e4696b' }}>
            off
          </text>
        )}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 600 ${H}`} width="100%" role="img" aria-label={props.title ?? 'Tubular epithelial cell with apical and basolateral transporters'}>
      <defs>
        <marker id="cell-arr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#a3b9c9" />
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
      <rect x={x0} y={top} width={x1 - x0} height={cellH} rx="14" fill="#16303f" stroke="#2f7f73" stroke-width="1.5" />
      {props.cellNote && (
        <text x="300" y={top + cellH - 8} text-anchor="middle" class="svg-label" style={{ fontSize: 9.5 }}>
          {props.cellNote}
        </text>
      )}
      {props.apical.map((c, i) => carrier(c, i, 'a'))}
      {props.basolateral.map((c, i) => carrier(c, i, 'b'))}
      {props.paracellular?.length ? (
        <g>
          <rect x={x0} y={top + cellH + 6} width={x1 - x0} height="8" fill="#0b1b27" stroke="#2f7f7366" />
          <text x="300" y={top + cellH + 30} text-anchor="middle" class="svg-label">
            tight junction / paracellular route
          </text>
          {props.paracellular.map((pc, i) => (
            <g key={pc.label}>
              <line x1={x0 - 40} x2={x1 + 40} y1={top + cellH + 44 + i * 14} y2={top + cellH + 44 + i * 14} stroke="#f2b134" stroke-width={0.5 + 2.5 * Math.min(1, pc.activity)} opacity={0.2 + 0.7 * Math.min(1, pc.activity)} marker-end="url(#cell-arr)" />
              <text x={x0 - 46} y={top + cellH + 48 + i * 14} text-anchor="end" class="svg-label">
                {pc.label}
              </text>
            </g>
          ))}
        </g>
      ) : null}
    </svg>
  );
}
