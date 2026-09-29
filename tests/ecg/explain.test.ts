import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg, type EcgRun } from '../../src/ecg/engine';
import { explainAt } from '../../src/ecg/engine/explain';
import { PRESETS } from '../../src/ecg/engine/presets';

const run = (id: string): EcgRun => runEcg(makePhysio({ ...PRESETS[id].patch, noise: 0 }), 8000);
const midBeat = (r: EcgRun, pred: (b: EcgRun['sig']['beats'][number]) => boolean = () => true) => r.sig.beats.filter((b) => b.ev.t > 1500 && pred(b))[0];

describe('time-resolved ECG explanation', () => {
  it('walks through P → PR → QRS → ST → T → TP for a sinus beat', () => {
    const r = run('nsr');
    const b = midBeat(r);
    const a = r.sim.atrial[b.ev.atrialIndex];
    const at = (t: number) => explainAt(r, t, 'II').phase.id;
    expect(at(a.t + 30)).toBe('P');
    expect(at(b.ev.t - 15)).toBe('PR');
    expect(at(b.ev.t + b.morph.qrsDur / 2)).toBe('QRS');
    expect(at(b.ev.t + (b.morph.qrsDur + b.morph.tStart) / 2)).toBe('ST');
    expect(at(b.ev.t + (b.morph.tStart + b.morph.tEnd) / 2)).toBe('T');
    const next = r.sig.beats[r.sig.beats.indexOf(b) + 1];
    const nextP = r.sim.atrial[next.ev.atrialIndex].t;
    expect(at((b.ev.t + b.morph.tEnd + 130 + nextP) / 2)).toBe('TP');
  });
  it('phase intervals bracket the time and the lead value matches the tracing', () => {
    const r = run('nsr');
    const b = midBeat(r);
    const t = b.ev.t + 20;
    const m = explainAt(r, t, 'V1');
    expect(m.phase.t0).toBeLessThanOrEqual(t);
    expect(m.phase.t1).toBeGreaterThanOrEqual(t);
    expect(m.value).toBeCloseTo(r.sig.leads.V1![Math.round(t)], 6);
    expect(m.comps.length).toBeGreaterThan(0);
    expect(m.comps.reduce((s, c) => s + c.weight, 0)).toBeLessThanOrEqual(1.0001);
  });
  it('names the conduction abnormality while the QRS is written', () => {
    const qrs = (id: string): string => {
      const r = run(id);
      const b = midBeat(r);
      return explainAt(r, b.ev.t + 20).why.join(' ');
    };
    expect(qrs('rbbb')).toMatch(/Right bundle blocked/);
    expect(qrs('lbbb')).toMatch(/Left bundle blocked.*right→left/);
    expect(qrs('lafb')).toMatch(/anterior fascicle/);
    expect(qrs('wpw')).toMatch(/Delta wave|pre-excited/);
    expect(qrs('vvi')).toMatch(/Paced beat/);
    const r = run('pvc');
    const pvc = midBeat(r, (b) => b.ev.route === 'focus');
    expect(explainAt(r, pvc.ev.t + 20).why.join(' ')).toMatch(/Ectopic ventricular activation/);
  });
  it('explains a blocked P wave in Mobitz I / II', () => {
    for (const id of ['mobitz1', 'mobitz2']) {
      const r = run(id);
      const blocked = r.sim.atrial.find((a) => a.t > 1000 && a.t < 7000 && !a.conducted && a.kind === 'sinus')!;
      expect(blocked, id).toBeDefined();
      const txt = (t: number): string => {
        const m = explainAt(r, t);
        return [m.phase.id, ...m.conduction, ...m.why].join(' ');
      };
      // Somewhere in the 300 ms after the blocked P the explanation reports the block.
      let found = false;
      for (let t = blocked.t; t < blocked.t + 300; t += 10) if (/BLOCKED|blocked|infranodal|not followed by a QRS/.test(txt(t))) found = true;
      expect(found, id).toBe(true);
    }
  });
  it('explains injury current during the ST segment of a STEMI and flutter waves', () => {
    const r = run('stemiAnterior');
    const b = midBeat(r);
    expect(explainAt(r, b.ev.t + b.morph.qrsDur + 30).why.join(' ')).toMatch(/injury current/);
    const f = run('flutter41');
    const fb = midBeat(f);
    const ids = new Set<string>();
    for (let t = fb.ev.t + 400; t < fb.ev.t + 700; t += 20) ids.add(explainAt(f, t).phase.id);
    expect([...ids]).toContain('F');
  });
});

describe('level of block', () => {
  it('Mobitz II is explained as infranodal, Mobitz I as AV-nodal', () => {
    const lines = (id: string): string => {
      const r = run(id);
      const blocked = r.sim.atrial.find((a) => a.t > 1000 && !a.conducted && a.kind === 'sinus')!;
      let all = '';
      for (let t = blocked.t; t < blocked.t + 300; t += 10) all += explainAt(r, t).conduction.join(' ');
      return all;
    };
    const m2 = lines('mobitz2');
    expect(m2).toMatch(/infranodal/);
    expect(m2).not.toMatch(/dies in the node/);
    const m1 = lines('mobitz1');
    expect(m1).toMatch(/dies in the node/);
    expect(m1).not.toMatch(/infranodal/);
  });
});
