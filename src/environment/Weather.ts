// Weather model.
//
// Two ways to set the weather:
//   • A preset or the weather editor sets conditions that apply everywhere.
//   • "Dynamic worldwide" derives conditions from smooth, deterministic noise
//     fields over latitude/longitude/time plus simple climatology (westerlies at
//     mid-latitudes, trade winds in the tropics, colder air towards the poles),
//     so weather varies geographically as you fly. No internet connection is
//     needed. It is procedural — it does NOT represent real observed weather.
//
// Physics consumes wind (with a power-law altitude profile) and Dryden-style
// turbulence; rendering consumes clouds, visibility and precipitation.

import { type Vec3, DEG, clamp, KT, FT } from '../core/math';

export type Precip = 'none' | 'rain' | 'snow';

export interface WeatherSettings {
  preset: string;
  dynamic: boolean;
  windFromDeg: number;
  windKt: number;
  gustKt: number;
  visibilityKm: number;
  /** 0 = clear, 1 = few, 2 = scattered, 3 = broken, 4 = overcast */
  cloudCover: number;
  cloudBaseFt: number;
  cloudTopsFt: number;
  precipitation: Precip;
  precipIntensity: number; // 0..1
  temperatureC: number; // at sea level
  turbulence: number; // 0..1
  thunderstorms: boolean;
}

export const WEATHER_PRESETS: Record<string, Partial<WeatherSettings>> = {
  Clear: { windFromDeg: 270, windKt: 5, gustKt: 0, visibilityKm: 60, cloudCover: 0, precipitation: 'none', precipIntensity: 0, temperatureC: 18, turbulence: 0.05, thunderstorms: false },
  'Few clouds': { windFromDeg: 250, windKt: 8, gustKt: 0, visibilityKm: 40, cloudCover: 1, cloudBaseFt: 4500, cloudTopsFt: 7000, precipitation: 'none', precipIntensity: 0, temperatureC: 17, turbulence: 0.1, thunderstorms: false },
  Scattered: { windFromDeg: 240, windKt: 12, gustKt: 4, visibilityKm: 30, cloudCover: 2, cloudBaseFt: 3500, cloudTopsFt: 8000, precipitation: 'none', precipIntensity: 0, temperatureC: 15, turbulence: 0.2, thunderstorms: false },
  Overcast: { windFromDeg: 220, windKt: 14, gustKt: 6, visibilityKm: 15, cloudCover: 4, cloudBaseFt: 2000, cloudTopsFt: 7000, precipitation: 'none', precipIntensity: 0, temperatureC: 11, turbulence: 0.25, thunderstorms: false },
  Rain: { windFromDeg: 200, windKt: 16, gustKt: 8, visibilityKm: 6, cloudCover: 4, cloudBaseFt: 1400, cloudTopsFt: 12000, precipitation: 'rain', precipIntensity: 0.7, temperatureC: 10, turbulence: 0.35, thunderstorms: false },
  Snow: { windFromDeg: 330, windKt: 12, gustKt: 5, visibilityKm: 3, cloudCover: 4, cloudBaseFt: 1200, cloudTopsFt: 9000, precipitation: 'snow', precipIntensity: 0.7, temperatureC: -6, turbulence: 0.2, thunderstorms: false },
  Fog: { windFromDeg: 0, windKt: 2, gustKt: 0, visibilityKm: 0.4, cloudCover: 4, cloudBaseFt: 200, cloudTopsFt: 1200, precipitation: 'none', precipIntensity: 0, temperatureC: 8, turbulence: 0.02, thunderstorms: false },
  'Strong wind': { windFromDeg: 290, windKt: 30, gustKt: 15, visibilityKm: 40, cloudCover: 2, cloudBaseFt: 4000, cloudTopsFt: 7000, precipitation: 'none', precipIntensity: 0, temperatureC: 12, turbulence: 0.6, thunderstorms: false },
  Thunderstorm: { windFromDeg: 230, windKt: 20, gustKt: 20, visibilityKm: 4, cloudCover: 4, cloudBaseFt: 2500, cloudTopsFt: 35000, precipitation: 'rain', precipIntensity: 1, temperatureC: 26, turbulence: 0.9, thunderstorms: true },
};

export function defaultWeather(): WeatherSettings {
  return { preset: 'Few clouds', dynamic: false, windFromDeg: 250, windKt: 8, gustKt: 0, visibilityKm: 40, cloudCover: 1, cloudBaseFt: 4500, cloudTopsFt: 7000, precipitation: 'none', precipIntensity: 0, temperatureC: 17, turbulence: 0.1, thunderstorms: false };
}

export function applyPreset(ws: WeatherSettings, name: string): WeatherSettings {
  return { ...ws, ...WEATHER_PRESETS[name], preset: name, dynamic: name === 'Dynamic worldwide' };
}

/** Local conditions at a point. */
export interface LocalWeather {
  windFromDeg: number;
  windKt: number;
  gustKt: number;
  visibilityKm: number;
  cloudCover: number;
  cloudBaseFt: number;
  cloudTopsFt: number;
  precipitation: Precip;
  precipIntensity: number;
  temperatureC: number;
  turbulence: number;
  thunderstorms: boolean;
}

// --- smooth value noise on the sphere (deterministic) -------------------------
function hash(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  let r = 0;
  for (let dx = 0; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) for (let dz = 0; dz <= 1; dz++) {
    r += hash(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  }
  return r;
}
/** Fractal noise sampled on the unit sphere so there is no seam at ±180° or the poles. */
function sphereNoise(lat: number, lon: number, scale: number, t: number, seed: number) {
  const x = Math.cos(lat * DEG) * Math.cos(lon * DEG), y = Math.cos(lat * DEG) * Math.sin(lon * DEG), z = Math.sin(lat * DEG);
  let v = 0, amp = 0.6, f = scale;
  for (let o = 0; o < 3; o++) {
    v += amp * noise3(x * f + seed * 17.1 + t, y * f + seed * 3.7, z * f - t * 0.5);
    amp *= 0.5; f *= 2.1;
  }
  return v / 0.95;
}

export class Weather {
  settings: WeatherSettings = defaultWeather();
  /** Turbulence state (m/s, ENU) — first-order Gauss-Markov (Dryden-like) filters. */
  private gust: Vec3 = [0, 0, 0];
  private gustPhase = 0;
  /** Seconds since weather start: dynamic weather slowly evolves. */
  time = 0;
  private cacheKey = '';
  private cache: LocalWeather | null = null;

  set(s: WeatherSettings) {
    this.settings = { ...s };
    this.cacheKey = '';
  }

  /** Conditions at a location (cached per ~0.1°). */
  at(lat: number, lon: number): LocalWeather {
    const key = `${lat.toFixed(1)},${lon.toFixed(1)},${Math.floor(this.time / 60)}`;
    if (key === this.cacheKey && this.cache) return this.cache;
    this.cacheKey = key;
    this.cache = this.settings.dynamic ? this.dynamicAt(lat, lon) : { ...this.settings };
    return this.cache;
  }

  private dynamicAt(lat: number, lon: number): LocalWeather {
    const t = this.time / 7200; // evolves over hours
    const moist = sphereNoise(lat, lon, 3.2, t, 1);
    const storm = sphereNoise(lat, lon, 7.5, t * 1.5, 2);
    const windN = sphereNoise(lat, lon, 2.4, t, 3);
    const alat = Math.abs(lat);
    // Climatological surface temperature: warm tropics, cold poles.
    const temp = 28 - 0.0095 * alat * alat - 0.001 * alat * alat * (Math.sign(lat) < 0 ? 0.3 : 0) + (sphereNoise(lat, lon, 4, t, 4) - 0.5) * 12;
    // Prevailing winds: trades (from east) < 30°, westerlies 30–60°, polar easterlies beyond.
    const band = alat < 30 ? 80 : alat < 60 ? 260 : 60;
    const windFrom = (band + (windN - 0.5) * 140 + (lat < 0 && alat < 30 ? 30 : 0) + 360) % 360;
    const windKt = clamp(4 + (alat > 30 && alat < 60 ? 10 : 4) + (windN - 0.3) * 22, 0, 40);
    const cover = moist < 0.35 ? 0 : moist < 0.45 ? 1 : moist < 0.55 ? 2 : moist < 0.65 ? 3 : 4;
    const precip = moist > 0.66 ? (temp < 1 ? 'snow' : 'rain') : 'none';
    const tstorm = storm > 0.78 && temp > 18 && moist > 0.55;
    return {
      windFromDeg: windFrom,
      windKt,
      gustKt: tstorm ? 18 : windKt > 18 ? 8 : 0,
      visibilityKm: precip !== 'none' ? (precip === 'snow' ? 3 : 7) : moist > 0.6 ? 18 : 45,
      cloudCover: tstorm ? 4 : cover,
      cloudBaseFt: 1500 + (1 - moist) * 5000,
      cloudTopsFt: tstorm ? 38000 : 5000 + moist * 9000,
      precipitation: precip as Precip,
      precipIntensity: precip === 'none' ? 0 : clamp((moist - 0.66) * 4, 0.2, 1),
      temperatureC: temp,
      turbulence: clamp(0.08 + (tstorm ? 0.8 : 0) + windKt / 80, 0, 1),
      thunderstorms: tstorm,
    };
  }

  /** ISA deviation (K) implied by the local sea-level temperature. */
  deltaT(lat: number, lon: number) {
    return this.at(lat, lon).temperatureC - 15;
  }

  /**
   * Advances turbulence and returns total wind (ENU m/s, direction air moves to)
   * at a location/altitude. Mean wind grows with height (power-law profile) and
   * turns into a strong westerly jet at jet-stream altitudes in dynamic mode.
   */
  wind(lat: number, lon: number, altM: number, aglM: number, dt: number, tasMs: number, turbScale: number): Vec3 {
    const w = this.at(lat, lon);
    const hRef = 10;
    const profile = Math.pow(Math.max(aglM, 1) / hRef, 0.14);
    let spd = w.windKt * KT * clamp(profile, 0.3, 2.2);
    let from = w.windFromDeg;
    if (this.settings.dynamic && altM > 20000 * FT) {
      const jet = clamp((altM - 20000 * FT) / (15000 * FT), 0, 1) * (Math.abs(lat) > 25 && Math.abs(lat) < 60 ? 45 : 15) * KT;
      spd = spd * (1 - 0.5 * jet / (jet + 1)) + jet;
      from = from + (270 - from) * clamp(jet / (40 * KT), 0, 0.8);
    }
    const toRad = (from + 180) * DEG;
    const mean: Vec3 = [Math.sin(toRad) * spd, Math.cos(toRad) * spd, 0];

    // Turbulence: σ grows with setting, lower near the ground (surface roughness) and in cloud.
    const inCloud = w.cloudCover >= 3 && altM > w.cloudBaseFt * FT && altM < w.cloudTopsFt * FT;
    const sigma = (w.turbulence * 2.6 + (inCloud ? 0.8 : 0) + (w.thunderstorms && inCloud ? 3 : 0)) * turbScale;
    const V = Math.max(tasMs, 20);
    const Lu = altM < 300 ? Math.max(30, altM * 2) : 530;
    const a = Math.exp(-(V / Lu) * dt);
    const k = sigma * Math.sqrt(1 - a * a);
    const rnd = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;
    this.gust = [a * this.gust[0] + k * rnd(), a * this.gust[1] + k * rnd(), a * this.gust[2] + k * 0.7 * rnd()];
    // Gusts: slow periodic surges on top of the mean wind.
    this.gustPhase += dt;
    const gust = w.gustKt * KT * Math.max(0, Math.sin(this.gustPhase * 0.35) * Math.sin(this.gustPhase * 0.13 + 1)) * clamp(profile, 0.3, 1.5);
    const dir: Vec3 = spd > 0.1 ? [mean[0] / spd, mean[1] / spd, 0] : [0, 0, 0];
    const vertDamp = clamp(aglM / 150, 0, 1); // no vertical gusts into the runway
    return [mean[0] + this.gust[0] + dir[0] * gust, mean[1] + this.gust[1] + dir[1] * gust, this.gust[2] * vertDamp];
  }
}
