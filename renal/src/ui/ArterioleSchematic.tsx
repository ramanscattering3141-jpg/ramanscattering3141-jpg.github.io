// Two taps around a capillary: vessel widths follow the arteriolar resistances (r ∝ R^-¼,
// Poiseuille), the glomerulus colour follows its pressure, and the filtrate stream its GFR.

export function ArterioleSchematic(props: { ra: number; re: number; pgc: number; gfr: number; rbf: number; label?: string }) {
  const w = (rel: number) => Math.max(3, Math.min(30, 16 * Math.pow(Math.max(rel, 0.05), -0.25)));
  const wa = w(props.ra);
  const we = w(props.re);
  const heat = Math.max(0, Math.min(1, (props.pgc - 30) / 40));
  const glomFill = `rgb(${Math.round(90 + 150 * heat)}, ${Math.round(110 - 50 * heat)}, ${Math.round(140 - 80 * heat)})`;
  const flowW = Math.max(1.5, Math.min(24, (props.rbf / 1150) * 14));
  const filtW = Math.max(0.5, Math.min(16, (props.gfr / 125) * 7));
  return (
    <svg viewBox="0 0 600 230" width="100%" role="img" aria-label={props.label ?? 'Afferent and efferent arterioles around the glomerulus'}>
      <defs>
        <marker id="arr-sch" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#a3b9c9" />
        </marker>
      </defs>
      {/* artery → afferent */}
      <path d="M10,110 L120,110" stroke="#c0504d" stroke-width="30" stroke-linecap="round" />
      <path d={`M120,110 L230,110`} stroke="#d9605c" stroke-width={wa} stroke-linecap="round" />
      {/* glomerulus */}
      <circle cx="300" cy="110" r="62" fill="#12283a" stroke="#7fd1c1" stroke-width="3" />
      <circle cx="300" cy="110" r="44" fill={glomFill} />
      <text x="300" y="106" text-anchor="middle" class="svg-value" style={{ fontSize: 15 }}>
        {props.pgc.toFixed(0)} mmHg
      </text>
      <text x="300" y="124" text-anchor="middle" class="svg-label">
        Pgc
      </text>
      {/* efferent → peritubular */}
      <path d={`M370,110 L480,110`} stroke="#b8566b" stroke-width={we} stroke-linecap="round" />
      <path d="M480,110 L590,110" stroke="#8a5a78" stroke-width="22" stroke-linecap="round" opacity="0.8" />
      {/* flow arrow */}
      <line x1="30" x2="110" y1="60" y2="60" stroke="#a3b9c9" stroke-width={flowW / 3 + 1} marker-end="url(#arr-sch)" />
      <text x="30" y="48" class="svg-label">
        RBF {props.rbf.toFixed(0)} mL/min
      </text>
      {/* filtrate */}
      <path d="M300,172 L300,222" stroke="#6aa9e8" stroke-width={filtW} marker-end="url(#arr-sch)" />
      <text x="312" y="205" class="svg-label" style={{ fill: '#6aa9e8' }}>
        GFR {props.gfr.toFixed(0)} mL/min → proximal tubule
      </text>
      <text x="175" y="88" text-anchor="middle" class="svg-label">
        afferent ×{props.ra.toFixed(2)}
      </text>
      <text x="425" y="88" text-anchor="middle" class="svg-label">
        efferent ×{props.re.toFixed(2)}
      </text>
      <text x="535" y="145" text-anchor="middle" class="svg-label">
        peritubular capillaries
      </text>
    </svg>
  );
}
