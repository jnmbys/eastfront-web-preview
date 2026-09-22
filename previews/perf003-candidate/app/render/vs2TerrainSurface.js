import { runTerrainWork } from './terrainWork.js';
import { reportTerrainLoad } from './terrainLoadProgress.js';
import { paintVS2Infrastructure } from './vs2Infrastructure.js';
import { paintVS2PlainTracesAsync, paintVS2MarshReedsAsync, paintVS2RiverbankDetailsAsync } from './vs2PlainTraces.js';
import { paintVS2Forest } from './vs2ForestSurface.js';
import { VS2_PRESENTATION } from './vs2Presentation.js';
import { loadTerrainImage, terrainSurfaceCapabilities } from './terrainSurface.js';
import { projectVS2Terrain } from './vs2Projection.js';
import { planVS2CityClustersAsync, planVS2CityBlocksAsync, paintVS2CityMassing, planVS2CityCourtsAsync, paintVS2CityCourts } from './vs2CityClusters.js';
import { rasterizeVS2WorldSurfaceAsync, VS2_WORLD_MATERIAL_IDS } from './vs2WorldRaster.js';
import { vs2AssetCatalog } from './vs2Assets.js';
export function createVS2TerrainSurfaceHooks(assets = vs2AssetCatalog, control) {
    return {
        stage: 'production-world-surface',
        renderAvailable: true,
        assets,
        worldBase: createVS2WorldBaseLayer(assets, control),
        lookupAsset(id) {
            const entry = assets.byId(id);
            return entry ? { entry, url: assets.url(entry) } : undefined;
        },
    };
}
export function createVS2WorldBaseLayer(assets = vs2AssetCatalog, control) {
    return {
        id: 'vs2-002-surface-integration',
        replacesCityMarkers: true,
        paintInfrastructure: (ctx, model, lod) => paintVS2Infrastructure(ctx, model, lod, assets),
        async paint(ctx, model, seed, lod = 'medium') {
            const textures = new Map(), capabilities = terrainSurfaceCapabilities();
            // Decode sequentially through the established direct-image/fetch fallback.
            // Retain only CPU texture pixels; release each decoded image immediately.
            reportTerrainLoad({ kind: 'assets', total: VS2_WORLD_MATERIAL_IDS.length });
            for (const id of VS2_WORLD_MATERIAL_IDS) {
                const entry = assets.byId(id);
                if (!entry)
                    throw new Error(`VS2 material missing from manifest: ${id}`);
                const image = await loadTerrainImage({ id, family: entry.family, file: entry.file,
                    sourceSize: [entry.sourceSize[0], entry.sourceSize[1]] }, 'p5', capabilities, new URL(assets.url(entry), document.baseURI).href);
                const scratch = document.createElement('canvas');
                try {
                    scratch.width = image.width;
                    scratch.height = image.height;
                    const pixels = scratch.getContext('2d', { willReadFrequently: true });
                    if (!pixels)
                        throw new Error('VS2 texture Canvas 2D unavailable');
                    pixels.drawImage(image.source, 0, 0);
                    textures.set(id, { width: image.width, height: image.height,
                        data: pixels.getImageData(0, 0, image.width, image.height).data });
                }
                finally {
                    image.release?.();
                    scratch.width = 0;
                    scratch.height = 0;
                }
            }
            reportTerrainLoad({ kind: 'building' });
            const projection = await runTerrainWork('projection', (function* () { return projectVS2Terrain(model, VS2_PRESENTATION[lod].pixelSize); })(), control), bounds = projection.rasterBounds, pixelSize = projection.pixelSize;
            const raster = await rasterizeVS2WorldSurfaceAsync(projection.field, textures, seed, bounds, pixelSize, control);
            const surface = document.createElement('canvas');
            try {
                surface.width = raster.width;
                surface.height = raster.height;
                const pixels = surface.getContext('2d');
                if (!pixels)
                    throw new Error('VS2 surface Canvas 2D unavailable');
                await runTerrainWork('raster-canvas-write', (function* () {
                    for (let row = 0; row < raster.height; row += 32) {
                        const height = Math.min(32, raster.height - row), image = pixels.createImageData(raster.width, height);
                        image.data.set(raster.data.subarray(row * raster.width * 4, (row + height) * raster.width * 4));
                        pixels.putImageData(image, 0, row);
                        yield;
                    }
                })(), control);
                await runTerrainWork('raster-canvas-compose', (function* () {
                    ctx.drawImage(surface, bounds.minX, bounds.minY, raster.width * pixelSize, raster.height * pixelSize);
                })(), control);
            }
            finally {
                textures.clear();
                surface.width = 0;
                surface.height = 0;
            }
            await paintVS2PlainTracesAsync(ctx, projection, seed, control);
            await paintVS2MarshReedsAsync(ctx, projection, seed, control);
            await paintVS2RiverbankDetailsAsync(ctx, projection, seed, control);
            const forest = await paintVS2Forest(ctx, projection, seed, lod, assets, control);
            // Stable city layout at every LOD. Far uses silhouettes of cached footprints,
            // without loading component images whose manifest disallows Far.
            const placements = await planVS2CityClustersAsync(projection, seed, 'medium', assets, control);
            const blocks = await planVS2CityBlocksAsync(projection, seed, control);
            paintVS2CityCourts(ctx, await planVS2CityCourtsAsync(projection, blocks, control));
            if (VS2_PRESENTATION[lod].citySummary) {
                paintVS2CityMassing(ctx, blocks);
                return { imageDraws: 1 + forest.imageDraws, uniqueAssets: VS2_WORLD_MATERIAL_IDS.length + forest.uniqueAssets };
            }
            const cityAssets = [...new Set(placements.map(p => p.assetId))].sort();
            reportTerrainLoad({ kind: 'assets', total: cityAssets.length });
            for (const id of cityAssets) {
                const entry = assets.byId(id);
                const image = await loadTerrainImage({ id, family: entry.family, file: entry.file,
                    sourceSize: [entry.sourceSize[0], entry.sourceSize[1]] }, 'p5', capabilities, new URL(assets.url(entry), document.baseURI).href);
                try {
                    for (const p of placements.filter(p => p.assetId === id)) {
                        ctx.save();
                        try {
                            ctx.globalAlpha = p.opacity;
                            ctx.drawImage(image.source, p.x - entry.anchor[0] * p.width, p.y - entry.anchor[1] * p.height, p.width, p.height);
                        }
                        finally {
                            ctx.restore();
                        }
                    }
                }
                finally {
                    image.release?.();
                }
            }
            reportTerrainLoad({ kind: 'building' });
            // Native core silhouettes remain legible above the small component textures.
            paintVS2CityMassing(ctx, blocks);
            return { imageDraws: 1 + forest.imageDraws + placements.length, uniqueAssets: VS2_WORLD_MATERIAL_IDS.length + forest.uniqueAssets + cityAssets.length };
        },
    };
}
