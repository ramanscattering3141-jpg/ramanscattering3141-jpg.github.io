import { describe, expect, it } from 'vitest';
import { makePhysio, runEcg, type EcgRun, type LeadId } from '../../src/ecg/engine';
import { PRESETS } from '../../src/ecg/engine/presets';
import { applyPatch, type PhysioPatch } from '../../src/ecg/engine/params';

const run = (id: string, extra?: PhysioPatch, dur = 10000): EcgRun => runEcg(applyPatch(makePhysio(PRESETS[id].patch), extra), dur);

/** ST deviation (mV) at J+60 ms relative to the PR baseline, for a mid-strip beat. */
function st(r: EcgRun, lead: LeadId): number {
  const b = r.sig.beats[Math.floor(r.sig.beats.length / 2)];
  const a = r.sig.leads[lead]!;
  return a[Math.round(b.ev.t + b.morph.qrsDur + 60 - r.sig.from)] - a[Math.round(b.ev.t - 25 - r.sig.from)];
}

describe('every physiological preset simulates', () => {
  for (const [id, pr] of Object.entries(PRESETS)) {
    it(id, () => {
      const r = runEcg(makePhysio(pr.patch), 8000);
      let finite = true;
      for (const arr of Object.values(r.sig.leads)) for (const v of arr!) if (!Number.isFinite(v)) finite = false;
      expect(finite).toBe(true);
      const organised = !['vf', 'vflutter', 'asystole'].includes(id);
      if (organised) expect(r.sim.ventricular.filter((v) => v.t >= 0).length).toBeGreaterThan(0);
    });
  }
});

describe('normal physiology', () => {
  it('normal sinus rhythm has normal intervals and axis', () => {
    const r = run('nsr');
    expect(r.m.ventRate).toBeGreaterThan(60);
    expect(r.m.ventRate).toBeLessThan(90);
    expect(r.m.pr).toBeGreaterThanOrEqual(120);
    expect(r.m.pr).toBeLessThanOrEqual(200);
    expect(r.m.qrs).toBeLessThan(110);
    expect(r.m.axisLabel).toBe('normal');
    expect(r.m.avRelation).toBe('1:1 AV conduction');
  });
});

describe('re-entry emerges from pathway properties', () => {
  it('a PAC initiates sustained AVNRT with short-RP retrograde P waves', () => {
    const r = run('avnrt');
    const retro = r.sim.atrial.filter((a) => a.kind === 'retro' && a.t > 2500);
    expect(retro.length).toBeGreaterThan(10);
    const late = r.sim.ventricular.filter((v) => v.t > 4000);
    const cl = (late[late.length - 1].t - late[0].t) / (late.length - 1);
    expect(60000 / cl).toBeGreaterThan(140);
    expect(60000 / cl).toBeLessThan(250);
    // Retrograde P within ~70 ms of QRS onset (hidden at the end of the QRS)
    const v = late[3];
    const rp = Math.min(...retro.map((a) => Math.abs(a.t - v.t)));
    expect(rp).toBeLessThan(70);
  });
  it('adenosine terminates AVNRT (AV node is part of the circuit)', () => {
    const r = run('avnrt', { rhythm: { interventions: [{ t: 5000, kind: 'adenosine' }] } }, 12000);
    // No sustained re-entry after the drug (escape beats and sinus rhythm may follow)
    const vs = r.sim.ventricular.filter((v) => v.t > 9000);
    for (let i = 1; i < vs.length; i++) expect(vs[i].t - vs[i - 1].t).toBeGreaterThan(500);
  });
  it('orthodromic AVRT: narrow QRS, retrograde P via the pathway with RP ≥ 70 ms', () => {
    const r = run('orthoAvrt');
    const retro = r.sim.atrial.filter((a) => a.via === 'ap' && a.t > 3000);
    expect(retro.length).toBeGreaterThan(8);
    const vs = r.sim.ventricular.filter((v) => v.t > 3000);
    expect(vs.every((v) => v.route === 'his')).toBe(true);
    const v = vs[2];
    const next = retro.find((a) => a.t > v.t)!;
    expect(next.t - v.t).toBeGreaterThanOrEqual(70);
  });
  it('antidromic AVRT is fully pre-excited', () => {
    const r = run('antiAvrt');
    const vs = r.sim.ventricular.filter((v) => v.t > 3500);
    expect(vs.length).toBeGreaterThan(8);
    expect(vs.filter((v) => v.route === 'ap' && !Number.isFinite(v.hisDelay)).length).toBeGreaterThan(vs.length * 0.8);
  });
});

describe('AV-nodal filtering of atrial tachyarrhythmias', () => {
  it('flutter 2:1 ≈ 150/min, 4:1 ≈ 75/min', () => {
    expect(Math.abs((run('flutter21').m.ventRate ?? 0) - 150)).toBeLessThan(10);
    expect(Math.abs((run('flutter41').m.ventRate ?? 0) - 75)).toBeLessThan(10);
  });
  it('AF is irregularly irregular', () => {
    const r = run('af');
    expect(r.m.rrCV).toBeGreaterThan(0.1);
    expect(r.m.atrialRate).toBeNull();
  });
  it('pre-excited AF: after an AV-nodal blocker every beat is fully pre-excited and the rate does not fall', () => {
    const base = run('preexAf');
    const blk = run('preexAf', { rhythm: { interventions: [{ t: 0, kind: 'avnBlocker' }] } });
    const late = blk.sim.ventricular.filter((v) => v.t > 5000);
    expect(late.every((v) => v.route === 'ap')).toBe(true);
    expect(blk.m.ventRate!).toBeGreaterThan(base.m.ventRate! * 0.85);
  });
});

describe('AV block', () => {
  it('Mobitz I: PR lengthens before a dropped beat', () => {
    const r = run('mobitz1', undefined, 12000);
    const prs = r.sim.ventricular.filter((v) => v.t >= 0 && v.atrialIndex >= 0).map((v) => v.t - r.sim.atrial[v.atrialIndex].t);
    let increases = 0;
    for (let i = 1; i < prs.length; i++) if (prs[i] > prs[i - 1] + 10) increases++;
    expect(increases).toBeGreaterThan(2);
    expect(r.m.conductedFraction).toBeLessThan(1);
  });
  it('Mobitz II: constant PR with dropped beats', () => {
    const r = run('mobitz2', undefined, 12000);
    expect(r.m.prRange![1] - r.m.prRange![0]).toBeLessThan(12);
    expect(r.m.conductedFraction).toBeLessThan(0.9);
  });
  it('complete heart block: junctional escape is narrow, ventricular escape is wide and slower', () => {
    const j = run('chbJunctional');
    const v = run('chbVentricular');
    expect(j.m.conductedFraction).toBe(0);
    expect(v.m.conductedFraction).toBe(0);
    expect(j.m.qrs!).toBeLessThan(110);
    expect(v.m.qrs!).toBeGreaterThanOrEqual(120);
    expect(v.m.ventRate!).toBeLessThan(j.m.ventRate!);
  });
  it('atropine does not rescue infranodal block', () => {
    const r = run('chbVentricular', { rhythm: { interventions: [{ t: 0, kind: 'atropine' }] } });
    expect(r.m.conductedFraction).toBe(0);
    expect(r.m.ventRate!).toBeLessThan(40);
  });
});

describe('intraventricular conduction', () => {
  it('bundle-branch blocks widen the QRS; fascicular blocks shift the axis', () => {
    expect(run('rbbb').m.qrs!).toBeGreaterThanOrEqual(115);
    expect(run('lbbb').m.qrs!).toBeGreaterThanOrEqual(120);
    expect(run('lafb').m.axis!).toBeLessThanOrEqual(-45);
    expect(run('lpfb').m.axis!).toBeGreaterThanOrEqual(90);
  });
  it('RBBB produces a terminal positive deflection in V1; LBBB a deep negative V1', () => {
    const rb = run('rbbb');
    const lb = run('lbbb');
    const b = rb.sig.beats[4];
    const v1 = rb.sig.leads.V1!;
    const end = Math.round(b.ev.t + b.morph.qrsDur - 25);
    expect(v1[end]).toBeGreaterThan(0.2);
    const bl = lb.sig.beats[4];
    let mn = 0;
    for (let i = Math.round(bl.ev.t); i < bl.ev.t + bl.morph.qrsDur; i++) mn = Math.min(mn, lb.sig.leads.V1![i]);
    expect(mn).toBeLessThan(-1);
  });
  it('WPW: short PR and wide QRS', () => {
    const r = run('wpw');
    expect(r.m.pr!).toBeLessThan(120);
    expect(r.m.qrs!).toBeGreaterThan(110);
  });
});

describe('ventricular rhythms and adenosine', () => {
  it('scar VT shows AV dissociation and ignores adenosine; RVOT VT terminates', () => {
    const vt = run('monoVT', { rhythm: { interventions: [{ t: 3000, kind: 'adenosine' }] } });
    expect(vt.m.avRelation).toMatch(/dissociation/);
    expect(vt.sim.ventricular.filter((v) => v.t > 9000 && v.mechanism === 'VT').length).toBeGreaterThan(0);
    const rv = run('rvotVT', { rhythm: { interventions: [{ t: 3000, kind: 'adenosine' }] } });
    expect(rv.sim.ventricular.filter((v) => v.t > 8000 && v.mechanism === 'VT').length).toBe(0);
  });
  it('adenosine in sinus tachycardia causes transient AV block, not termination', () => {
    const r = run('sinusTach', { rhythm: { interventions: [{ t: 2000, kind: 'adenosine' }] } });
    expect(r.sim.atrial.some((a) => a.t > 3000 && a.t < 9000 && a.kind === 'sinus' && !a.conducted)).toBe(true);
    expect(r.sim.atrial.some((a) => a.t > 9000 && a.conducted)).toBe(true);
  });
  it('a shock converts VT to sinus rhythm', () => {
    const r = run('monoVT', { rhythm: { interventions: [{ t: 4000, kind: 'shock' }] } });
    expect(r.sim.ventricular.filter((v) => v.t > 5000 && v.mechanism === 'VT').length).toBe(0);
    expect(r.sim.ventricular.filter((v) => v.t > 5000 && v.mechanism === 'conducted').length).toBeGreaterThan(3);
  });
});

describe('ions, drugs and repolarisation', () => {
  it('hyperkalaemia widens the QRS progressively', () => {
    const q = [4.2, 6.5, 7.5, 8.5].map((K) => runEcg(makePhysio({ K }), 6000).m.qrs!);
    for (let i = 1; i < q.length; i++) expect(q[i]).toBeGreaterThanOrEqual(q[i - 1]);
    expect(q[3]).toBeGreaterThan(120);
  });
  it('calcium sets the QT via the ST segment', () => {
    const lo = runEcg(makePhysio({ Ca: 1.7 }), 6000).m.qtcBazett!;
    const n = runEcg(makePhysio({}), 6000).m.qtcBazett!;
    const hi = runEcg(makePhysio({ Ca: 3.4 }), 6000).m.qtcBazett!;
    expect(lo).toBeGreaterThan(n);
    expect(n).toBeGreaterThan(hi);
  });
  it('sodium-channel blockade widens the QRS with a terminal R in aVR', () => {
    const r = run('tca');
    expect(r.m.qrs!).toBeGreaterThan(120);
    const b = r.sig.beats[5];
    const a = r.sig.leads.aVR!;
    const i = Math.round(b.ev.t + b.morph.qrsDur - 15 - r.sig.from);
    expect(a[i]).toBeGreaterThan(0.1);
  });
});

describe('injury currents', () => {
  it('inferior STEMI: STE in II/III/aVF (III > II) with reciprocal STD in aVL', () => {
    const r = run('stemiInferior');
    expect(st(r, 'III')).toBeGreaterThan(0.1);
    expect(st(r, 'III')).toBeGreaterThan(st(r, 'II'));
    expect(st(r, 'aVL')).toBeLessThan(-0.05);
  });
  it('anterior STEMI: STE in V2–V4', () => {
    const r = run('stemiAnterior');
    expect(st(r, 'V2')).toBeGreaterThan(0.2);
    expect(st(r, 'V3')).toBeGreaterThan(0.2);
  });
  it('posterior MI: ST depression in V1–V3', () => {
    expect(st(run('stemiPosterior'), 'V2')).toBeLessThan(-0.15);
  });
  it('pericarditis: diffuse STE with ST depression in aVR', () => {
    const r = run('pericarditis');
    expect(st(r, 'II')).toBeGreaterThan(0.08);
    expect(st(r, 'V5')).toBeGreaterThan(0.08);
    expect(st(r, 'aVR')).toBeLessThan(-0.05);
  });
  it('diffuse subendocardial ischaemia elevates aVR and depresses V6', () => {
    const r = run('subendo');
    expect(st(r, 'aVR')).toBeGreaterThan(0.08);
    expect(st(r, 'V6')).toBeLessThan(-0.08);
  });
});
