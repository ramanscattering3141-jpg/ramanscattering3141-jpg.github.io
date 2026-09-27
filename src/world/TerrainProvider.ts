// Cesium terrain provider built on ElevationService.
//
// Cesium requests terrain in a *geographic* tiling scheme (2×1 root tiles),
// while Terrarium tiles are Web Mercator. For every requested geographic tile we
// fetch the overlapping Mercator tiles one zoom deeper (same longitude width),
// resample a 65×65 height grid, flatten runways and add a water mask so oceans
// render with Cesium's animated water. Cesium handles LOD selection, frustum /
// horizon culling, skirts, caching of meshes and upsampling beyond our max level.

import {
  Credit, Event, GeographicTilingScheme, HeightmapTerrainData, TerrainProvider, Ellipsoid, Math as CMath,
  type Request, type TileAvailability,
} from 'cesium';
import { ElevationService, TERRARIUM_MAX_ZOOM } from './ElevationService';

const GRID = 65;
const MAX_LEVEL = TERRARIUM_MAX_ZOOM - 1;

export class TerrariumTerrainProvider {
  readonly tilingScheme = new GeographicTilingScheme({ ellipsoid: Ellipsoid.WGS84 });
  readonly errorEvent = new Event();
  readonly credit = new Credit('Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank">Terrain Tiles (Mapzen/AWS Open Data; SRTM, GMTED, ETOPO1)</a>');
  readonly hasWaterMask = true;
  readonly hasVertexNormals = false;
  readonly hasMetadata = false;
  readonly availability: TileAvailability | undefined = undefined;
  private levelZeroError = TerrainProvider.getEstimatedLevelZeroGeometricErrorForAHeightmap(Ellipsoid.WGS84, GRID, 2);
  /** Hook to make sure runway flattening data is loaded before building detailed tiles. */
  beforeTile: ((west: number, south: number, east: number, north: number, level: number) => Promise<void>) | null = null;
  private active = 0;

  constructor(private elevation: ElevationService) {}

  getLevelMaximumGeometricError(level: number) {
    return this.levelZeroError / (1 << level);
  }

  getTileDataAvailable(_x: number, _y: number, level: number) {
    return level <= MAX_LEVEL;
  }

  loadTileDataAvailability() {
    return undefined;
  }

  requestTileGeometry(x: number, y: number, level: number, request?: Request): Promise<HeightmapTerrainData> | undefined {
    // Throttle: returning undefined tells Cesium to retry this tile later.
    if (request?.throttle && this.active >= 16) return undefined;
    this.active++;
    return this.build(x, y, level).finally(() => { this.active--; });
  }

  private async build(x: number, y: number, level: number): Promise<HeightmapTerrainData> {
    const rect = this.tilingScheme.tileXYToRectangle(x, y, level);
    const west = CMath.toDegrees(rect.west), east = CMath.toDegrees(rect.east);
    const south = CMath.toDegrees(rect.south), north = CMath.toDegrees(rect.north);
    const z = Math.min(level + 1, TERRARIUM_MAX_ZOOM);
    if (this.beforeTile) await this.beforeTile(west, south, east, north, level).catch(() => undefined);
    const tiles = this.elevation.tilesFor(west, Math.max(south, -85.05), east, Math.min(north, 85.05), z);
    await Promise.all(tiles.map(([tx, ty]) => this.elevation.getTile(z, tx, ty)));

    const heights = new Float32Array(GRID * GRID);
    const water = new Uint8Array(GRID * GRID);
    let anyWater = false, anyLand = false;
    for (let j = 0; j < GRID; j++) {
      const lat = north - ((north - south) * j) / (GRID - 1);
      for (let i = 0; i < GRID; i++) {
        const lon = west + ((east - west) * i) / (GRID - 1);
        const raw = this.elevation.sampleRaw(lat, lon, z) ?? 0;
        const h = this.elevation.flatten.apply(lat, lon, Math.max(0, raw));
        heights[j * GRID + i] = h;
        const w = raw < -1 && h <= 0.01;
        water[j * GRID + i] = w ? 255 : 0;
        if (w) anyWater = true; else anyLand = true;
      }
    }
    return new HeightmapTerrainData({
      buffer: heights,
      width: GRID,
      height: GRID,
      // No children beyond our deepest level: Cesium will upsample instead of requesting.
      childTileMask: level < MAX_LEVEL ? 15 : 0,
      waterMask: anyWater && anyLand ? water : new Uint8Array([anyWater ? 255 : 0]),
    });
  }
}
