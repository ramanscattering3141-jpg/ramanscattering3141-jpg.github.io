// Persistent user settings (localStorage, with graceful fallback when storage
// is unavailable, e.g. private browsing).

import type { ImageryChoice } from '../world/Globe';
import type { Action } from '../input/Input';

export interface Settings {
  realism: 'arcade' | 'realistic' | 'simulation';
  imagery: ImageryChoice;
  ionToken: string;
  terrainQuality: number; // 0..2
  objectDensity: number; // 0..3
  cloudQuality: number; // 0..3
  shadowQuality: number; // 0..3
  textureQuality: number; // 0..2
  drawDistance: number; // 0..2
  trafficDensity: number; // 0..3 (reserved for AI traffic)
  showBorders: boolean;
  showLabels: boolean;
  nightLights: boolean;
  units: 'aviation' | 'metric';
  bindings: Partial<Record<Action, string[]>>;
  controlSensitivity: number;
}

export const DEFAULT_SETTINGS: Settings = {
  realism: 'realistic',
  imagery: 'auto',
  ionToken: '',
  terrainQuality: 1,
  objectDensity: 2,
  cloudQuality: 2,
  shadowQuality: 2,
  textureQuality: 1,
  drawDistance: 1,
  trafficDensity: 0,
  showBorders: true,
  showLabels: true,
  nightLights: true,
  units: 'aviation',
  bindings: {},
  controlSensitivity: 1,
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

/** A quick GPU-capability guess used to pick defaults on first run. */
export function autoDetectQuality(s: Settings): Settings {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg ? String(gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    const weak = /swiftshader|llvmpipe|software|intel\(r\) (hd|uhd) graphics [2-6]/i.test(renderer) || (navigator.hardwareConcurrency ?? 8) <= 4;
    if (weak) return { ...s, terrainQuality: 0, shadowQuality: 0, cloudQuality: 1, objectDensity: 1, textureQuality: 0, drawDistance: 0 };
  } catch { /* ignore */ }
  return s;
}
