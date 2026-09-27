// Renders the simulated aircraft: procedural glTF model, animated control
// surfaces/gear/propeller, and navigation/beacon/strobe lights.

import {
  Model, Matrix4, Matrix3, Quaternion, Cartesian3, Axis, ShadowMode, PointPrimitiveCollection, Color,
  type PointPrimitive, type Scene, NearFarScalar,
} from 'cesium';
import type { AircraftDefinition } from './types';
import type { FlightDynamics } from './FlightDynamics';
import { buildAircraftModel, type BuiltModel } from './ModelBuilder';
import { type Vec3, type Quat, qToMat, DEG } from '../core/math';

export class AircraftView {
  model: Model | null = null;
  built: BuiltModel;
  private lights: PointPrimitiveCollection;
  private navL: PointPrimitive; private navR: PointPrimitive; private tail: PointPrimitive;
  private beacon: PointPrimitive; private beaconB: PointPrimitive;
  private strobeL: PointPrimitive; private strobeR: PointPrimitive;
  private propAngle = 0;
  private readonly tmpM = new Matrix4();
  visible = true;

  constructor(private scene: Scene, readonly def: AircraftDefinition) {
    this.built = buildAircraftModel(def);
    this.lights = scene.primitives.add(new PointPrimitiveCollection());
    const mk = (c: Color, size: number) => this.lights.add({ color: c, pixelSize: size, scaleByDistance: new NearFarScalar(50, 1.4, 20000, 0.5), show: true });
    this.navL = mk(Color.fromCssColorString('#ff2a2a'), 5);
    this.navR = mk(Color.fromCssColorString('#2aff4d'), 5);
    this.tail = mk(Color.WHITE, 4);
    this.beacon = mk(Color.RED, 6);
    this.beaconB = mk(Color.RED, 6);
    this.strobeL = mk(Color.WHITE, 8);
    this.strobeR = mk(Color.WHITE, 8);
  }

  async load() {
    // Cesium accepts an in-memory glTF JSON object (the typings only list `url`).
    this.model = await Model.fromGltfAsync({
      gltf: this.built.gltf,
      upAxis: Axis.Z,
      forwardAxis: Axis.X,
      shadows: ShadowMode.ENABLED,
      minimumPixelSize: 32,
      maximumScale: 20000,
      allowPicking: false,
      scene: this.scene,
    } as unknown as Parameters<typeof Model.fromGltfAsync>[0]);
    this.scene.primitives.add(this.model);
  }

  /** Model→ECEF matrix from ECEF position and body→ECEF attitude. */
  static modelMatrix(pos: Vec3, q: Quat, out: Matrix4) {
    const m = qToMat(q);
    // Body axes (x fwd, y right, z down) → model axes (x fwd, y left, z up).
    return Matrix4.fromArray([
      m[0], m[3], m[6], 0,
      -m[1], -m[4], -m[7], 0,
      -m[2], -m[5], -m[8], 0,
      pos[0], pos[1], pos[2], 1,
    ], 0, out);
  }

  update(pos: Vec3, q: Quat, fd: FlightDynamics, dt: number, time: number, hideForCockpit: boolean) {
    const mm = AircraftView.modelMatrix(pos, q, this.tmpM);
    if (this.model) {
      this.model.modelMatrix = mm;
      this.model.show = this.visible;
      // Hide the airframe in cockpit view for big jets (we'd only see the inside of the nose);
      // keep it for GA so the wings are visible out of the windows.
      if (this.model.ready) this.animate(fd, dt, hideForCockpit);
    }
    this.updateLights(mm, fd, time);
  }

  private setPart(name: string, angle: number) {
    const p = this.built.parts.find(x => x.name === name);
    const node = this.model?.getNode(name);
    if (!p || !node) return;
    const rot = Matrix3.fromQuaternion(Quaternion.fromAxisAngle(new Cartesian3(...p.axis), angle));
    node.matrix = Matrix4.fromRotationTranslation(rot, new Cartesian3(...p.pivot));
  }

  private animate(fd: FlightDynamics, dt: number, cockpit: boolean) {
    const c = fd.controls, a = fd.def.aero;
    // Positive rotation about each hinge axis follows the right-hand rule; signs chosen so
    // trailing edges move the physically correct way.
    const flap = fd.flapsFrac * 38 * DEG;
    this.setPart('flap_l', flap);
    this.setPart('flap_r', -flap);
    const ail = c.aileron * a.aileronMaxDeg * DEG;
    this.setPart('aileron_l', -ail);
    this.setPart('aileron_r', -ail);
    const elev = -(c.elevator + fd.trimPos * 0.5) * a.elevatorMaxDeg * DEG;
    this.setPart('elevator_l', -elev);
    this.setPart('elevator_r', elev);
    this.setPart('rudder', -c.rudder * a.rudderMaxDeg * DEG);
    const gearAngle = (1 - fd.gearPos) * 95 * DEG;
    for (const g of ['gear_nose', 'gear_l', 'gear_r', 'gear_bl', 'gear_br']) {
      const node = this.model?.getNode(g);
      if (node) node.show = fd.gearPos > 0.02 && !cockpit;
      this.setPart(g, g === 'gear_nose' ? gearAngle : gearAngle);
    }
    const running = fd.engines.states[0];
    const rpm = running && running.status !== 'off' ? 600 + 2000 * running.n : Math.max(0, 0);
    this.propAngle += (rpm / 60) * 2 * Math.PI * dt;
    this.setPart('prop', this.propAngle % (2 * Math.PI));
  }

  private updateLights(mm: Matrix4, fd: FlightDynamics, time: number) {
    const L = this.built.lights;
    const tr = (p: Vec3) => Matrix4.multiplyByPoint(mm, new Cartesian3(p[0], p[1], p[2]), new Cartesian3());
    const on = this.visible;
    this.navL.position = tr(L.navLeft);
    this.navR.position = tr(L.navRight);
    this.tail.position = tr(L.tail);
    this.beacon.position = tr(L.beaconTop);
    this.beaconB.position = tr(L.beaconBottom);
    this.strobeL.position = tr(L.navLeft);
    this.strobeR.position = tr(L.navRight);
    const engineOn = fd.engines.running;
    const beaconOn = engineOn && (time % 1.2) < 0.12;
    const strobeOn = !fd.telemetry.onGround && (time % 1.4) < 0.05;
    this.navL.show = this.navR.show = this.tail.show = on;
    this.beacon.show = this.beaconB.show = on && beaconOn;
    this.strobeL.show = this.strobeR.show = on && strobeOn;
  }

  destroy() {
    if (this.model) this.scene.primitives.remove(this.model);
    this.scene.primitives.remove(this.lights);
    this.model = null;
  }
}
