import { paintVS2Infrastructure } from './vs2Infrastructure.js';
import { paintVS2Forest } from './vs2ForestSurface.js';
import { VS2_PRESENTATION } from './vs2Presentation.js';
import { loadTerrainImage, terrainSurfaceCapabilities, type TerrainWorldBaseLayer } from './terrainSurface.js';
import { projectVS2Terrain } from './vs2Projection.js';
import { planVS2CityClusters } from './vs2CityClusters.js';
import { rasterizeVS2WorldSurface, VS2_WORLD_MATERIAL_IDS, type VS2Texture } from './vs2WorldRaster.js';
import { vs2AssetCatalog, type VS2AssetCatalog, type VS2AssetEntry } from './vs2Assets.js';

export interface VS2TerrainAssetReference {
  readonly entry: VS2AssetEntry;
  readonly url: string;
}

/** Production world-surface hook; the live grid remains a separate layer. */
export interface VS2TerrainSurfaceHooks {
  readonly stage: 'production-world-surface';
  readonly renderAvailable: true;
  readonly assets: VS2AssetCatalog;
  readonly worldBase: TerrainWorldBaseLayer;
  lookupAsset(id: string): VS2TerrainAssetReference | undefined;
}

export function createVS2TerrainSurfaceHooks(
  assets: VS2AssetCatalog = vs2AssetCatalog,
): VS2TerrainSurfaceHooks {
  return {
    stage: 'production-world-surface',
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
    id: 'vs2-002-surface-integration',
    replacesCityMarkers: true,
    paintInfrastructure: (ctx, model, lod) => paintVS2Infrastructure(ctx, model, lod, assets),
    async paint(ctx, model, seed, lod = 'medium') {
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
      const projection = projectVS2Terrain(model, VS2_PRESENTATION[lod].pixelSize), bounds = projection.rasterBounds, pixelSize = projection.pixelSize;
      const raster = rasterizeVS2WorldSurface(projection.field, textures, seed, bounds, pixelSize);
      const surface = document.createElement('canvas');
      try {
        surface.width = raster.width; surface.height = raster.height;
        const pixels = surface.getContext('2d');
        if (!pixels) throw new Error('VS2 surface Canvas 2D unavailable');
        const image = pixels.createImageData(raster.width, raster.height); image.data.set(raster.data); pixels.putImageData(image, 0, 0);
        ctx.drawImage(surface, bounds.minX, bounds.minY, raster.width * pixelSize, raster.height * pixelSize);
      } finally { textures.clear(); surface.width = 0; surface.height = 0; }
      const forest = await paintVS2Forest(ctx, projection, seed, lod, assets);
      // Stable city layout at every LOD. Far uses silhouettes of cached footprints,
      // without loading component images whose manifest disallows Far.
      const placements = planVS2CityClusters(projection, seed, 'medium', assets);
      if (VS2_PRESENTATION[lod].citySummary) {
        ctx.save();
        try {
          ctx.fillStyle = '#746b59';
          for (const p of placements) ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        } finally { ctx.restore(); }
        return { imageDraws: 1 + forest.imageDraws, uniqueAssets: VS2_WORLD_MATERIAL_IDS.length + forest.uniqueAssets };
      }
      const cityAssets = [...new Set(placements.map(p => p.assetId))].sort();
      for (const id of cityAssets) {
        const entry = assets.byId(id)!;
        const image = await loadTerrainImage({ id, family: entry.family, file: entry.file,
          sourceSize: [entry.sourceSize[0]!, entry.sourceSize[1]!] }, 'p5', capabilities,
          new URL(assets.url(entry), document.baseURI).href);
        try {
          for (const p of placements.filter(p => p.assetId === id)) {
            ctx.save();
            try {
              ctx.globalAlpha = p.opacity;
              ctx.drawImage(image.source, p.x - entry.anchor[0]! * p.width, p.y - entry.anchor[1]! * p.height, p.width, p.height);
            } finally { ctx.restore(); }
          }
        } finally { image.release?.(); }
      }
      return { imageDraws: 1 + forest.imageDraws + placements.length, uniqueAssets: VS2_WORLD_MATERIAL_IDS.length + forest.uniqueAssets + cityAssets.length };
    },
  };
}
