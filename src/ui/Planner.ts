// Pre-flight planner: aircraft, departure/destination airports & runways, start
// condition, weather, time of day, realism, fuel — plus optional missions.

import { h, clear } from './dom';
import { AIRCRAFT, getAircraft } from '../aircraft/registry';
import type { AircraftDefinition } from '../aircraft/types';
import type { AirportDatabase } from '../world/AirportDatabase';
import { airportLabel, SURFACE_NAMES, type Airport } from '../world/AirportTypes';
import { runwayEnds, suggestCruiseAltitudeFt, FlightPlan, type RunwayEnd } from '../navigation/Navigation';
import { WEATHER_PRESETS, applyPreset, defaultWeather, type WeatherSettings } from '../environment/Weather';
import { distance } from '../core/geodesy';
import { NM, KT, FT, clamp, wrap180 } from '../core/math';
import { fmtDuration } from '../sim/Scoring';
import type { FlightConfig, MissionDef, StartState } from '../sim/FlightSession';

const MISSIONS = Object.values(import.meta.glob('../../data/missions/*.json', { eager: true, import: 'default' }) as Record<string, MissionDef>)
  .sort((a, b) => a.id.localeCompare(b.id));

export interface PlannerResult {
  config: FlightConfig;
  weather: WeatherSettings;
  startTimeUtc: Date;
}

interface PlannerState {
  aircraftId: string;
  dep: Airport | null;
  depRunway: string;
  dest: Airport | null;
  arrRunway: string; // 'auto' or ident
  start: StartState;
  position: 'threshold' | 'intersection';
  airAltFt: number;
  airDistNm: number;
  headingDeg: number | null;
  cruiseAltFt: number | null;
  fuelPct: number | null; // null = auto
  weather: WeatherSettings;
  date: string;
  time: string;
  realism: FlightConfig['realism'];
  mission: MissionDef | null;
}

const START_LABELS: Record<StartState, string> = {
  ready: 'On the runway — ready for take-off',
  cold: 'On the runway — cold & dark (engines off)',
  airborne: 'Airborne near the departure airport',
  final: 'On final approach at the destination (10 NM)',
};

/** Rough trip fuel estimate (clearly an estimate): cruise fuel flow × time + 45 min reserve. */
export function estimateFuelKg(def: AircraftDefinition, eteS: number) {
  const W = def.spec.mtowKg * 0.85 * 9.81;
  let ffKgH: number;
  if (def.engine.kind === 'turbofan') ffKgH = (W / 17) * def.engine.sfc * 1.6;
  else ffKgH = (def.spec.powerKW ?? 100) * def.spec.engineCount * 0.65 * def.engine.sfc;
  return ffKgH * (eteS / 3600 + 0.75) * 1.05;
}

export class Planner {
  root: HTMLElement;
  private s: PlannerState;
  private body: HTMLElement;
  private depRunways: RunwayEnd[] = [];
  private arrRunways: RunwayEnd[] = [];
  private tab: 'plan' | 'missions' = 'plan';
  onPreview: ((dep: Airport | null, dest: Airport | null, plan: FlightPlan | null) => void) | null = null;

  constructor(parent: HTMLElement, private db: AirportDatabase, private handlers: { onStart(r: PlannerResult): void; onSettings(): void; onHelp(): void }, realism: FlightConfig['realism']) {
    const now = new Date();
    this.s = {
      aircraftId: 'c172', dep: null, depRunway: '', dest: null, arrRunway: 'auto', start: 'ready', position: 'threshold',
      airAltFt: 4000, airDistNm: 5, headingDeg: null, cruiseAltFt: null, fuelPct: null, weather: defaultWeather(),
      date: now.toISOString().slice(0, 10), time: '12:00', realism, mission: null,
    };
    this.body = h('div', { class: 'planner-body' });
    this.root = h('div', { class: 'planner' },
      h('div', { class: 'planner-head' },
        h('div', { class: 'brand' }, h('span', { class: 'logo' }, '✈'), h('div', {}, h('h1', {}, 'World Flight Simulator'), h('div', { class: 'muted small' }, 'Fly anywhere on Earth'))),
        h('div', { class: 'head-btns' },
          h('button', { class: 'chip', onclick: () => this.handlers.onHelp() }, 'Controls'),
          h('button', { class: 'chip', onclick: () => this.handlers.onSettings() }, 'Settings'),
        ),
      ),
      h('div', { class: 'tabs' },
        h('button', { class: 'tab on', 'data-tab': 'plan', onclick: e => this.setTab('plan', e) }, 'Free flight'),
        h('button', { class: 'tab', 'data-tab': 'missions', onclick: e => this.setTab('missions', e) }, 'Missions'),
      ),
      this.body,
    );
    parent.append(this.root);
  }

  async init() {
    clear(this.body);
    this.body.append(h('p', { class: 'muted' }, 'Loading the airport database…'));
    try {
      await this.db.load();
    } catch (e) {
      clear(this.body);
      this.body.append(h('p', { class: 'bad' }, `Could not load the airport database: ${(e as Error).message}. Check your connection and reload.`));
      return;
    }
    await this.selectDeparture(this.db.get('KSFO') ?? this.db.airports[0]);
    await this.selectDestination(this.db.get('KLAX') ?? this.db.airports[1]);
    this.render();
  }

  show(on: boolean) {
    this.root.classList.toggle('hidden', !on);
    if (on) this.preview();
  }

  private setTab(t: 'plan' | 'missions', e: Event) {
    this.tab = t;
    this.root.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', b === e.currentTarget));
    this.render();
  }

  private async selectDeparture(a: Airport) {
    this.s.dep = a;
    const rws = await this.db.runways(a);
    this.depRunways = rws.flatMap(r => runwayEnds(r, a.elevM ?? 0)).filter(r => r.lengthM > 0);
    const w = this.s.weather;
    this.s.depRunway = this.bestRunway(this.depRunways, w)?.ident ?? '';
  }

  private async selectDestination(a: Airport) {
    this.s.dest = a;
    const rws = await this.db.runways(a);
    this.arrRunways = rws.flatMap(r => runwayEnds(r, a.elevM ?? 0)).filter(r => r.lengthM > 0);
    this.s.arrRunway = 'auto';
  }

  /** Prefers paved, long runways most aligned into the wind. */
  private bestRunway(list: RunwayEnd[], w: WeatherSettings): RunwayEnd | undefined {
    const score = (r: RunwayEnd) => {
      const head = Math.cos(wrap180(w.windFromDeg - r.headingTrue) * Math.PI / 180) * (w.dynamic ? 0 : w.windKt);
      return r.lengthM / 100 + head * 3 + (r.widthM > 25 ? 5 : 0);
    };
    return [...list].sort((a, b) => score(b) - score(a))[0];
  }

  private depRw() { return this.depRunways.find(r => r.ident === this.s.depRunway) ?? this.depRunways[0] ?? null; }
  private arrRw() {
    if (this.s.arrRunway === 'auto') return this.bestRunway(this.arrRunways, this.s.weather) ?? null;
    return this.arrRunways.find(r => r.ident === this.s.arrRunway) ?? null;
  }

  private get def() { return getAircraft(this.s.aircraftId); }

  private planNow(): FlightPlan | null {
    const s = this.s;
    if (!s.dep || !s.dest) return null;
    const d = distance(s.dep.lat, s.dep.lon, s.dest.lat, s.dest.lon);
    const cruise = s.cruiseAltFt ?? suggestCruiseAltitudeFt(d, this.def.perf.cruiseAltFt);
    return FlightPlan.generate(s.dep, s.dest, this.depRw(), this.arrRw(), cruise * FT);
  }

  private preview() {
    this.onPreview?.(this.s.dep, this.s.dest, this.planNow());
  }

  private render() {
    clear(this.body);
    if (this.tab === 'missions') { this.renderMissions(); return; }
    const s = this.s, def = this.def;

    // --- aircraft ---
    const acGrid = h('div', { class: 'ac-grid' }, ...AIRCRAFT.map(a => h('button', {
      class: `ac-card ${a.id === s.aircraftId ? 'on' : ''}`,
      onclick: () => { s.aircraftId = a.id; s.cruiseAltFt = null; s.fuelPct = null; this.render(); this.preview(); },
      title: a.name,
    }, h('div', { class: 'ac-name' }, a.name), h('div', { class: 'muted small' }, `${a.category} · ${a.spec.engineCount}× ${a.engine.kind}`))));
    const specRows: [string, string][] = [
      ['Max take-off weight', `${a0(def.spec.mtowKg)} kg`], ['Empty weight', `${a0(def.spec.emptyKg)} kg`], ['Wingspan', `${def.spec.wingspanM} m`],
      ['Length', `${def.spec.lengthM} m`], ['Wing area', `${def.spec.wingAreaM2} m²`], ['Fuel capacity', `${a0(def.spec.fuelCapacityL)} L`],
      ['Engines', `${def.spec.engineCount} × ${def.spec.engineModel}`], ['Max speed', `${def.spec.vmoKt} kt${def.spec.mmo ? ` / M${def.spec.mmo}` : ''}`],
      ['Cruise', `${def.spec.cruiseKtas} KTAS`], ['Ceiling', `${a0(def.spec.ceilingFt)} ft`], ['Range', def.spec.rangeNm ? `${a0(def.spec.rangeNm)} NM` : '—'],
      ...(def.spec.stallKt ? [['Stall (landing config)', `${def.spec.stallKt} kt`] as [string, string]] : []),
    ];
    const specs = h('details', { class: 'specs' },
      h('summary', {}, 'Published specifications'),
      h('table', {}, ...specRows.map(([k, v]) => h('tr', {}, h('td', { class: 'muted' }, k), h('td', {}, v)))),
      h('p', { class: 'muted small' }, `Source: ${def.spec.source}.${def.spec.approximate?.length ? ` Approximate: ${def.spec.approximate.join(', ')}.` : ''} Aerodynamic and handling parameters are simulation estimates, not manufacturer data.`),
      h('p', { class: 'muted small' }, `V-speeds used by the sim (estimates): Vr ${def.perf.vrKt} kt · V2 ${def.perf.v2Kt} kt · Vref ${def.perf.vrefKt} kt · climb ${def.perf.climbKt} kt.`),
    );

    // --- airports ---
    const depSearch = this.airportSearch('Departure airport', s.dep, async a => { await this.selectDeparture(a); s.cruiseAltFt = null; this.render(); this.preview(); });
    const destSearch = this.airportSearch('Destination airport', s.dest, async a => { await this.selectDestination(a); s.cruiseAltFt = null; this.render(); this.preview(); });
    const rwOpt = (r: RunwayEnd, est: boolean) => h('option', { value: r.ident, selected: r.ident === s.depRunway }, `${r.ident} — ${a0(r.lengthM)} m × ${Math.round(r.widthM)} m${est ? ' (estimated position)' : ''}`);
    const depRwData = s.dep?.runways ?? [];
    const isEst = (ident: string, list = depRwData) => list.some(r => (r.leIdent === ident || r.heIdent === ident) && r.estimated);
    const surf = (ident: string, list = depRwData) => SURFACE_NAMES[list.find(r => r.leIdent === ident || r.heIdent === ident)?.surface ?? 'U'];
    const depRwSel = h('select', { onchange: e => { s.depRunway = (e.target as HTMLSelectElement).value; this.render(); this.preview(); } },
      ...this.depRunways.map(r => rwOpt(r, isEst(r.ident))));
    const arrRwSel = h('select', { onchange: e => { s.arrRunway = (e.target as HTMLSelectElement).value; this.render(); this.preview(); } },
      h('option', { value: 'auto', selected: s.arrRunway === 'auto' }, `Auto (into wind: ${this.arrRw()?.ident ?? '—'})`),
      ...this.arrRunways.map(r => h('option', { value: r.ident, selected: r.ident === s.arrRunway }, `${r.ident} — ${a0(r.lengthM)} m`)));

    const startSel = h('select', { onchange: e => { s.start = (e.target as HTMLSelectElement).value as StartState; this.render(); } },
      ...(Object.keys(START_LABELS) as StartState[]).map(k => h('option', { value: k, selected: k === s.start }, START_LABELS[k])));
    const airborneFields = s.start === 'airborne' ? h('div', { class: 'row3' },
      field('Altitude (ft MSL)', numInput(s.airAltFt, 500, 45000, v => { s.airAltFt = v; })),
      field('Distance from runway (NM)', numInput(s.airDistNm, 0, 200, v => { s.airDistNm = v; })),
      field('Heading (° true)', numInput(s.headingDeg ?? Math.round(this.depRw()?.headingTrue ?? 0), 0, 359, v => { s.headingDeg = v; })),
    ) : s.start === 'ready' || s.start === 'cold' ? h('div', { class: 'row2' },
      field('Starting position', h('select', { onchange: e => { s.position = (e.target as HTMLSelectElement).value as PlannerState['position']; } },
        h('option', { value: 'threshold', selected: s.position === 'threshold' }, 'Runway threshold'),
        h('option', { value: 'intersection', selected: s.position === 'intersection' }, 'Intersection (⅓ down the runway)'))),
      field('Heading', h('div', { class: 'static' }, `${Math.round(this.depRw()?.headingTrue ?? 0)}° true (runway)`)),
    ) : null;

    // --- weather ---
    const w = s.weather;
    const presetSel = h('select', { onchange: e => { s.weather = applyPreset(w, (e.target as HTMLSelectElement).value); this.render(); } },
      ...[...Object.keys(WEATHER_PRESETS), 'Dynamic worldwide'].map(p => h('option', { value: p, selected: p === w.preset }, p)),
      h('option', { value: 'Custom', selected: w.preset === 'Custom' }, 'Custom'));
    const custom = () => { w.preset = 'Custom'; w.dynamic = false; presetSel.value = 'Custom'; };
    const wx = h('details', { class: 'wx-editor', open: w.preset === 'Custom' },
      h('summary', {}, 'Weather editor'),
      w.dynamic ? h('p', { class: 'muted small' }, 'Dynamic worldwide weather is generated procedurally for every location (not real observed weather). Choose Custom to edit values.') : '',
      h('div', { class: 'row3' },
        field('Wind from (°)', numInput(w.windFromDeg, 0, 359, v => { w.windFromDeg = v; custom(); })),
        field('Wind (kt)', numInput(w.windKt, 0, 80, v => { w.windKt = v; custom(); })),
        field('Gusts (+kt)', numInput(w.gustKt, 0, 40, v => { w.gustKt = v; custom(); })),
        field('Visibility (km)', numInput(w.visibilityKm, 0.1, 100, v => { w.visibilityKm = v; custom(); }, 0.1)),
        field('Clouds', h('select', { onchange: e => { w.cloudCover = +(e.target as HTMLSelectElement).value; custom(); } },
          ...['Clear', 'Few', 'Scattered', 'Broken', 'Overcast'].map((n, i) => h('option', { value: i, selected: i === w.cloudCover }, n)))),
        field('Cloud base (ft AGL/MSL)', numInput(w.cloudBaseFt, 100, 30000, v => { w.cloudBaseFt = v; w.cloudTopsFt = Math.max(w.cloudTopsFt, v + 1000); custom(); })),
        field('Precipitation', h('select', { onchange: e => { w.precipitation = (e.target as HTMLSelectElement).value as WeatherSettings['precipitation']; w.precipIntensity = w.precipitation === 'none' ? 0 : Math.max(0.5, w.precipIntensity); custom(); } },
          ...(['none', 'rain', 'snow'] as const).map(p => h('option', { value: p, selected: p === w.precipitation }, p)))),
        field('Temperature (°C at sea level)', numInput(w.temperatureC, -50, 50, v => { w.temperatureC = v; custom(); })),
        field('Turbulence (0–1)', numInput(w.turbulence, 0, 1, v => { w.turbulence = v; custom(); }, 0.05)),
      ),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: w.thunderstorms, onchange: e => { w.thunderstorms = (e.target as HTMLInputElement).checked; custom(); } }), ' Thunderstorms'),
    );

    // --- time ---
    const timeRow = h('div', { class: 'row3' },
      field('Date', h('input', { type: 'date', value: s.date, onchange: e => { s.date = (e.target as HTMLInputElement).value; } })),
      field('Local time at departure', h('input', { type: 'time', value: s.time, onchange: e => { s.time = (e.target as HTMLInputElement).value; } })),
      field('Quick', h('div', { class: 'quick' }, ...[['Dawn', '06:15'], ['Noon', '12:00'], ['Dusk', '19:15'], ['Night', '23:00']].map(([n, t]) => h('button', { class: 'chip small', onclick: () => { s.time = t; this.render(); } }, n)))),
    );

    // --- summary ---
    const plan = this.planNow();
    const distNm = plan ? plan.totalDistanceM / NM : 0;
    const cruise = plan ? Math.round(plan.cruiseAltM / FT) : 0;
    const est = plan?.estimate(def.spec.cruiseKtas * KT, def.perf.climbKt * KT * 1.2, def.perf.maxVsFpm * 0.5 * FT / 60);
    const maxFuel = def.spec.fuelCapacityL * def.fuelDensity;
    const needKg = est ? estimateFuelKg(def, est.eteS) : maxFuel;
    const room = def.spec.mtowKg - def.spec.emptyKg - def.defaultPayloadKg;
    const autoPct = clamp(needKg / maxFuel, 0.1, Math.min(1, room / maxFuel));
    const pct = s.fuelPct ?? autoPct;
    const warnings: string[] = [];
    if (def.spec.rangeNm && distNm > def.spec.rangeNm) warnings.push(`Distance exceeds the ${def.name}'s published range (${a0(def.spec.rangeNm)} NM).`);
    if (needKg > maxFuel * pct * 1.02) warnings.push('Fuel load may be insufficient for this trip (estimate).');
    const minRw = { 'general aviation': 450, turboprop: 800, 'business jet': 1300, narrowbody: 1900, widebody: 2600 }[def.category];
    const drw = this.depRw(), arw = this.arrRw();
    if (drw && drw.lengthM < minRw && s.start !== 'final' && s.start !== 'airborne') warnings.push(`Departure runway ${drw.ident} (${a0(drw.lengthM)} m) is short for this aircraft.`);
    if (arw && arw.lengthM < minRw) warnings.push(`Arrival runway ${arw.ident} (${a0(arw.lengthM)} m) is short for this aircraft.`);
    if (drw && isEst(drw.ident)) warnings.push('Departure runway position is estimated (not surveyed) — it may not line up with the imagery.');
    if (!drw) warnings.push('No runway data for the departure airport.');

    const summary = h('div', { class: 'summary' },
      h('div', { class: 'route' }, `${s.dep ? s.dep.icao || s.dep.ident : '—'} ${drw ? `(${drw.ident})` : ''} → ${s.dest ? s.dest.icao || s.dest.ident : '—'} ${arw ? `(${arw.ident})` : ''}`),
      h('div', { class: 'kv' },
        kv('Distance', `${a0(distNm)} NM`), kv('Est. time', est ? fmtDuration(est.eteS) : '—'),
        kv('Aircraft', def.name), kv('Weather', w.dynamic ? 'Dynamic' : `${w.preset}, ${String(w.windFromDeg).padStart(3, '0')}°/${w.windKt} kt, vis ${w.visibilityKm} km`),
      ),
      h('div', { class: 'row3' },
        field('Cruise altitude (ft)', numInput(cruise, 1000, def.spec.ceilingFt, v => { s.cruiseAltFt = Math.round(v / 500) * 500; this.preview(); }, 500)),
        field(`Fuel ${s.fuelPct === null ? '(auto)' : ''}`, h('div', { class: 'fuel' },
          h('input', { type: 'range', min: 5, max: 100, value: Math.round(pct * 100), oninput: e => { s.fuelPct = +(e.target as HTMLInputElement).value / 100; fuelLbl.textContent = `${Math.round(s.fuelPct * 100)}% · ${a0(maxFuel * s.fuelPct)} kg`; } }),
        )),
        field('Realism', h('select', { onchange: e => { s.realism = (e.target as HTMLSelectElement).value as FlightConfig['realism']; } },
          h('option', { value: 'arcade', selected: s.realism === 'arcade' }, 'Arcade — forgiving'),
          h('option', { value: 'realistic', selected: s.realism === 'realistic' }, 'Realistic'),
          h('option', { value: 'simulation', selected: s.realism === 'simulation' }, 'Simulation — strict'))),
      ),
      ...warnings.map(t => h('div', { class: 'warnline' }, `⚠ ${t}`)),
    );
    const fuelLbl = h('div', { class: 'muted small' }, `${Math.round(pct * 100)}% · ${a0(maxFuel * pct)} kg (trip + reserve estimate ${a0(needKg)} kg)`);
    summary.querySelector('.fuel')?.append(fuelLbl);

    const startBtn = h('button', { class: 'btn primary big', disabled: !s.dep || !s.dest, onclick: () => this.start() }, s.mission ? `START MISSION` : 'START FLIGHT');

    this.body.append(
      section('Aircraft', acGrid, specs),
      section('Departure', depSearch, s.dep ? h('div', { class: 'muted small' }, `${s.dep.city ? s.dep.city + ', ' : ''}${s.dep.country} · elevation ${s.dep.elevM !== null ? a0(s.dep.elevM / FT) + ' ft' : 'unknown'}`) : '',
        h('div', { class: 'row2' }, field('Runway', depRwSel), field('Start', startSel)),
        s.dep && drw ? h('div', { class: 'muted small' }, `Surface: ${surf(drw.ident)}`) : '', airborneFields),
      section('Destination', destSearch, h('div', { class: 'row2' }, field('Arrival runway', arrRwSel), field('Approach', h('div', { class: 'static' }, 'Synthetic 3° ILS to the arrival runway')))),
      section('Weather', h('div', { class: 'row2' }, field('Preset', presetSel), field('', h('div', {}))), wx),
      section('Time of day', timeRow, h('div', { class: 'muted small' }, 'Local solar time at the departure airport. The sun, shadows, twilight and night lighting follow the real date and time.')),
      section('Flight summary', summary),
      h('div', { class: 'start-row' }, s.mission ? h('div', { class: 'mission-tag' }, `Mission: ${s.mission.title}`, h('button', { class: 'chip small', onclick: () => { s.mission = null; this.render(); } }, '✕')) : '', startBtn),
      h('p', { class: 'muted small disclaimer' }, 'Entertainment simulator — not suitable for real-world flight training or navigation. Airport data: OurAirports (public domain). Terrain: AWS Terrain Tiles. Geography: Natural Earth. Imagery credits are shown on the globe.'),
    );
  }

  private renderMissions() {
    this.body.append(h('p', { class: 'muted' }, 'Optional scenarios with scoring. Pick one to load it into the planner, or start it directly.'),
      ...MISSIONS.map(m => h('div', { class: 'mission' },
        h('div', { class: 'mission-head' }, h('h3', {}, m.title), h('span', { class: `badge ${m.difficulty.toLowerCase()}` }, m.difficulty)),
        h('p', {}, m.description),
        h('div', { class: 'muted small' }, `${getAircraft(m.aircraft).name} · ${m.departure}${m.depRunway ? ' ' + m.depRunway : ''} → ${m.destination}${m.arrRunway ? ' ' + m.arrRunway : ''} · ${m.weatherPreset} · ${m.localTime}`),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn', onclick: async () => { await this.loadMission(m); this.tab = 'plan'; this.root.querySelectorAll('.tab').forEach(b => b.classList.toggle('on', (b as HTMLElement).dataset.tab === 'plan')); this.render(); this.preview(); } }, 'Load into planner'),
          h('button', { class: 'btn primary', onclick: async () => { await this.loadMission(m); this.start(); } }, 'Start mission'),
        ),
      )),
    );
  }

  private async loadMission(m: MissionDef) {
    const s = this.s;
    s.aircraftId = m.aircraft;
    const dep = this.db.get(m.departure), dest = this.db.get(m.destination);
    if (dep) await this.selectDeparture(dep);
    if (dest) await this.selectDestination(dest);
    if (m.depRunway) s.depRunway = m.depRunway;
    s.arrRunway = m.arrRunway ?? 'auto';
    s.start = m.start;
    s.airAltFt = m.airborneAltFt ?? 4000;
    s.airDistNm = m.airborneDistNm ?? 5;
    s.headingDeg = m.headingDeg ?? null;
    s.weather = { ...applyPreset(defaultWeather(), m.weatherPreset), ...(m.weather ?? {}) };
    if (m.weather) s.weather.preset = 'Custom';
    s.time = m.localTime;
    if (m.date) s.date = m.date;
    s.cruiseAltFt = null;
    s.fuelPct = null;
    s.mission = m;
  }

  private airportSearch(labelText: string, current: Airport | null, onPick: (a: Airport) => void) {
    const input = h('input', { type: 'search', placeholder: 'ICAO, IATA, name or city…', value: '' });
    const results = h('div', { class: 'results hidden' });
    const cur = h('div', { class: 'airport-current' }, current ? airportLabel(current) : 'None selected');
    let timer = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        clear(results);
        const list = this.db.search(input.value, 10);
        results.classList.toggle('hidden', list.length === 0);
        for (const a of list) {
          results.append(h('button', { class: 'result', onclick: () => { input.value = ''; results.classList.add('hidden'); onPick(a); } },
            h('div', {}, airportLabel(a)), h('div', { class: 'muted small' }, `${a.city ? a.city + ', ' : ''}${a.country} · longest runway ${a0(a.longestRunwayM)} m`)));
        }
      }, 120);
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') (results.querySelector('.result') as HTMLButtonElement | null)?.click(); });
    return h('div', { class: 'airport-search' }, h('label', {}, labelText), cur, h('div', { class: 'search-wrap' }, input, results));
  }

  private start() {
    const s = this.s;
    if (!s.dep || !s.dest) return;
    const def = this.def;
    const plan = this.planNow()!;
    const est = plan.estimate(def.spec.cruiseKtas * KT, def.perf.climbKt * KT * 1.2, def.perf.maxVsFpm * 0.5 * FT / 60);
    const maxFuel = def.spec.fuelCapacityL * def.fuelDensity;
    const room = def.spec.mtowKg - def.spec.emptyKg - def.defaultPayloadKg;
    const fuelPct = s.fuelPct ?? clamp(estimateFuelKg(def, est.eteS) / maxFuel, 0.1, Math.min(1, room / maxFuel));
    let depRw = this.depRw();
    if (depRw && s.position === 'intersection' && (s.start === 'ready' || s.start === 'cold')) {
      depRw = { ...depRw, displacedM: depRw.displacedM + depRw.lengthM / 3 };
    }
    // Local solar time → UTC using the departure longitude (15° per hour).
    const [y, mo, d] = s.date.split('-').map(Number);
    const [hh, mm] = s.time.split(':').map(Number);
    const utc = new Date(Date.UTC(y, mo - 1, d, hh, mm) - (s.dep.lon / 15) * 3600e3);
    this.handlers.onStart({
      config: {
        aircraft: def, departure: s.dep, depRunway: depRw, destination: s.dest, arrRunway: this.arrRw(),
        start: s.start, airborneAltFt: s.airAltFt, airborneDistNm: s.airDistNm, headingDeg: s.start === 'airborne' ? s.headingDeg : null,
        cruiseAltFt: Math.round(plan.cruiseAltM / FT), fuelFraction: fuelPct, realism: s.realism, mission: s.mission,
      },
      weather: { ...s.weather },
      startTimeUtc: utc,
    });
  }
}

const a0 = (n: number) => Math.round(n).toLocaleString('en-US');
function section(title: string, ...content: (Node | string | null)[]) {
  return h('section', { class: 'psec' }, h('h2', {}, title), ...content);
}
function field(labelText: string, control: HTMLElement) {
  return h('label', { class: 'field' }, labelText ? h('span', {}, labelText) : '', control);
}
function kv(k: string, v: string) {
  return h('div', {}, h('span', { class: 'muted' }, k), h('b', {}, v));
}
function numInput(value: number, min: number, max: number, onChange: (v: number) => void, step = 1) {
  return h('input', { type: 'number', value: String(value), min, max, step, onchange: e => onChange(clamp(+(e.target as HTMLInputElement).value, min, max)) });
}
