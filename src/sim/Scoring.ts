// Flight scoring: landing quality, route adherence, fuel efficiency, altitude and
// speed discipline, and duration. Used for the post-flight report and missions.

import type { FlightTelemetry, TouchdownEvent } from '../aircraft/FlightDynamics';
import type { GpsState, RunwayEnd } from '../navigation/Navigation';
import { approachGuidance } from '../navigation/Navigation';
import { FT, NM, KT, clamp } from '../core/math';

export interface ScoreItem { label: string; score: number; detail: string }
export interface FlightReport {
  items: ScoreItem[];
  total: number;
  landing?: { sinkFpm: number; centreM: number; fromThresholdM: number; runway: string };
}

export class Scoring {
  private xtkSq = 0; private xtkN = 0;
  private altDevSum = 0; private altDevN = 0;
  private overspeedS = 0; private flapOverS = 0; private stallS = 0;
  private reachedCruise = false;
  touchdowns: (TouchdownEvent & { centreM?: number; fromThrM?: number; runway?: string })[] = [];
  private fuelStart = 0;
  private fuelEnd = 0;
  time = 0;

  constructor(private cruiseAltM: number, private plannedFuelKg: number, private plannedTimeS: number, fuelStart: number) {
    this.fuelStart = fuelStart;
  }

  sample(dt: number, t: FlightTelemetry, gps: GpsState, depDistM: number, destDistM: number) {
    this.time += dt;
    this.fuelEnd = t.fuelKg;
    if (t.onGround) return;
    if (t.overspeed) this.overspeedS += dt;
    if (t.flapOverspeed) this.flapOverS += dt;
    if (t.stallWarning) this.stallS += dt;
    if (gps.hasPlan && depDistM > 8 * NM && destDistM > 12 * NM) {
      this.xtkSq += gps.crossTrackM ** 2 * dt; this.xtkN += dt;
    }
    if (this.cruiseAltM <= 0) return; // no cruise segment (approach-only flights)
    if (!this.reachedCruise && Math.abs(t.alt - this.cruiseAltM) < 300 * FT) this.reachedCruise = true;
    if (this.reachedCruise && gps.hasPlan && gps.distToTodM > 0) { this.altDevSum += Math.abs(t.alt - this.cruiseAltM) * dt; this.altDevN += dt; }
  }

  touchdown(e: TouchdownEvent, rw: RunwayEnd | null) {
    const rec: Scoring['touchdowns'][number] = { ...e };
    if (rw) {
      const g = approachGuidance(rw, e.lat, e.lon, rw.elev);
      rec.centreM = Math.abs(g.crossTrackM);
      // Measured from the landing threshold (runway end + any displaced threshold).
      rec.fromThrM = -g.distThresholdM - rw.displacedM;
      rec.runway = rw.ident;
    }
    this.touchdowns.push(rec);
  }

  report(landedAtDestination: boolean): FlightReport {
    const items: ScoreItem[] = [];
    const td = [...this.touchdowns].reverse().find(t => t.runway) ?? this.touchdowns[this.touchdowns.length - 1];
    let landing: FlightReport['landing'];
    if (td) {
      const fpm = td.sinkRateMs / FT * 60;
      // Ideal touchdown ≈ 100–250 fpm; above 600 fpm is a hard landing.
      const sinkScore = fpm < 60 ? 85 : fpm <= 250 ? 100 : clamp(100 - (fpm - 250) / 5, 0, 100);
      items.push({ label: 'Landing smoothness', score: sinkScore, detail: `${fpm.toFixed(0)} fpm at touchdown` });
      if (td.centreM !== undefined && td.fromThrM !== undefined) {
        const c = clamp(100 - td.centreM * 6, 0, 100);
        const zone = td.fromThrM < 0 ? 0 : td.fromThrM <= 900 ? 100 : clamp(100 - (td.fromThrM - 900) / 10, 0, 100);
        items.push({ label: 'Centreline', score: c, detail: `${td.centreM.toFixed(1)} m off centreline` });
        items.push({ label: 'Touchdown zone', score: zone, detail: td.fromThrM < 0 ? 'landed short of the runway' : `${td.fromThrM.toFixed(0)} m past threshold` });
        landing = { sinkFpm: fpm, centreM: td.centreM, fromThresholdM: td.fromThrM, runway: td.runway ?? '' };
      }
    }
    if (this.xtkN > 30) {
      const rms = Math.sqrt(this.xtkSq / this.xtkN) / NM;
      items.push({ label: 'Route adherence', score: clamp(100 - rms * 25, 0, 100), detail: `RMS cross-track ${rms.toFixed(2)} NM` });
    }
    if (this.altDevN > 30) {
      const ft = this.altDevSum / this.altDevN / FT;
      items.push({ label: 'Altitude discipline', score: clamp(100 - (ft - 50) / 4, 0, 100), detail: `average ${ft.toFixed(0)} ft from cruise altitude` });
    }
    const spdPenalty = this.overspeedS * 2 + this.flapOverS * 2 + this.stallS * 3;
    items.push({ label: 'Speed discipline', score: clamp(100 - spdPenalty, 0, 100), detail: `overspeed ${this.overspeedS.toFixed(0)} s · flap overspeed ${this.flapOverS.toFixed(0)} s · stall warning ${this.stallS.toFixed(0)} s` });
    const used = this.fuelStart - this.fuelEnd;
    if (this.plannedFuelKg > 0 && used > 0) {
      const ratio = used / this.plannedFuelKg;
      items.push({ label: 'Fuel efficiency', score: clamp(100 - Math.max(0, ratio - 1) * 150, 0, 100), detail: `${used.toFixed(0)} kg used (${(ratio * 100).toFixed(0)}% of estimate)` });
    }
    if (this.plannedTimeS > 0 && landedAtDestination) {
      const r = this.time / this.plannedTimeS;
      items.push({ label: 'Flight duration', score: clamp(100 - Math.abs(r - 1) * 120, 0, 100), detail: `${fmtDuration(this.time)} (plan ${fmtDuration(this.plannedTimeS)})` });
    }
    const total = items.length ? items.reduce((a, b) => a + b.score, 0) / items.length : 0;
    return { items, total, landing };
  }
}

export function fmtDuration(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
}

export const kt = (ms: number) => ms / KT;
