// Visual weather: clouds, cloud deck, visibility fog, precipitation and lightning.
//
// Clouds are placed on a fixed world grid using a deterministic hash, so they
// stay put as you fly past them (you can use them as visual references). Only
// cells within a radius of the camera exist at any time.

import {
  CloudCollection, Cartesian3, Cartesian2, PostProcessStage, Color, type Scene, type CumulusCloud,
  Primitive, GeometryInstance, RectangleGeometry, Rectangle, EllipsoidSurfaceAppearance, Material,
  Simon1994PlanetaryPositions, JulianDate, Transforms, Matrix3,
} from 'cesium';
import type { Weather, LocalWeather } from './Weather';
import { FT, DEG, clamp } from '../core/math';

const FOG_SHADER = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float visibility;
uniform vec3 fogColor;
uniform float flash;
uniform float precipitation; // 0 none, else intensity
uniform float snow;
uniform float time;
uniform float inCloud;
uniform float hazeFactor;
in vec2 v_textureCoordinates;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  // Distance fog on terrain and models is done by Cesium's built-in fog (see update()).
  // Here we only whiten the sky in poor visibility and white-out inside cloud.
  float depth = czm_readDepth(depthTexture, v_textureCoordinates);
  float f = depth >= 1.0 ? (1.0 - smoothstep(1500.0, 25000.0, visibility)) * 0.9 * hazeFactor : 0.0;
  f = clamp(max(f, inCloud), 0.0, 1.0);
  vec3 c = mix(color.rgb, fogColor, f);

  // Precipitation streaks (screen space, cheap).
  if (precipitation > 0.0) {
    vec2 uv = v_textureCoordinates;
    float layers = 0.0;
    for (int i = 0; i < 3; i++) {
      float s = float(i) + 1.0;
      vec2 p = uv * vec2(snow > 0.5 ? 60.0 * s : 140.0 * s, snow > 0.5 ? 40.0 * s : 8.0 * s);
      p.y += time * (snow > 0.5 ? 0.8 * s : 6.0 * s);
      p.x += snow > 0.5 ? sin(time * 0.7 + s) * 2.0 : 0.3 * p.y * 0.02;
      vec2 cell = floor(p);
      vec2 fp = fract(p);
      float h = hash(cell + s * 13.1);
      if (h < 0.08 * precipitation) {
        float d = snow > 0.5 ? length(fp - vec2(0.5)) : abs(fp.x - 0.5);
        layers += (snow > 0.5 ? smoothstep(0.25, 0.0, d) : smoothstep(0.08, 0.0, d)) * (0.5 / s);
      }
    }
    c = mix(c, vec3(0.82, 0.85, 0.9), clamp(layers, 0.0, 0.6));
  }
  c += vec3(flash);
  out_FragColor = vec4(c, color.a);
}`;

export class WeatherVisuals {
  private clouds: CloudCollection;
  private cells = new Map<string, CumulusCloud[]>();
  private fog: PostProcessStage;
  private deck: Primitive | null = null;
  private deckCenter = { lat: 999, lon: 999, key: '' };
  private flash = 0;
  private nextFlash = 5;
  quality = 2; // 0..3 cloud quality
  /** Minimum haze density from the draw-distance setting */
  baseFogDensity = 1.5e-5;
  private cellSizeDeg = 0.03;

  constructor(private scene: Scene, private weather: Weather) {
    this.clouds = scene.primitives.add(new CloudCollection({ noiseDetail: 16 }));
    const self = this;
    this.fog = scene.postProcessStages.add(new PostProcessStage({
      fragmentShader: FOG_SHADER,
      uniforms: {
        visibility: () => self.uVis,
        fogColor: () => self.uFogColor,
        flash: () => self.flash,
        precipitation: () => self.uPrecip,
        snow: () => self.uSnow,
        time: () => performance.now() / 1000,
        inCloud: () => self.uInCloud,
        hazeFactor: () => self.uHaze,
      },
    })) as PostProcessStage;
  }

  lastSunElevation = 45;
  private uVis = 50000;
  private uFogColor = new Cartesian3(0.75, 0.8, 0.86);
  private uPrecip = 0;
  private uSnow = 0;
  private uInCloud = 0;
  private uHaze = 1;

  /** Sun elevation (deg) at a location — drives fog/cloud colours. */
  sunElevation(lat: number, lon: number, t: JulianDate): number {
    const sunInertial = Simon1994PlanetaryPositions.computeSunPositionInEarthInertialFrame(t);
    const icrfToFixed = Transforms.computeIcrfToFixedMatrix(t) ?? Transforms.computeTemeToPseudoFixedMatrix(t);
    const sun = Matrix3.multiplyByVector(icrfToFixed, sunInertial, new Cartesian3());
    const p = Cartesian3.fromDegrees(lon, lat, 0);
    const up = Cartesian3.normalize(p, new Cartesian3());
    const toSun = Cartesian3.normalize(Cartesian3.subtract(sun, p, new Cartesian3()), new Cartesian3());
    return Math.asin(clamp(Cartesian3.dot(up, toSun), -1, 1)) / DEG;
  }

  update(dt: number, time: JulianDate, camLat: number, camLon: number, camAlt: number, enabled: boolean) {
    const w = this.weather.at(camLat, camLon);
    const sunEl = this.sunElevation(camLat, camLon, time);
    this.lastSunElevation = sunEl;
    const day = clamp((sunEl + 6) / 12, 0.03, 1); // civil twilight blend
    const overcastDim = 1 - 0.12 * Math.max(0, w.cloudCover - 2);
    const gray = (w.precipitation !== 'none' ? 0.62 : 0.78) * overcastDim;
    this.uFogColor = new Cartesian3(gray * day * 0.97, gray * day, gray * day * 1.06);
    const inCloud = w.cloudCover >= 3 && camAlt > w.cloudBaseFt * FT && camAlt < Math.min(w.cloudTopsFt, w.cloudBaseFt + 3000) * FT;
    this.uInCloud += ((inCloud ? 0.92 : 0) - this.uInCloud) * Math.min(1, dt * 1.5);
    this.uVis = w.visibilityKm * 1000;
    // Haze layer top: the cloud base for low overcast, otherwise ~3 km.
    const hazeTop = Math.max(1500, Math.min(w.cloudCover >= 3 ? w.cloudBaseFt * FT + 300 : 3000, 5000));
    this.uHaze = clamp(1 - (camAlt - hazeTop) / (hazeTop * 3), 0.1, 1);
    const belowClouds = camAlt < w.cloudBaseFt * FT || w.cloudCover < 3;
    this.uPrecip = enabled && belowClouds || inCloud ? w.precipIntensity * (w.precipitation === 'none' ? 0 : 1) : 0;
    this.uSnow = w.precipitation === 'snow' ? 1 : 0;
    this.fog.enabled = enabled;

    // Visibility → Cesium fog density. With heightFalloff = 0 and visualDensityScalar = 1,
    // Cesium's globe fog is 1 − exp(−(s+1)·2s) with s = distance·density, which reaches ≈95%
    // at s ≈ 0.82 — so density = 0.82 / visibility. Models use 1 − exp(−s²).
    const fog = this.scene.fog;
    fog.enabled = true;
    fog.heightFalloff = 0;
    fog.heightScalar = 1;
    fog.visualDensityScalar = 1;
    const vis = enabled ? this.uVis : 80000;
    const d = Math.max(0.82 / vis, this.baseFogDensity) * this.uHaze;
    fog.density = inCloud ? 0.82 / 150 : d;

    // Lightning flashes in thunderstorms.
    this.flash = Math.max(0, this.flash - dt * 4);
    if (w.thunderstorms && enabled) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) { this.flash = 0.6 + Math.random() * 0.4; this.nextFlash = 3 + Math.random() * 12; }
    }

    this.updateClouds(camLat, camLon, w, day, enabled);
    this.updateDeck(camLat, camLon, w, day, enabled);
  }

  private updateClouds(lat: number, lon: number, w: LocalWeather, day: number, enabled: boolean) {
    const coverage = enabled ? [0, 0.12, 0.3, 0.55, 0.7][w.cloudCover] ?? 0 : 0;
    const radiusDeg = [0.12, 0.2, 0.3, 0.4][this.quality];
    const cs = this.cellSizeDeg;
    const wanted = new Set<string>();
    if (coverage > 0 && this.quality > 0) {
      const lonScale = 1 / Math.max(0.2, Math.cos(lat * DEG));
      for (let i = Math.floor((lat - radiusDeg) / cs); i <= Math.floor((lat + radiusDeg) / cs); i++) {
        for (let j = Math.floor((lon - radiusDeg * lonScale) / cs); j <= Math.floor((lon + radiusDeg * lonScale) / cs); j++) {
          const h = hash2(i, j);
          if (h > coverage) continue;
          const k = `${i},${j},${w.cloudCover},${Math.round(w.cloudBaseFt / 500)}`;
          wanted.add(k);
          if (this.cells.has(k)) continue;
          const clouds: CumulusCloud[] = [];
          const n = w.cloudCover >= 3 ? 2 : 1;
          for (let c = 0; c < n; c++) {
            const r1 = hash2(i * 7 + c, j * 13), r2 = hash2(i * 3, j * 5 + c);
            const clat = (i + r1) * cs, clon = (j + r2) * cs;
            // Cumulus proportions: wider than tall (Cesium renders each as a billboard).
            const thick = Math.min(w.cloudTopsFt - w.cloudBaseFt, 6000) * FT;
            const sx = 700 + r1 * 1500 + (w.cloudCover >= 3 ? 1000 : 0);
            const sy = clamp(thick * (0.35 + r2 * 0.4), 180, sx * 0.42);
            clouds.push(this.clouds.add({
              position: Cartesian3.fromDegrees(clon, clat, w.cloudBaseFt * FT + sy * 0.45),
              scale: new Cartesian2(sx, sy),
              maximumSize: new Cartesian3(50, 15 + r2 * 6, 13),
              slice: 0.36 + r1 * 0.2,
              brightness: clamp(day * (w.thunderstorms ? 0.55 : w.cloudCover >= 4 ? 0.8 : 1), 0.05, 1),
              color: w.thunderstorms ? Color.fromCssColorString('#8a8f99') : Color.WHITE,
            }));
          }
          this.cells.set(k, clouds);
        }
      }
    }
    for (const [k, list] of this.cells) {
      if (!wanted.has(k)) { for (const c of list) this.clouds.remove(c); this.cells.delete(k); }
      else for (const c of list) c.brightness = clamp(day * (w.thunderstorms ? 0.55 : 1), 0.05, 1);
    }
  }

  /** A translucent cloud deck for broken/overcast skies, re-centred as you travel. */
  private updateDeck(lat: number, lon: number, w: LocalWeather, day: number, enabled: boolean) {
    const want = enabled && w.cloudCover >= 3;
    const key = `${w.cloudCover},${w.cloudBaseFt},${Math.round(day * 10)}`;
    const moved = Math.abs(lat - this.deckCenter.lat) > 0.25 || Math.abs(lon - this.deckCenter.lon) > 0.25;
    if (!want) {
      if (this.deck) { this.scene.primitives.remove(this.deck); this.deck = null; }
      return;
    }
    if (this.deck && !moved && key === this.deckCenter.key) return;
    if (this.deck) this.scene.primitives.remove(this.deck);
    const half = 0.9;
    const alpha = w.cloudCover >= 4 ? 0.93 : 0.55;
    const g = clamp(day * (w.thunderstorms ? 0.45 : 0.82), 0.04, 0.9);
    this.deck = this.scene.primitives.add(new Primitive({
      geometryInstances: new GeometryInstance({
        geometry: new RectangleGeometry({
          rectangle: Rectangle.fromDegrees(lon - half * 1.5, lat - half, lon + half * 1.5, clamp(lat + half, -89, 89)),
          height: Math.min(w.cloudTopsFt, w.cloudBaseFt + 2500) * FT,
          vertexFormat: EllipsoidSurfaceAppearance.VERTEX_FORMAT,
        }),
      }),
      appearance: new EllipsoidSurfaceAppearance({
        material: Material.fromType('Color', { color: new Color(g, g, g * 1.03, alpha) }),
        translucent: true,
        faceForward: true,
        aboveGround: true,
      }),
      asynchronous: false,
    }));
    this.deckCenter = { lat, lon, key };
  }

  clear() {
    for (const list of this.cells.values()) for (const c of list) this.clouds.remove(c);
    this.cells.clear();
    if (this.deck) { this.scene.primitives.remove(this.deck); this.deck = null; }
  }
}

function hash2(i: number, j: number) {
  let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
