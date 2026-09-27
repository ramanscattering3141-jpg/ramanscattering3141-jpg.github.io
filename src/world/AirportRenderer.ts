// Draws nearby airports: textured runways with standard ICAO-style markings
// (threshold "piano keys", designators, touchdown zone, aiming point, centreline,
// edge lines), runway edge/threshold/approach lights at night, and name labels.
//
// Runways are GroundPrimitives draped on the terrain. The terrain under every
// runway is flattened (see ElevationService), so the drape is flat and the
// flight model's wheels sit exactly on the painted surface.

import {
  GroundPrimitive, GeometryInstance, PolygonGeometry, PolygonHierarchy, Cartesian3, Material, MaterialAppearance,
  PointPrimitiveCollection, LabelCollection, Color, NearFarScalar, DistanceDisplayCondition, LabelStyle,
  VerticalOrigin, type Scene, Cartesian2, HeightReference,
} from 'cesium';
import type { AirportDatabase } from './AirportDatabase';
import type { Airport, Runway } from './AirportTypes';
import { destination, bearing, distance } from '../core/geodesy';

interface AirportVisual {
  ident: string;
  runways: GroundPrimitive[];
  lights: PointPrimitiveCollection;
}

function runwayTexture(rw: Runway, lengthM: number, widthM: number): HTMLCanvasElement {
  const paved = rw.surface === 'P';
  const W = 64;
  const H = Math.min(2048, Math.max(256, Math.round(lengthM / 2)));
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const base = paved ? '#45484d' : rw.surface === 'G' ? '#5f7a3d' : rw.surface === 'S' ? '#dfe5ea' : '#8b7757';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);
  // subtle wear/noise
  for (let i = 0; i < W * H / 40; i++) {
    ctx.fillStyle = `rgba(${paved ? '255,255,255' : '0,0,0'},${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 3);
  }
  if (!paved) return cv;
  const mPerPxY = lengthM / H, mPerPxX = widthM / W;
  const py = (m: number) => m / mPerPxY;
  const px = (m: number) => m / mPerPxX;
  ctx.fillStyle = '#f2f2ee';
  // edge lines (0.9 m)
  ctx.fillRect(px(1), 0, Math.max(1, px(0.9)), H);
  ctx.fillRect(W - px(1.9), 0, Math.max(1, px(0.9)), H);
  // Both ends: y grows from the "le" threshold (top) to the "he" threshold (bottom).
  const drawEnd = (fromTop: boolean, ident: string) => {
    const y = (m: number, h: number) => (fromTop ? py(m) : H - py(m) - py(h));
    // threshold stripes: 30 m long
    const stripes = widthM >= 45 ? 12 : widthM >= 30 ? 8 : 4;
    const sw = (widthM - 6) / (stripes * 2);
    for (let i = 0; i < stripes; i++) {
      const x0 = 3 + (i * 2 + 0.5) * sw;
      ctx.fillRect(px(x0), y(6, 30), Math.max(1, px(sw)), py(30));
    }
    // designator: 9 m tall numbers
    ctx.save();
    const cy = fromTop ? py(48) : H - py(48);
    ctx.translate(W / 2, cy);
    if (!fromTop) ctx.rotate(Math.PI);
    ctx.scale(1, py(12) / 28);
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ident.replace(/^0/, '0'), 0, 0);
    ctx.restore();
    // aiming point (≈300 m, two wide bars) and touchdown zone pairs
    if (lengthM > 1200) {
      ctx.fillRect(px(widthM * 0.2), y(300, 45), px(widthM * 0.12), py(45));
      ctx.fillRect(px(widthM * 0.68), y(300, 45), px(widthM * 0.12), py(45));
      for (const d of [150, 450, 600]) {
        if (d > lengthM / 2 - 100) continue;
        ctx.fillRect(px(widthM * 0.24), y(d, 22), px(widthM * 0.06), py(22));
        ctx.fillRect(px(widthM * 0.7), y(d, 22), px(widthM * 0.06), py(22));
      }
    }
  };
  drawEnd(true, rw.leIdent);
  drawEnd(false, rw.heIdent);
  // centreline: 30 m dashes, 20 m gaps between the designators
  for (let m = 70; m < lengthM - 70; m += 50) ctx.fillRect(W / 2 - Math.max(1, px(0.45)), py(m), Math.max(1, px(0.9)), py(30));
  return cv;
}

export class AirportRenderer {
  private visuals = new Map<string, AirportVisual>();
  private labels: LabelCollection;
  private labelled = new Set<string>();
  private lastUpdate = { lat: 999, lon: 999 };
  lightsOn = false;
  /** Painted runway surfaces (hidden when photoreal scenery already shows the real ones) */
  surfacesVisible = true;
  radiusM = 35000;

  constructor(private scene: Scene, private db: AirportDatabase) {
    this.labels = scene.primitives.add(new LabelCollection({ scene }));
  }

  /** Call periodically with the camera/aircraft position. */
  async update(lat: number, lon: number, nightOrLowVis: boolean) {
    this.setLights(nightOrLowVis);
    if (distance(lat, lon, this.lastUpdate.lat, this.lastUpdate.lon) < 3000) return;
    this.lastUpdate = { lat, lon };
    await this.db.ensureCell(lat, lon);
    const near = this.db.nearby(lat, lon, this.radiusM, a => a.longestRunwayM >= 250);
    const keep = new Set(near.slice(0, 40).map(n => n.airport.ident));
    for (const [id, v] of this.visuals) if (!keep.has(id)) this.remove(id, v);
    for (const { airport } of near.slice(0, 40)) {
      if (!this.visuals.has(airport.ident)) this.add(airport);
    }
    // Labels for airports within ~150 km (large/medium) so you can find them from the air.
    const labelSet = this.db.nearby(lat, lon, 150000, a => a.type <= 1);
    for (const { airport } of labelSet.slice(0, 60)) {
      if (this.labelled.has(airport.ident)) continue;
      this.labelled.add(airport.ident);
      this.labels.add({
        position: Cartesian3.fromDegrees(airport.lon, airport.lat, (airport.elevM ?? 0) + 60),
        text: `✈ ${airport.icao || airport.ident}`,
        font: '600 14px system-ui, sans-serif',
        fillColor: Color.fromCssColorString('#ffd166'),
        outlineColor: Color.BLACK,
        outlineWidth: 3,
        style: LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: VerticalOrigin.BOTTOM,
        distanceDisplayCondition: new DistanceDisplayCondition(3000, 180000),
        scaleByDistance: new NearFarScalar(5000, 1.1, 150000, 0.7),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      });
    }
  }

  private add(a: Airport) {
    const vis: AirportVisual = { ident: a.ident, runways: [], lights: this.scene.primitives.add(new PointPrimitiveCollection()) };
    for (const rw of a.runways ?? []) {
      if (rw.surface === 'W') continue;
      try {
        vis.runways.push(this.runwayPrimitive(rw));
        this.runwayLights(vis.lights, a, rw);
      } catch (e) {
        console.warn('runway render failed', a.ident, e);
      }
    }
    vis.lights.show = this.lightsOn;
    this.visuals.set(a.ident, vis);
  }

  private remove(id: string, v: AirportVisual) {
    for (const p of v.runways) this.scene.groundPrimitives.remove(p);
    this.scene.primitives.remove(v.lights);
    this.visuals.delete(id);
  }

  private runwayPrimitive(rw: Runway): GroundPrimitive {
    const hdg = bearing(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
    const len = distance(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
    const hw = rw.widthM / 2;
    const c = (lat: number, lon: number, brg: number, d: number) => destination(lat, lon, brg, d);
    const p1 = c(rw.leLat, rw.leLon, hdg - 90, hw);
    const p2 = c(rw.leLat, rw.leLon, hdg + 90, hw);
    const p3 = c(rw.heLat, rw.heLon, hdg + 90, hw);
    const p4 = c(rw.heLat, rw.heLon, hdg - 90, hw);
    const positions = [p1, p2, p3, p4].map(([la, lo]) => Cartesian3.fromDegrees(lo, la));
    const tex = runwayTexture(rw, len, rw.widthM);
    const prim = new GroundPrimitive({
      geometryInstances: new GeometryInstance({
        geometry: new PolygonGeometry({
          polygonHierarchy: new PolygonHierarchy(positions),
          // Align texture coordinates with the runway: t runs along the runway.
          stRotation: ((-hdg + 180) * Math.PI) / 180,
          vertexFormat: MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        }),
      }),
      appearance: new MaterialAppearance({
        material: Material.fromType('Image', { image: tex, repeat: new Cartesian2(1, 1) }),
        materialSupport: MaterialAppearance.MaterialSupport.TEXTURED,
      }),
      asynchronous: true,
    });
    prim.show = this.surfacesVisible;
    this.scene.groundPrimitives.add(prim);
    return prim;
  }

  private runwayLights(coll: PointPrimitiveCollection, a: Airport, rw: Runway) {
    if (rw.surface !== 'P' && !rw.lighted) return;
    const hdg = bearing(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
    const len = distance(rw.leLat, rw.leLon, rw.heLat, rw.heLon);
    const hw = rw.widthM / 2 + 1.5;
    const elev = (t: number) => ((rw.leElevM ?? a.elevM ?? 0) * (1 - t) + (rw.heElevM ?? a.elevM ?? 0) * t) + 0.4;
    const add = (lat: number, lon: number, h: number, color: Color, size = 4) => coll.add({
      position: Cartesian3.fromDegrees(lon, lat, h), color, pixelSize: size,
      scaleByDistance: new NearFarScalar(200, 1.5, 15000, 0.4), heightReference: HeightReference.NONE,
    });
    const white = Color.fromCssColorString('#fff6d8'), green = Color.fromCssColorString('#38ff6a'), red = Color.fromCssColorString('#ff3030');
    for (let d = 0; d <= len; d += 60) {
      const [cl, co] = destination(rw.leLat, rw.leLon, hdg, d);
      for (const s of [-1, 1]) {
        const [la, lo] = destination(cl, co, hdg + 90 * s, hw);
        add(la, lo, elev(d / len), d > len - 600 || d < 0 ? Color.fromCssColorString('#ffc34d') : white);
      }
    }
    // Threshold (green) / end (red) bars at both ends
    for (const [lat, lon, brg, t] of [[rw.leLat, rw.leLon, hdg, 0], [rw.heLat, rw.heLon, hdg + 180, 1]] as const) {
      for (let x = -hw; x <= hw; x += 4) {
        const [la, lo] = destination(lat, lon, brg + 90, x);
        add(la, lo, elev(t), green, 4);
        const [la2, lo2] = destination(la, lo, brg + 180, 2);
        add(la2, lo2, elev(t), red, 3);
      }
      // Simple approach light row: 900 m, every 30 m, plus a crossbar at 300 m.
      if (len > 1500) {
        for (let d = 30; d <= 900; d += 30) {
          const [la, lo] = destination(lat, lon, brg + 180, d);
          add(la, lo, elev(t) + d * 0.004, white, 5);
          if (d === 300) for (const x of [-15, -10, -5, 5, 10, 15]) {
            const [lb, lob] = destination(la, lo, brg + 90, x);
            add(lb, lob, elev(t) + 1.2, white, 4);
          }
        }
      }
    }
  }

  setSurfacesVisible(on: boolean) {
    this.surfacesVisible = on;
    for (const v of this.visuals.values()) for (const p of v.runways) p.show = on;
  }

  setLights(on: boolean) {
    if (on === this.lightsOn) return;
    this.lightsOn = on;
    for (const v of this.visuals.values()) v.lights.show = on;
  }

  clear() {
    for (const [id, v] of this.visuals) this.remove(id, v);
  }
}
