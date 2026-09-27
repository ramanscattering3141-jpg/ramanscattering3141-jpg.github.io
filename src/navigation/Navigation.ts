// Flight plan, GPS guidance and runway approach guidance.
//
// Route generation: departure and destination are joined by a great circle (the
// shortest path on the globe). Intermediate "GC" waypoints are placed along it so
// the displayed legs follow the curve, then a final approach fix is added on the
// extended centreline of the landing runway.
//
// Approach guidance is SYNTHETIC: OurAirports has no ILS data, so every runway
// gets a computed localizer (runway centreline) and a 3° glideslope aimed ~300 m
// past the threshold. It behaves like an ILS for gameplay but is not real
// navigation data.

import { distance, bearing, intermediate, destination, crossTrack } from '../core/geodesy';
import { NM, FT, KT, clamp, wrap180, wrap360, DEG, RAD } from '../core/math';
import type { Airport, Runway } from '../world/AirportTypes';

export interface Waypoint {
  ident: string;
  lat: number;
  lon: number;
  /** Planned altitude (m), optional */
  alt?: number;
  kind: 'airport' | 'wpt' | 'faf' | 'runway';
}

export interface RunwayEnd {
  ident: string;
  lat: number; // threshold
  lon: number;
  elev: number;
  headingTrue: number;
  lengthM: number;
  widthM: number;
  /** Opposite threshold */
  endLat: number;
  endLon: number;
  displacedM: number;
}

export function runwayEnds(rw: Runway, airportElev: number): [RunwayEnd, RunwayEnd] {
  const len = rw.lengthM;
  const leElev = rw.leElevM ?? airportElev;
  const heElev = rw.heElevM ?? airportElev;
  const hdg = bearing(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
  return [
    { ident: rw.leIdent, lat: rw.leLat, lon: rw.leLon, elev: leElev, headingTrue: hdg, lengthM: len, widthM: rw.widthM, endLat: rw.heLat, endLon: rw.heLon, displacedM: rw.leDisplacedM },
    { ident: rw.heIdent, lat: rw.heLat, lon: rw.heLon, elev: heElev, headingTrue: wrap360(hdg + 180), lengthM: len, widthM: rw.widthM, endLat: rw.leLat, endLon: rw.leLon, displacedM: rw.heDisplacedM },
  ];
}

export interface FlightPlanSummary {
  distanceM: number;
  cruiseAltM: number;
  eteS: number;
}

export class FlightPlan {
  waypoints: Waypoint[] = [];
  activeLeg = 1; // index of the waypoint being flown TO
  cruiseAltM = 0;
  constructor(public departure: Airport, public destination: Airport, public depRunway: RunwayEnd | null, public arrRunway: RunwayEnd | null) {}

  /**
   * Builds a great-circle route. Waypoints roughly every 400 km (closer for
   * short hops) keep leg courses accurate on long-haul flights.
   */
  static generate(dep: Airport, arr: Airport, depRw: RunwayEnd | null, arrRw: RunwayEnd | null, cruiseAltM: number): FlightPlan {
    const fp = new FlightPlan(dep, arr, depRw, arrRw);
    fp.cruiseAltM = cruiseAltM;
    const start = depRw ? { lat: depRw.endLat, lon: depRw.endLon } : { lat: dep.lat, lon: dep.lon };
    const faf = arrRw ? destination(arrRw.lat, arrRw.lon, arrRw.headingTrue + 180, 10 * NM) : [arr.lat, arr.lon];
    const total = distance(start.lat, start.lon, faf[0], faf[1]);
    const n = Math.max(1, Math.round(total / 400_000));
    fp.waypoints.push({ ident: dep.ident, lat: start.lat, lon: start.lon, kind: 'airport', alt: dep.elevM ?? 0 });
    for (let i = 1; i < n; i++) {
      const [lat, lon] = intermediate(start.lat, start.lon, faf[0], faf[1], i / n);
      fp.waypoints.push({ ident: `GC${String(i).padStart(2, '0')}`, lat, lon, kind: 'wpt', alt: cruiseAltM });
    }
    if (arrRw) {
      const fafAlt = arrRw.elev + 10 * NM * Math.tan(3 * DEG);
      fp.waypoints.push({ ident: `FF${arrRw.ident}`, lat: faf[0], lon: faf[1], kind: 'faf', alt: fafAlt });
      fp.waypoints.push({ ident: `RW${arrRw.ident}`, lat: arrRw.lat, lon: arrRw.lon, kind: 'runway', alt: arrRw.elev });
    } else {
      fp.waypoints.push({ ident: arr.ident, lat: arr.lat, lon: arr.lon, kind: 'airport', alt: arr.elevM ?? 0 });
    }
    return fp;
  }

  get totalDistanceM() {
    let d = 0;
    for (let i = 1; i < this.waypoints.length; i++) {
      const a = this.waypoints[i - 1], b = this.waypoints[i];
      d += distance(a.lat, a.lon, b.lat, b.lon);
    }
    return d;
  }

  /** Estimated time en route assuming a simple climb/cruise/descent speed profile. */
  estimate(cruiseTasMs: number, climbTasMs: number, climbRateMs: number): FlightPlanSummary {
    const d = this.totalDistanceM;
    const climbDist = Math.min(d / 2, (this.cruiseAltM / Math.max(1, climbRateMs)) * climbTasMs);
    const descentDist = Math.min(d / 2, (this.cruiseAltM / 1000) * 3 * NM * 1.0);
    const cruiseDist = Math.max(0, d - climbDist - descentDist);
    const ete = climbDist / climbTasMs + cruiseDist / cruiseTasMs + descentDist / (climbTasMs * 1.05) + 300;
    return { distanceM: d, cruiseAltM: this.cruiseAltM, eteS: ete };
  }

  /** Direct-to: replaces the active leg with a leg from the present position. */
  directTo(index: number, lat: number, lon: number) {
    index = clamp(index, 1, this.waypoints.length - 1);
    this.waypoints.splice(index, 0, { ident: 'PPOS', lat, lon, kind: 'wpt' });
    this.waypoints.splice(0, index); // drop passed waypoints
    this.activeLeg = 1;
  }
}

/** Suggests a cruise altitude from flight distance and aircraft capability. */
export function suggestCruiseAltitudeFt(distanceM: number, maxCruiseFt: number) {
  const nm = distanceM / NM;
  // Roughly: 1,000 ft of cruise altitude per 10 NM for short trips, capped.
  const ft = Math.min(maxCruiseFt, Math.max(3000, Math.round((nm * 100) / 1000) * 1000));
  return ft;
}

export interface GpsState {
  hasPlan: boolean;
  activeWaypoint: Waypoint | null;
  fromWaypoint: Waypoint | null;
  desiredTrack: number;
  crossTrackM: number;
  distToWptM: number;
  bearingToWpt: number;
  distToDestM: number;
  eteDestS: number;
  bearingToDest: number;
  /** Top of descent distance remaining (m), negative once passed */
  distToTodM: number;
}

export interface ApproachState {
  runway: RunwayEnd;
  /** Localizer deviation in dots (±2.5 full scale), + = aircraft is right of centreline (fly left) */
  locDots: number;
  /** Glideslope deviation in dots, + = aircraft is above the glidepath (fly down) */
  gsDots: number;
  locDeviationDeg: number;
  gsDeviationDeg: number;
  distThresholdM: number;
  crossTrackM: number;
  glidepathAltM: number;
  inRange: boolean;
  course: number;
}

export class Gps {
  plan: FlightPlan | null = null;
  approachRunway: RunwayEnd | null = null;

  setPlan(plan: FlightPlan | null) {
    this.plan = plan;
    this.approachRunway = plan?.arrRunway ?? null;
  }

  update(lat: number, lon: number, gsMs: number, altM: number): GpsState {
    const p = this.plan;
    if (!p || p.waypoints.length < 2) {
      return { hasPlan: false, activeWaypoint: null, fromWaypoint: null, desiredTrack: 0, crossTrackM: 0, distToWptM: 0, bearingToWpt: 0, distToDestM: 0, eteDestS: 0, bearingToDest: 0, distToTodM: 0 };
    }
    let from = p.waypoints[p.activeLeg - 1];
    let to = p.waypoints[p.activeLeg];
    // Sequence: switch to the next leg when abeam the active waypoint or within turn anticipation.
    const turnRadius = Math.max(gsMs, 50) ** 2 / (9.81 * Math.tan(25 * DEG));
    for (let guard = 0; guard < 3 && p.activeLeg < p.waypoints.length - 1; guard++) {
      const legLen = distance(from.lat, from.lon, to.lat, to.lon);
      const { atk } = crossTrack(from.lat, from.lon, to.lat, to.lon, lat, lon);
      const next = p.waypoints[p.activeLeg + 1];
      const turn = Math.abs(wrap180(bearing(to.lat, to.lon, next.lat, next.lon) - bearing(from.lat, from.lon, to.lat, to.lon)));
      const anticipation = turnRadius * Math.tan(Math.min(turn, 120) * DEG / 2);
      if (atk >= legLen - anticipation) {
        p.activeLeg++;
        from = p.waypoints[p.activeLeg - 1];
        to = p.waypoints[p.activeLeg];
      } else break;
    }
    const { xtk, atk: along } = crossTrack(from.lat, from.lon, to.lat, to.lon, lat, lon);
    const distToWpt = distance(lat, lon, to.lat, to.lon);
    let remaining = distToWpt;
    for (let i = p.activeLeg + 1; i < p.waypoints.length; i++) {
      const a = p.waypoints[i - 1], b = p.waypoints[i];
      remaining += distance(a.lat, a.lon, b.lat, b.lon);
    }
    // Top of descent: the pilots' 3:1 rule (3 NM per 1,000 ft) assumes a ~3.2° idle
    // descent; our aircraft glide a little shallower at idle, so plan 3.5 NM per
    // 1,000 ft down to 1,500 ft above the field, plus 8 NM to slow down and configure.
    const destElev = p.arrRunway?.elev ?? p.destination.elevM ?? 0;
    const descentNeeded = Math.max(0, altM - destElev - 1500 * FT);
    const todDist = (descentNeeded / (1000 * FT)) * 3.5 * NM + (descentNeeded > 0 ? 8 * NM : 0);
    const dest = p.waypoints[p.waypoints.length - 1];
    // Desired track = the great-circle leg's course at the point abeam the aircraft
    // (a great circle's course changes along its length).
    const legLen = distance(from.lat, from.lon, to.lat, to.lon);
    const f = legLen > 1 ? clamp(along / legLen, 0, 1) : 0;
    const [pl, po] = intermediate(from.lat, from.lon, to.lat, to.lon, f);
    const courseHere = f < 0.999 ? bearing(pl, po, to.lat, to.lon) : bearing(from.lat, from.lon, to.lat, to.lon);
    return {
      hasPlan: true,
      activeWaypoint: to,
      fromWaypoint: from,
      desiredTrack: courseHere,
      crossTrackM: xtk,
      distToWptM: distToWpt,
      bearingToWpt: bearing(lat, lon, to.lat, to.lon),
      distToDestM: remaining,
      eteDestS: gsMs > 5 ? remaining / gsMs : 0,
      bearingToDest: bearing(lat, lon, dest.lat, dest.lon),
      distToTodM: remaining - todDist,
    };
  }

  approach(lat: number, lon: number, altM: number): ApproachState | null {
    const rw = this.approachRunway;
    if (!rw) return null;
    return approachGuidance(rw, lat, lon, altM);
  }
}

export function approachGuidance(rw: RunwayEnd, lat: number, lon: number, altM: number): ApproachState {
  // Localizer antenna sits ~300 m beyond the far end; course is the runway heading.
  const [antLat, antLon] = destination(rw.endLat, rw.endLon, rw.headingTrue, 300);
  const distAnt = distance(lat, lon, antLat, antLon);
  const brgFromAnt = bearing(antLat, antLon, lat, lon);
  // Angle between the back-course (heading+180) and the aircraft as seen from the antenna.
  const locDev = wrap180(brgFromAnt - wrap360(rw.headingTrue + 180));
  const { xtk, atk } = crossTrack(rw.lat, rw.lon, rw.endLat, rw.endLon, lat, lon);
  // Glideslope: 3° path through a point 50 ft above the aiming point ~300 m past the threshold.
  const aimDist = Math.max(150, Math.min(300, rw.lengthM * 0.15)) + rw.displacedM;
  const distAim = Math.max(1, aimDist - atk);
  const gpAlt = rw.elev + distAim * Math.tan(3 * DEG); // ≈50 ft over the threshold
  const gsAngle = Math.atan2(altM - rw.elev, distAim) * RAD;
  const gsDev = gsAngle - 3;
  const distThr = distance(lat, lon, rw.lat, rw.lon);
  return {
    runway: rw,
    // Seen from the antenna, an aircraft right of the centreline appears left of the
    // back-course (negative locDev). Full scale (2 dots) ≈ ±2.5°.
    locDots: clamp(-locDev / 1.25, -2.5, 2.5),
    gsDots: clamp(gsDev / 0.3, -2.5, 2.5),
    locDeviationDeg: locDev,
    gsDeviationDeg: gsDev,
    distThresholdM: atk < 0 ? distThr : -atk,
    crossTrackM: xtk,
    glidepathAltM: gpAlt,
    inRange: distAnt < 25 * NM && Math.abs(locDev) < 35,
    course: rw.headingTrue,
  };
}

/** Speed helpers for displays */
export const toKt = (ms: number) => ms / KT;
