// Procedural sound (Web Audio, no sample files): engine tone that follows power
// (propeller buzz or turbofan whine + roar), wind noise with airspeed, tyre
// rumble on the ground, and stall / overspeed warnings. Starts muted until the
// user interacts (browser autoplay rules).

import type { FlightDynamics } from '../aircraft/FlightDynamics';
import { clamp, KT } from '../core/math';

export class SimAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private engOsc!: OscillatorNode; private engGain!: GainNode;
  private whine!: OscillatorNode; private whineGain!: GainNode;
  private noiseGain!: GainNode; private noiseFilter!: BiquadFilterNode;
  private roarGain!: GainNode; private roarFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private warnGain!: GainNode; private warnOsc!: OscillatorNode;
  volume = 0.6;
  muted = false;

  /** Must be called from a user gesture. */
  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    try {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = this.volume; this.master.connect(ctx.destination);
      const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = () => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(); return n; };
      // engine fundamental
      this.engOsc = ctx.createOscillator(); this.engOsc.type = 'sawtooth';
      const engFilter = ctx.createBiquadFilter(); engFilter.type = 'lowpass'; engFilter.frequency.value = 600;
      this.engGain = ctx.createGain(); this.engGain.gain.value = 0;
      this.engOsc.connect(engFilter).connect(this.engGain).connect(this.master); this.engOsc.start();
      // turbine whine
      this.whine = ctx.createOscillator(); this.whine.type = 'sine';
      this.whineGain = ctx.createGain(); this.whineGain.gain.value = 0;
      this.whine.connect(this.whineGain).connect(this.master); this.whine.start();
      // jet roar (band-passed noise)
      this.roarFilter = ctx.createBiquadFilter(); this.roarFilter.type = 'lowpass'; this.roarFilter.frequency.value = 400;
      this.roarGain = ctx.createGain(); this.roarGain.gain.value = 0;
      noise().connect(this.roarFilter).connect(this.roarGain).connect(this.master);
      // wind
      this.noiseFilter = ctx.createBiquadFilter(); this.noiseFilter.type = 'bandpass'; this.noiseFilter.Q.value = 0.6;
      this.noiseGain = ctx.createGain(); this.noiseGain.gain.value = 0;
      noise().connect(this.noiseFilter).connect(this.noiseGain).connect(this.master);
      // tyre rumble
      const rf = ctx.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 90;
      this.rumbleGain = ctx.createGain(); this.rumbleGain.gain.value = 0;
      noise().connect(rf).connect(this.rumbleGain).connect(this.master);
      // warning tone
      this.warnOsc = ctx.createOscillator(); this.warnOsc.type = 'square'; this.warnOsc.frequency.value = 880;
      this.warnGain = ctx.createGain(); this.warnGain.gain.value = 0;
      this.warnOsc.connect(this.warnGain).connect(this.master); this.warnOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  update(fd: FlightDynamics | null, paused: boolean, cockpit: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime, tc = 0.08;
    const set = (g: AudioParam, v: number) => g.setTargetAtTime(v, now, tc);
    if (!fd || paused || fd.crashed) {
      for (const g of [this.engGain, this.whineGain, this.roarGain, this.noiseGain, this.rumbleGain, this.warnGain]) set(g.gain, 0);
      return;
    }
    const t = fd.telemetry;
    const e = fd.engines.states;
    const n = e.reduce((a, s) => a + (s.status === 'running' ? 0.3 + 0.7 * s.n : s.status === 'starting' ? 0.2 * s.startProgress : 0), 0) / e.length;
    const inside = cockpit ? 0.55 : 1;
    if (fd.def.engine.kind === 'turbofan') {
      set(this.engGain.gain, 0);
      set(this.whine.frequency, 900 + 2600 * n);
      set(this.whineGain.gain, 0.025 * n * inside);
      set(this.roarFilter.frequency, 250 + 900 * n);
      set(this.roarGain.gain, 0.28 * n * n * inside);
    } else {
      const rpm = e[0]?.display ?? 0;
      const f = fd.def.engine.kind === 'piston' ? (rpm / 60) * 2 : 60 + 90 * n;
      set(this.engOsc.frequency, Math.max(20, f));
      set(this.engGain.gain, 0.12 * n * inside);
      set(this.whine.frequency, 1500 + 1800 * n);
      set(this.whineGain.gain, fd.def.engine.kind === 'turboprop' ? 0.015 * n : 0);
      set(this.roarGain.gain, 0.08 * n * inside);
      set(this.roarFilter.frequency, 300 + 500 * n);
    }
    const kt = t.tas / KT;
    set(this.noiseFilter.frequency, 300 + kt * 6);
    set(this.noiseGain.gain, clamp((kt - 30) / 400, 0, 0.35) * (cockpit ? 0.6 : 1));
    set(this.rumbleGain.gain, t.onGround ? clamp(t.gs / 40, 0, 1) * 0.4 : 0);
    const warn = t.stallWarning || t.overspeed;
    set(this.warnGain.gain, warn && Math.floor(now * 4) % 2 === 0 ? 0.04 : 0);
    this.warnOsc.frequency.value = t.overspeed ? 1200 : 650;
  }
}
