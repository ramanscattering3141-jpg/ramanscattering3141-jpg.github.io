import { describe, it, expect } from 'vitest';
import { FlightDynamics, REALISM } from '../src/aircraft/FlightDynamics';
import { Autopilot } from '../src/aircraft/Autopilot';
import { approachGuidance, type RunwayEnd, type GpsState } from '../src/navigation/Navigation';
import { destination } from '../src/core/geodesy';
import { KT, FT, NM, DEG, wrap180 } from '../src/core/math';
import { loadDef, allIds, flatEnv, run } from './helpers';

const noGps: GpsState = { hasPlan: false, activeWaypoint: null, fromWaypoint: null, desiredTrack: 0, crossTrackM: 0, distToWptM: 0, bearingToWpt: 0, distToDestM: 0, eteDestS: 0, bearingToDest: 0, distToTodM: 0 };

function airborne(id: string, altFt: number, kt: number, hdg = 0) {
  const def = loadDef(id);
  const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true });
  fd.controls.gearDown = false;
  fd.place(45, 0, altFt * FT, hdg, 0, kt * KT);
  const aoa = fd.trimLevelFlight(kt * KT, altFt * FT);
  fd.place(45, 0, altFt * FT, hdg, aoa, kt * KT);
  return fd;
}

describe('autopilot', () => {
  for (const id of allIds()) {
    it(`${id}: HDG + VS/ALT capture + A/THR`, () => {
      const def = loadDef(id);
      const ga = def.cockpit === 'ga' || def.engine.kind !== 'turbofan';
      const kt = ga ? Math.min(def.spec.cruiseKtas * 0.7, 160) : 250;
      const fd = airborne(id, 8000, kt, 0);
      const ap = new Autopilot(fd);
      run(fd, flatEnv(-1000), 0.1);
      ap.engage(true);
      ap.setLateral('HDG');
      ap.setVertical('VS');
      ap.targets.heading = 90;
      ap.targets.altitudeFt = 10000;
      ap.targets.speedKt = Math.round(fd.telemetry.ias / KT);
      ap.targets.vsFpm = Math.min(def.perf.maxVsFpm, 1000);
      ap.setAthr(true);
      run(fd, flatEnv(-1000), 240, (f) => { ap.update(1 / 120, noGps, null); });
      const t = fd.telemetry;
      expect(fd.crashed).toBeNull();
      expect(Math.abs(wrap180(t.heading - 90)), `${id} hdg ${t.heading}`).toBeLessThan(4);
      expect(Math.abs(t.alt / FT - 10000), `${id} alt ${t.alt / FT}`).toBeLessThan(150);
      expect(Math.abs(t.ias / KT - ap.targets.speedKt), `${id} spd ${t.ias / KT} vs ${ap.targets.speedKt}`).toBeLessThan(12);
      expect(ap.vertical).toBe('ALT');
    });
  }

  for (const id of ['c172', 'b738', 'b744', 'a359']) {
    it(`${id}: coupled approach and autoland`, () => {
      const def = loadDef(id);
      const rw: RunwayEnd = { ident: '09', lat: 45, lon: 0, elev: 100, headingTrue: 90, lengthM: 3000, widthM: 45, endLat: 0, endLon: 0, displacedM: 0 };
      [rw.endLat, rw.endLon] = destination(45, 0, 90, 3000);
      const [lat, lon] = destination(45, 0, 270, 12 * NM);
      const alt = 100 + 12 * NM * Math.tan(3 * DEG) - 150;
      const kt = def.perf.approachKt;
      const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true });
      fd.controls.flapsIndex = def.flaps.length - 1;
      fd.controls.gearDown = true;
      // Start offset 1 km right of the centreline, heading to intercept.
      const [la2, lo2] = destination(lat, lon, 180, 1000);
      fd.place(la2, lo2, alt, 60, 0, kt * KT);
      const aoa = fd.trimLevelFlight(kt * KT, alt);
      fd.place(la2, lo2, alt, 60, aoa, kt * KT);
      const ap = new Autopilot(fd);
      run(fd, flatEnv(100), 0.1);
      ap.engage(true);
      ap.setLateral('HDG');
      ap.targets.heading = 60;
      ap.setVertical('ALT');
      ap.targets.altitudeFt = alt / FT;
      ap.targets.speedKt = def.perf.vrefKt + 5;
      ap.setAthr(true);
      ap.armApproach();
      let touchdown: { sink: number; xtk: number; dist: number } | null = null;
      fd.onTouchdown = (e) => {
        const g = approachGuidance(rw, e.lat, e.lon, 100);
        touchdown = { sink: e.sinkRateMs, xtk: g.crossTrackM, dist: -g.distThresholdM };
      };
      run(fd, flatEnv(100), 1000, () => {
        const t = fd.telemetry;
        ap.update(1 / 120, noGps, approachGuidance(rw, t.lat, t.lon, t.alt));
        if (touchdown && t.gs < 20) return false;
        if (t.onGround) { fd.controls.brakes = 1; fd.controls.throttle = 0; }
      });
      expect(fd.crashed, `${id} crashed ${fd.crashed}`).toBeNull();
      expect(touchdown, `${id} never touched down (mode ${ap.lateral}/${ap.vertical})`).not.toBeNull();
      const td = touchdown!;
      expect(Math.abs(td.xtk), `${id} centreline`).toBeLessThan(15);
      expect(td.sink, `${id} sink rate`).toBeLessThan(2.5);
      expect(td.dist, `${id} touchdown point`).toBeGreaterThan(-50);
      expect(td.dist, `${id} touchdown point`).toBeLessThan(1500);
    });
  }
});
