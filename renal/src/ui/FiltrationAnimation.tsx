// Particles flowing along a glomerular capillary. Small solutes and water cross into Bowman's
// space where the local net filtration pressure is positive; plasma proteins cannot, so they
// concentrate toward the efferent end — which is why oncotic pressure rises along the capillary.

import { useEffect, useRef } from 'preact/hooks';
import type { ProfilePoint } from '../engine/glomerulus';

interface P {
  x: number;
  y: number;
  kind: 'water' | 'protein' | 'rbc';
  crossing: number; // 0 = in capillary; >0 = moving into Bowman's space
  vy: number;
}

export function FiltrationAnimation(props: { profile: ProfilePoint[]; flow: number; height?: number; barrierLeak?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const state = useRef({ ps: [] as P[], profile: props.profile, flow: props.flow, leak: props.barrierLeak ?? 0 });
  state.current.profile = props.profile;
  state.current.flow = props.flow;
  state.current.leak = props.barrierLeak ?? 0;

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const W = 600;
    const top = 30;
    const bottom = 90;
    const nodes: SVGCircleElement[] = [];
    const g = svg.querySelector('g.particles')!;
    let raf = 0;
    let last = performance.now();
    const nfpAt = (x: number) => {
      const pr = state.current.profile;
      if (!pr.length) return 0;
      const i = Math.min(pr.length - 1, Math.max(0, Math.round(x * (pr.length - 1))));
      return Math.max(0, pr[i].nfp);
    };
    const spawn = (): P => {
      const r = Math.random();
      const kind: P['kind'] = r < 0.62 ? 'water' : r < 0.85 ? 'protein' : 'rbc';
      return { x: 0, y: top + 8 + Math.random() * (bottom - top - 16), kind, crossing: 0, vy: 0 };
    };
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = state.current;
      const speed = 0.28 * Math.max(0.15, s.flow);
      if (s.ps.length < 220 && Math.random() < 0.9) s.ps.push(spawn());
      for (const p of s.ps) {
        if (p.crossing > 0) {
          p.y += 60 * dt;
          p.crossing += dt;
        } else {
          p.x += speed * dt * (0.85 + Math.random() * 0.3);
          const canCross = p.kind === 'water' || (p.kind === 'protein' && Math.random() < s.leak * 0.02);
          if (canCross) {
            // Scaled so roughly a fifth of the water crosses over a normal transit (FF ≈ 0.2).
            const prob = nfpAt(p.x) * 0.0006 * dt * 60;
            if (Math.random() < prob) {
              p.crossing = 0.001;
              p.y = bottom - 2;
            }
          }
        }
      }
      s.ps = s.ps.filter((p) => p.x < 1 && p.crossing < 1.6);
      while (nodes.length < s.ps.length) {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        g.appendChild(c);
        nodes.push(c);
      }
      nodes.forEach((c, i) => {
        const p = s.ps[i];
        if (!p) {
          c.setAttribute('r', '0');
          return;
        }
        c.setAttribute('cx', String(40 + p.x * (W - 80)));
        c.setAttribute('cy', String(p.y));
        c.setAttribute('r', p.kind === 'rbc' ? '4.2' : p.kind === 'protein' ? '3' : '1.9');
        c.setAttribute('fill', p.kind === 'rbc' ? '#c0504d' : p.kind === 'protein' ? '#f2b134' : '#6aa9e8');
        c.setAttribute('opacity', p.crossing > 0 ? String(Math.max(0, 1 - p.crossing / 1.6)) : '0.9');
      });
      raf = requestAnimationFrame(tick);
    };
    if (!reduce) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg ref={ref} viewBox="0 0 600 150" width="100%" style={{ maxHeight: props.height ?? 170 }} role="img" aria-label="Animation of filtration along a glomerular capillary">
      <text x="40" y="20" class="svg-label">
        afferent end
      </text>
      <text x="560" y="20" class="svg-label" text-anchor="end">
        efferent end
      </text>
      <rect x="40" y="30" width="520" height="60" rx="30" fill="#c0504d18" stroke="#c0504d88" />
      <line x1="40" x2="560" y1="92" y2="92" stroke="#7fd1c1" stroke-width="3" stroke-dasharray="2 3" />
      <text x="300" y="140" class="svg-label" text-anchor="middle">
        Bowman&apos;s space · <tspan fill="#6aa9e8">● water &amp; small solutes cross</tspan> · <tspan fill="#f2b134">● protein retained</tspan> · <tspan fill="#c0504d">● red cells</tspan>
      </text>
      <g class="particles" />
    </svg>
  );
}
