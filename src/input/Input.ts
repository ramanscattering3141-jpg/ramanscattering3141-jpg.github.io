// Keyboard, mouse-yoke and gamepad input with user-configurable key bindings.
//
// Continuous controls (pitch/roll/yaw) ramp toward full deflection while a key
// is held and spring back when released, like a self-centring yoke. Throttle
// and trim move at a steady rate. Discrete actions fire on key press.

import { clamp, approach } from '../core/math';

export type AxisAction = 'pitchDown' | 'pitchUp' | 'rollLeft' | 'rollRight' | 'yawLeft' | 'yawRight' | 'throttleUp' | 'throttleDown' | 'trimDown' | 'trimUp' | 'brakes';
export type TriggerAction =
  | 'throttleFull' | 'throttleIdle' | 'reverse' | 'flapsDown' | 'flapsUp' | 'gear' | 'parkingBrake' | 'spoilers' | 'engines'
  | 'apToggle' | 'athrToggle' | 'camNext' | 'camCockpit' | 'camChase' | 'camWing' | 'camFree' | 'camTower'
  | 'pause' | 'hud' | 'panel' | 'map' | 'help' | 'simRateUp' | 'simRateDown' | 'mouseYoke' | 'lookReset';
export type Action = AxisAction | TriggerAction;

export const ACTION_LABELS: Record<Action, string> = {
  pitchDown: 'Pitch down (nose down)', pitchUp: 'Pitch up (nose up)', rollLeft: 'Roll left', rollRight: 'Roll right',
  yawLeft: 'Rudder left', yawRight: 'Rudder right', throttleUp: 'Throttle increase', throttleDown: 'Throttle decrease',
  trimDown: 'Elevator trim nose down', trimUp: 'Elevator trim nose up', brakes: 'Wheel brakes (hold)',
  throttleFull: 'Throttle full', throttleIdle: 'Throttle idle', reverse: 'Reverse thrust (on ground)',
  flapsDown: 'Flaps extend one step', flapsUp: 'Flaps retract one step', gear: 'Landing gear up/down',
  parkingBrake: 'Parking brake', spoilers: 'Spoilers / speed brake', engines: 'Engine start / shutdown',
  apToggle: 'Autopilot on/off', athrToggle: 'Autothrottle on/off',
  camNext: 'Next camera', camCockpit: 'Cockpit camera', camChase: 'Chase camera', camWing: 'Wing camera', camFree: 'Free camera', camTower: 'Tower camera',
  pause: 'Pause menu', hud: 'Show/hide HUD', panel: 'Show/hide instrument panel', map: 'Show/hide map', help: 'Controls help',
  simRateUp: 'Simulation rate faster', simRateDown: 'Simulation rate slower', mouseYoke: 'Mouse yoke on/off', lookReset: 'Reset view',
};

export const DEFAULT_BINDINGS: Record<Action, string[]> = {
  pitchDown: ['ArrowUp', 'KeyW'], pitchUp: ['ArrowDown', 'KeyS'], rollLeft: ['ArrowLeft', 'KeyA'], rollRight: ['ArrowRight', 'KeyD'],
  yawLeft: ['KeyZ'], yawRight: ['KeyX'], throttleUp: ['KeyR', 'PageUp'], throttleDown: ['KeyF', 'PageDown'],
  trimDown: ['Home', 'Shift+ArrowUp'], trimUp: ['End', 'Shift+ArrowDown'], brakes: ['KeyB', 'Period'],
  throttleFull: ['Shift+KeyR'], throttleIdle: ['Shift+KeyF'], reverse: ['KeyV'],
  flapsDown: ['BracketRight'], flapsUp: ['BracketLeft'], gear: ['KeyG'], parkingBrake: ['KeyP'], spoilers: ['Slash'], engines: ['KeyE'],
  apToggle: ['KeyQ'], athrToggle: ['Shift+KeyQ'],
  camNext: ['KeyC'], camCockpit: ['Digit1'], camChase: ['Digit2'], camWing: ['Digit3'], camFree: ['Digit4'], camTower: ['Digit5'],
  pause: ['Escape'], hud: ['KeyI'], panel: ['KeyO'], map: ['KeyM'], help: ['KeyH'],
  simRateUp: ['Equal', 'NumpadAdd'], simRateDown: ['Minus', 'NumpadSubtract'], mouseYoke: ['KeyY'], lookReset: ['KeyL'],
};

const AXES: AxisAction[] = ['pitchDown', 'pitchUp', 'rollLeft', 'rollRight', 'yawLeft', 'yawRight', 'throttleUp', 'throttleDown', 'trimDown', 'trimUp', 'brakes'];

export function comboFromEvent(e: KeyboardEvent) {
  const mods = [e.ctrlKey ? 'Ctrl' : '', e.altKey ? 'Alt' : '', e.shiftKey ? 'Shift' : ''].filter(Boolean);
  return [...mods, e.code].join('+');
}

export function prettyKey(combo: string) {
  return combo
    .replace(/Key([A-Z])/g, '$1').replace(/Digit(\d)/g, '$1').replace('Arrow', '')
    .replace('BracketRight', ']').replace('BracketLeft', '[').replace('Slash', '/').replace('Period', '.')
    .replace('Equal', '=').replace('Minus', '−').replace('Escape', 'Esc').replace('NumpadAdd', 'Num +').replace('NumpadSubtract', 'Num −');
}

export interface AxisState {
  pitch: number; // + nose up
  roll: number; // + right
  yaw: number; // + right
  throttleRate: number; // per second
  trimRate: number;
  brakes: number;
  /** Absolute throttle from a gamepad trigger/axis, if in use */
  throttleAbs: number | null;
}

export class Input {
  bindings: Record<Action, string[]>;
  private held = new Set<string>();
  private listeners: ((a: TriggerAction) => void)[] = [];
  axes: AxisState = { pitch: 0, roll: 0, yaw: 0, throttleRate: 0, trimRate: 0, brakes: 0, throttleAbs: null };
  mouseYoke = false;
  private mouse = { x: 0, y: 0 };
  gamepadName = '';
  enabled = true;
  /** When set, the next key press is captured for rebinding. */
  captureNext: ((combo: string) => void) | null = null;
  private prevButtons: boolean[] = [];

  constructor(saved?: Partial<Record<Action, string[]>>) {
    this.bindings = { ...DEFAULT_BINDINGS, ...(saved ?? {}) };
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
    window.addEventListener('blur', () => this.held.clear());
    window.addEventListener('mousemove', e => {
      this.mouse = { x: (e.clientX / window.innerWidth) * 2 - 1, y: (e.clientY / window.innerHeight) * 2 - 1 };
    });
    window.addEventListener('gamepadconnected', e => { this.gamepadName = (e as GamepadEvent).gamepad.id; });
    window.addEventListener('gamepaddisconnected', () => { this.gamepadName = ''; });
  }

  on(fn: (a: TriggerAction) => void) {
    this.listeners.push(fn);
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
    if (this.captureNext && down) {
      e.preventDefault();
      if (!['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight'].includes(e.code)) {
        const cb = this.captureNext;
        this.captureNext = null;
        cb(comboFromEvent(e));
      }
      return;
    }
    const combo = comboFromEvent(e);
    if (!down) {
      // Release every held combo that uses this physical key.
      for (const h of [...this.held]) if (h.endsWith(e.code)) this.held.delete(h);
      return;
    }
    const actions = this.actionsFor(combo);
    if (actions.length || this.isBound(e.code)) e.preventDefault();
    if (!this.enabled && !actions.includes('pause')) return;
    this.held.add(combo);
    if (e.repeat) return;
    for (const a of actions) if (!AXES.includes(a as AxisAction)) this.listeners.forEach(l => l(a as TriggerAction));
  }

  private isBound(code: string) {
    return Object.values(this.bindings).some(list => list.some(c => c === code));
  }

  private actionsFor(combo: string): Action[] {
    return (Object.keys(this.bindings) as Action[]).filter(a => this.bindings[a].includes(combo));
  }

  private axisHeld(a: AxisAction) {
    return this.bindings[a].some(c => this.held.has(c));
  }

  /** Updates continuous axes; call once per rendered frame. */
  update(dt: number, sensitivity = 1) {
    const ax = this.axes;
    const target = (neg: AxisAction, pos: AxisAction) => (this.axisHeld(pos) ? 1 : 0) - (this.axisHeld(neg) ? 1 : 0);
    const tp = target('pitchDown', 'pitchUp') * sensitivity;
    const tr = target('rollLeft', 'rollRight') * sensitivity;
    const ty = target('yawLeft', 'yawRight');
    // Ramp toward the key target (≈0.35 s to full), springing back when released.
    ax.pitch = approach(ax.pitch, tp, tp === 0 ? 4 : 2.4, dt);
    ax.roll = approach(ax.roll, tr, tr === 0 ? 5 : 3, dt);
    ax.yaw = approach(ax.yaw, ty, ty === 0 ? 4 : 2.5, dt);
    ax.throttleRate = target('throttleDown', 'throttleUp') * 0.45;
    ax.trimRate = target('trimDown', 'trimUp') * 0.3;
    ax.brakes = this.axisHeld('brakes') ? 1 : 0;
    ax.throttleAbs = null;

    if (this.mouseYoke) {
      ax.roll = clamp(this.mouse.x * 1.4, -1, 1);
      ax.pitch = clamp(this.mouse.y * 1.4, -1, 1);
    }
    this.pollGamepad(dt);
  }

  private pollGamepad(dt: number) {
    const pads = navigator.getGamepads?.() ?? [];
    const gp = [...pads].find(p => p && p.connected);
    if (!gp) return;
    this.gamepadName = gp.id;
    const dz = (v: number) => (Math.abs(v) < 0.08 ? 0 : (v - Math.sign(v) * 0.08) / 0.92);
    const ax = this.axes;
    const lx = dz(gp.axes[0] ?? 0), ly = dz(gp.axes[1] ?? 0), rx = dz(gp.axes[2] ?? 0);
    // Expo curve for finer control near centre.
    const expo = (v: number) => Math.sign(v) * (0.35 * Math.abs(v) + 0.65 * v * v);
    if (lx) ax.roll = expo(lx);
    if (ly) ax.pitch = expo(ly); // stick back (+y) = nose up
    if (rx) ax.yaw = rx;
    const b = (i: number) => !!gp.buttons[i]?.pressed;
    const val = (i: number) => gp.buttons[i]?.value ?? 0;
    const rt = val(7), lt = val(6);
    if (rt > 0.05 || lt > 0.05) ax.throttleRate = (rt - lt) * 0.6;
    if (b(0)) ax.brakes = 1;
    if (b(4)) ax.trimRate = -0.3;
    if (b(5)) ax.trimRate = 0.3;
    const map: [number, TriggerAction][] = [[1, 'flapsDown'], [2, 'flapsUp'], [3, 'camNext'], [8, 'apToggle'], [9, 'pause'], [12, 'gear'], [13, 'spoilers'], [14, 'parkingBrake'], [15, 'reverse']];
    for (const [i, action] of map) {
      const now = b(i);
      if (now && !this.prevButtons[i]) this.listeners.forEach(l => l(action));
      this.prevButtons[i] = now;
    }
    void dt;
  }
}
