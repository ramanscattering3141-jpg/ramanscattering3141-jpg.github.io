// Aircraft registry: every JSON file in data/aircraft is bundled at build time.
import type { AircraftDefinition } from './types';

const modules = import.meta.glob('../../data/aircraft/*.json', { eager: true, import: 'default' }) as Record<string, AircraftDefinition>;

const ORDER = ['c172', 'pc12', 'cj4', 'b738', 'a320', 'b789', 'b77w', 'a359', 'b744'];

export const AIRCRAFT: AircraftDefinition[] = Object.values(modules).sort((a, b) => {
  const ia = ORDER.indexOf(a.id), ib = ORDER.indexOf(b.id);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
});

export function getAircraft(id: string): AircraftDefinition {
  return AIRCRAFT.find(a => a.id === id) ?? AIRCRAFT[0];
}
