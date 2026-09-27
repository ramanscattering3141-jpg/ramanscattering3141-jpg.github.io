import { describe, it, expect } from 'vitest';
import { FlightDynamics, REALISM } from '../src/aircraft/FlightDynamics';
import { Autopilot } from '../src/aircraft/Autopilot';
import { FlightPlan, Gps, runwayEnds } from '../src/navigation/Navigation';
import type { Airport, Runway } from '../src/world/AirportTypes';
import { destination, distance } from '../src/core/geodesy';
import { KT, FT, NM, wrap180 } from '../src/core/math';
import { loadDef, flatEnv, run } from './helpers';

// Two synthetic airports ~140 NM apart on flat terrain at 100 m elevation.
function airport(ident: string, lat: number, lon: number, hdg: number): Airport {
  const [la2, lo2] = destination(lat, lon, hdg, 3000);
  const rw: Runway = { leIdent: '09', heIdent: '27', lengthM: 3000, widthM: 45, surface: 'P', lighted: true, leLat: lat, leLon: lon, leElevM: 100, heLat: la2, heLon: lo2, heElevM: 100, leHeadingTrue: hdg, leDisplacedM: 0, heDisplacedM: 0, estimated: false };
  return { ident, icao: ident, iata: '', name: ident, city: '', country: '', lat, lon, elevM: 100, type: 0, longestRunwayM: 3000, paved: true, scheduled: true, runways: [rw] };
}

describe('complete flight between two airports', () => {
  for (const id of ['a320', 'c172']) {
    it(`${id}: take-off, LNAV cruise, descent, coupled approach and landing`, () => {
      const def = loadDef(id);
      const dep = airport('DEPA', 45, 0, 90);
      const dst = airport('DSTB', 45.6, id === 'c172' ? 1.0 : 2.8, 60);
      const depRw = runwayEnds(dep.runways![0], 100)[0];
      const arrRw = runwayEnds(dst.runways![0], 100)[0];
      const cruiseFt = id === 'c172' ? 5500 : 16000; // sensible for a ~120 NM trip
      const plan = FlightPlan.generate(dep, dst, depRw, arrRw, cruiseFt * FT);
      const gps = new Gps();
      gps.setPlan(plan);
      const env = flatEnv(100);
      const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true, fuelKg: def.spec.fuelCapacityL * def.fuelDensity * 0.35 });
      fd.controls.flapsIndex = def.cockpit === 'ga' ? 0 : 2;
      const [sl, so] = destination(depRw.lat, depRw.lon, depRw.headingTrue, 60);
      fd.place(sl, so, 100 + fd.restingHeight(), depRw.headingTrue, 0, 0);
      const ap = new Autopilot(fd);
      let phase = 'takeoff', pitchCmd = 0, touchdown: { sink: number; lat: number; lon: number } | null = null;
      fd.onTouchdown = e => { if (phase === 'approach' || phase === 'final') touchdown = { sink: e.sinkRateMs, lat: e.lat, lon: e.lon }; };
      const dt = 1 / 120;
      const log: string[] = [];
      run(fd, env, 3 * 3600, (f) => {
        const t = f.telemetry, c = f.controls;
        const g = gps.update(t.lat, t.lon, t.gs, t.alt);
        const app = gps.approach(t.lat, t.lon, t.alt);
        if (phase === 'takeoff') {
          c.throttle = 1;
          c.rudder = Math.max(-1, Math.min(1, wrap180(depRw.headingTrue - t.heading) * 0.2 - f.omega[2] * 2));
          c.aileron = Math.max(-1, Math.min(1, -t.roll * 0.05 - f.omega[0] * 0.5));
          if (t.ias > def.perf.vrKt * KT) pitchCmd = Math.min(def.perf.rotatePitchDeg + 2, pitchCmd + 2.5 * dt);
          if (pitchCmd > 0) c.elevator = Math.max(-1, Math.min(1, (pitchCmd - t.pitch) * 0.2 - f.omega[1] * 3));
          if (t.agl > 400 * FT) {
            c.gearDown = false;
            ap.engage(true); ap.setLateral('NAV'); ap.targets.altitudeFt = cruiseFt; ap.targets.speedKt = def.perf.climbKt;
            ap.setVertical('FLCH'); ap.setAthr(true);
            phase = 'climb';
          }
        } else if (phase === 'climb') {
          if (t.agl > 1500 * FT) c.flapsIndex = 0;
          if (ap.vertical === 'ALT') { ap.targets.speedKt = def.cockpit === 'ga' ? 110 : 280; phase = 'cruise'; }
        } else if (phase === 'cruise') {
          if (g.distToTodM < 0) { ap.targets.altitudeFt = 3000 + 330; ap.setVertical('FLCH'); ap.targets.speedKt = def.cockpit === 'ga' ? 100 : 280; phase = 'descent'; }
        } else if (phase === 'descent') {
          if (g.distToDestM < 30 * NM && ap.vertical === 'FLCH') { ap.setVertical('VS'); ap.targets.vsFpm = def.cockpit === 'ga' ? -700 : -1800; ap.targets.speedKt = def.cockpit === 'ga' ? 90 : 220; }
          if (g.distToDestM < 20 * NM) { ap.armApproach(); ap.targets.speedKt = Math.round(f.vrefKt() + 30); c.flapsIndex = 1; phase = 'approach'; }
        } else if (phase === 'approach') {
          if (app && app.distThresholdM < 8 * NM) { c.flapsIndex = def.flaps.length - 1; c.gearDown = true; ap.targets.speedKt = Math.round(f.vrefKt() + 5); phase = 'final'; }
        }
        if (touchdown) { c.brakes = 1; c.throttle = 0; if (t.gs < 5) return false; }
        if (Math.round(f.time) % 300 === 0 && Math.abs(f.time - Math.round(f.time)) < dt / 2) log.push(`${phase} t=${f.time.toFixed(0)} alt=${(t.alt / FT).toFixed(0)} ias=${(t.ias / KT).toFixed(0)} ${ap.lateral}/${ap.vertical} xtk=${g.crossTrackM.toFixed(0)} dest=${(g.distToDestM / NM).toFixed(0)}`);
        ap.update(dt, g, app);
      });
      const t = fd.telemetry;
      expect(fd.crashed, `${id} crashed (${fd.crashed} ${fd.crashPart})\n${log.join('\n')}`).toBeNull();
      expect(touchdown, `${id} never landed; phase ${phase}\n${log.join('\n')}`).not.toBeNull();
      const td = touchdown!;
      expect(distance(td.lat, td.lon, arrRw.lat, arrRw.lon), 'touchdown on destination runway').toBeLessThan(2500);
      expect(td.sink, 'touchdown sink').toBeLessThan(3);
      expect(t.gs).toBeLessThan(10);
    });
  }
});
