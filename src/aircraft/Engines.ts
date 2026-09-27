// Engine models: piston propeller, turboprop and turbofan.
//
// Each engine has a normalised "power setting" n (0 = idle, 1 = full rated) that
// lags the throttle lever with a first-order spool time constant, so jets take
// several seconds to spool up exactly as pilots expect. Thrust is then derived:
//   • turbofan:  T = Tmax · lapse(σ, M) · (idle + (1-idle)·n)
//     lapse ≈ σ^0.75 · (1 − 0.25 M)  – a common textbook approximation for
//     high-bypass engines (thrust falls with air density and Mach).
//   • propeller: P = Pmax · altitudeFactor · (idle + (1-idle)·n)
//     T = min(Tstatic·σ, η·P / V)     – propeller thrust falls with speed.
// Fuel flow uses published-order-of-magnitude specific fuel consumption.

import type { AircraftDefinition } from './types';
import type { AirData } from '../environment/Atmosphere';
import { RHO0 } from '../environment/Atmosphere';
import { clamp } from '../core/math';

export type EngineStatus = 'off' | 'starting' | 'running' | 'failed';

export interface EngineState {
  status: EngineStatus;
  n: number; // spool / power fraction 0..1 (above idle)
  startProgress: number; // 0..1 during start
  thrustN: number;
  fuelFlowKgS: number;
  /** Displayed primary parameter: N1 % for jets, RPM for piston, torque % for turboprop */
  display: number;
}

export class Engines {
  readonly states: EngineState[];
  constructor(private def: AircraftDefinition, running: boolean) {
    this.states = def.engine.positionsY.map(() => ({
      status: running ? 'running' : 'off',
      n: 0,
      startProgress: running ? 1 : 0,
      thrustN: 0,
      fuelFlowKgS: 0,
      display: 0,
    }));
  }

  get running() {
    return this.states.some(s => s.status === 'running');
  }
  get allRunning() {
    return this.states.every(s => s.status === 'running');
  }

  /** Begin start sequence (or shut down if already running). */
  toggleStart(instant = false) {
    if (this.running || this.states.some(s => s.status === 'starting')) {
      for (const s of this.states) { s.status = 'off'; s.startProgress = 0; }
    } else {
      for (const s of this.states) {
        if (s.status === 'failed') continue;
        s.status = instant ? 'running' : 'starting';
        s.startProgress = instant ? 1 : 0;
      }
    }
  }

  fail(index: number) {
    const s = this.states[index];
    if (s) { s.status = 'failed'; s.n = 0; }
  }

  /**
   * @param throttle 0..1 lever position
   * @param reverse  true when reverse thrust is selected (ground only)
   * @param tas      true airspeed m/s
   * @param fuelAvailable whether any fuel remains
   */
  update(dt: number, throttle: number, reverse: boolean, air: AirData, tas: number, mach: number, fuelAvailable: boolean) {
    const e = this.def.engine;
    const sigma = air.density / RHO0;
    let totalFuel = 0;
    for (let i = 0; i < this.states.length; i++) {
      const s = this.states[i];
      if (s.status === 'running' && !fuelAvailable) s.status = 'off'; // flame-out
      if (s.status === 'starting') {
        s.startProgress += dt / e.startTime;
        if (s.startProgress >= 1) { s.status = fuelAvailable ? 'running' : 'off'; s.startProgress = 1; }
      }
      const target = s.status === 'running' ? clamp(throttle, 0, 1) : 0;
      // Jets spool more slowly from low power (the classic "spool-up lag").
      const tau = e.kind === 'turbofan' && s.n < 0.3 ? e.spoolTime * 1.6 : e.spoolTime;
      s.n += (target - s.n) * Math.min(1, dt / tau);
      const setting = e.idleFraction + (1 - e.idleFraction) * s.n;
      let thrust = 0, fuel = 0;
      if (s.status === 'running') {
        if (e.kind === 'turbofan') {
          const lapse = Math.pow(sigma, 0.75) * Math.max(0.2, 1 - 0.25 * mach);
          thrust = (this.def.spec.thrustKN ?? 0) * 1000 * lapse * setting;
          // TSFC grows with Mach (≈0.36 lb/lbf/h static → ≈0.6 at M0.8 for CFM56-class engines)
          fuel = (e.sfc * (1 + 0.8 * mach) * Math.max(thrust, 0.08 * (this.def.spec.thrustKN ?? 0) * 1000 * lapse)) / 3600;
          s.display = 20 + 80 * (0.08 + 0.92 * Math.sqrt(s.n)) + 2 * (setting > 0.99 ? 1 : 0); // N1 %
        } else {
          // Piston power falls with density (Gagg-Ferrar); turboprops are flat-rated to altitude.
          const altFactor = e.kind === 'piston' ? clamp(1.132 * sigma - 0.132, 0, 1) : clamp(1.35 * sigma, 0, 1);
          const power = (this.def.spec.powerKW ?? 0) * 1000 * altFactor * setting;
          const staticCap = (e.staticThrustKN ?? 1) * 1000 * Math.max(sigma, 0.3);
          thrust = Math.min(staticCap * setting, ((e.propEfficiency ?? 0.8) * power) / Math.max(tas, 1));
          fuel = (e.sfc * power) / 3.6e6;
          s.display = e.kind === 'piston' ? 700 + 2000 * (0.15 + 0.85 * s.n) * clamp(0.75 + tas / 260, 0, 1.05) : 100 * setting;
        }
        if (reverse && e.reverseFraction > 0) thrust = -thrust * e.reverseFraction / Math.max(setting, 0.05) * s.n;
      } else {
        s.display = s.status === 'starting' ? 20 * s.startProgress : Math.max(0, s.display - dt * 20);
      }
      s.thrustN = thrust;
      s.fuelFlowKgS = fuel;
      totalFuel += fuel;
    }
    return totalFuel;
  }
}
