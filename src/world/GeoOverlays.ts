// Geographic overlays and cities.
//   • Country borders (Natural Earth 1:50m) draped on the terrain
//   • City labels (Natural Earth populated places)
//   • Procedural city skylines for large cities: building count, spread and
//     height scale with population, taller in the centre. Buildings avoid water
//     and runways. This is an impression of a city's footprint, not real
//     building data.

import {
  GroundPolylinePrimitive, GroundPolylineGeometry, GeometryInstance, PolylineColorAppearance, ColorGeometryInstanceAttribute,
  Color, Cartesian3, LabelCollection, LabelStyle, DistanceDisplayCondition, NearFarScalar, VerticalOrigin,
  Primitive, BoxGeometry, PerInstanceColorAppearance, Transforms, Matrix4, type Scene,
  PointPrimitiveCollection, HeadingPitchRoll, ShadowMode,
} from 'cesium';
import type { ElevationService } from './ElevationService';
import { distance, destination } from '../core/geodesy';
import { rng, clamp } from '../core/math';

interface City { name: string; country: string; lat: number; lon: number; pop: number; mega: boolean; capital: boolean }

export class GeoOverlays {
  private borders: GroundPolylinePrimitive | null = null;
  private labels: LabelCollection;
  cities: City[] = [];
  private builtCities = new Map<string, { prim: Primitive; lights: PointPrimitiveCollection }>();
  private lastCityCheck = { lat: 999, lon: 999 };
  objectDensity = 2; // 0..3
  private busy = false;
  /** Procedural skylines are skipped when real 3D buildings are shown */
  proceduralEnabled = true;

  constructor(private scene: Scene, private base: string, private elevation: ElevationService) {
    this.labels = scene.primitives.add(new LabelCollection({ scene }));
  }

  async loadCities() {
    try {
      const r = await fetch(`${this.base}/cities.json`);
      const d = await r.json() as { cities: [string, string, number, number, number, number, number][] };
      this.cities = d.cities.map(c => ({ name: c[0], country: c[1], lat: c[2], lon: c[3], pop: c[4], mega: !!c[5], capital: !!c[6] }));
      for (const c of this.cities) {
        const big = c.pop > 3e6;
        this.labels.add({
          position: Cartesian3.fromDegrees(c.lon, c.lat, 400),
          text: c.name,
          font: `${big ? 600 : 500} ${big ? 16 : 13}px system-ui, sans-serif`,
          fillColor: Color.WHITE.withAlpha(0.92),
          outlineColor: Color.BLACK.withAlpha(0.8),
          outlineWidth: 3,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          distanceDisplayCondition: new DistanceDisplayCondition(8000, big ? 3.5e6 : c.pop > 1e6 ? 1.2e6 : 4e5),
          scaleByDistance: new NearFarScalar(2e4, 1, 2e6, 0.6),
          disableDepthTestDistance: 5e4,
        });
      }
    } catch (e) {
      console.warn('cities unavailable', e);
    }
  }

  async setBorders(on: boolean) {
    if (!on) {
      if (this.borders) this.scene.groundPrimitives.remove(this.borders);
      this.borders = null;
      return;
    }
    if (this.borders) return;
    try {
      const r = await fetch(`${this.base}/borders.json`);
      const d = await r.json() as { lines: number[][] };
      const instances = d.lines.filter(l => l.length >= 4).map(l => new GeometryInstance({
        geometry: new GroundPolylineGeometry({ positions: Cartesian3.fromDegreesArray(l), width: 2.0 }),
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString('#ffe08a').withAlpha(0.65)) },
      }));
      this.borders = this.scene.groundPrimitives.add(new GroundPolylinePrimitive({
        geometryInstances: instances,
        appearance: new PolylineColorAppearance(),
        asynchronous: true,
      }));
    } catch (e) {
      console.warn('borders unavailable', e);
    }
  }

  /** Builds/removes procedural skylines for large cities near (lat, lon). */
  async updateCities(lat: number, lon: number, night: boolean) {
    for (const v of this.builtCities.values()) v.lights.show = night && this.proceduralEnabled;
    for (const v of this.builtCities.values()) v.prim.show = this.proceduralEnabled;
    if (this.busy || this.objectDensity === 0 || !this.proceduralEnabled) return;
    if (distance(lat, lon, this.lastCityCheck.lat, this.lastCityCheck.lon) < 5000) return;
    this.lastCityCheck = { lat, lon };
    const minPop = [Infinity, 2e6, 7e5, 3e5][this.objectDensity];
    const near = this.cities.filter(c => c.pop >= minPop && distance(lat, lon, c.lat, c.lon) < 70000 + Math.sqrt(c.pop) * 15);
    const keep = new Set(near.map(c => c.name + c.country));
    for (const [k, v] of this.builtCities) if (!keep.has(k)) {
      this.scene.primitives.remove(v.prim);
      this.scene.primitives.remove(v.lights);
      this.builtCities.delete(k);
    }
    this.busy = true;
    try {
      for (const c of near) {
        const k = c.name + c.country;
        if (this.builtCities.has(k)) continue;
        await this.elevation.prefetch(c.lat, c.lon, 11, 1);
        this.builtCities.set(k, this.buildCity(c, night));
      }
    } finally {
      this.busy = false;
    }
  }

  private buildCity(c: City, night: boolean) {
    const rand = rng(Math.floor(c.lat * 1000) * 31 + Math.floor(c.lon * 1000));
    const scale = [0, 0.4, 0.7, 1][this.objectDensity];
    const count = Math.round(clamp(c.pop / 4000, 150, 2600) * scale);
    const radius = clamp(1800 * Math.sqrt(c.pop / 1e6), 1500, 16000);
    const maxH = clamp(40 + Math.log10(c.pop) * 30 + (c.mega ? 120 : 0), 50, 320);
    const instances: GeometryInstance[] = [];
    const lights = this.scene.primitives.add(new PointPrimitiveCollection());
    const palette = ['#cfc8bd', '#b9b7b2', '#a9aeb4', '#d8d2c4', '#8f969e', '#c4b8a6', '#9aa3a8'];
    for (let i = 0; i < count; i++) {
      // Gaussian-ish radial distribution: dense core, sparse suburbs.
      const r = radius * Math.sqrt(-2 * Math.log(Math.max(1e-6, rand()))) * 0.45;
      if (r > radius * 1.4) continue;
      const [la, lo] = destination(c.lat, c.lon, rand() * 360, r);
      const raw = this.elevation.sampleRaw(la, lo, 13);
      if (raw === null || raw < 0.5) continue; // water or unknown
      if (this.elevation.flatten.inZone(la, lo)) continue; // runways
      const ground = this.elevation.height(la, lo) ?? raw;
      const core = Math.exp(-((r / (radius * 0.25)) ** 2));
      const h = clamp(8 + rand() * 18 + core * maxH * (0.25 + rand() * 0.75) * (rand() < 0.3 ? 1 : 0.4), 6, maxH);
      const w = 14 + rand() * 30 + core * 20;
      const d = 14 + rand() * 30;
      const enu = Transforms.headingPitchRollToFixedFrame(Cartesian3.fromDegrees(lo, la, ground - 15 + (h + 15) / 2), new HeadingPitchRoll(rand() * Math.PI, 0, 0));
      instances.push(new GeometryInstance({
        geometry: BoxGeometry.fromDimensions({ dimensions: new Cartesian3(w, d, h + 15), vertexFormat: PerInstanceColorAppearance.VERTEX_FORMAT }),
        modelMatrix: enu,
        attributes: { color: ColorGeometryInstanceAttribute.fromColor(Color.fromCssColorString(palette[Math.floor(rand() * palette.length)])) },
      }));
      if (rand() < 0.35) {
        const top = Matrix4.multiplyByPoint(enu, new Cartesian3(0, 0, (h + 15) / 2 + 0.5), new Cartesian3());
        lights.add({ position: top, pixelSize: 2 + rand() * 2, color: Color.fromCssColorString(rand() < 0.2 ? '#ff5050' : '#ffd9a0'), scaleByDistance: new NearFarScalar(500, 1.3, 30000, 0.3) });
      }
    }
    lights.show = night;
    const prim = this.scene.primitives.add(new Primitive({
      geometryInstances: instances,
      appearance: new PerInstanceColorAppearance({ closed: true, flat: false, translucent: false }),
      shadows: ShadowMode.DISABLED,
      asynchronous: true,
    }));
    return { prim, lights };
  }

  setLabels(on: boolean) {
    this.labels.show = on;
  }
}
