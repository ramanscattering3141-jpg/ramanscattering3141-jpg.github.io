import fs from 'node:fs';
import path from 'node:path';
import type { AircraftDefinition } from '../src/aircraft/types';
import { FlightDynamics, REALISM, type Environment } from '../src/aircraft/FlightDynamics';

export const loadDef = (id: string): AircraftDefinition =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../data/aircraft/${id}.json`), 'utf8'));
export const allIds = () => fs.readdirSync(path.resolve(__dirname, '../data/aircraft')).map(f => f.replace('.json', ''));

export const flatEnv = (elev = 0, wind: [number, number, number] = [0, 0, 0]): Environment => ({
  windEnu: () => wind,
  deltaT: () => 0,
  groundHeight: () => elev,
  isWater: () => false,
});

export function onRunway(id: string, realism = REALISM.realistic, elev = 0) {
  const fd = new FlightDynamics(loadDef(id), realism, { engineRunning: true });
  fd.place(10, 20, elev + fd.restingHeight(), 90, 0, 0);
  return fd;
}

export function run(fd: FlightDynamics, env: Environment, seconds: number, each?: (fd: FlightDynamics, t: number) => void | boolean) {
  const dt = 1 / 120;
  for (let t = 0; t < seconds; t += dt) {
    if (each && each(fd, t) === false) break;
    fd.step(dt, env);
    if (fd.crashed) break;
  }
}
