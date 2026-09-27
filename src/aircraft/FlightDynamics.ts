// Six-degree-of-freedom rigid-body flight model.
//
// State
//   pos   – ECEF position (m)            vel – ECEF velocity (m/s)
//   q     – body→ECEF attitude quaternion
//   omega – body angular rates p, q, r (rad/s)
// Body axes follow the aerospace convention: x forward, y right wing, z down.
//
// Each fixed step (default 1/120 s):
//   1. Build the local East-North-Up frame at the aircraft.
//   2. Air-relative velocity = ground velocity − wind (incl. turbulence), rotated
//      into body axes → airspeed V, angle of attack α, sideslip β, Mach.
//   3. Aerodynamic coefficients (lift with stall break, drag polar with ground
//      effect and compressibility rise, side force, roll/pitch/yaw moments with
//      stability & control derivatives) → forces and moments.
//   4. Engine thrust along body x at each engine's lateral station.
//   5. Landing-gear spring/damper + tyre friction at each wheel.
//   6. Gravity: normal gravity along the ellipsoid normal (see geodesy.ts).
//   7. Semi-implicit Euler integration of translation (ECEF) and rotation
//      (Euler's equations in body axes, quaternion kinematics).
//
// The aerodynamic model is a standard "stability derivative" build-up
// (see e.g. Roskam, "Airplane Flight Dynamics", or Stevens & Lewis). It is a
// simplified model for plausible behaviour, NOT certified simulator fidelity.

import type { AircraftDefinition } from './types';
import {
  type Vec3, type Quat, type Mat3, DEG, RAD, KT, add, sub, scale, dot, cross, norm, len, clamp,
  qMul, qNormalize, qToMat, mulMV, mulMtV, matCols, matToQ, smoothstep, wrap360, addScaled,
} from '../core/math';
import { ecefToGeodetic, enuBasis, geodeticToEcef, normalGravity, hprToBodyAxes, enuToEcefVec, type EnuBasis, type Geodetic } from '../core/geodesy';
import { isa, tasToCas, type AirData } from '../environment/Atmosphere';
import { Engines } from './Engines';

export interface ControlInputs {
  /** +1 = full nose-up (stick back) */
  elevator: number;
  /** +1 = full right roll */
  aileron: number;
  /** +1 = full right yaw */
  rudder: number;
  throttle: number;
  reverse: boolean;
  /** Elevator trim, +1 = full nose-up trim */
  trim: number;
  flapsIndex: number;
  gearDown: boolean;
  brakes: number;
  parkingBrake: boolean;
  spoilers: number;
}

export const defaultControls = (): ControlInputs => ({
  elevator: 0, aileron: 0, rudder: 0, throttle: 0, reverse: false, trim: 0,
  flapsIndex: 0, gearDown: true, brakes: 0, parkingBrake: false, spoilers: 0,
});

/** What the world provides to the flight model. */
export interface Environment {
  /** Wind + turbulence at a location, ENU m/s (the direction the air moves *towards*). */
  windEnu(lat: number, lon: number, alt: number): Vec3;
  /** ISA deviation (K) at a location */
  deltaT(lat: number, lon: number): number;
  /** Ground elevation (m) under a point, or null if unknown */
  groundHeight(lat: number, lon: number): number | null;
  isWater(lat: number, lon: number): boolean;
}

export interface RealismProfile {
  name: 'arcade' | 'realistic' | 'simulation';
  autoRudder: boolean;
  autoTrim: boolean;
  stallProtection: boolean;
  fuelBurn: boolean;
  instantEngineStart: boolean;
  turbulenceScale: number;
  gearLimitScale: number;
  overspeedDamage: boolean;
  controlSensitivity: number;
}

export const REALISM: Record<RealismProfile['name'], RealismProfile> = {
  arcade: { name: 'arcade', autoRudder: true, autoTrim: true, stallProtection: true, fuelBurn: false, instantEngineStart: true, turbulenceScale: 0.3, gearLimitScale: 2.0, overspeedDamage: false, controlSensitivity: 0.8 },
  realistic: { name: 'realistic', autoRudder: true, autoTrim: false, stallProtection: false, fuelBurn: true, instantEngineStart: false, turbulenceScale: 1, gearLimitScale: 1.3, overspeedDamage: false, controlSensitivity: 1 },
  simulation: { name: 'simulation', autoRudder: false, autoTrim: false, stallProtection: false, fuelBurn: true, instantEngineStart: false, turbulenceScale: 1.2, gearLimitScale: 1.0, overspeedDamage: true, controlSensitivity: 1 },
};

export type CrashReason = 'terrain' | 'water' | 'gear-collapse' | 'tail-strike' | 'overspeed' | 'belly-landing';

export interface TouchdownEvent {
  sinkRateMs: number;
  groundSpeedMs: number;
  pitchDeg: number;
  rollDeg: number;
  lat: number;
  lon: number;
  time: number;
}

export interface FlightTelemetry {
  lat: number; lon: number; alt: number; agl: number; groundElev: number;
  heading: number; pitch: number; roll: number; track: number;
  tas: number; ias: number; gs: number; mach: number; vs: number;
  alpha: number; beta: number; gLoad: number;
  onGround: boolean;
  stallWarning: boolean; stalled: boolean; overspeed: boolean;
  flapsFrac: number; flapLabel: string; gearPos: number; spoilers: number;
  fuelKg: number; fuelFlowKgH: number; massKg: number;
  throttle: number; reverse: boolean; parkingBrake: boolean; brakes: number;
  engines: { status: string; display: number; thrustN: number; fuelFlowKgH: number }[];
  windFromDeg: number; windKt: number; oat: number;
  flapOverspeed: boolean;
}

interface Contact { body: Vec3; kind: 'nose' | 'main' | 'structure'; name: string }

export class FlightDynamics {
  // --- state ---
  pos: Vec3 = [0, 0, 0];
  vel: Vec3 = [0, 0, 0];
  q: Quat = [1, 0, 0, 0];
  omega: Vec3 = [0, 0, 0];
  fuelKg: number;
  payloadKg: number;
  time = 0;

  // --- subsystems ---
  engines: Engines;
  flapsFrac = 0; // actual surface position (0..1 of full effect)
  gearPos = 1; // 0 = up, 1 = down
  spoilerPos = 0;
  trimPos = 0; // actual trim (-1..1), runs at a finite rate
  controls: ControlInputs = defaultControls();

  // --- outputs / events ---
  crashed: CrashReason | null = null;
  /** Which part of the airframe hit the ground (for the crash report) */
  crashPart = '';
  telemetry!: FlightTelemetry;
  onTouchdown: ((e: TouchdownEvent) => void) | null = null;

  private readonly S: number;
  private readonly b: number;
  private readonly cbar: number;
  private readonly AR: number;
  private inertia: Vec3 = [1, 1, 1];
  private gearPts: Contact[] = [];
  private structPts: Contact[] = [];
  private gearK: number[] = [];
  private gearC: number[] = [];
  private wasOnGround = true;
  private airborneTime = 0;
  private lastSinkRate = 0;
  private stallNoise = 0;
  private autoTrimIntegrator = 0;
  private lastGeo: Geodetic = { lat: 0, lon: 0, h: 0 };
  private lastGround = 0;

  constructor(readonly def: AircraftDefinition, public realism: RealismProfile, opts: { engineRunning: boolean; fuelKg?: number; payloadKg?: number }) {
    this.S = def.spec.wingAreaM2;
    this.b = def.spec.wingspanM;
    this.cbar = this.S / this.b;
    this.AR = (this.b * this.b) / this.S;
    const maxFuel = def.spec.fuelCapacityL * def.fuelDensity;
    this.payloadKg = opts.payloadKg ?? def.defaultPayloadKg;
    // Never exceed MTOW with the default fuel load.
    const room = def.spec.mtowKg - def.spec.emptyKg - this.payloadKg;
    this.fuelKg = clamp(opts.fuelKg ?? Math.min(maxFuel, room), 0, maxFuel);
    this.engines = new Engines(def, opts.engineRunning);
    this.gearPos = def.gear.retractable ? 1 : 1;
    this.buildContacts();
    this.updateInertia();
  }

  get mass() {
    return this.def.spec.emptyKg + this.payloadKg + this.fuelKg;
  }
  get maxFuelKg() {
    return this.def.spec.fuelCapacityL * this.def.fuelDensity;
  }

  /** Inertia from non-dimensional radii of gyration (Roskam): k = R̄ · (reference length)/2 */
  private updateInertia() {
    const m = this.mass, [rx, ry, rz] = this.def.gyration;
    const L = this.def.spec.lengthM, b = this.b, e = (b + L) / 2;
    this.inertia = [m * (rx * b / 2) ** 2, m * (ry * L / 2) ** 2, m * (rz * e / 2) ** 2];
  }

  private buildContacts() {
    const g = this.def.gear, geo = this.def.geometry, L = this.def.spec.lengthM, b = this.b;
    const H = g.heightM;
    this.gearPts = [
      { body: [g.noseX, 0, H], kind: 'nose', name: 'nose' },
      { body: [g.mainX, -g.mainHalfTrack, H], kind: 'main', name: 'left main' },
      { body: [g.mainX, g.mainHalfTrack, H], kind: 'main', name: 'right main' },
    ];
    // Spring rates: each strut compresses `compressionM` under its static share of MTOW.
    const W = this.def.spec.mtowKg * 9.81;
    const noseShare = -g.mainX / (g.noseX - g.mainX);
    const shares = [noseShare, (1 - noseShare) / 2, (1 - noseShare) / 2];
    this.gearK = shares.map(s => (s * W) / g.compressionM);
    this.gearC = shares.map((s, i) => 2 * 0.7 * Math.sqrt(this.gearK[i] * s * this.def.spec.mtowKg));

    // Structural points: touching the ground with any of these is a crash.
    const r = geo.fuselageDiameterM / 2;
    const tailX = -0.45 * L;
    // Published tail-strike angles are with the main gear on the ground (struts compressed).
    const tailZ = H - g.compressionM - (g.mainX - tailX) * Math.tan(geo.tailStrikeDeg * DEG);
    const wingZ = geo.wingPosition === 'high' ? -r : r * 0.6;
    const tipZ = wingZ - Math.tan(geo.dihedralDeg * DEG) * b / 2;
    this.structPts = [
      { body: [0.48 * L, 0, r * 0.8], kind: 'structure', name: 'nose' },
      { body: [tailX, 0, tailZ], kind: 'structure', name: 'tail' },
      { body: [-0.1 * L, -b / 2, tipZ], kind: 'structure', name: 'left wingtip' },
      { body: [-0.1 * L, b / 2, tipZ], kind: 'structure', name: 'right wingtip' },
      { body: [0.2 * L, 0, r], kind: 'structure', name: 'belly' },
      { body: [-0.1 * L, 0, r], kind: 'structure', name: 'belly' },
    ];
    if (geo.engineMount === 'wing') {
      const clearance = Math.max(0.45, 0.12 * H);
      for (const y of this.def.engine.positionsY) this.structPts.push({ body: [0.05 * L, y, H - clearance], kind: 'structure', name: 'engine nacelle' });
    }
  }

  get bodyToEcef(): Mat3 {
    return qToMat(this.q);
  }

  /** Places the aircraft at rest on the ground (or in the air) at a geodetic position. */
  place(lat: number, lon: number, alt: number, headingDeg: number, pitchDeg: number, speedMs: number) {
    const ax = hprToBodyAxes(lat, lon, headingDeg, pitchDeg, 0);
    this.q = matToQ(matCols(ax.fwd, ax.right, ax.down));
    this.pos = geodeticToEcef(lat, lon, alt);
    this.vel = scale(ax.fwd, speedMs);
    this.omega = [0, 0, 0];
    this.crashed = null;
    this.crashPart = '';
    this.wasOnGround = speedMs < 1;
    this.airborneTime = 0;
    this.time = 0;
    this.flapsFrac = this.def.flaps[this.controls.flapsIndex]?.frac ?? 0;
    this.gearPos = this.controls.gearDown || !this.def.gear.retractable ? 1 : 0;
    this.trimPos = this.controls.trim;
    this.lastGeo = { lat, lon, h: alt };
    this.computeTelemetry(isa(alt), [0, 0, 0], [0, 0, 0], 0, false, 0);
  }

  /** Height of the CG above ground when resting on the gear at static compression. */
  restingHeight() {
    return this.def.gear.heightM - this.def.gear.compressionM * (this.mass / this.def.spec.mtowKg);
  }

  /**
   * Trim for steady level flight at `tasMs`: returns the angle of attack and sets the
   * elevator trim and throttle so an airborne start does not immediately pitch away.
   */
  trimLevelFlight(tasMs: number, alt: number) {
    const a = this.def.aero;
    const air = isa(alt);
    const qbar = 0.5 * air.density * tasMs * tasMs;
    const f = this.flapsFrac;
    const clReq = (this.mass * 9.81) / (qbar * this.S);
    const alpha = (clReq - a.cl0 - a.dCl0Flaps * f) / a.clAlpha;
    const deReq = -(a.cm0 + a.cmAlpha * alpha + a.cmFlaps * f) / a.cmDe; // rad, TED positive
    const trim = clamp(-deReq / (a.elevatorMaxDeg * DEG * 0.5), -1, 1);
    this.controls.trim = trim;
    this.trimPos = trim;
    // Throttle for thrust = drag (iterate a few times over the engine model).
    const mach = tasMs / air.speedOfSound;
    const cd = this.dragCoefficient(clReq, mach, 1, f);
    const drag = qbar * this.S * cd;
    let thr = 0.5;
    for (let i = 0; i < 20; i++) {
      for (const s of this.engines.states) s.n = thr;
      this.engines.update(0, thr, false, air, tasMs, mach, true);
      const t = this.engines.states.reduce((acc, s) => acc + s.thrustN, 0);
      thr = clamp(thr + (drag - t) / Math.max(1, drag) * 0.5, 0, 1);
    }
    this.controls.throttle = thr;
    return alpha * RAD;
  }

  private dragCoefficient(cl: number, mach: number, groundFactor: number, flaps: number) {
    const a = this.def.aero;
    let cd = a.cd0 + a.dCd0Flaps * flaps + a.dCdGear * this.gearPos + a.dCdSpoilers * this.spoilerPos;
    cd += groundFactor * (cl * cl) / (Math.PI * a.oswald * this.AR);
    // Compressibility: Lock's approximation of wave drag above the critical Mach.
    if (a.mdd) {
      const mcr = a.mdd - 0.1;
      if (mach > mcr) cd += 20 * (mach - mcr) ** 4;
    }
    return cd;
  }

  /**
   * Reference landing speed (kt, calibrated) for the current weight and a flap detent:
   * Vref = 1.23 × 1-g stall speed, the standard margin used for transport aircraft.
   */
  vrefKt(flapFrac = 1) {
    const a = this.def.aero;
    const clMax = a.clMaxClean + a.dClMaxFlaps * flapFrac;
    const vs = Math.sqrt((2 * this.mass * 9.81) / (1.225 * this.S * clMax));
    return (1.23 * vs) / KT;
  }

  /** Current flap/stall limits used by warnings and the autopilot. */
  stallAlphaRad(flaps = this.flapsFrac) {
    const a = this.def.aero;
    const clMax = a.clMaxClean + a.dClMaxFlaps * flaps - 0.4 * this.spoilerPos;
    return (clMax - a.cl0 - a.dCl0Flaps * flaps) / a.clAlpha;
  }

  step(dt: number, env: Environment) {
    if (this.crashed) return;
    this.time += dt;
    const def = this.def, a = def.aero, c = this.controls, rp = this.realism;

    // --- 1. Local frame & atmosphere ------------------------------------------
    const geo = ecefToGeodetic(this.pos);
    this.lastGeo = geo;
    const enu = enuBasis(geo.lat, geo.lon);
    const air = isa(geo.h, env.deltaT(geo.lat, geo.lon));
    const R = this.bodyToEcef;

    // --- 2. Air data ------------------------------------------------------------
    const windE = env.windEnu(geo.lat, geo.lon, geo.h);
    const windEcef = enuToEcefVec(enu, windE[0], windE[1], windE[2]);
    const vAirBody = mulMtV(R, sub(this.vel, windEcef));
    const V = len(vAirBody);
    const alpha = V > 0.5 ? Math.atan2(vAirBody[2], vAirBody[0]) : 0;
    const beta = V > 0.5 ? Math.asin(clamp(vAirBody[1] / V, -1, 1)) : 0;
    const mach = V / air.speedOfSound;
    const qbar = 0.5 * air.density * V * V;

    // --- 3. Secondary systems (surfaces move at finite rates) ------------------
    const flapTarget = def.flaps[clamp(c.flapsIndex, 0, def.flaps.length - 1)].frac;
    this.flapsFrac += clamp(flapTarget - this.flapsFrac, -dt / 8, dt / 8);
    const gearTarget = c.gearDown || !def.gear.retractable ? 1 : 0;
    if (gearTarget === 0 && this.wasOnGround) {
      // Squat switch: the gear won't retract with weight on wheels.
    } else if (def.gear.transitTime > 0) {
      this.gearPos = clamp(this.gearPos + Math.sign(gearTarget - this.gearPos) * dt / def.gear.transitTime, 0, 1);
    } else this.gearPos = gearTarget;
    this.spoilerPos += clamp(c.spoilers - this.spoilerPos, -dt, dt);
    this.trimPos += clamp(c.trim - this.trimPos, -dt * 0.25, dt * 0.25);

    // --- 4. Ground proximity for ground effect -----------------------------------
    const ground = env.groundHeight(geo.lat, geo.lon);
    const gh = ground ?? this.lastGround;
    this.lastGround = gh;
    const hWing = Math.max(0.1, geo.h - gh - def.gear.heightM * 0.5);
    // McCormick's ground-effect factor on induced drag (1 = out of ground effect).
    const r16 = (16 * hWing / this.b) ** 2;
    const phiGE = r16 / (1 + r16);

    // --- 5. Aerodynamic coefficients --------------------------------------------
    const f = this.flapsFrac;
    const clMax = a.clMaxClean + a.dClMaxFlaps * f - 0.4 * this.spoilerPos;
    const cl0 = a.cl0 + a.dCl0Flaps * f;
    const aStall = (clMax - cl0) / a.clAlpha;
    const aStallNeg = -aStall * 0.8 - cl0 / a.clAlpha;

    // Control deflections (rad). Sign conventions documented in ControlInputs.
    let elevIn = c.elevator;
    if (rp.stallProtection && alpha > aStall - 2 * DEG && elevIn > 0) {
      elevIn *= clamp(1 - (alpha - (aStall - 2 * DEG)) / (2 * DEG), 0, 1);
    }
    const trimDefl = this.trimPos * a.elevatorMaxDeg * DEG * 0.5;
    const de = clamp(-elevIn * a.elevatorMaxDeg * DEG - trimDefl, -a.elevatorMaxDeg * DEG * 1.3, a.elevatorMaxDeg * DEG * 1.3);
    const da = c.aileron * a.aileronMaxDeg * DEG;
    let rudIn = c.rudder;
    if (rp.autoRudder && !this.wasOnGround) rudIn = clamp(rudIn + beta * 4 + this.omega[2] * 0.15 * (V > 1 ? 1 : 0), -1, 1);
    const dr = -rudIn * a.rudderMaxDeg * DEG;

    const clLin = cl0 + a.clAlpha * alpha;
    // Smooth stall break: blend from the linear lift curve to flat-plate lift past α_stall.
    const sPos = smoothstep(aStall - 1 * DEG, aStall + 3 * DEG, alpha);
    const sNeg = smoothstep(-aStallNeg - 1 * DEG, -aStallNeg + 3 * DEG, -alpha);
    const stall = Math.max(sPos, sNeg);
    const clFlat = 1.15 * Math.sin(2 * alpha);
    let CL = (1 - stall) * clLin + stall * clFlat;
    CL *= 1 + 0.08 * (1 - phiGE); // slight lift increase in ground effect
    CL -= 0.35 * this.spoilerPos * (1 - stall);
    const CD = this.dragCoefficient(CL, mach, phiGE, f) + stall * 1.2 * Math.sin(alpha) ** 2;
    const CY = a.cyBeta * beta + a.cyDr * dr;

    const Vn = Math.max(V, 5);
    const ph = (this.omega[0] * this.b) / (2 * Vn);
    const qh = (this.omega[1] * this.cbar) / (2 * Vn);
    const rh = (this.omega[2] * this.b) / (2 * Vn);
    // Stall: roll damping collapses and a wing may drop (random asymmetric moment).
    this.stallNoise += (Math.random() - 0.5) * dt * 4 - this.stallNoise * dt * 0.5;
    const Cl = a.clBeta * beta + a.clP * ph * (1 - 0.8 * stall) + a.clR * rh + a.clDa * da * (1 - 0.5 * stall) + a.clDr * dr + stall * 0.08 * this.stallNoise;
    const Cm = a.cm0 + a.cmAlpha * alpha + a.cmQ * qh + a.cmDe * de + a.cmFlaps * f - stall * 0.05;
    const Cn = a.cnBeta * beta + a.cnR * rh + a.cnP * ph + a.cnDa * da + a.cnDr * dr;

    // --- 6. Forces & moments in body axes ------------------------------------
    let F: Vec3 = [0, 0, 0];
    let M: Vec3 = [0, 0, 0];
    if (V > 0.5) {
      const vHat = scale(vAirBody, 1 / V);
      const liftDir = norm(cross([0, 1, 0], vHat));
      F = add(F, scale(vHat, -qbar * this.S * CD));
      F = add(F, scale(liftDir, qbar * this.S * CL));
      F = add(F, [0, qbar * this.S * CY, 0]);
      M = [qbar * this.S * this.b * Cl, qbar * this.S * this.cbar * Cm, qbar * this.S * this.b * Cn];
    }

    // Engines
    const fuelAvailable = this.fuelKg > 0.01;
    const fuelFlow = this.engines.update(dt, c.throttle, c.reverse && this.wasOnGround, air, V, mach, fuelAvailable);
    if (rp.fuelBurn) this.fuelKg = Math.max(0, this.fuelKg - fuelFlow * dt);
    def.engine.positionsY.forEach((y, i) => {
      const T = this.engines.states[i].thrustN;
      F = add(F, [T, 0, 0]);
      M = add(M, [0, 0, -y * T]);
    });
    // Propeller torque / P-factor: single-engine props yaw left at high power & low speed.
    if (def.engine.kind !== 'turbofan') {
      const T = this.engines.states[0].thrustN;
      M = add(M, [0, 0, -0.02 * T * this.b / 2 * clamp(1 - V / 60, 0, 1)]);
    }

    // --- 7. Gravity (ECEF) and ground ------------------------------------------
    const g = normalGravity(geo.lat, geo.h);
    const mass = this.mass;
    let Fecef = add(mulMV(R, F), scale(enu.up, -g * mass));
    const groundRes = this.groundForces(dt, R, enu, geo, env, mass);
    Fecef = add(Fecef, groundRes.force);
    M = add(M, groundRes.moment);

    // Auto-trim (arcade): slowly integrates the trim needed to hold the current pitch rate at zero.
    if (rp.autoTrim && !groundRes.onGround && Math.abs(c.elevator) < 0.05) {
      this.autoTrimIntegrator = clamp(this.autoTrimIntegrator + this.omega[1] * dt * 2.5, -1, 1);
      c.trim = clamp(c.trim + this.omega[1] * dt * 3, -1, 1);
    }

    // --- 8. Integrate ------------------------------------------------------------
    const acc = scale(Fecef, 1 / mass);
    this.vel = addScaled(this.vel, acc, dt);
    this.pos = addScaled(this.pos, this.vel, dt);

    const [Ix, Iy, Iz] = this.inertia;
    const w = this.omega;
    // Euler's rotation equations with a diagonal inertia tensor.
    const Iw: Vec3 = [Ix * w[0], Iy * w[1], Iz * w[2]];
    const gyro = cross(w, Iw);
    this.omega = [
      w[0] + ((M[0] - gyro[0]) / Ix) * dt,
      w[1] + ((M[1] - gyro[1]) / Iy) * dt,
      w[2] + ((M[2] - gyro[2]) / Iz) * dt,
    ];
    // Quaternion kinematics: q̇ = ½ q ⊗ (0, ω_body)
    const [p, qq, r] = this.omega;
    const dq = qMul(this.q, [0, p, qq, r]);
    this.q = qNormalize([this.q[0] + 0.5 * dq[0] * dt, this.q[1] + 0.5 * dq[1] * dt, this.q[2] + 0.5 * dq[2] * dt, this.q[3] + 0.5 * dq[3] * dt]);
    this.updateInertia();

    // --- 9. Overspeed damage (simulation realism) ---------------------------------
    const cas = tasToCas(V, air);
    if (rp.overspeedDamage && (cas > (def.spec.vmoKt * 1.25) * KT || (def.spec.mmo && mach > def.spec.mmo + 0.08))) this.crashed = 'overspeed';

    const nLoad = dot(mulMtV(R, sub(acc, scale(enu.up, -g))), [0, 0, -1]) / g;
    this.computeTelemetry(air, windE, acc, nLoad, groundRes.onGround, fuelFlow, { V, alpha, beta, mach, aStall, stall, cas, geo, enu, ground: gh });
  }

  /** Landing-gear and structure contact with the terrain. */
  private groundForces(dt: number, R: Mat3, enu: EnuBasis, geo: Geodetic, env: Environment, mass: number) {
    let force: Vec3 = [0, 0, 0];
    let moment: Vec3 = [0, 0, 0];
    let onGround = false;
    const h0 = env.groundHeight(geo.lat, geo.lon);
    if (h0 === null) return { force, moment, onGround };
    const agl = geo.h - h0;
    const reach = this.def.spec.lengthM + this.b;
    if (agl > reach) {
      if (this.wasOnGround) this.leaveGround();
      this.airborneTime += dt;
      return { force, moment, onGround };
    }

    // Local ground plane from terrain gradient (east/north finite differences).
    const dLat = 10 / 111320, dLon = 10 / (111320 * Math.max(0.05, Math.cos(geo.lat * DEG)));
    const he = env.groundHeight(geo.lat, geo.lon + dLon) ?? h0;
    const hn = env.groundHeight(geo.lat + dLat, geo.lon) ?? h0;
    const nEnu = norm([-(he - h0) / 10, -(hn - h0) / 10, 1]);
    const n = enuToEcefVec(enu, nEnu[0], nEnu[1], nEnu[2]);
    // Height of a world-space offset above the ground plane under the aircraft.
    const heightAbove = (off: Vec3) => agl * nEnu[2] + dot(off, n);

    const c = this.controls;
    const water = env.isWater(geo.lat, geo.lon);
    let touchdownSink = 0;

    // Structure: any contact is a crash.
    for (const pt of this.structPts) {
      const off = mulMV(R, pt.body);
      if (heightAbove(off) < 0) {
        const sink = -dot(this.vel, n);
        this.crashPart = pt.name;
        if (pt.name === 'belly' && this.gearPos < 0.5) this.crashed = 'belly-landing';
        else if (pt.name === 'tail' && sink < 2 && len(this.vel) < 120) this.crashed = 'tail-strike';
        else this.crashed = water ? 'water' : 'terrain';
        return { force, moment, onGround: true };
      }
    }

    if (this.gearPos < 0.95) {
      if (this.wasOnGround) this.leaveGround();
      return { force, moment, onGround };
    }

    const brake = Math.max(c.brakes, c.parkingBrake ? 1 : 0);
    const fwdEcef = mulMV(R, [1, 0, 0]);
    this.gearPts.forEach((pt, i) => {
      const off = mulMV(R, pt.body);
      const pen = -heightAbove(off);
      if (pen <= 0) return;
      if (water) { this.crashed = 'water'; return; }
      onGround = true;
      // Velocity of the wheel contact point: v + ω × r (ω rotated into ECEF).
      const wEcef = mulMV(R, this.omega);
      const vp = add(this.vel, cross(wEcef, off));
      const vn = dot(vp, n);
      if (!this.wasOnGround) touchdownSink = Math.max(touchdownSink, -vn);
      // Strut: spring + damper, can only push.
      const Fn = Math.max(0, this.gearK[i] * Math.min(pen, this.def.gear.compressionM * 3) - this.gearC[i] * vn);
      // Rolling direction; the nose wheel steers with the rudder at low speed.
      let roll = norm(sub(fwdEcef, scale(n, dot(fwdEcef, n))));
      if (pt.kind === 'nose') {
        const gs = len(this.vel);
        // Pedal steering is limited to a few degrees at speed; full tiller authority when taxiing slowly.
        const maxSteer = this.def.gear.maxSteerDeg;
        const limit = maxSteer + (Math.min(maxSteer, 8) - maxSteer) * clamp(gs / 10, 0, 1);
        const steer = c.rudder * limit * DEG * clamp(1 - gs / 80, 0.3, 1); // + = wheel turned right
        roll = norm(add(scale(roll, Math.cos(steer)), scale(cross(roll, n), Math.sin(steer))));
      }
      const side = cross(n, roll);
      const vt = sub(vp, scale(n, vn));
      const vRoll = dot(vt, roll), vSide = dot(vt, side);
      const share = mass / 3;
      // Tyre friction as a stiff viscous law clamped to μ·N (stable at a fixed timestep).
      const mu = pt.kind === 'main' ? 0.02 + 0.6 * brake : 0.02;
      const fRoll = clamp(-vRoll * share / dt * 0.3, -mu * Fn, mu * Fn);
      const fSide = clamp(-vSide * share / dt * 0.3, -0.8 * Fn, 0.8 * Fn);
      const Fw = add(add(scale(n, Fn), scale(roll, fRoll)), scale(side, fSide));
      force = add(force, Fw);
      moment = add(moment, cross(pt.body, mulMtV(R, Fw)));
    });

    if (onGround && !this.wasOnGround) {
      this.lastSinkRate = touchdownSink;
      if (this.airborneTime > 2) {
        const limit = this.def.gear.limitSinkMs * this.realism.gearLimitScale;
        if (touchdownSink > limit * 1.35) this.crashed = 'gear-collapse';
        const t = this.telemetry;
        this.onTouchdown?.({ sinkRateMs: touchdownSink, groundSpeedMs: len(this.vel), pitchDeg: t?.pitch ?? 0, rollDeg: t?.roll ?? 0, lat: geo.lat, lon: geo.lon, time: this.time });
      }
      this.airborneTime = 0;
    }
    if (!onGround) this.airborneTime += dt;
    this.wasOnGround = onGround;
    return { force, moment, onGround };
  }

  private leaveGround() {
    this.wasOnGround = false;
    this.airborneTime = 0;
  }

  get lastTouchdownSink() {
    return this.lastSinkRate;
  }

  private computeTelemetry(air: AirData, windE: Vec3, _acc: Vec3, nLoad: number, onGround: boolean, fuelFlow: number,
    x?: { V: number; alpha: number; beta: number; mach: number; aStall: number; stall: number; cas: number; geo: Geodetic; enu: EnuBasis; ground: number }) {
    const geo = x?.geo ?? this.lastGeo;
    const enu = x?.enu ?? enuBasis(geo.lat, geo.lon);
    const R = this.bodyToEcef;
    const fwd = mulMV(R, [1, 0, 0]);
    const right = mulMV(R, [0, 1, 0]);
    const fE = dot(fwd, enu.east), fN = dot(fwd, enu.north), fU = dot(fwd, enu.up);
    const heading = wrap360(Math.atan2(fE, fN) * RAD);
    const pitch = Math.asin(clamp(fU, -1, 1)) * RAD;
    const roll = Math.atan2(-dot(right, enu.up), dot(cross(fwd, right), enu.up) * -1) * RAD;
    const vE = dot(this.vel, enu.east), vN = dot(this.vel, enu.north), vU = dot(this.vel, enu.up);
    const gs = Math.hypot(vE, vN);
    const windSpd = Math.hypot(windE[0], windE[1]);
    const def = this.def;
    const V = x?.V ?? len(this.vel);
    const alpha = x?.alpha ?? 0;
    const aStall = x?.aStall ?? this.stallAlphaRad();
    const cas = x?.cas ?? tasToCas(V, air);
    const flapDetent = def.flaps[clamp(this.controls.flapsIndex, 0, def.flaps.length - 1)];
    const vfe = [...def.flaps].reverse().find(fl => fl.frac <= this.flapsFrac + 0.01 && fl.maxKt > 0)?.maxKt ?? 0;
    this.telemetry = {
      lat: geo.lat, lon: geo.lon, alt: geo.h, groundElev: x?.ground ?? this.lastGround, agl: geo.h - (x?.ground ?? this.lastGround),
      heading, pitch, roll, track: gs > 1 ? wrap360(Math.atan2(vE, vN) * RAD) : heading,
      tas: V, ias: cas, gs, mach: x?.mach ?? V / air.speedOfSound, vs: vU,
      alpha: alpha * RAD, beta: (x?.beta ?? 0) * RAD, gLoad: nLoad,
      onGround,
      stallWarning: !onGround && V > 10 && alpha > aStall - 3 * DEG,
      stalled: (x?.stall ?? 0) > 0.5 && !onGround,
      overspeed: cas > def.spec.vmoKt * KT * 1.005 || (!!def.spec.mmo && (x?.mach ?? 0) > def.spec.mmo + 0.005),
      flapsFrac: this.flapsFrac, flapLabel: flapDetent.label, gearPos: this.gearPos, spoilers: this.spoilerPos,
      fuelKg: this.fuelKg, fuelFlowKgH: fuelFlow * 3600, massKg: this.mass,
      throttle: this.controls.throttle, reverse: this.controls.reverse, parkingBrake: this.controls.parkingBrake, brakes: this.controls.brakes,
      engines: this.engines.states.map(s => ({ status: s.status, display: s.display, thrustN: s.thrustN, fuelFlowKgH: s.fuelFlowKgS * 3600 })),
      windFromDeg: wrap360(Math.atan2(-windE[0], -windE[1]) * RAD), windKt: windSpd / KT, oat: air.temperature - 273.15,
      flapOverspeed: vfe > 0 && cas > vfe * KT * 1.02,
    };
  }

  /** Snapshot for render interpolation. */
  snapshot() {
    return { pos: [...this.pos] as Vec3, q: [...this.q] as Quat };
  }
}
