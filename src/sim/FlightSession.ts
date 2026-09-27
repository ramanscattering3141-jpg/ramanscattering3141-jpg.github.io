// A single flight: builds the aircraft and its systems from a FlightConfig,
// spawns it, runs the fixed-timestep simulation with render interpolation,
// feeds navigation/autopilot, and detects crashes, landings and mission events.

import type { AircraftDefinition } from '../aircraft/types';
import { FlightDynamics, REALISM, type Environment, type RealismProfile } from '../aircraft/FlightDynamics';
import { Autopilot } from '../aircraft/Autopilot';
import { AircraftView } from '../aircraft/AircraftView';
import { FlightPlan, Gps, type RunwayEnd, type GpsState, type ApproachState } from '../navigation/Navigation';
import type { Airport } from '../world/AirportTypes';
import type { ElevationService } from '../world/ElevationService';
import type { Weather, WeatherSettings } from '../environment/Weather';
import { Scoring, type FlightReport } from './Scoring';
import { type Vec3, type Quat, KT, FT, NM, DEG, clamp, lerp, qSlerp, len } from '../core/math';
import { destination, distance, ecefToGeodetic } from '../core/geodesy';
import type { Scene } from 'cesium';

export type StartState = 'ready' | 'cold' | 'airborne' | 'final';

export interface MissionEvent { type: 'engineFailure'; engine: number; atSeconds: number }
export interface MissionObjective { type: 'land' | 'climb'; altitudeAglFt?: number }
export interface MissionDef {
  id: string; title: string; description: string; difficulty: string;
  aircraft: string; departure: string; depRunway?: string; destination: string; arrRunway?: string;
  start: StartState; airborneAltFt?: number; airborneDistNm?: number; headingDeg?: number;
  weatherPreset: string; weather?: Partial<WeatherSettings>; localTime: string; date?: string;
  objective: MissionObjective; events?: MissionEvent[];
}

export interface FlightConfig {
  aircraft: AircraftDefinition;
  departure: Airport;
  depRunway: RunwayEnd | null;
  destination: Airport;
  arrRunway: RunwayEnd | null;
  start: StartState;
  airborneAltFt: number;
  airborneDistNm: number;
  headingDeg: number | null;
  cruiseAltFt: number;
  fuelFraction: number;
  realism: RealismProfile['name'];
  mission: MissionDef | null;
}

export type SessionStatus = 'loading' | 'flying' | 'crashed' | 'complete';

export class FlightSession {
  readonly fdm: FlightDynamics;
  readonly ap: Autopilot;
  readonly gps = new Gps();
  readonly plan: FlightPlan;
  view: AircraftView;
  scoring: Scoring;
  status: SessionStatus = 'loading';
  paused = false;
  simRate = 1;
  gpsState!: GpsState;
  approach: ApproachState | null = null;
  message = '';
  report: FlightReport | null = null;
  missionResult: { passed: boolean; text: string } | null = null;
  readonly dt = 1 / 120;
  private acc = 0;
  private prev: { pos: Vec3; q: Quat } | null = null;
  renderPos: Vec3 = [0, 0, 0];
  renderQ: Quat = [1, 0, 0, 0];
  private sampleT = 0;
  private stoppedT = 0;
  private flightTime = 0;
  private firedEvents = new Set<number>();
  env: Environment;
  /** Correction (m) from the elevation model to the visible 3D scenery under the aircraft */
  groundOffset = 0;
  onStatus: ((s: SessionStatus) => void) | null = null;

  constructor(readonly config: FlightConfig, scene: Scene, private elevation: ElevationService, readonly weather: Weather) {
    const def = config.aircraft;
    const realism = REALISM[config.realism];
    const engineRunning = config.start !== 'cold';
    const maxFuel = def.spec.fuelCapacityL * def.fuelDensity;
    const payload = def.defaultPayloadKg;
    const room = def.spec.mtowKg - def.spec.emptyKg - payload;
    const fuel = clamp(maxFuel * config.fuelFraction, maxFuel * 0.05, Math.min(maxFuel, room));
    this.fdm = new FlightDynamics(def, realism, { engineRunning, fuelKg: fuel, payloadKg: payload });
    this.ap = new Autopilot(this.fdm);
    this.plan = FlightPlan.generate(config.departure, config.destination, config.depRunway, config.arrRunway, config.cruiseAltFt * FT);
    this.gps.setPlan(this.plan);
    this.view = new AircraftView(scene, def);
    const est = this.plan.estimate(def.spec.cruiseKtas * KT, def.perf.climbKt * KT * 1.2, def.perf.maxVsFpm * 0.5 * FT / 60);
    // Duration is only scored for real point-to-point flights.
    const timed = config.start !== 'final' && config.departure.ident !== config.destination.ident;
    this.scoring = new Scoring(timed ? config.cruiseAltFt * FT : 0, 0, timed ? est.eteS : 0, fuel);
    this.env = {
      windEnu: (lat, lon, alt) => {
        const g = this.elevation.height(lat, lon) ?? 0;
        return this.weather.wind(lat, lon, alt, alt - g, this.dt, this.fdm.telemetry?.tas ?? 0, realism.turbulenceScale);
      },
      deltaT: (lat, lon) => this.weather.deltaT(lat, lon),
      groundHeight: (lat, lon) => { const h = this.elevation.height(lat, lon); return h === null ? null : h + this.groundOffset; },
      isWater: (lat, lon) => this.elevation.isWater(lat, lon),
    };
    this.fdm.onTouchdown = e => {
      const nearDest = distance(e.lat, e.lon, config.destination.lat, config.destination.lon) < 8000;
      this.scoring.touchdown(e, nearDest ? config.arrRunway : distance(e.lat, e.lon, config.departure.lat, config.departure.lon) < 8000 ? config.depRunway : null);
      const fpm = e.sinkRateMs / FT * 60;
      this.message = `Touchdown ${fpm.toFixed(0)} fpm${fpm > 600 ? ' — hard landing!' : fpm < 250 ? ' — smooth!' : ''}`;
    };
  }

  /** Start position/altitude/heading from the configuration. */
  private spawnPoint() {
    const c = this.config, def = c.aircraft;
    if (c.start === 'final' && c.arrRunway) {
      const rw = c.arrRunway;
      const d = 10 * NM;
      const [lat, lon] = destination(rw.lat, rw.lon, rw.headingTrue + 180, d);
      return { lat, lon, alt: rw.elev + d * Math.tan(3 * DEG) + 60, hdg: rw.headingTrue, airborne: true, speed: (this.fdm.vrefKt() + 10) * KT };
    }
    if (c.start === 'airborne') {
      const base = c.depRunway ? { lat: c.depRunway.endLat, lon: c.depRunway.endLon, hdg: c.depRunway.headingTrue } : { lat: c.departure.lat, lon: c.departure.lon, hdg: 0 };
      const hdg = c.headingDeg ?? base.hdg;
      const [lat, lon] = destination(base.lat, base.lon, hdg, c.airborneDistNm * NM);
      const kt = def.cockpit === 'ga' ? def.perf.climbKt + 20 : Math.min(250, def.spec.vmoKt - 20);
      return { lat, lon, alt: c.airborneAltFt * FT, hdg, airborne: true, speed: kt * KT };
    }
    // On the runway, lined up just past the (displaced) threshold.
    const rw = c.depRunway;
    if (rw) {
      const along = rw.displacedM + Math.max(15, def.spec.lengthM * 0.6);
      const [lat, lon] = destination(rw.lat, rw.lon, rw.headingTrue, along);
      return { lat, lon, alt: rw.elev, hdg: c.headingDeg ?? rw.headingTrue, airborne: false, speed: 0 };
    }
    return { lat: c.departure.lat, lon: c.departure.lon, alt: c.departure.elevM ?? 0, hdg: c.headingDeg ?? 0, airborne: false, speed: 0 };
  }

  /** Loads terrain around the spawn point and places the aircraft. */
  async spawn() {
    this.status = 'loading';
    const sp = this.spawnPoint();
    const zoom = sp.airborne ? 12 : 15;
    await Promise.race([this.elevation.prefetch(sp.lat, sp.lon, zoom, 1), new Promise(r => setTimeout(r, 8000))]);
    await this.view.load().catch(e => console.error('model load failed', e));
    const def = this.config.aircraft, c = this.fdm.controls;
    c.flapsIndex = 0;
    c.gearDown = true;
    c.parkingBrake = false;
    c.throttle = 0;
    c.trim = 0;
    const ground = this.elevation.height(sp.lat, sp.lon) ?? sp.alt;
    if (sp.airborne) {
      if (this.config.start === 'final') { c.flapsIndex = def.flaps.length - 1; c.gearDown = true; }
      else c.gearDown = !def.gear.retractable;
      const alt = Math.max(sp.alt, ground + 150);
      this.fdm.place(sp.lat, sp.lon, alt, sp.hdg, 0, sp.speed);
      const aoa = this.fdm.trimLevelFlight(sp.speed, alt);
      this.fdm.place(sp.lat, sp.lon, alt, sp.hdg, aoa, sp.speed);
      for (const s of this.fdm.engines.states) s.n = c.throttle;
      if (this.config.start === 'final') {
        this.ap.targets.heading = Math.round(sp.hdg);
        this.ap.targets.altitudeFt = Math.round(alt / FT / 100) * 100;
      }
    } else {
      // Take-off flap setting for jets; GA starts clean.
      c.flapsIndex = this.config.start === 'cold' ? 0 : def.cockpit === 'ga' ? 0 : Math.min(2, def.flaps.length - 1);
      c.parkingBrake = this.config.start === 'cold';
      this.fdm.place(sp.lat, sp.lon, ground + this.fdm.restingHeight() + 0.05, sp.hdg, 0, 0);
    }
    this.ap.targets.altitudeFt = this.config.start === 'final' ? Math.round(this.fdm.telemetry.alt / FT / 100) * 100 : this.config.cruiseAltFt;
    this.ap.targets.speedKt = this.config.start === 'final' ? Math.round(this.fdm.vrefKt() + 5) : def.perf.climbKt;
    this.ap.targets.mach = def.perf.cruiseMach ?? 0.78;
    this.ap.targets.heading = Math.round(sp.hdg);
    this.ap.targets.vsFpm = Math.min(def.perf.maxVsFpm, 1800);
    this.prev = this.fdm.snapshot();
    this.renderPos = this.prev.pos;
    this.renderQ = this.prev.q;
    this.gpsState = this.gps.update(sp.lat, sp.lon, 0, sp.alt);
    this.status = 'flying';
    this.onStatus?.(this.status);
  }

  /** Advances the simulation by one rendered frame. */
  update(frameDt: number) {
    if (this.status !== 'flying' || this.paused) return;
    const fdm = this.fdm;
    this.acc += Math.min(frameDt, 0.1) * this.simRate;
    let steps = 0;
    const maxSteps = 120 * 0.1 * Math.max(1, this.simRate);
    while (this.acc >= this.dt && steps < maxSteps) {
      this.prev = fdm.snapshot();
      const t = fdm.telemetry;
      this.approach = this.gps.approach(t.lat, t.lon, t.alt);
      this.ap.update(this.dt, this.gpsState, this.approach);
      fdm.step(this.dt, this.env);
      this.weather.time += this.dt;
      this.flightTime += this.dt;
      this.acc -= this.dt;
      steps++;
      this.missionEvents();
      if (fdm.crashed) break;
    }
    if (steps >= maxSteps) this.acc = 0;
    // Render interpolation between the last two physics states.
    const a = clamp(this.acc / this.dt, 0, 1);
    const p = this.prev ?? fdm.snapshot();
    const cur = fdm.snapshot();
    this.renderPos = [lerp(p.pos[0], cur.pos[0], a), lerp(p.pos[1], cur.pos[1], a), lerp(p.pos[2], cur.pos[2], a)];
    this.renderQ = qSlerp(p.q, cur.q, a);

    const t = fdm.telemetry;
    this.gpsState = this.gps.update(t.lat, t.lon, t.gs, t.alt);
    this.sampleT += frameDt * this.simRate;
    if (this.sampleT >= 0.5) {
      const dep = distance(t.lat, t.lon, this.config.departure.lat, this.config.departure.lon);
      const dst = distance(t.lat, t.lon, this.config.destination.lat, this.config.destination.lon);
      this.scoring.sample(this.sampleT, t, this.gpsState, dep, dst);
      this.sampleT = 0;
    }
    if (fdm.crashed) {
      this.status = 'crashed';
      this.simRate = 1;
      this.onStatus?.(this.status);
      return;
    }
    this.checkComplete(frameDt);
    // Keep high-resolution elevation loaded near the aircraft for ground contact.
    if (Math.random() < 0.02) this.elevation.prefetch(t.lat, t.lon, t.agl < 2500 ? 15 : 12, 1);
    // Safety: limit time acceleration near the ground.
    if (this.simRate > 4 && t.agl < 1500 * FT) { this.simRate = 4; this.message = 'Sim rate limited to 4× below 1,500 ft AGL'; }
  }

  private missionEvents() {
    const m = this.config.mission;
    if (!m?.events) return;
    m.events.forEach((ev, i) => {
      if (this.firedEvents.has(i) || this.flightTime < ev.atSeconds) return;
      this.firedEvents.add(i);
      if (ev.type === 'engineFailure') { this.fdm.engines.fail(ev.engine); this.message = `ENGINE ${ev.engine + 1} FAILURE`; }
    });
    if (m.objective.type === 'climb' && !this.missionResult) {
      const t = this.fdm.telemetry;
      if (t.agl > (m.objective.altitudeAglFt ?? 1500) * FT && !t.onGround) this.finish(true, `Reached ${m.objective.altitudeAglFt} ft AGL — mission complete`);
    }
  }

  private checkComplete(dt: number) {
    const t = this.fdm.telemetry;
    if (t.onGround && t.gs < 3 && this.scoring.touchdowns.length > 0) {
      this.stoppedT += dt;
      if (this.stoppedT > 2 && this.status === 'flying') {
        const atDest = distance(t.lat, t.lon, this.config.destination.lat, this.config.destination.lon) < 8000;
        this.finish(atDest, atDest ? `Landed at ${this.config.destination.name}` : 'Landed away from the destination');
      }
    } else this.stoppedT = 0;
  }

  private finish(success: boolean, text: string) {
    const atDest = distance(this.fdm.telemetry.lat, this.fdm.telemetry.lon, this.config.destination.lat, this.config.destination.lon) < 8000;
    this.report = this.scoring.report(atDest);
    if (this.config.mission) this.missionResult = { passed: success && this.report.total >= 50, text };
    else this.missionResult = { passed: success, text };
    this.status = 'complete';
    this.simRate = 1;
    this.onStatus?.(this.status);
  }

  /** Continue flying after a landing report (e.g. taxi or take off again). */
  resume() {
    if (this.status === 'complete') { this.status = 'flying'; this.stoppedT = -1e9; }
  }

  get planeGeo() {
    return ecefToGeodetic(this.renderPos);
  }

  get speed() {
    return len(this.fdm.vel);
  }

  destroy() {
    this.view.destroy();
  }
}

export const altFt = (m: number) => m / FT;
