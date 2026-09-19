import { viewBoxForHexes } from './coreSvg.js';
import { loadTerrainImage, terrainSurfaceCapabilities, type TerrainWorldBaseLayer } from './terrainSurface.js';
import { createVS2RegionField } from './vs2WorldField.js';
import { rasterizeVS2WorldSurface, VS2_WORLD_MATERIAL_IDS, type VS2Texture } from './vs2WorldRaster.js';
import { vs2AssetCatalog, type VS2AssetCatalog, type VS2AssetEntry } from './vs2Assets.js';

export interface VS2TerrainAssetReference {
  readonly entry: VS2AssetEntry;
  readonly url: string;
}

/** World-surface prototype hook; existing grid and infrastructure stay separate. */
export interface VS2TerrainSurfaceHooks {
  readonly stage: 'world-surface-prototype';
  readonly renderAvailable: true;
  readonly assets: VS2AssetCatalog;
  readonly worldBase: TerrainWorldBaseLayer;
  lookupAsset(id: string): VS2TerrainAssetReference | undefined;
}

export function createVS2TerrainSurfaceHooks(
  assets: VS2AssetCatalog = vs2AssetCatalog,
): VS2TerrainSurfaceHooks {
  return {
    stage: 'world-surface-prototype',
    renderAvailable: true,
    assets,
    worldBase: createVS2WorldBaseLayer(assets),
    lookupAsset(id) {
      const entry = assets.byId(id);
      return entry ? { entry, url: assets.url(entry) } : undefined;
    },
  };
}

export function createVS2WorldBaseLayer(assets: VS2AssetCatalog = vs2AssetCatalog): TerrainWorldBaseLayer {
  return {
    id: 'vs2-002-world-prototype',
    async paint(ctx, model, seed) {
      const textures = new Map<string, VS2Texture>(), capabilities = terrainSurfaceCapabilities();
      // Decode sequentially through the established direct-image/fetch fallback.
      // Retain only CPU texture pixels; release each decoded image immediately.
      for (const id of VS2_WORLD_MATERIAL_IDS) {
        const entry = assets.byId(id);
        if (!entry) throw new Error(`VS2 material missing from manifest: ${id}`);
        const image = await loadTerrainImage({ id, family: entry.family, file: entry.file,
          sourceSize: [entry.sourceSize[0]!, entry.sourceSize[1]!] }, 'p5', capabilities,
          new URL(assets.url(entry), document.baseURI).href);
        const scratch = document.createElement('canvas');
        try {
          scratch.width = image.width; scratch.height = image.height;
          const pixels = scratch.getContext('2d', { willReadFrequently: true });
          if (!pixels) throw new Error('VS2 texture Canvas 2D unavailable');
          pixels.drawImage(image.source, 0, 0);
          textures.set(id, { width: image.width, height: image.height,
            data: pixels.getImageData(0, 0, image.width, image.height).data });
        } finally { image.release?.(); scratch.width = 0; scratch.height = 0; }
      }
      const bounds = viewBoxForHexes(model.hexes), pixelSize = 2;
      const raster = rasterizeVS2WorldSurface(createVS2RegionField(model.hexes), textures, seed, bounds, pixelSize);
      const surface = document.createElement('canvas');
      try {
        surface.width = raster.width; surface.height = raster.height;
        const pixels = surface.getContext('2d');
        if (!pixels) throw new Error('VS2 surface Canvas 2D unavailable');
        const image = pixels.createImageData(raster.width, raster.height); image.data.set(raster.data); pixels.putImageData(image, 0, 0);
        ctx.drawImage(surface, bounds.minX, bounds.minY, raster.width * pixelSize, raster.height * pixelSize);
      } finally { textures.clear(); surface.width = 0; surface.height = 0; }
      return { imageDraws: 1, uniqueAssets: VS2_WORLD_MATERIAL_IDS.length };
    },
  };
}
