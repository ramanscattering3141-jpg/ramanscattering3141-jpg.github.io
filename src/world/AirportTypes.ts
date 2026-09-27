// Airport/runway records decoded from public/data/airports (see tools/build-airports.mjs).

export interface Runway {
  leIdent: string;
  heIdent: string;
  lengthM: number;
  widthM: number;
  surface: 'P' | 'G' | 'V' | 'D' | 'W' | 'S' | 'U';
  lighted: boolean;
  leLat: number;
  leLon: number;
  leElevM: number | null;
  heLat: number;
  heLon: number;
  heElevM: number | null;
  leHeadingTrue: number;
  leDisplacedM: number;
  heDisplacedM: number;
  /** Threshold positions were estimated (not surveyed) */
  estimated: boolean;
}

export interface Airport {
  ident: string;
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  elevM: number | null;
  type: 0 | 1 | 2;
  longestRunwayM: number;
  paved: boolean;
  scheduled: boolean;
  runways?: Runway[];
}

export const SURFACE_NAMES: Record<Runway['surface'], string> = {
  P: 'Paved', G: 'Grass', V: 'Gravel', D: 'Dirt', W: 'Water', S: 'Snow/ice', U: 'Unknown',
};

export const TYPE_NAMES = ['Large airport', 'Medium airport', 'Small airport'];

/** "Name — ICAO/IATA" as shown throughout the UI */
export function airportLabel(a: Airport) {
  const codes = [a.icao || a.ident, a.iata].filter(Boolean).join('/');
  return `${a.name} — ${codes}`;
}
