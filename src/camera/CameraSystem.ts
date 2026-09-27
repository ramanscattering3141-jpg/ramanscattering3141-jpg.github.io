// Camera modes: cockpit, chase, wing, free (orbit/inspect) and tower.
// Switching blends smoothly from the previous camera pose over ~0.8 s.

import { Cartesian3, Matrix4, Transforms, HeadingPitchRange, type Camera, type Scene, PerspectiveFrustum } from 'cesium';
import type { AircraftDefinition } from '../aircraft/types';
import { type Vec3, type Quat, qToMat, mulMV, add, scale, norm, sub, cross, dot, clamp, lerp, DEG } from '../core/math';
import { ecefToGeodetic, enuBasis, geodeticToEcef, destination, distance, bearing } from '../core/geodesy';

export type CameraMode = 'cockpit' | 'chase' | 'wing' | 'free' | 'tower';
export const CAMERA_MODES: CameraMode[] = ['cockpit', 'chase', 'wing', 'free', 'tower'];
export const CAMERA_LABELS: Record<CameraMode, string> = { cockpit: 'Cockpit', chase: 'Chase', wing: 'Wing', free: 'Free', tower: 'Tower' };

interface Pose { pos: Vec3; dir: Vec3; up: Vec3 }

export class CameraSystem {
  mode: CameraMode = 'chase';
  /** Look-around offsets (deg) used by cockpit & chase views */
  lookYaw = 0;
  lookPitch = 0;
  chaseZoom = 1;
  fovDeg = 65;
  private blendFrom: Pose | null = null;
  private blendT = 1;
  private chasePos: Vec3 | null = null;
  private tower: { lat: number; lon: number; h: number } | null = null;
  private camera: Camera;
  private dragging = false;
  private lastMouse = { x: 0, y: 0 };

  constructor(private scene: Scene, private def: AircraftDefinition, canvas: HTMLCanvasElement) {
    this.camera = scene.camera;
    // Mouse look (right-drag, or left-drag when not in free mode and mouse-yoke is off).
    canvas.addEventListener('pointerdown', e => {
      if (this.mode === 'free') return;
      if (e.button === 2 || (e.button === 0 && !this.mouseYokeActive)) { this.dragging = true; this.lastMouse = { x: e.clientX, y: e.clientY }; }
    });
    window.addEventListener('pointerup', () => { this.dragging = false; });
    window.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      this.lookYaw = clamp(this.lookYaw + (e.clientX - this.lastMouse.x) * 0.25, -170, 170);
      this.lookPitch = clamp(this.lookPitch - (e.clientY - this.lastMouse.y) * 0.25, -70, 70);
      this.lastMouse = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', e => {
      if (this.mode === 'chase') this.chaseZoom = clamp(this.chaseZoom * (e.deltaY > 0 ? 1.1 : 0.9), 0.35, 6);
      if (this.mode === 'cockpit') this.fovDeg = clamp(this.fovDeg + (e.deltaY > 0 ? 3 : -3), 25, 95);
    }, { passive: true });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  mouseYokeActive = false;

  setAircraft(def: AircraftDefinition) {
    this.def = def;
    this.chasePos = null;
  }

  setMode(mode: CameraMode, towerSite?: { lat: number; lon: number; h: number } | null) {
    if (mode === this.mode) return;
    this.blendFrom = { pos: this.cart(this.camera.positionWC), dir: this.cart(this.camera.directionWC), up: this.cart(this.camera.upWC) };
    this.blendT = 0;
    if (this.mode === 'free') this.camera.lookAtTransform(Matrix4.IDENTITY);
    this.mode = mode;
    this.lookYaw = 0;
    this.lookPitch = 0;
    if (towerSite !== undefined) this.tower = towerSite;
    const ctl = this.scene.screenSpaceCameraController;
    ctl.enableInputs = mode === 'free';
    if (mode === 'free') {
      ctl.enableTranslate = false;
      ctl.minimumZoomDistance = 3;
    }
    this.chasePos = null;
  }

  resetLook() {
    this.lookYaw = 0; this.lookPitch = 0; this.fovDeg = 65; this.chaseZoom = 1;
  }

  private cart(c: Cartesian3): Vec3 {
    return [c.x, c.y, c.z];
  }

  update(dt: number, pos: Vec3, q: Quat, vel: Vec3) {
    const R = qToMat(q);
    const L = this.def.spec.lengthM, b = this.def.spec.wingspanM;
    const geo = ecefToGeodetic(pos);
    const enu = enuBasis(geo.lat, geo.lon);
    const frustum = this.camera.frustum as PerspectiveFrustum;
    let fov = 65;
    let pose: Pose | null = null;

    switch (this.mode) {
      case 'cockpit': {
        const eye = this.def.geometry.eye;
        const p = add(pos, mulMV(R, eye));
        const yaw = this.lookYaw * DEG, pitch = (this.lookPitch - (this.def.cockpit === 'ga' ? 4 : 6)) * DEG;
        const dirB: Vec3 = [Math.cos(pitch) * Math.cos(yaw), Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch)];
        const upB: Vec3 = [-Math.sin(pitch) * Math.cos(yaw), -Math.sin(pitch) * Math.sin(yaw), -Math.cos(pitch)];
        pose = { pos: p, dir: mulMV(R, dirB), up: mulMV(R, upB) };
        fov = this.fovDeg;
        frustum.near = 0.05;
        break;
      }
      case 'chase': {
        // Follow behind along the flight path's horizontal direction, not the roll.
        const fwd = mulMV(R, [1, 0, 0]);
        let h = norm(sub(fwd, scale(enu.up, dot(fwd, enu.up))));
        if (!isFinite(h[0]) || Math.hypot(...h) < 0.5) h = enu.north;
        const yaw = this.lookYaw * DEG;
        const right = cross(h, enu.up);
        const back = norm(add(scale(h, -Math.cos(yaw)), scale(right, Math.sin(yaw))));
        const D = Math.max(18, 1.6 * L + 0.4 * b) * this.chaseZoom;
        const elev = clamp(12 + this.lookPitch, -20, 80) * DEG;
        const target = add(add(pos, scale(back, D * Math.cos(elev))), scale(enu.up, D * Math.sin(elev)));
        // Critically-damped follow so the camera lags slightly in manoeuvres.
        if (!this.chasePos) this.chasePos = target;
        const k = 1 - Math.exp(-dt * 6);
        this.chasePos = add(this.chasePos, scale(sub(target, this.chasePos), k));
        // Keep the lag bounded at high speed.
        const lag = sub(this.chasePos, target);
        if (Math.hypot(...lag) > D * 0.5) this.chasePos = add(target, scale(norm(lag), D * 0.5));
        const look = add(pos, scale(fwd, L * 0.15));
        const dir = norm(sub(look, this.chasePos));
        pose = { pos: this.chasePos, dir, up: norm(sub(enu.up, scale(dir, dot(enu.up, dir)))) };
        void vel;
        frustum.near = 0.5;
        break;
      }
      case 'wing': {
        const L2 = this.def.spec.lengthM;
        const eyeB: Vec3 = [-0.25 * L2, -(b / 2) * 0.55, -(this.def.geometry.fuselageDiameterM * 0.9 + 1.5)];
        const tgtB: Vec3 = [0.45 * L2, 0, 0];
        const p = add(pos, mulMV(R, eyeB));
        const dir = norm(mulMV(R, sub(tgtB, eyeB)));
        const upE = mulMV(R, [0, 0, -1]);
        pose = { pos: p, dir, up: norm(sub(upE, scale(dir, dot(upE, dir)))) };
        fov = 70;
        frustum.near = 0.2;
        break;
      }
      case 'tower': {
        if (!this.tower) {
          const [la, lo] = destination(geo.lat, geo.lon, 90, 600);
          this.tower = { lat: la, lon: lo, h: geo.h + 20 };
        }
        const tp = geodeticToEcef(this.tower.lat, this.tower.lon, this.tower.h);
        const dir = norm(sub(pos, tp));
        const upT = enuBasis(this.tower.lat, this.tower.lon).up;
        const dist = Math.hypot(...sub(pos, tp));
        fov = clamp((2 * Math.atan((L * 2.5) / Math.max(dist, 1))) / DEG, 2, 60);
        pose = { pos: tp, dir, up: norm(sub(upT, scale(dir, dot(upT, dir)))) };
        frustum.near = 1;
        // Re-site the tower if the aircraft flies far away.
        if (distance(geo.lat, geo.lon, this.tower.lat, this.tower.lon) > 40000) this.tower = null;
        break;
      }
      case 'free': {
        const t = Transforms.eastNorthUpToFixedFrame(new Cartesian3(...pos));
        if (this.blendT === 0) {
          this.camera.lookAtTransform(t, new HeadingPitchRange(-0.6, -0.25, Math.max(30, L * 2)));
          this.blendT = 1;
          this.blendFrom = null;
        } else this.camera.lookAtTransform(t);
        frustum.near = 0.5;
        frustum.fov = 65 * DEG;
        return;
      }
    }

    if (pose && this.blendFrom && this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / 0.8);
      const s = this.blendT * this.blendT * (3 - 2 * this.blendT);
      pose = {
        pos: [lerp(this.blendFrom.pos[0], pose.pos[0], s), lerp(this.blendFrom.pos[1], pose.pos[1], s), lerp(this.blendFrom.pos[2], pose.pos[2], s)],
        dir: norm([lerp(this.blendFrom.dir[0], pose.dir[0], s), lerp(this.blendFrom.dir[1], pose.dir[1], s), lerp(this.blendFrom.dir[2], pose.dir[2], s)]),
        up: norm([lerp(this.blendFrom.up[0], pose.up[0], s), lerp(this.blendFrom.up[1], pose.up[1], s), lerp(this.blendFrom.up[2], pose.up[2], s)]),
      };
    }
    if (pose) {
      frustum.fov = fov * DEG;
      this.camera.setView({
        destination: new Cartesian3(...pose.pos),
        orientation: { direction: new Cartesian3(...pose.dir), up: new Cartesian3(...pose.up) },
      });
    }
  }

  /** Picks a tower site near the closest airport's main runway. */
  static towerSiteFor(airport: { lat: number; lon: number; elevM: number | null; runways?: { leLat: number; leLon: number; heLat: number; heLon: number; lengthM: number; widthM: number }[] }) {
    const rw = [...(airport.runways ?? [])].sort((a, b) => b.lengthM - a.lengthM)[0];
    const elev = airport.elevM ?? 0;
    if (!rw) return { lat: airport.lat, lon: airport.lon, h: elev + 35 };
    const midLat = (rw.leLat + rw.heLat) / 2, midLon = (rw.leLon + rw.heLon) / 2;
    const hdg = bearing(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
    const [la, lo] = destination(midLat, midLon, hdg + 90, 300 + rw.widthM);
    return { lat: la, lon: lo, h: elev + 35 };
  }
}
