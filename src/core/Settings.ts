// Persistent user settings (localStorage, with graceful fallback when storage
// is unavailable, e.g. private browsing).

import type { ImageryChoice } from '../world/Globe';
import type { Action } from '../input/Input';
import { isMobile } from './device';

export interface Settings {
  realism: 'arcade' | 'realistic' | 'simulation';
  imagery: ImageryChoice;
  ionToken: string;
  terrainQuality: number; // 0..3
  objectDensity: number; // 0..3
  cloudQuality: number; // 0..3
  shadowQuality: number; // 0..3
  textureQuality: number; // 0..3
  drawDistance: number; // 0..3
  trafficDensity: number; // 0..3 (reserved for AI traffic)
  showBorders: boolean;
  showLabels: boolean;
  nightLights: boolean;
  units: 'aviation' | 'metric';
  bindings: Partial<Record<Action, string[]>>;
  controlSensitivity: number;
  sound: boolean;
  /** Google Photorealistic 3D Tiles (needs a Cesium ion token) */
  photoreal3d: boolean;
  graphicsPreset: 'low' | 'medium' | 'high' | 'ultra' | 'custom';
}

export const DEFAULT_SETTINGS: Settings = {
  realism: 'realistic',
  imagery: 'auto',
  ionToken: '',
  terrainQuality: 2,
  objectDensity: 2,
  cloudQuality: 2,
  shadowQuality: 2,
  textureQuality: 2,
  drawDistance: 2,
  trafficDensity: 0,
  showBorders: true,
  showLabels: true,
  nightLights: true,
  units: 'aviation',
  bindings: {},
  controlSensitivity: 1,
  sound: true,
  photoreal3d: true,
  graphicsPreset: 'high',
};

const KEY = 'world-flight-sim.settings.v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* storage unavailable */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch { /* storage unavailable */ }
}

export const GRAPHICS_PRESETS: Record<Exclude<Settings['graphicsPreset'], 'custom'>, Pick<Settings, 'terrainQuality' | 'textureQuality' | 'drawDistance' | 'shadowQuality' | 'cloudQuality' | 'objectDensity'>> = {
  low: { terrainQuality: 0, textureQuality: 0, drawDistance: 0, shadowQuality: 0, cloudQuality: 1, objectDensity: 1 },
  medium: { terrainQuality: 1, textureQuality: 1, drawDistance: 1, shadowQuality: 1, cloudQuality: 2, objectDensity: 2 },
  high: { terrainQuality: 2, textureQuality: 2, drawDistance: 2, shadowQuality: 2, cloudQuality: 2, objectDensity: 2 },
  ultra: { terrainQuality: 3, textureQuality: 3, drawDistance: 3, shadowQuality: 3, cloudQuality: 3, objectDensity: 3 },
};

/** A quick GPU-capability guess used to pick defaults on first run. */
export function autoDetectQuality(s: Settings): Settings {
  if (isMobile) return { ...s, ...GRAPHICS_PRESETS.low, graphicsPreset: 'low', photoreal3d: false };
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const weak = /swiftshader|llvmpipe|software|intel\(r\) (hd|uhd) graphics [2-6]/i.test(renderer) || (navigator.hardwareConcurrency ?? 8) <= 4;
    if (weak) return { ...s, ...GRAPHICS_PRESETS.low, graphicsPreset: 'low' };
    const strong = /rtx|radeon rx|apple m[1-9] (pro|max|ultra)/i.test(renderer);
    if (strong) return { ...s, ...GRAPHICS_PRESETS.ultra, graphicsPreset: 'ultra' };
  } catch { /* ignore */ }
  return s;
}
