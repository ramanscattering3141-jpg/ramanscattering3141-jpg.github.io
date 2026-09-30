// The countercurrent model drawn as the textbook draws it: boxes of descending limb, interstitium,
// ascending limb and collecting duct at each medullary level, coloured and labelled by osmolality.

import type { CCState, CCParams } from '../sim/countercurrent';
import { interstitium, loopOutflow } from '../sim/countercurrent';

const heat = (osm: number) => {
  const t = Math.max(0, Math.min(1, (osm - 100) / 1200));
  const r = Math.round(40 + 200 * t);
  const g = Math.round(90 + 90 * (1 - Math.abs(t - 0.45) * 1.6));
  const b = Math.round(170 - 140 * t);
  return `rgb(${r},${Math.max(40, g)},${Math.max(30, b)})`;
};

export function LoopDiagram({ s, p, highlight }: { s: CCState; p: CCParams; highlight?: 'pump' | 'equilibrate' | 'flow' | null }) {
  const n = s.desc.length;
  const top = 50;
  const h = 44;
  const inter = interstitium(s);
  const col = { desc: 90, int: 200, asc: 310, cd: 470 };
  const w = 90;
  const box = (x: number, y: number, v: number, label?: string, stroke?: string) => (
    <g>
      <rect x={x} y={y} width={w} height={h - 4} rx="6" fill={heat(v)} opacity="0.85" stroke={stroke ?? 'var(--c-deep)'} stroke-width={stroke ? 2.5 : 1} />
      <text x={x + w / 2} y={y + h / 2 + 2} text-anchor="middle" class="svg-value" style={{ fill: 'var(--c-deep)', fontWeight: 700, fontSize: 13 }}>
        {Math.round(v)}
      </text>
      {label && (
        <text x={x + w / 2} y={y + h - 8} text-anchor="middle" style={{ fontSize: 8, fill: 'var(--c-deep)' }}>
          {label}
        </text>
      )}
    </g>
  );
  return (
    <svg viewBox={`0 0 600 ${top + n * h + 70}`} width="100%" role="img" aria-label="Osmolality at each level of the loop of Henle, interstitium and collecting duct">
      {['Descending limb', 'Interstitium', 'Ascending limb', 'Collecting duct'].map((t, i) => (
        <text key={t} x={[col.desc, col.int, col.asc, col.cd][i] + w / 2} y={top - 26} text-anchor="middle" class="svg-label" style={{ fontSize: 11 }}>
          {t}
        </text>
      ))}
      <text x={col.desc + w / 2} y={top - 8} text-anchor="middle" class="svg-label">
        ↓ from PT (290)
      </text>
      <text x={col.asc + w / 2} y={top - 8} text-anchor="middle" class="svg-label">
        ↑ to cortex ({Math.round(loopOutflow(s, p))} after cortical TAL)
      </text>
      <text x={col.cd + w / 2} y={top - 8} text-anchor="middle" class="svg-label">
        ↓ ADH {Math.round(p.adh * 100)}%
      </text>
      {Array.from({ length: n }, (_, i) => {
        const y = top + i * h;
        return (
          <g key={i}>
            {box(col.desc, y, s.desc[i], undefined, highlight === 'equilibrate' ? 'var(--c-strong)' : undefined)}
            {box(col.int, y, inter[i], s.urea[i] > 20 ? `NaCl ${Math.round(s.nacl[i])} + urea ${Math.round(s.urea[i])}` : undefined)}
            {box(col.asc, y, s.asc[i], undefined, highlight === 'pump' ? 'var(--c-strong)' : undefined)}
            {box(col.cd, y, s.cd[i])}
            {/* pump arrows */}
            <path d={`M${col.asc - 4},${y + h / 2 - 2} L${col.int + w + 4},${y + h / 2 - 2}`} stroke={highlight === 'pump' ? 'var(--c-amber)' : 'color-mix(in srgb, var(--c-amber) 53%, transparent)'} stroke-width="2" marker-end="url(#cc-arr)" />
            <path d={`M${col.desc + w + 4},${y + h / 2 + 8} L${col.int - 4},${y + h / 2 + 8}`} stroke={highlight === 'equilibrate' ? 'var(--c-blue)' : 'color-mix(in srgb, var(--c-blue) 33%, transparent)'} stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#cc-arr-b)" />
          </g>
        );
      })}
      {/* hairpin */}
      <path d={`M${col.desc + w / 2},${top + n * h} C${col.desc + w / 2},${top + n * h + 40} ${col.asc + w / 2},${top + n * h + 40} ${col.asc + w / 2},${top + n * h}`} fill="none" stroke={highlight === 'flow' ? 'var(--c-strong)' : 'var(--c-mint)'} stroke-width="3" marker-end="url(#cc-arr-w)" />
      <text x={(col.desc + col.asc + w) / 2} y={top + n * h + 55} text-anchor="middle" class="svg-label">
        hairpin: papilla ≈ {Math.round(inter[n - 1])} mOsm/kg · final urine {Math.round(s.cd[n - 1])}
      </text>
      <text x={col.int + w + 6} y={top + 12} class="svg-label" style={{ fill: 'var(--c-amber)', fontSize: 9 }}>
        NaCl
      </text>
      <text x={col.desc + w + 6} y={top + 36} class="svg-label" style={{ fill: 'var(--c-blue)', fontSize: 9 }}>
        H₂O
      </text>
      <defs>
        <marker id="cc-arr" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-amber)" />
        </marker>
        <marker id="cc-arr-b" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-blue)" />
        </marker>
        <marker id="cc-arr-w" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="var(--c-mint)" />
        </marker>
      </defs>
    </svg>
  );
}
