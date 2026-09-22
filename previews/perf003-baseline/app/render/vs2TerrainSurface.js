import {trace as __trace} from '../../trace.js';
import { reportTerrainLoad } from './terrainLoadProgress.js';
import { paintVS2Infrastructure } from './vs2Infrastructure.js';
import { paintVS2PlainTraces as raw_paintVS2PlainTraces, paintVS2MarshReeds as raw_paintVS2MarshReeds, paintVS2RiverbankDetails as raw_paintVS2RiverbankDetails } from './vs2PlainTraces.js';
import { paintVS2Forest } from './vs2ForestSurface.js';
import { VS2_PRESENTATION } from './vs2Presentation.js';
import { loadTerrainImage, terrainSurfaceCapabilities } from './terrainSurface.js';
import { projectVS2Terrain as raw_projectVS2Terrain } from './vs2Projection.js';
import { planVS2CityClusters as raw_planVS2CityClusters, planVS2CityBlocks as raw_planVS2CityBlocks, paintVS2CityMassing, planVS2CityCourts as raw_planVS2CityCourts, paintVS2CityCourts } from './vs2CityClusters.js';
import { rasterizeVS2WorldSurface as raw_rasterizeVS2WorldSurface, VS2_WORLD_MATERIAL_IDS } from './vs2WorldRaster.js';
import { vs2AssetCatalog } from './vs2Assets.js';
export function createVS2TerrainSurfaceHooks(assets = vs2AssetCatalog) {
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
export function createVS2WorldBaseLayer(assets = vs2AssetCatalog) {
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
            const projection = projectVS2Terrain(model, VS2_PRESENTATION[lod].pixelSize), bounds = projection.rasterBounds, pixelSize = projection.pixelSize;
            const raster = rasterizeVS2WorldSurface(projection.field, textures, seed, bounds, pixelSize);
            const surface = document.createElement('canvas');
            try {
                surface.width = raster.width;
                surface.height = raster.height;
                const pixels = surface.getContext('2d');
                if (!pixels)
                    throw new Error('VS2 surface Canvas 2D unavailable');
                const image = pixels.createImageData(raster.width, raster.height);
                image.data.set(raster.data);
                pixels.putImageData(image, 0, 0);
                ctx.drawImage(surface, bounds.minX, bounds.minY, raster.width * pixelSize, raster.height * pixelSize);
            }
            finally {
                textures.clear();
                surface.width = 0;
                surface.height = 0;
            }
            paintVS2PlainTraces(ctx, projection, seed);
            paintVS2MarshReeds(ctx, projection, seed);
            paintVS2RiverbankDetails(ctx, projection, seed);
            const forest = await paintVS2Forest(ctx, projection, seed, lod, assets);
            // Stable city layout at every LOD. Far uses silhouettes of cached footprints,
            // without loading component images whose manifest disallows Far.
            const placements = planVS2CityClusters(projection, seed, 'medium', assets);
            const blocks = planVS2CityBlocks(projection, seed);
            paintVS2CityCourts(ctx, planVS2CityCourts(projection, blocks));
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

function projectVS2Terrain(...a){return __trace.sync('projectVS2Terrain',()=>raw_projectVS2Terrain(...a));}
function rasterizeVS2WorldSurface(...a){return __trace.sync('rasterizeVS2WorldSurface',()=>raw_rasterizeVS2WorldSurface(...a));}
function paintVS2PlainTraces(...a){return __trace.sync('paintVS2PlainTraces',()=>raw_paintVS2PlainTraces(...a));}
function paintVS2MarshReeds(...a){return __trace.sync('paintVS2MarshReeds',()=>raw_paintVS2MarshReeds(...a));}
function paintVS2RiverbankDetails(...a){return __trace.sync('paintVS2RiverbankDetails',()=>raw_paintVS2RiverbankDetails(...a));}
function planVS2CityClusters(...a){return __trace.sync('planVS2CityClusters',()=>raw_planVS2CityClusters(...a));}
function planVS2CityBlocks(...a){return __trace.sync('planVS2CityBlocks',()=>raw_planVS2CityBlocks(...a));}
function planVS2CityCourts(...a){return __trace.sync('planVS2CityCourts',()=>raw_planVS2CityCourts(...a));}