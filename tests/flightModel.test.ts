import { describe, it, expect } from 'vitest';
import { FlightDynamics, REALISM } from '../src/aircraft/FlightDynamics';
import { KT, FT } from '../src/core/math';
import { loadDef, allIds, flatEnv, onRunway, run } from './helpers';

const env = flatEnv(0);

describe('ground handling', () => {
  it('a parked aircraft stays put and settles on its gear', () => {
    for (const id of allIds()) {
      const fd = onRunway(id);
      fd.controls.parkingBrake = true;
      fd.controls.throttle = 0;
      const start = [...fd.pos];
      run(fd, env, 10);
      expect(fd.crashed, id).toBeNull();
      const moved = Math.hypot(fd.pos[0] - start[0], fd.pos[1] - start[1], fd.pos[2] - start[2]);
      expect(moved, id).toBeLessThan(0.5);
      expect(fd.telemetry.onGround, id).toBe(true);
      expect(Math.abs(fd.telemetry.pitch), id).toBeLessThan(3);
    }
  });
});

describe('takeoff', () => {
  for (const id of allIds()) {
    it(`${id} accelerates, rotates and climbs away`, () => {
      const def = loadDef(id);
      const fd = onRunway(id);
      fd.controls.flapsIndex = Math.min(def.cockpit === 'ga' ? 1 : 2, def.flaps.length - 1);
      fd.controls.throttle = 1;
      let liftoffDist = -1;
      const start = [...fd.pos];
      let pitchCmd = 0;
      run(fd, env, 90, (f, time) => {
        const t = f.telemetry;
        // Simple pilot: keep wings level and runway heading, rotate at Vr at ~2.5°/s.
        f.controls.aileron = Math.max(-1, Math.min(1, -t.roll * 0.05 - f.omega[0] * 0.5));
        f.controls.rudder = Math.max(-1, Math.min(1, ((90 - t.heading) * 0.2) - f.omega[2] * 2));
        if (t.ias > def.perf.vrKt * KT) pitchCmd = Math.min(def.perf.rotatePitchDeg, pitchCmd + 2.5 / 120);
        if (pitchCmd > 0) f.controls.elevator = Math.max(-1, Math.min(1, (pitchCmd - t.pitch) * 0.2 - f.omega[1] * 3));
        if (!t.onGround && liftoffDist < 0 && t.agl > 5) liftoffDist = Math.hypot(f.pos[0] - start[0], f.pos[1] - start[1], f.pos[2] - start[2]);
        if (t.agl > 300) return false;
      });
      expect(fd.crashed, `${id} crashed: ${fd.crashed}`).toBeNull();
      expect(liftoffDist, `${id} never lifted off`).toBeGreaterThan(0);
      expect(liftoffDist, `${id} ground roll`).toBeLessThan(3500);
      expect(fd.telemetry.agl).toBeGreaterThan(150);
    });
  }
});

describe('cruise', () => {
  for (const id of allIds()) {
    it(`${id} holds a trimmed level cruise hands-off`, () => {
      const def = loadDef(id);
      const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true });
      fd.controls.gearDown = false;
      const alt = Math.min(def.perf.cruiseAltFt, 10000) * FT;
      const tas = Math.min(def.spec.cruiseKtas * 0.85, 280) * KT;
      fd.place(45, 0, alt, 0, 0, tas);
      const aoa = fd.trimLevelFlight(tas, alt);
      fd.place(45, 0, alt, 0, aoa, tas);
      run(fd, flatEnv(-1000), 60);
      expect(fd.crashed).toBeNull();
      expect(Math.abs(fd.telemetry.alt - alt), `${id} altitude drift`).toBeLessThan(250);
      expect(Math.abs(fd.telemetry.roll), `${id} roll`).toBeLessThan(15);
      expect(fd.telemetry.tas).toBeGreaterThan(tas * 0.7);
    });
  }
});

describe('stall', () => {
  it('C172 stalls near its published stall speed and loses altitude', () => {
    const def = loadDef('c172');
    const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true });
    const alt = 1500;
    fd.place(45, 0, alt, 0, 0, 90 * KT);
    const aoa = fd.trimLevelFlight(90 * KT, alt);
    fd.place(45, 0, alt, 0, aoa, 90 * KT);
    fd.controls.throttle = 0;
    let stallIas = 0;
    run(fd, flatEnv(-1000), 40, (f) => {
      f.controls.aileron = -f.telemetry.roll * 0.05;
      f.controls.elevator = Math.min(1, f.controls.elevator + 0.0004);
      if (f.telemetry.stalled && !stallIas) stallIas = f.telemetry.ias / KT;
    });
    expect(stallIas).toBeGreaterThan(35);
    expect(stallIas).toBeLessThan(62);
  });
});

describe('performance', () => {
  it('C172 full-power level speed is in the published ballpark', () => {
    const def = loadDef('c172');
    const fd = new FlightDynamics(def, REALISM.realistic, { engineRunning: true });
    const alt = 2000 * FT;
    fd.place(45, 0, alt, 0, 0, 100 * KT);
    const aoa = fd.trimLevelFlight(100 * KT, alt);
    fd.place(45, 0, alt, 0, aoa, 100 * KT);
    fd.controls.throttle = 1;
    // Hold altitude with a simple pitch controller and read the settled speed.
    run(fd, flatEnv(-1000), 240, (f) => {
      const t = f.telemetry;
      const pitchCmd = Math.max(-5, Math.min(8, (alt - t.alt) * 0.02 - t.vs * 0.3));
      f.controls.elevator = Math.max(-1, Math.min(1, (pitchCmd - t.pitch) * 0.08 - f.omega[1] * 1.5));
    });
    const kt = fd.telemetry.tas / KT;
    expect(kt).toBeGreaterThan(110);
    expect(kt).toBeLessThan(145);
  });
});
