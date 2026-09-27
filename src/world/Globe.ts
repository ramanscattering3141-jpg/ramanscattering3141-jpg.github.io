// Globe: the Cesium viewer, imagery layers with automatic fallback, lighting,
// atmosphere and global rendering settings.
//
// Imagery sources (first reachable one wins, see `imageryCandidates`):
//   1. Cesium ion (Bing Maps aerial) — only if the user supplies a free ion token
//   2. Sentinel-2 cloudless 2016 by EOX — CC BY 4.0, ~10 m/pixel, no key needed
//   3. NASA Blue Marble (GIBS) — public domain, low resolution
//   4. Natural Earth II bundled with Cesium — works fully offline
// Night-side city lights come from NASA's VIIRS "Black Marble" (public domain).

import {
  Viewer, ImageryLayer, UrlTemplateImageryProvider, TileMapServiceImageryProvider, WebMercatorTilingScheme,
  Credit, Ion, IonImageryProvider, buildModuleUrl, Color, JulianDate, ShadowMode, Cartesian3,
  type ImageryProvider, SceneMode, Tonemapper,
} from 'cesium';
import type { TerrariumTerrainProvider } from './TerrainProvider';
import { isMobile, lowMemory } from '../core/device';

export type ImageryChoice = 'auto' | 'ion' | 'sentinel2' | 'bluemarble' | 'offline';

interface Candidate {
  id: Exclude<ImageryChoice, 'auto'>;
  name: string;
  probe?: string;
  create: () => Promise<ImageryProvider>;
}

function candidates(ionToken: string): Candidate[] {
  const list: Candidate[] = [];
  if (ionToken) {
    list.push({
      id: 'ion', name: 'Bing Maps aerial via Cesium ion',
      create: async () => { Ion.defaultAccessToken = ionToken; return IonImageryProvider.fromAssetId(2, {}); },
    });
  }
  list.push({
    id: 'sentinel2',
    name: 'Sentinel-2 cloudless 2016 (EOX)',
    probe: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/1/0/0.jpg',
    create: async () => new UrlTemplateImageryProvider({
      url: 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
      tilingScheme: new WebMercatorTilingScheme(),
      maximumLevel: 15,
      credit: new Credit('<a href="https://s2maps.eu" target="_blank">Sentinel-2 cloudless - https://s2maps.eu</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016 &amp; 2017), CC BY 4.0'),
    }),
  });
  list.push({
    id: 'bluemarble',
    name: 'NASA Blue Marble (GIBS)',
    probe: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/0/0/0.jpeg',
    create: async () => new UrlTemplateImageryProvider({
      url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
      tilingScheme: new WebMercatorTilingScheme(),
      maximumLevel: 8,
      credit: new Credit('Imagery: NASA Blue Marble via <a href="https://earthdata.nasa.gov/gibs" target="_blank">NASA GIBS</a>'),
    }),
  });
  list.push({
    id: 'offline',
    name: 'Natural Earth II (offline, low resolution)',
    create: async () => TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
  });
  return list;
}

/** Loads one image with a timeout to test whether a tile server is reachable. */
function probe(url: string, timeoutMs = 6000): Promise<boolean> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const t = setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

export class Globe {
  readonly viewer: Viewer;
  imageryName = '';
  private baseLayer: ImageryLayer | null = null;
  private nightLayer: ImageryLayer | null = null;

  constructor(container: HTMLElement, terrain: TerrariumTerrainProvider) {
    this.viewer = new Viewer(container, {
      baseLayer: false,
      terrainProvider: terrain as never,
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      shadows: true,
      terrainShadows: ShadowMode.RECEIVE_ONLY,
      sceneMode: SceneMode.SCENE3D,
      requestRenderMode: false,
      msaaSamples: isMobile ? 1 : 4,
    });
    const scene = this.viewer.scene;
    const globe = scene.globe;
    globe.enableLighting = true;
    globe.dynamicAtmosphereLighting = true;
    globe.dynamicAtmosphereLightingFromSun = true;
    globe.showWaterEffect = true;
    globe.depthTestAgainstTerrain = true;
    globe.baseColor = Color.fromCssColorString('#1d3350');
    globe.tileCacheSize = 400;
    globe.preloadAncestors = true;
    globe.preloadSiblings = false;
    globe.maximumScreenSpaceError = 2;
    globe.atmosphereLightIntensity = 12;
    scene.fog.enabled = true;
    scene.fog.density = 1.2e-4;
    scene.fog.minimumBrightness = 0.08;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    scene.highDynamicRange = false;
    scene.postProcessStages.fxaa.enabled = true;
    scene.shadowMap.softShadows = true;
    scene.shadowMap.size = 2048;
    scene.shadowMap.maximumDistance = 2500;
    scene.camera.frustum.near = 0.2;
    (scene.camera.frustum as { fov: number }).fov = (65 * Math.PI) / 180;
    this.viewer.clock.shouldAnimate = true;
    // The simulator drives the camera; disable Cesium's default mouse navigation until
    // a free-camera mode enables it.
    this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    (this.viewer.cesiumWidget.creditContainer as HTMLElement).classList.add('credits');
  }

  /** Chooses and installs the base imagery (with automatic fallback). */
  async setImagery(choice: ImageryChoice, ionToken: string): Promise<string> {
    const list = candidates(ionToken);
    const ordered = choice === 'auto' ? list : [...list.filter(c => c.id === choice), ...list.filter(c => c.id !== choice)];
    for (const c of ordered) {
      try {
        if (c.probe && !(await probe(c.probe))) continue;
        const provider = await c.create();
        const layer = new ImageryLayer(provider, {});
        if (this.baseLayer) this.viewer.imageryLayers.remove(this.baseLayer, true);
        this.viewer.imageryLayers.add(layer, 0);
        this.baseLayer = layer;
        this.imageryName = c.name;
        return c.name;
      } catch (e) {
        console.warn('imagery source failed', c.id, e);
      }
    }
    return 'none';
  }

  /** City lights on the night side (NASA VIIRS Black Marble 2016, public domain). */
  async enableNightLights(on: boolean) {
    if (!on) {
      if (this.nightLayer) this.viewer.imageryLayers.remove(this.nightLayer, true);
      this.nightLayer = null;
      return;
    }
    if (this.nightLayer) return;
    const url = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';
    if (!(await probe(url.replace('{z}/{y}/{x}', '0/0/0')))) return;
    const provider = new UrlTemplateImageryProvider({
      url, tilingScheme: new WebMercatorTilingScheme(), maximumLevel: 8,
      credit: new Credit('City lights: NASA Earth Observatory / VIIRS Black Marble via NASA GIBS'),
    });
    const layer = new ImageryLayer(provider, { dayAlpha: 0, nightAlpha: 0.95, brightness: 1.6 });
    this.viewer.imageryLayers.add(layer);
    this.nightLayer = layer;
  }

  setTime(date: Date) {
    this.viewer.clock.currentTime = JulianDate.fromDate(date);
  }

  get time(): Date {
    return JulianDate.toDate(this.viewer.clock.currentTime);
  }

  /**
   * Graphics quality. Levels 0–3 = low, medium, high, ultra.
   *   terrain  – allowed screen-space error of terrain tiles (lower = sharper)
   *   textures – render resolution (ultra renders at the full device pixel ratio,
   *              which is what makes high-DPI/retina screens look crisp) and tile cache
   *   shadows  – shadow map size and softness
   * High and ultra also turn on HDR lighting with filmic tone mapping; ultra adds
   * screen-space ambient occlusion.
   */
  setQuality(q: { terrain: number; shadows: number; drawDistance: number; textures: number }) {
    const s = this.viewer.scene;
    s.globe.maximumScreenSpaceError = [4, 2.5, 1.6, 1.0][q.terrain] ?? 1.6;
    s.shadowMap.enabled = q.shadows > 0;
    this.viewer.shadows = q.shadows > 0;
    s.shadowMap.size = [1024, 1024, 2048, 4096][q.shadows] ?? 2048;
    s.shadowMap.softShadows = q.shadows >= 2;
    s.globe.tileCacheSize = lowMemory ? 150 : [150, 300, 600, 1000][q.textures] ?? 600;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // Ultra renders at native resolution on high-DPI screens and supersamples 1.5× on
    // standard screens (sharper edges and textures); the governor may trim it back.
    this.targetResolution = isMobile ? Math.min(1, [0.75, 1, 1, 1][q.textures] ?? 1) : [0.75, 1, Math.min(dpr, 1.5), Math.min(2, Math.max(dpr, 1.5))][q.textures] ?? 1;
    this.viewer.resolutionScale = this.targetResolution;
    this.governed = q.textures >= 2 && !isMobile;
    this.viewer.useBrowserRecommendedResolution = q.textures < 2;
    const hdr = q.textures >= 2;
    s.highDynamicRange = hdr;
    if (hdr) s.postProcessStages.tonemapper = Tonemapper.PBR_NEUTRAL;
    s.postProcessStages.fxaa.enabled = true;
    const ao = s.postProcessStages.ambientOcclusion;
    ao.enabled = q.textures >= 3 && !isMobile;
    if (ao.enabled) {
      ao.uniforms.intensity = 2.2;
      ao.uniforms.bias = 0.1;
      ao.uniforms.lengthCap = 0.03;
      ao.uniforms.stepSize = 1;
      ao.uniforms.blurStepSize = 0.86;
    }
    s.msaaSamples = q.textures >= 2 && !isMobile ? 4 : 1;
  }

  targetResolution = 1;
  private governed = false;
  private slowFor = 0;
  private fastFor = 0;

  /**
   * Frame-rate governor for High/Ultra: if the average frame rate stays below ~40 fps
   * the render resolution steps down (never below 1× CSS pixels, or 0.8× on high-DPI),
   * and steps back up toward the target when there is headroom.
   */
  governResolution(fps: number, dt: number) {
    if (!this.governed) return;
    const v = this.viewer;
    const floor = Math.min(1, this.targetResolution) * (window.devicePixelRatio > 1.2 ? 0.8 : 1);
    if (fps < 40) { this.slowFor += dt; this.fastFor = 0; } else if (fps > 57) { this.fastFor += dt; this.slowFor = 0; } else { this.slowFor = 0; this.fastFor = 0; }
    if (this.slowFor > 3 && v.resolutionScale > floor + 0.01) {
      v.resolutionScale = Math.max(floor, v.resolutionScale - 0.15);
      this.slowFor = 0;
    } else if (this.fastFor > 8 && v.resolutionScale < this.targetResolution - 0.01) {
      v.resolutionScale = Math.min(this.targetResolution, v.resolutionScale + 0.1);
      this.fastFor = 0;
    }
  }

  /** Hides the elevation-model globe surface (used when photoreal 3D tiles provide the ground). */
  setGlobeVisible(on: boolean) {
    this.viewer.scene.globe.show = on;
  }

  flyOverview(lat: number, lon: number, heightM: number) {
    this.viewer.camera.flyTo({ destination: Cartesian3.fromDegrees(lon, lat, heightM), duration: 1.5 });
  }
}

