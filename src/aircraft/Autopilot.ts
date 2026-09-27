// Simplified autopilot, flight director and autothrottle.
//
// The autopilot never moves the aircraft directly: it only writes the same
// control inputs a pilot would (elevator, aileron, rudder, throttle), so the
// aircraft responds through the flight model with its real inertia and limits.
//
// Structure (classic cascaded loops):
//   Lateral  : HDG / NAV / LOC  → bank-angle command → roll-rate loop → aileron
//   Vertical : ALT / VS / FLCH / GS / FLARE → vertical-speed or pitch command
//              → pitch attitude loop → elevator
//   A/THR    : SPD (IAS or Mach) → throttle; FLCH uses fixed climb/idle thrust
// Inner-loop gains are normalised by each aircraft's control power so one set
// of gains works from a Cessna 172 to a 747.

import type { FlightDynamics } from './FlightDynamics';
import type { GpsState, ApproachState } from '../navigation/Navigation';
import { DEG, RAD, KT, FPM, FT, clamp, wrap180 } from '../core/math';
import { casToTas, isa } from '../environment/Atmosphere';

export type LateralMode = 'ROLL' | 'HDG' | 'NAV' | 'LOC';
export type VerticalMode = 'PITCH' | 'ALT' | 'VS' | 'FLCH' | 'GS' | 'FLARE';

export interface AutopilotTargets {
  heading: number; // deg true
  altitudeFt: number;
  vsFpm: number;
  speedKt: number;
  mach: number;
  speedIsMach: boolean;
}

export class Autopilot {
  engaged = false;
  athr = false;
  fd = true;
  lateral: LateralMode = 'ROLL';
  vertical: VerticalMode = 'PITCH';
  locArmed = false;
  gsArmed = false;
  targets: AutopilotTargets = { heading: 0, altitudeFt: 5000, vsFpm: 1500, speedKt: 250, mach: 0.78, speedIsMach: false };
  /** Flight director commands (deg) for display */
  fdPitch = 0;
  fdBank = 0;
  message = '';

  private elevI = 0;
  private thrI = 0.5;
  private pitchHold = 0;
  private bankHold = 0;
  private prevIas = 0;
  private accelF = 0;
  private flareH0 = 15;
  private flareVs0 = 4;
  private lastVertical: VerticalMode = 'PITCH';

  constructor(private fd_: FlightDynamics) {}

  engage(on = !this.engaged) {
    const t = this.fd_.telemetry;
    if (on && t.onGround) { this.message = 'AP unavailable on ground'; return; }
    this.engaged = on;
    if (on) {
      this.elevI = 0;
      this.pitchHold = t.pitch;
      this.bankHold = Math.abs(t.roll) < 6 ? 0 : t.roll;
      if (this.lateral === 'ROLL') { this.lateral = 'HDG'; this.targets.heading = Math.round(t.heading); }
      if (this.vertical === 'PITCH') { this.vertical = 'VS'; this.targets.vsFpm = Math.round(t.vs / FPM / 100) * 100; }
      this.message = '';
    } else {
      this.releaseToTrim();
      this.message = 'AUTOPILOT DISCONNECT';
    }
  }

  setAthr(on = !this.athr) {
    this.athr = on;
    if (on) {
      this.thrI = this.fd_.controls.throttle;
      const t = this.fd_.telemetry;
      if (this.targets.speedKt <= 0 || !isFinite(this.targets.speedKt)) this.targets.speedKt = Math.round(t.ias / KT);
    }
  }

  /** Transfers the elevator the autopilot was holding into trim so disconnect is smooth. */
  private releaseToTrim() {
    const c = this.fd_.controls;
    c.trim = clamp(c.trim + this.elevI * 2, -1, 1);
    c.elevator = 0;
    c.aileron = 0;
    this.elevI = 0;
  }

  setLateral(m: LateralMode) {
    if (m === 'LOC') { this.locArmed = true; return; }
    this.lateral = m;
    this.locArmed = false;
    if (m === 'HDG' && !this.engaged) this.targets.heading = Math.round(this.fd_.telemetry.heading);
  }

  setVertical(m: VerticalMode) {
    this.vertical = m;
    if (m === 'VS') this.targets.vsFpm = Math.round(this.fd_.telemetry.vs / FPM / 100) * 100;
    if (m !== 'GS') this.gsArmed = false;
  }

  /** APP button: arm localizer and glideslope capture. */
  armApproach() {
    this.locArmed = true;
    this.gsArmed = true;
  }

  update(dt: number, gps: GpsState, app: ApproachState | null) {
    const fdm = this.fd_, t = fdm.telemetry, def = fdm.def, c = fdm.controls;
    const tas = Math.max(t.tas, 20);

    // ---------------- mode transitions ----------------
    if (this.locArmed && app?.inRange && Math.abs(app.locDots) < 2 && Math.abs(wrap180(t.track - app.course)) < 100) {
      this.lateral = 'LOC';
      this.locArmed = false;
    }
    // Glideslope capture from below or above, only within 15 NM of the threshold.
    if (this.gsArmed && this.lateral === 'LOC' && app?.inRange && Math.abs(app.gsDots) < 0.8 && app.distThresholdM > 0 && app.distThresholdM < 15 * 1852) {
      this.vertical = 'GS';
      this.gsArmed = false;
    }
    // Signal lost (out of range / passed the station): hold heading and altitude.
    if (this.lateral === 'LOC' && (!app || !app.inRange) && !t.onGround) {
      this.lateral = 'HDG';
      this.targets.heading = Math.round(t.heading);
      this.message = 'LOC signal lost — HDG hold';
    }
    if (this.vertical === 'GS' && (!app || !app.inRange || app.distThresholdM < -1000) && !t.onGround) {
      this.vertical = 'ALT';
      this.targets.altitudeFt = Math.round(t.alt / FT / 100) * 100;
      this.message = 'G/S signal lost — ALT hold';
    }
    // Flare: start at a height proportional to the sink rate (≈5 s to go), at least 25/40 ft.
    const hW = t.agl - def.gear.heightM;
    if (this.vertical === 'GS' && hW < Math.max((def.cockpit === 'ga' ? 20 : 40) * FT, -t.vs * 5)) {
      this.vertical = 'FLARE';
      this.flareH0 = Math.max(hW, 1);
      this.flareVs0 = Math.max(-t.vs, 1);
    }
    if (this.engaged && t.onGround && this.vertical === 'FLARE') {
      this.engage(false);
      this.message = 'AUTOLAND: touchdown — AP off';
      c.throttle = 0;
      this.athr = false;
    }
    if (this.engaged && (t.stalled || Math.abs(t.roll) > 60 || Math.abs(t.pitch) > 35)) {
      this.engage(false);
      this.message = 'AP DISCONNECT — unusual attitude';
    }

    // ---------------- lateral: bank command ----------------
    let bankCmd = this.bankHold;
    const maxBank = def.perf.maxBankDeg;
    if (this.lateral === 'HDG') {
      bankCmd = clamp(wrap180(this.targets.heading - t.heading) * 1.6, -maxBank, maxBank);
    } else if (this.lateral === 'NAV' && gps.hasPlan) {
      // L1-style intercept: aim at a point ~20 s ahead on the course line.
      const L1 = Math.max(tas * 20, 800);
      const intercept = Math.atan2(-gps.crossTrackM, L1) * RAD;
      const desired = gps.desiredTrack + clamp(intercept, -45, 45);
      bankCmd = clamp(wrap180(desired - t.track) * 1.8, -maxBank, maxBank);
    } else if (this.lateral === 'LOC' && app) {
      const L1 = Math.max(tas * 12, 500);
      const intercept = Math.atan2(-app.crossTrackM, L1) * RAD;
      const desired = app.course + clamp(intercept, -30, 30);
      bankCmd = clamp(wrap180(desired - t.track) * 2.0, -Math.min(maxBank, 20), Math.min(maxBank, 20));
    } else if (this.lateral === 'NAV') {
      bankCmd = 0;
    }
    if (this.vertical === 'FLARE') bankCmd = clamp(bankCmd, -2, 2);

    // ---------------- vertical: pitch command ----------------
    const altFt = t.alt / FT;
    const vsNow = t.vs;
    let vsCmd: number | null = null;
    let pitchCmd = this.pitchHold;
    const air = isa(t.alt);
    const spdTargetMs = this.targets.speedIsMach ? this.targets.mach * air.speedOfSound : casToTas(this.targets.speedKt * KT, air);
    const maxVs = def.perf.maxVsFpm * FPM;

    if (this.vertical === 'VS') {
      vsCmd = this.targets.vsFpm * FPM;
      // Capture the selected altitude (ALT*): switch when close enough given the climb rate.
      const errFt = this.targets.altitudeFt - altFt;
      if (Math.sign(errFt) !== Math.sign(this.targets.vsFpm) && this.targets.vsFpm !== 0) vsCmd = 0;
      if (Math.abs(errFt) < Math.max(100, Math.abs(vsNow / FPM) * 0.12)) this.vertical = 'ALT';
    }
    if (this.vertical === 'ALT') {
      const errM = (this.targets.altitudeFt - altFt) * FT;
      vsCmd = clamp(errM * 0.12, -maxVs * 0.5, maxVs * 0.5);
    }
    if (this.vertical === 'FLCH') {
      // Pitch controls speed: too slow → pitch down; thrust is fixed at climb/idle.
      const errFt = this.targets.altitudeFt - altFt;
      if (Math.abs(errFt) < Math.max(150, Math.abs(vsNow / FPM) * 0.12)) this.vertical = 'ALT';
      else {
        const spdErr = (t.tas - spdTargetMs) / KT; // + = too fast → pitch up
        const gammaDeg = Math.asin(clamp(vsNow / tas, -1, 1)) * RAD;
        const gammaCmd = clamp(gammaDeg + spdErr * 0.25, errFt > 0 ? 0 : -8, errFt > 0 ? 12 : 0);
        pitchCmd = gammaCmd + t.alpha;
      }
    }
    if (this.vertical === 'GS' && app) {
      const gsRate = -t.gs * Math.tan(3 * DEG);
      const devM = t.alt - app.glidepathAltM;
      vsCmd = gsRate - devM * 0.15;
    }
    if (this.vertical === 'FLARE') {
      // Exponential flare: sink rate proportional to wheel height (τ ≈ 2.5 s), then idle.
      // Sink rate commanded proportional to wheel height, continuous with the glideslope
      // sink at flare entry, down to ~100 fpm at touchdown.
      const hWheels = Math.max(0, t.agl - def.gear.heightM);
      vsCmd = -Math.max(0.5, this.flareVs0 * (hWheels / this.flareH0) * 0.9);
      if (hWheels < 25 * FT) c.throttle = Math.max(0, c.throttle - dt * 0.5);
    }
    if (vsCmd !== null) {
      // Envelope protection: never command a climb the aircraft can't sustain at this speed.
      const minSpd = def.perf.vrefKt * KT * (this.vertical === 'FLARE' ? 0.85 : 1.05);
      if (t.ias < minSpd && vsCmd > 0) vsCmd *= clamp((t.ias - minSpd * 0.9) / (minSpd * 0.1), 0, 1);
      vsCmd = clamp(vsCmd, -maxVs * 1.2, maxVs);
      // Flight-path feed-forward: pitch = α + γ, then correct remaining VS error.
      const gammaCmd = Math.asin(clamp(vsCmd / tas, -0.5, 0.5)) * RAD;
      pitchCmd = t.alpha + gammaCmd + clamp((vsCmd - vsNow) / tas * RAD * 0.5, -3, 3);
    }
    // Never touch down nose-wheel first.
    if (this.vertical === 'FLARE') pitchCmd = clamp(pitchCmd, def.cockpit === 'ga' ? 2 : 0, def.geometry.tailStrikeDeg - 2);
    pitchCmd = clamp(pitchCmd, -12, 20);
    this.fdPitch = pitchCmd;
    this.fdBank = bankCmd;

    // ---------------- autothrottle ----------------
    if (this.athr && !t.onGround) {
      if (this.vertical === 'FLCH') {
        const climbing = this.targets.altitudeFt > altFt;
        this.thrI += clamp((climbing ? 0.95 : 0.0) - this.thrI, -dt * 0.3, dt * 0.3);
        c.throttle = this.thrI;
      } else if (this.vertical !== 'FLARE') {
        const errKt = (spdTargetMs - t.tas) / KT;
        // Low-pass filtered acceleration gives damping without reacting to turbulence.
        const accelKt = ((t.ias - this.prevIas) / Math.max(dt, 1e-3)) / KT;
        this.accelF += (accelKt - this.accelF) * Math.min(1, dt * 1.5);
        this.thrI = clamp(this.thrI + errKt * 0.012 * dt, 0, 1);
        const cmd = clamp(this.thrI + errKt * 0.02 - this.accelF * 0.25, 0, 1);
        c.throttle += clamp(cmd - c.throttle, -dt * 0.25, dt * 0.25);
      }
    }
    this.prevIas = t.ias;
    if (this.vertical !== this.lastVertical) this.lastVertical = this.vertical;

    if (!this.engaged) return;

    // ---------------- inner loops ----------------
    // Roll: desired roll rate ∝ bank error; aileron normalised by steady-state roll authority.
    const a = def.aero;
    const rollAuth = (a.clDa * a.aileronMaxDeg * DEG / -a.clP) * (2 * tas / def.spec.wingspanM); // rad/s at full aileron
    const pDes = clamp((bankCmd - t.roll) * 0.35, -8, 8) * DEG; // ≤ 8°/s
    c.aileron = clamp((pDes + (pDes - fdm.omega[0]) * 1.5) / Math.max(rollAuth, 0.05), -1, 1);

    // Pitch: desired pitch rate ∝ attitude error, PI loop on pitch rate. The gains are
    // divided by the pitch acceleration full elevator produces right now (which scales
    // with dynamic pressure and aircraft size), so they work for every aircraft and speed.
    const qbar = 0.5 * air.density * tas * tas;
    const S = def.spec.wingAreaM2, cbar = S / def.spec.wingspanM;
    const iyyPerMass = (def.gyration[1] * def.spec.lengthM / 2) ** 2;
    const accFull = (qbar * S * cbar * Math.abs(a.cmDe) * a.elevatorMaxDeg * DEG) / (fdm.mass * iyyPerMass); // rad/s²
    const qDes = clamp((pitchCmd - t.pitch) * 0.6, -3, 3) * DEG;
    const qErr = qDes - fdm.omega[1];
    const k = 1 / Math.max(accFull, 0.2);
    this.elevI = clamp(this.elevI + qErr * dt * 10 * k * 3, -1, 1);
    c.elevator = clamp(this.elevI + qErr * 8 * k, -1, 1);
    // Coordinated turns
    c.rudder = clamp(-t.beta * DEG * 3, -0.5, 0.5);
    if (this.vertical !== 'PITCH') this.pitchHold = t.pitch;
    if (this.lateral !== 'ROLL') this.bankHold = t.roll;
  }
}
