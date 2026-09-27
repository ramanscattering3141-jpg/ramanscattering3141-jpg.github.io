// Settings dialog: graphics quality, imagery source, controls (key rebinding),
// overlays and default realism. Every control applies immediately.

import { h, clear } from './dom';
import { DEFAULT_SETTINGS, saveSettings, type Settings } from '../core/Settings';
import { ACTION_LABELS, DEFAULT_BINDINGS, prettyKey, type Action, type Input } from '../input/Input';

export class SettingsUI {
  root: HTMLElement;
  private card: HTMLElement;
  private tab: 'graphics' | 'imagery' | 'controls' | 'general' = 'graphics';

  constructor(parent: HTMLElement, private settings: Settings, private input: Input, private apply: (s: Settings, changed: keyof Settings) => void) {
    this.card = h('div', { class: 'card wide' });
    this.root = h('div', { class: 'overlay modal hidden' }, this.card);
    this.root.addEventListener('click', e => { if (e.target === this.root) this.close(); });
    parent.append(this.root);
  }

  open() {
    this.render();
    this.root.classList.remove('hidden');
  }

  close() {
    this.root.classList.add('hidden');
    this.input.captureNext = null;
  }

  get isOpen() {
    return !this.root.classList.contains('hidden');
  }

  private set<K extends keyof Settings>(k: K, v: Settings[K]) {
    this.settings[k] = v;
    saveSettings(this.settings);
    this.apply(this.settings, k);
  }

  private render() {
    clear(this.card);
    const s = this.settings;
    const tabs = h('div', { class: 'tabs' }, ...(['graphics', 'imagery', 'controls', 'general'] as const).map(t =>
      h('button', { class: `tab ${t === this.tab ? 'on' : ''}`, onclick: () => { this.tab = t; this.render(); } }, t[0].toUpperCase() + t.slice(1))));
    const body = h('div', { class: 'settings-body' });
    const level = (label: string, key: keyof Settings, names: string[], hint = '') => h('label', { class: 'field' }, h('span', {}, label),
      h('select', { onchange: e => this.set(key, +(e.target as HTMLSelectElement).value as never) }, ...names.map((n, i) => h('option', { value: i, selected: s[key] === i }, n))),
      hint ? h('small', { class: 'muted' }, hint) : '');
    const toggle = (label: string, key: keyof Settings) => h('label', { class: 'check' },
      h('input', { type: 'checkbox', checked: !!s[key], onchange: e => this.set(key, (e.target as HTMLInputElement).checked as never) }), ` ${label}`);

    if (this.tab === 'graphics') {
      body.append(
        h('div', { class: 'row2' },
          level('Terrain quality', 'terrainQuality', ['Low', 'Medium', 'High'], 'Terrain detail vs. distance (level of detail).'),
          level('Texture quality', 'textureQuality', ['Low', 'Medium', 'High'], 'Tile cache size and render resolution.'),
          level('Draw distance', 'drawDistance', ['Short', 'Medium', 'Far'], 'Distance fog density.'),
          level('Shadow quality', 'shadowQuality', ['Off', 'Low', 'Medium', 'High']),
          level('Cloud quality', 'cloudQuality', ['Off', 'Low', 'Medium', 'High'], 'Number and radius of 3D clouds.'),
          level('Object density (cities)', 'objectDensity', ['Off', 'Low', 'Medium', 'High'], 'Procedural city buildings.'),
        ),
        h('p', { class: 'muted small' }, 'Tip: on laptops or integrated graphics use Low/Medium terrain and shadows off for a steady frame rate. AI traffic is not implemented yet, so there is no traffic density setting.'),
      );
    } else if (this.tab === 'imagery') {
      const tokenInput = h('input', { type: 'password', value: s.ionToken, placeholder: 'Paste a Cesium ion access token (optional)', onchange: e => this.set('ionToken', (e.target as HTMLInputElement).value.trim()) });
      body.append(
        h('label', { class: 'field' }, h('span', {}, 'Satellite imagery'),
          h('select', { onchange: e => this.set('imagery', (e.target as HTMLSelectElement).value as Settings['imagery']) },
            ...([['auto', 'Automatic (best available)'], ['ion', 'Bing Maps aerial via Cesium ion (needs token)'], ['sentinel2', 'Sentinel-2 cloudless 2016 (EOX, 10 m)'], ['bluemarble', 'NASA Blue Marble (low resolution)'], ['offline', 'Offline Natural Earth (lowest)']] as const)
              .map(([v, n]) => h('option', { value: v, selected: s.imagery === v }, n)))),
        h('label', { class: 'field' }, h('span', {}, 'Cesium ion token'), tokenInput,
          h('small', { class: 'muted' }, 'Optional. A free account at cesium.com/ion gives sharper Bing Maps aerial imagery. The token is stored only in this browser.')),
        toggle('City lights at night (NASA Black Marble)', 'nightLights'),
      );
    } else if (this.tab === 'controls') {
      const table = h('table', { class: 'bindings' });
      for (const a of Object.keys(ACTION_LABELS) as Action[]) {
        const keys = this.input.bindings[a];
        const btn = h('button', { class: 'chip small' }, keys.length ? keys.map(prettyKey).join(' / ') : '—');
        btn.addEventListener('click', () => {
          btn.textContent = 'Press a key…';
          this.input.captureNext = combo => {
            this.input.bindings[a] = [combo, ...keys.filter(k => k !== combo)].slice(0, 2);
            this.set('bindings', { ...this.input.bindings });
            this.render();
          };
        });
        table.append(h('tr', {}, h('td', {}, ACTION_LABELS[a]), h('td', {}, btn)));
      }
      body.append(
        h('label', { class: 'field' }, h('span', {}, `Control sensitivity (${s.controlSensitivity.toFixed(2)})`),
          h('input', { type: 'range', min: 0.4, max: 1.5, step: 0.05, value: s.controlSensitivity, onchange: e => { this.set('controlSensitivity', +(e.target as HTMLInputElement).value); this.render(); } })),
        h('p', { class: 'muted small' }, 'Click a binding, then press the new key (modifiers like Shift are allowed). The new key replaces the primary binding.'),
        table,
        h('button', { class: 'btn', onclick: () => { this.input.bindings = { ...DEFAULT_BINDINGS }; this.set('bindings', {}); this.render(); } }, 'Reset to defaults'),
        h('p', { class: 'muted small' }, this.input.gamepadName ? `Gamepad detected: ${this.input.gamepadName}` : 'No gamepad detected — press a button on your controller to activate it.'),
      );
    } else {
      body.append(
        h('label', { class: 'field' }, h('span', {}, 'Default realism'),
          h('select', { onchange: e => this.set('realism', (e.target as HTMLSelectElement).value as Settings['realism']) },
            ...([['arcade', 'Arcade — auto-rudder, auto-trim, stall protection, no fuel burn'], ['realistic', 'Realistic — real fuel burn, engine start, auto-rudder in the air'], ['simulation', 'Simulation — no assists, strict gear and overspeed limits']] as const)
              .map(([v, n]) => h('option', { value: v, selected: s.realism === v }, n)))),
        toggle('Country borders', 'showBorders'),
        toggle('City & airport labels', 'showLabels'),
        h('button', { class: 'btn', onclick: () => { Object.assign(s, { ...DEFAULT_SETTINGS, bindings: s.bindings, ionToken: s.ionToken }); saveSettings(s); (Object.keys(s) as (keyof Settings)[]).forEach(k => this.apply(s, k)); this.render(); } }, 'Restore default settings'),
      );
    }
    this.card.append(h('div', { class: 'card-head' }, h('h2', {}, 'Settings'), h('button', { class: 'chip', onclick: () => this.close() }, 'Close')), tabs, body);
  }
}
