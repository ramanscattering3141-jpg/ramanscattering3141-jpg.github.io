import { useMemo } from 'preact/hooks';

/**
 * Rose Fig. 17-1: the acid–base map.
 *
 * pH on the horizontal axis, PCO2 on the vertical, with bicarbonate isopleths as curves. The
 * shaded bands are the ranges of the four simple disorders including their expected compensations
 * (Table 17-3). A point that falls between bands is a mixed disorder — which is the whole reason
 * the map is worth drawing rather than just quoting the formulae.
 */

export interface MapPoint {
  pH: number;
  pco2: number;
  label?: string;
  tone?: 'current' | 'case';
}

/** Bicarbonate implied by a pH and PCO2, from Henderson–Hasselbalch. */
export const hco3From = (pH: number, pco2: number) => 0.03 * pco2 * Math.pow(10, pH - 6.1);
/** PCO2 at which a given bicarbonate produces a given pH. */
const pco2At = (pH: number, hco3: number) => hco3 / (0.03 * Math.pow(10, pH - 6.1));
/** pH from bicarbonate and PCO2. */
export const phFrom = (hco3: number, pco2: number) => 6.1 + Math.log10(Math.max(hco3, 0.1) / (0.03 * Math.max(pco2, 1)));

type BandId = 'metAcidosis' | 'metAlkalosis' | 'respAcidoseAcute' | 'respAcidoseChronic' | 'respAlkAcute' | 'respAlkChronic';

export const BANDS: { id: BandId; label: string; colour: string }[] = [
  { id: 'metAcidosis', label: 'Metabolic acidosis', colour: 'var(--c-blue)' },
  { id: 'metAlkalosis', label: 'Metabolic alkalosis', colour: 'var(--c-green)' },
  { id: 'respAcidoseAcute', label: 'Acute respiratory acidosis', colour: 'var(--c-coral)' },
  { id: 'respAcidoseChronic', label: 'Chronic respiratory acidosis', colour: 'var(--c-blood)' },
  { id: 'respAlkAcute', label: 'Acute respiratory alkalosis', colour: 'var(--c-amber)' },
  { id: 'respAlkChronic', label: 'Chronic respiratory alkalosis', colour: 'var(--c-amber-dk)' },
];

/**
 * Each band is generated from its compensation rule with a tolerance, so the geometry and the
 * arithmetic cannot drift apart: the same numbers that the interpreter quotes draw the picture.
 */
function bandPoints(id: BandId): { hco3: number; pco2: number }[][] {
  const upper: { hco3: number; pco2: number }[] = [];
  const lower: { hco3: number; pco2: number }[] = [];
  const push = (hco3: number, pco2: number, tol: number) => {
    upper.push({ hco3, pco2: pco2 + tol });
    lower.push({ hco3, pco2: pco2 - tol });
  };
  if (id === 'metAcidosis') {
    for (let h = 24; h >= 4; h -= 1) push(h, 40 + 1.2 * (h - 24), 2 + 0.06 * (24 - h));
  } else if (id === 'metAlkalosis') {
    for (let h = 24; h <= 46; h += 1) push(h, 40 + 0.7 * (h - 24), 2.5 + 0.09 * (h - 24));
  } else {
    // Respiratory: the rule gives bicarbonate as a function of PCO2, so the band is generated
    // along PCO2 and the tolerance applied to the bicarbonate instead.
    const spec: Record<string, { from: number; to: number; slope: number; tol: number }> = {
      respAcidoseAcute: { from: 40, to: 100, slope: 0.1, tol: 1.5 },
      respAcidoseChronic: { from: 40, to: 100, slope: 0.35, tol: 2.5 },
      respAlkAcute: { from: 40, to: 14, slope: 0.2, tol: 1.5 },
      respAlkChronic: { from: 40, to: 14, slope: 0.4, tol: 2.5 },
    };
    const s = spec[id];
    const step = s.to > s.from ? 2 : -2;
    for (let p = s.from; step > 0 ? p <= s.to : p >= s.to; p += step) {
      const h = 24 + s.slope * (p - 40);
      upper.push({ hco3: h + s.tol, pco2: p });
      lower.push({ hco3: h - s.tol, pco2: p });
    }
  }
  return [upper, lower];
}

export function AcidBaseMap(props: {
  points?: MapPoint[];
  /** which bands to draw; all of them if omitted */
  show?: BandId[];
  height?: number;
  /** highlight one band, dimming the rest */
  highlight?: BandId | null;
}) {
  const h = props.height ?? 320;
  const W = 640;
  const H = h;
  const pad = { l: 46, r: 12, t: 12, b: 34 };
  const pHmin = 6.85;
  const pHmax = 7.75;
  const pcoMin = 8;
  const pcoMax = 110;
  const x = (pH: number) => pad.l + ((pH - pHmin) / (pHmax - pHmin)) * (W - pad.l - pad.r);
  const y = (pco2: number) => H - pad.b - ((Math.log(pco2) - Math.log(pcoMin)) / (Math.log(pcoMax) - Math.log(pcoMin))) * (H - pad.t - pad.b);

  const bands = useMemo(() => {
    const ids = props.show ?? BANDS.map((b) => b.id);
    return BANDS.filter((b) => ids.includes(b.id)).map((b) => {
      const [upper, lower] = bandPoints(b.id);
      const toXY = (pt: { hco3: number; pco2: number }) => {
        const pH = phFrom(pt.hco3, pt.pco2);
        return `${x(pH).toFixed(1)},${y(pt.pco2).toFixed(1)}`;
      };
      const d = `M${upper.map(toXY).join(' L')} L${lower.slice().reverse().map(toXY).join(' L')} Z`;
      return { ...b, d };
    });
  }, [props.show, h]);

  const isopleths = useMemo(
    () =>
      [5, 10, 15, 20, 25, 30, 40, 50].map((hco3) => {
        const pts: string[] = [];
        for (let pH = pHmin; pH <= pHmax; pH += 0.02) {
          const p = pco2At(pH, hco3);
          if (p >= pcoMin && p <= pcoMax) pts.push(`${x(pH).toFixed(1)},${y(p).toFixed(1)}`);
        }
        // label at the top end of the curve
        const last = pts.length ? pts[pts.length - 1].split(',').map(Number) : null;
        return { hco3, d: pts.length ? `M${pts.join(' L')}` : '', label: last };
      }),
    [h],
  );

  return (
    <div>
      <div class="svg-scroll wide">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Acid–base map: pH against PCO2 with bicarbonate isopleths and the bands of the simple disorders">
        {/* bicarbonate isopleths */}
        {isopleths.map((iso) => (
          <g key={iso.hco3}>
            <path d={iso.d} fill="none" stroke="color-mix(in srgb, var(--mix) 9%, transparent)" stroke-width="1" stroke-dasharray="3 3" />
            {iso.label && iso.label[1] > pad.t + 10 && (
              <text x={iso.label[0] + 3} y={iso.label[1] + 3} fill="color-mix(in srgb, var(--mix) 21%, transparent)" font-size="9">
                {iso.hco3}
              </text>
            )}
          </g>
        ))}
        {/* disorder bands */}
        {bands.map((b) => {
          const dim = props.highlight && props.highlight !== b.id;
          return <path key={b.id} d={b.d} fill={b.colour} opacity={dim ? 0.07 : 0.22} stroke={b.colour} stroke-opacity={dim ? 0.15 : 0.5} stroke-width="1" />;
        })}
        {/* normal box */}
        <rect x={x(7.37)} y={y(44)} width={x(7.43) - x(7.37)} height={y(36) - y(44)} fill="color-mix(in srgb, var(--mix) 13%, transparent)" stroke="color-mix(in srgb, var(--mix) 33%, transparent)" stroke-width="1" />
        {/* axes */}
        <line x1={pad.l} y1={H - pad.b} x2={W - pad.r} y2={H - pad.b} stroke="color-mix(in srgb, var(--mix) 20%, transparent)" />
        <line x1={pad.l} y1={pad.t} x2={pad.l} y2={H - pad.b} stroke="color-mix(in srgb, var(--mix) 20%, transparent)" />
        {[6.9, 7.0, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7].map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={H - pad.b} x2={x(t)} y2={H - pad.b + 4} stroke="color-mix(in srgb, var(--mix) 20%, transparent)" />
            <text x={x(t)} y={H - pad.b + 15} fill="var(--ink-faint)" class="svg-label" text-anchor="middle">
              {t.toFixed(1)}
            </text>
          </g>
        ))}
        {[10, 20, 40, 60, 100].map((t) => (
          <g key={t}>
            <line x1={pad.l - 4} y1={y(t)} x2={pad.l} y2={y(t)} stroke="color-mix(in srgb, var(--mix) 20%, transparent)" />
            <text x={pad.l - 7} y={y(t) + 3} fill="var(--ink-faint)" class="svg-label" text-anchor="end">
              {t}
            </text>
          </g>
        ))}
        <text x={(W + pad.l) / 2} y={H - 3} class="svg-label axis-title" text-anchor="middle">
          arterial pH →
        </text>
        <text x={12} y={H / 2} class="svg-label" text-anchor="middle" transform={`rotate(-90 12 ${H / 2})`} style={{ fontWeight: 600, fill: 'var(--ink)' }}>
          arterial PCO₂ (mmHg) →
        </text>
        {/* plotted points */}
        {(props.points ?? []).map((p, i) => {
          const px = x(Math.max(pHmin, Math.min(pHmax, p.pH)));
          const py = y(Math.max(pcoMin, Math.min(pcoMax, p.pco2)));
          const current = p.tone !== 'case';
          return (
            <g key={i}>
              <circle cx={px} cy={py} r={current ? 6 : 4} fill={current ? 'var(--c-teal)' : 'var(--c-strong)'} stroke="var(--bg)" stroke-width="1.5" />
              {p.label && (
                <text x={px + 9} y={py + 4} fill={current ? 'var(--c-teal)' : 'color-mix(in srgb, var(--mix) 80%, transparent)'} font-size="10">
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
      <div class="chips" style={{ marginTop: 2 }}>
        {BANDS.filter((b) => (props.show ?? BANDS.map((z) => z.id)).includes(b.id)).map((b) => (
          <span key={b.id} class="tag" style={{ color: b.colour }}>
            ■ {b.label}
          </span>
        ))}
        <span class="tag" style={{ color: 'color-mix(in srgb, var(--mix) 67%, transparent)' }}>■ Normal</span>
      </div>
    </div>
  );
}
