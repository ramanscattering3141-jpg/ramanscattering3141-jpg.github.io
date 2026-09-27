// Google Photorealistic 3D Tiles (streamed via Cesium ion): photogrammetry of
// cities, airports and landscapes worldwide.
//
// Height alignment: the tiles use true WGS84 ellipsoid heights, while the rest of
// the simulator (terrain, runways, physics) works in metres above mean sea level.
// The difference is the geoid undulation N (e.g. −32 m at New York, −99 m in
// southern India). We shift the whole tileset by −N along the local vertical at
// the area being viewed, re-centring as you travel, so the scans sit on our MSL
// frame without touching the flight model's coordinates.
//
// Ground contact: the scanned surface can differ from the elevation model by a
// few metres, so near the ground we measure the rendered tile height under the
// aircraft each frame and pass a smoothed correction to the flight model.

import {
  CustomShader, UniformType, LightingModel,
  Cesium3DTileset, createGooglePhotorealistic3DTileset, Cartesian3, Cartographic, Matrix4, Ellipsoid, type Scene,
} from 'cesium';
import { geoidUndulation, geoidReady } from '../core/Geoid';
import { lowMemory } from '../core/device';
import { distance } from '../core/geodesy';
import { clamp } from '../core/math';

export class Photoreal3D {
  tileset: Cesium3DTileset | null = null;
  enabled = false;
  failed = '';
  private shiftCenter = { lat: 999, lon: 999 };
  private loading: Promise<boolean> | null = null;
  /** Smoothed (scanned surface − elevation model) height difference under the aircraft (m) */
  groundCorrection = 0;
  private correctionAge = Infinity;

  /**
   * The scans are photographs with daylight baked in (unlit materials), so they would
   * glow at night. This shader scales them by a daylight factor and warms them at dusk.
   */
  private shader = new CustomShader({
    lightingModel: LightingModel.UNLIT,
    uniforms: {
      u_daylight: { type: UniformType.FLOAT, value: 1 },
      u_warmth: { type: UniformType.FLOAT, value: 0 },
    },
    fragmentShaderText: `
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        vec3 c = material.diffuse * u_daylight;
        c *= mix(vec3(1.0), vec3(1.12, 0.9, 0.72), u_warmth);
        material.diffuse = c;
      }`,
  });

  constructor(private scene: Scene) {}

  /** Sun elevation (deg) → brightness of the baked-in photo lighting. */
  setSunElevation(deg: number) {
    const day = clamp((deg + 8) / 14, 0.035, 1);
    const warm = clamp(1 - Math.abs(deg - 2) / 10, 0, 1) * 0.7;
    this.shader.setUniform('u_daylight', day);
    this.shader.setUniform('u_warmth', warm);
  }

  /** Loads the tileset (once). Resolves false if unavailable (no token, quota, network). */
  load(maxSse: number): Promise<boolean> {
    if (!this.loading) {
      this.loading = createGooglePhotorealistic3DTileset(undefined, {
        maximumScreenSpaceError: maxSse,
        // Keep memory in check on a long flight and load what the camera needs first.
        // Browsers kill tabs that use too much memory (mobile Safari especially), so keep the cache modest.
        cacheBytes: (lowMemory ? 96 : 384) * 1024 * 1024,
        maximumCacheOverflowBytes: (lowMemory ? 32 : 192) * 1024 * 1024,
        foveatedScreenSpaceError: true,
        dynamicScreenSpaceError: true,
        skipLevelOfDetail: false,
        showCreditsOnScreen: true,
      })
        .then(ts => {
          this.tileset = ts;
          ts.show = false;
          ts.customShader = this.shader;
          this.scene.primitives.add(ts);
          return true;
        })
        .catch(e => {
          this.failed = String(e?.message ?? e);
          console.warn('Google Photorealistic 3D Tiles unavailable:', e);
          return false;
        });
    }
    return this.loading;
  }

  setShow(on: boolean) {
    this.enabled = on;
    if (this.tileset) this.tileset.show = on;
    this.groundCorrection = 0;
    this.correctionAge = Infinity;
  }

  get active() {
    return this.enabled && !!this.tileset;
  }

  setQuality(maxSse: number) {
    if (this.tileset) this.tileset.maximumScreenSpaceError = maxSse;
  }

  /** Re-centres the geoid shift on the area being viewed (cheap; only when moved > 40 km). */
  updateShift(lat: number, lon: number) {
    if (!this.tileset || !geoidReady()) return;
    if (distance(lat, lon, this.shiftCenter.lat, this.shiftCenter.lon) < 40000) return;
    this.shiftCenter = { lat, lon };
    const n = geoidUndulation(lat, lon);
    const up = Ellipsoid.WGS84.geodeticSurfaceNormal(Cartesian3.fromDegrees(lon, lat, 0), new Cartesian3());
    const shift = Cartesian3.multiplyByScalar(up, -n, new Cartesian3());
    this.tileset.modelMatrix = Matrix4.fromTranslation(shift);
  }

  /**
   * Samples the rendered scanned surface under the aircraft and updates the
   * smoothed correction relative to the elevation model. Call once per frame.
   */
  updateGround(dt: number, lat: number, lon: number, demHeight: number | null, aglM: number, exclude: object[]) {
    if (!this.active || demHeight === null || aglM > 600 || !this.scene.sampleHeightSupported) {
      this.correctionAge += dt;
      if (this.correctionAge > 3) this.groundCorrection *= Math.max(0, 1 - dt);
      return;
    }
    let h: number | undefined;
    try {
      h = this.scene.sampleHeight(Cartographic.fromDegrees(lon, lat), exclude, 0.5);
    } catch {
      h = undefined;
    }
    if (h === undefined || !isFinite(h)) { this.correctionAge += dt; return; }
    // Ignore implausible hits (a building roof, a bridge above us, a cloud).
    const target = clamp(h - demHeight, -30, 30);
    if (Math.abs(h - demHeight) > 40) { this.correctionAge += dt; return; }
    const k = Math.min(1, dt * (this.correctionAge > 2 ? 0.8 : 2.5));
    this.groundCorrection += (target - this.groundCorrection) * k;
    this.correctionAge = 0;
  }
}
