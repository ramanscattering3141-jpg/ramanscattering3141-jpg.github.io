// Application shell: owns the world systems (globe, terrain, airports, weather,
// overlays), the planner and in-flight UI, and the active FlightSession. Wires
// input actions to aircraft systems and runs the per-frame update.

import { Cartesian2, Cartesian3, Color, ArcType, JulianDate, type Entity, LabelStyle, VerticalOrigin, Matrix4 } from 'cesium';
import { ElevationService } from './world/ElevationService';
import { TerrariumTerrainProvider } from './world/TerrainProvider';
import { Globe } from './world/Globe';
import { AirportDatabase } from './world/AirportDatabase';
import { AirportRenderer } from './world/AirportRenderer';
import { GeoOverlays } from './world/GeoOverlays';
import { Weather } from './environment/Weather';
import { WeatherVisuals } from './environment/WeatherVisuals';
import { Input, type TriggerAction } from './input/Input';
import { CameraSystem, CAMERA_MODES, type CameraMode } from './camera/CameraSystem';
import { FlightSession } from './sim/FlightSession';
import { Planner, type PlannerResult } from './ui/Planner';
import { FlightUI } from './ui/FlightUI';
import { SettingsUI } from './ui/SettingsUI';
import { h, toast } from './ui/dom';
import { loadSettings, autoDetectQuality, type Settings } from './core/Settings';
import { REALISM } from './aircraft/FlightDynamics';
import type { Airport } from './world/AirportTypes';
import type { FlightPlan } from './navigation/Navigation';
import { distance, ecefToGeodetic } from './core/geodesy';
import { clamp } from './core/math';

const BASE = import.meta.env.BASE_URL;
const SIM_RATES = [1, 2, 4, 8, 16];

export class App {
  settings: Settings;
  elevation = new ElevationService();
  terrain: TerrariumTerrainProvider;
  globe!: Globe;
  db: AirportDatabase;
  airports!: AirportRenderer;
  overlays!: GeoOverlays;
  weather = new Weather();
  weatherVisuals!: WeatherVisuals;
  input: Input;
  camera: CameraSystem | null = null;
  session: FlightSession | null = null;
  planner!: Planner;
  flightUI!: FlightUI;
  settingsUI!: SettingsUI;
  private lastFrame = performance.now();
  private slowTimer = 0;
  private lastResult: PlannerResult | null = null;
  private routeEntities: Entity[] = [];
  private status: HTMLElement;

  constructor(private cesiumEl: HTMLElement, private uiEl: HTMLElement) {
    let s = loadSettings();
    try { if (!localStorage.getItem('world-flight-sim.settings.v1')) s = autoDetectQuality(s); } catch { /* ignore */ }
    this.settings = s;
    this.db = new AirportDatabase(`${BASE}data/airports`, this.elevation.flatten);
    this.terrain = new TerrariumTerrainProvider(this.elevation);
    this.terrain.beforeTile = async (w, so, e, n, level) => { if (level >= 8) await this.db.ensureRect(w, so, e, n); };
    this.input = new Input(s.bindings);
    this.status = h('div', { class: 'status-line' });
  }

  async init() {
    this.globe = new Globe(this.cesiumEl, this.terrain);
    const viewer = this.globe.viewer;
    this.uiEl.append(this.status);
    this.elevation.onUnavailable = () => toast('Elevation server unreachable — terrain will be flat. Check your connection.', 8000);
    this.elevation.preloadWorld().catch(() => undefined);
    this.airports = new AirportRenderer(viewer.scene, this.db);
    this.overlays = new GeoOverlays(viewer.scene, `${BASE}data/geo`, this.elevation);
    this.weatherVisuals = new WeatherVisuals(viewer.scene, this.weather);
    this.applyAllSettings();
    this.globe.setImagery(this.settings.imagery, this.settings.ionToken).then(name => this.setStatus(`Imagery: ${name}`));
    this.overlays.loadCities();

    this.settingsUI = new SettingsUI(this.uiEl, this.settings, this.input, (s, k) => this.applySetting(s, k));
    this.flightUI = new FlightUI(this.uiEl, this.input, {
      onResume: () => this.togglePause(),
      onRestart: () => this.restart(),
      onPlanner: () => this.endFlight(),
      onSettings: () => this.settingsUI.open(),
      onCamera: m => this.setCamera(m),
      onContinueAfterLanding: () => { this.session?.resume(); this.flightUI.closeOverlay(); },
    }, `${BASE}data`);
    this.planner = new Planner(this.uiEl, this.db, {
      onStart: r => this.startFlight(r),
      onSettings: () => this.settingsUI.open(),
      onHelp: () => this.flightUI.showHelp(),
    }, this.settings.realism);
    this.planner.onPreview = (dep, dest, plan) => this.previewRoute(dep, dest, plan);
    this.input.on(a => this.onAction(a));

    viewer.scene.preUpdate.addEventListener(() => this.frame());
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(-100, 30, 2.2e7) });
    await this.planner.init();
  }

  private setStatus(text: string) {
    this.status.textContent = text;
  }

  // ---------------- settings ----------------
  private applyAllSettings() {
    for (const k of ['terrainQuality', 'nightLights', 'showBorders', 'showLabels', 'objectDensity', 'cloudQuality'] as (keyof Settings)[]) this.applySetting(this.settings, k);
  }

  private applySetting(s: Settings, k: keyof Settings) {
    switch (k) {
      case 'terrainQuality': case 'shadowQuality': case 'textureQuality': case 'drawDistance':
        this.globe.setQuality({ terrain: s.terrainQuality, shadows: s.shadowQuality, drawDistance: s.drawDistance, textures: s.textureQuality });
        this.weatherVisuals.baseFogDensity = [6e-5, 3e-5, 1.2e-5][s.drawDistance] ?? 3e-5;
        break;
      case 'cloudQuality': this.weatherVisuals.quality = s.cloudQuality; this.weatherVisuals.clear(); break;
      case 'objectDensity': this.overlays.objectDensity = s.objectDensity; break;
      case 'imagery': case 'ionToken':
        this.globe.setImagery(s.imagery, s.ionToken).then(name => { this.setStatus(`Imagery: ${name}`); toast(`Imagery: ${name}`); });
        break;
      case 'nightLights': this.globe.enableNightLights(s.nightLights); break;
      case 'showBorders': this.overlays.setBorders(s.showBorders); break;
      case 'showLabels': this.overlays.setLabels(s.showLabels); break;
      case 'bindings': break;
      case 'realism': break;
      case 'controlSensitivity': break;
    }
    if (k === 'terrainQuality' || k === 'shadowQuality' || k === 'textureQuality' || k === 'drawDistance') return;
  }

  // ---------------- planner preview ----------------
  private previewRoute(dep: Airport | null, dest: Airport | null, plan: FlightPlan | null) {
    const v = this.globe.viewer;
    for (const e of this.routeEntities) v.entities.remove(e);
    this.routeEntities = [];
    if (!dep || !dest) return;
    if (plan) {
      this.routeEntities.push(v.entities.add({
        polyline: {
          positions: plan.waypoints.map(w => Cartesian3.fromDegrees(w.lon, w.lat, 0)),
          width: 3, arcType: ArcType.GEODESIC, clampToGround: false,
          material: Color.fromCssColorString('#ff4fe0'),
        },
      }));
    }
    for (const a of [dep, dest]) {
      this.routeEntities.push(v.entities.add({
        position: Cartesian3.fromDegrees(a.lon, a.lat, (a.elevM ?? 0) + 50),
        point: { pixelSize: 9, color: Color.fromCssColorString('#ffd166'), outlineColor: Color.BLACK, outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: { text: a.icao || a.ident, font: '600 15px system-ui', style: LabelStyle.FILL_AND_OUTLINE, outlineWidth: 3, outlineColor: Color.BLACK, verticalOrigin: VerticalOrigin.BOTTOM, pixelOffset: new Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY },
      }));
    }
    if (!this.session) {
      const d = distance(dep.lat, dep.lon, dest.lat, dest.lon);
      const midLat = (dep.lat + dest.lat) / 2;
      let dLon = dest.lon - dep.lon;
      if (dLon > 180) dLon -= 360; if (dLon < -180) dLon += 360;
      const midLon = dep.lon + dLon / 2;
      v.camera.flyTo({ destination: Cartesian3.fromDegrees(midLon, midLat - clamp(d / 111000 * 0.35, 0.05, 25), clamp(d * 1.6, 25000, 1.6e7)), orientation: { heading: 0, pitch: -Math.PI / 2 * (d < 200000 ? 0.7 : 0.9), roll: 0 }, duration: 1.6 });
    }
  }

  // ---------------- flight lifecycle ----------------
  private async startFlight(r: PlannerResult) {
    this.lastResult = r;
    this.planner.show(false);
    const v = this.globe.viewer;
    for (const e of this.routeEntities) v.entities.remove(e);
    this.routeEntities = [];
    this.session?.destroy();
    this.weather.set(r.weather);
    this.weather.time = 0;
    this.weatherVisuals.clear();
    this.globe.setTime(r.startTimeUtc);
    v.clock.multiplier = 1;
    const s = new FlightSession(r.config, v.scene, this.elevation, this.weather);
    this.session = s;
    this.camera = new CameraSystem(v.scene, r.config.aircraft, v.scene.canvas);
    this.flightUI.attach(s);
    this.flightUI.showLoading(`Loading terrain around ${r.config.departure.name}…`);
    s.onStatus = st => {
      if (st === 'crashed') this.flightUI.showCrash(s.fdm.crashed ?? 'terrain', s.fdm.crashPart);
      if (st === 'complete') this.flightUI.showReport();
    };
    const sp = r.config.start === 'final' ? r.config.destination : r.config.departure;
    v.camera.setView({ destination: Cartesian3.fromDegrees(sp.lon, sp.lat - 0.02, (sp.elevM ?? 0) + 800), orientation: { heading: 0, pitch: -0.5, roll: 0 } });
    await s.spawn();
    if (this.session !== s) return;
    this.flightUI.closeOverlay();
    const startCam: CameraMode = 'chase';
    this.camera.setMode('cockpit');
    this.setCamera(startCam);
    if (r.config.aircraft.cockpit === 'glass' || r.config.aircraft.cockpit === 'ga') this.flightUI.togglePanel(false);
    const def = r.config.aircraft;
    const tips: Record<string, string> = {
      ready: `Ready for take-off. Full power (Shift+R), rotate at ${def.perf.vrKt} kt. Press H for controls.`,
      cold: 'Cold & dark: press E to start the engine(s), then P to release the parking brake.',
      airborne: 'Airborne. Press Q to engage the autopilot, or fly by hand. Press H for controls.',
      final: `On final. Fly the glidepath to runway ${r.config.arrRunway?.ident ?? ''}; press APP on the panel (O) to autoland.`,
    };
    toast(tips[r.config.start], 7000);
  }

  private restart() {
    if (this.lastResult) this.startFlight(this.lastResult);
  }

  private endFlight() {
    this.session?.destroy();
    this.session = null;
    this.camera?.setMode('free');
    this.globe.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    this.globe.viewer.scene.screenSpaceCameraController.enableInputs = true;
    this.globe.viewer.scene.screenSpaceCameraController.enableTranslate = true;
    this.camera = null;
    this.flightUI.detach();
    this.weatherVisuals.clear();
    this.planner.show(true);
  }

  private togglePause() {
    const s = this.session;
    if (!s || s.status === 'loading') return;
    if (s.status !== 'flying') return;
    s.paused = !s.paused;
    this.globe.viewer.clock.shouldAnimate = !s.paused;
    if (s.paused) this.flightUI.showPause(); else this.flightUI.closeOverlay();
  }

  private setCamera(m: CameraMode) {
    const s = this.session;
    if (!s || !this.camera) return;
    let tower: { lat: number; lon: number; h: number } | null | undefined;
    if (m === 'tower') {
      const t = s.fdm.telemetry;
      const near = this.db.nearby(t.lat, t.lon, 30000, a => !!a.runways && a.longestRunwayM > 500)[0];
      tower = near ? CameraSystem.towerSiteFor(near.airport) : null;
    }
    this.camera.setMode(m, tower);
    this.flightUI.setCameraLabel(m);
    // The instrument panel shows automatically in the cockpit view.
    this.flightUI.togglePanel(m === 'cockpit' ? true : this.flightUI.showPanel && this.camera.mode !== 'cockpit' ? this.flightUI.showPanel : false);
  }

  // ---------------- input ----------------
  private onAction(a: TriggerAction) {
    if (a === 'help') { if (this.flightUI.overlayOpen) this.flightUI.closeOverlay(); else this.flightUI.showHelp(); return; }
    if (this.settingsUI.isOpen) { if (a === 'pause') this.settingsUI.close(); return; }
    const s = this.session;
    if (!s || s.status === 'loading') return;
    if (a === 'pause') {
      if (s.status === 'flying') this.togglePause();
      else if (this.flightUI.overlayOpen) this.flightUI.closeOverlay();
      return;
    }
    if (s.paused) return;
    const c = s.fdm.controls, def = s.config.aircraft, t = s.fdm.telemetry;
    const msg = (m: string) => { s.message = m; };
    switch (a) {
      case 'throttleFull': c.throttle = 1; if (s.ap.athr) s.ap.setAthr(false); break;
      case 'throttleIdle': c.throttle = 0; if (s.ap.athr) s.ap.setAthr(false); break;
      case 'reverse':
        if (def.engine.reverseFraction <= 0) msg('No reverse thrust on this aircraft');
        else if (!t.onGround && !c.reverse) msg('Reverse thrust only on the ground');
        else { c.reverse = !c.reverse; msg(c.reverse ? 'Reverse thrust selected' : 'Reverse thrust stowed'); }
        break;
      case 'flapsDown': c.flapsIndex = Math.min(def.flaps.length - 1, c.flapsIndex + 1); msg(`Flaps ${def.flaps[c.flapsIndex].label}`); break;
      case 'flapsUp': c.flapsIndex = Math.max(0, c.flapsIndex - 1); msg(`Flaps ${def.flaps[c.flapsIndex].label}`); break;
      case 'gear':
        if (!def.gear.retractable) { msg('Fixed landing gear'); break; }
        if (t.onGround && c.gearDown) { msg('Gear cannot be raised on the ground'); break; }
        c.gearDown = !c.gearDown; msg(c.gearDown ? 'Gear down' : 'Gear up');
        break;
      case 'parkingBrake': c.parkingBrake = !c.parkingBrake; msg(c.parkingBrake ? 'Parking brake SET' : 'Parking brake released'); break;
      case 'spoilers':
        if (def.aero.dCdSpoilers <= 0) { msg('No spoilers on this aircraft'); break; }
        c.spoilers = c.spoilers > 0.5 ? 0 : t.onGround ? 1 : 0.6; msg(c.spoilers ? 'Speed brake extended' : 'Speed brake retracted'); break;
      case 'engines': {
        const wasRunning = s.fdm.engines.running;
        if (wasRunning && c.throttle > 0.1) { msg('Reduce throttle to idle before shutdown'); break; }
        s.fdm.engines.toggleStart(REALISM[s.config.realism].instantEngineStart);
        msg(wasRunning ? 'Engine shutdown' : REALISM[s.config.realism].instantEngineStart ? 'Engines running' : `Engine start… (${def.engine.startTime} s)`);
        break;
      }
      case 'apToggle': s.ap.engage(); msg(s.ap.engaged ? `Autopilot ON (${s.ap.lateral} / ${s.ap.vertical})` : s.ap.message || 'Autopilot OFF'); break;
      case 'athrToggle': s.ap.setAthr(); msg(s.ap.athr ? `Autothrottle ON — ${s.ap.targets.speedKt} kt` : 'Autothrottle OFF'); break;
      case 'camNext': this.setCamera(CAMERA_MODES[(CAMERA_MODES.indexOf(this.camera?.mode ?? 'chase') + 1) % CAMERA_MODES.length]); break;
      case 'camCockpit': this.setCamera('cockpit'); break;
      case 'camChase': this.setCamera('chase'); break;
      case 'camWing': this.setCamera('wing'); break;
      case 'camFree': this.setCamera('free'); break;
      case 'camTower': this.setCamera('tower'); break;
      case 'hud': this.flightUI.toggleHud(); break;
      case 'panel': this.flightUI.togglePanel(); break;
      case 'map': this.flightUI.toggleMap(); break;
      case 'simRateUp': case 'simRateDown': {
        const i = SIM_RATES.indexOf(s.simRate);
        const n = SIM_RATES[clamp(i + (a === 'simRateUp' ? 1 : -1), 0, SIM_RATES.length - 1)];
        if (n > 4 && t.agl < 1500 * 0.3048) { msg('Sim rate above 4× only above 1,500 ft AGL'); break; }
        s.simRate = n; this.globe.viewer.clock.multiplier = n; msg(`Simulation rate ×${n}`);
        break;
      }
      case 'mouseYoke': this.input.mouseYoke = !this.input.mouseYoke; if (this.camera) this.camera.mouseYokeActive = this.input.mouseYoke; msg(this.input.mouseYoke ? 'Mouse yoke ON (move mouse to fly, Y to release)' : 'Mouse yoke OFF'); break;
      case 'lookReset': this.camera?.resetLook(); break;
    }
  }

  /** Applies continuous pilot inputs to the aircraft controls. */
  private applyPilotInputs(dt: number) {
    const s = this.session!;
    const ax = this.input.axes, c = s.fdm.controls;
    const sens = this.settings.controlSensitivity * REALISM[s.config.realism].controlSensitivity;
    if (s.ap.engaged) {
      // Pilot override: firm control input disconnects the autopilot.
      if (Math.abs(ax.pitch) > 0.6 || Math.abs(ax.roll) > 0.6) { s.ap.engage(false); s.message = 'Autopilot disconnected by pilot input'; }
    } else {
      c.elevator = clamp(ax.pitch * sens, -1, 1);
      c.aileron = clamp(ax.roll * sens, -1, 1);
      c.rudder = clamp(ax.yaw, -1, 1);
    }
    if (s.ap.engaged && Math.abs(ax.yaw) > 0.1) c.rudder = ax.yaw;
    if (ax.throttleRate !== 0) {
      if (s.ap.athr) { s.ap.setAthr(false); s.message = 'Autothrottle disconnected'; }
      c.throttle = clamp(c.throttle + ax.throttleRate * dt, 0, 1);
    }
    if (ax.trimRate !== 0) c.trim = clamp(c.trim + ax.trimRate * dt, -1, 1);
    c.brakes = ax.brakes;
  }

  // ---------------- frame ----------------
  private frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const v = this.globe.viewer;
    const s = this.session;
    this.input.update(dt, 1);
    if (s && s.status !== 'loading') {
      if (!s.paused && !this.settingsUI.isOpen) this.applyPilotInputs(dt);
      if (!this.settingsUI.isOpen) s.update(dt);
      const running = !s.paused && s.status === 'flying';
      v.clock.shouldAnimate = running;
      v.clock.multiplier = s.simRate;
      const hideModel = this.camera?.mode === 'cockpit' && s.config.aircraft.cockpit === 'glass';
      s.view.visible = !hideModel;
      s.view.update(s.renderPos, s.renderQ, s.fdm, running ? dt * s.simRate : 0, now / 1000, !!hideModel);
      this.camera?.update(dt, s.renderPos, s.renderQ, s.fdm.vel);
      this.flightUI.update(dt);
    }
    // World systems around the camera (or aircraft).
    const camGeo = ecefToGeodetic([v.camera.positionWC.x, v.camera.positionWC.y, v.camera.positionWC.z]);
    const focus = s && s.status !== 'loading' ? s.fdm.telemetry : { lat: camGeo.lat, lon: camGeo.lon, alt: camGeo.h };
    this.weatherVisuals.update(dt, v.clock.currentTime ?? JulianDate.now(), camGeo.lat, camGeo.lon, camGeo.h, !!s);
    this.slowTimer += dt;
    if (this.slowTimer > 1) {
      this.slowTimer = 0;
      const night = this.weatherVisuals.lastSunElevation < -3;
      const lowVis = s ? this.weather.at(focus.lat, focus.lon).visibilityKm < 5 : false;
      if (focus.alt < 15000) this.airports.update(focus.lat, focus.lon, night || lowVis);
      if (focus.alt < 12000) this.overlays.updateCities(focus.lat, focus.lon, night);
    }
  }
}
