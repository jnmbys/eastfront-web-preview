import { HEX_SIZE, hexPolygon, hexToPixel, sharedHexEdge } from '../geometry/hex.js';
import { viewBoxForHexes } from './coreSvg.js';
import { assetUrl, entryVisibleAtLod, terrainAssetCatalog, unorderedEdgeVisualSeed, visualSeed, } from './terrainAssets.js';
import { marshContinuityDecision } from './productionTerrain.js';
export class TerrainSurfaceResourceError extends Error {
    details;
    constructor(message, details) { super(message); this.name = 'TerrainSurfaceResourceError'; this.details = details; }
}
let terrainSurfaceBuildCount = 0;
const RESOURCE_TIMEOUT_MS = 15000;
const MAX_RETAINED_TERRAIN_IMAGES = 16;
export function terrainSurfaceCapabilities() {
    let canvas2d = false;
    try {
        const c = document.createElement('canvas');
        canvas2d = Boolean(c.getContext('2d'));
    }
    catch { }
    return { createImageBitmap: typeof globalThis.createImageBitmap === 'function', offscreenCanvas: typeof globalThis.OffscreenCanvas === 'function', htmlImageDecode: typeof HTMLImageElement !== 'undefined' && typeof HTMLImageElement.prototype.decode === 'function', canvas2d };
}
export function formatTerrainSurfaceFailure(error) {
    if (error instanceof TerrainSurfaceResourceError) {
        const d = error.details;
        const bits = [`stage=${d.stage}`, d.assetId ? `asset=${d.assetId}` : '', d.family ? `family=${d.family}` : '', d.url ? `url=${d.url}` : '', d.httpStatus !== undefined ? `http=${d.httpStatus}` : '', d.preferredApi ? `api=${d.preferredApi}` : '', d.cause ? `cause=${d.cause}` : '', `capabilities=createImageBitmap:${d.capabilities.createImageBitmap},OffscreenCanvas:${d.capabilities.offscreenCanvas},HTMLImageElement.decode:${d.capabilities.htmlImageDecode},Canvas2D:${d.capabilities.canvas2d}`].filter(Boolean);
        return `Terrain surface startup failure: ${bits.join(' | ')}`;
    }
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
function absAssetUrl(entry, set) { return new URL(assetUrl(entry, set), document.baseURI).href; }
function errorText(error) { return error instanceof Error ? `${error.name}: ${error.message}` : String(error); }
function timeoutAfter(ms, label) { return new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)); }
async function imageFromUrl(url, entry, stage, capabilities) {
    return await Promise.race([new Promise((resolve, reject) => { const img = new Image(); if ('decoding' in img)
            img.decoding = 'async'; img.onload = () => resolve({ source: img, width: img.naturalWidth || img.width, height: img.naturalHeight || img.height }); img.onerror = () => reject(new TerrainSurfaceResourceError(`Terrain image failed: ${url}`, { stage, url, assetId: entry.id, family: entry.family, preferredApi: 'HTMLImageElement.onload', cause: 'image error event', capabilities })); img.src = url; }), timeoutAfter(RESOURCE_TIMEOUT_MS, `Image ${entry.id}`).catch(error => { if (error instanceof TerrainSurfaceResourceError)
            throw error; throw new TerrainSurfaceResourceError(`Terrain image timeout: ${url}`, { stage: 'timeout', url, assetId: entry.id, family: entry.family, preferredApi: 'HTMLImageElement.onload', cause: errorText(error), capabilities }); })]);
}
async function loadTerrainImage(entry, set, capabilities) {
    const url = absAssetUrl(entry, set);
    let response;
    let blob;
    let fetchFailure, bitmapFailure, blobImageFailure;
    try {
        response = await Promise.race([fetch(url, { cache: 'force-cache' }), timeoutAfter(RESOURCE_TIMEOUT_MS, `Fetch ${entry.id}`)]);
        if (!response.ok)
            throw new TerrainSurfaceResourceError(`Terrain asset HTTP ${response.status}: ${url}`, { stage: 'http', url, assetId: entry.id, family: entry.family, httpStatus: response.status, preferredApi: 'fetch', capabilities });
        blob = await response.blob();
    }
    catch (error) {
        if (error instanceof TerrainSurfaceResourceError)
            throw error;
        fetchFailure = error;
    }
    if (blob && capabilities.createImageBitmap) {
        try {
            const bitmap = await Promise.race([globalThis.createImageBitmap(blob), timeoutAfter(RESOURCE_TIMEOUT_MS, `createImageBitmap ${entry.id}`)]);
            return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        }
        catch (error) {
            bitmapFailure = error;
            console.warn('EASTFRONT terrain createImageBitmap fallback', entry.id, url, error);
        }
    }
    if (blob) {
        let objectUrl;
        try {
            objectUrl = URL.createObjectURL(blob);
            return await imageFromUrl(objectUrl, entry, 'html-image-load', capabilities);
        }
        catch (error) {
            blobImageFailure = error;
            console.warn('EASTFRONT terrain blob HTMLImage fallback failed', entry.id, url, error);
        }
        finally {
            if (objectUrl)
                URL.revokeObjectURL(objectUrl);
        }
    }
    try {
        return await imageFromUrl(url, entry, 'direct-image-load', capabilities);
    }
    catch (error) {
        const causes = [fetchFailure ? `fetch=${errorText(fetchFailure)}` : '', bitmapFailure ? `createImageBitmap=${errorText(bitmapFailure)}` : '', blobImageFailure ? `blobImage=${errorText(blobImageFailure)}` : '', `directImage=${errorText(error)}`].filter(Boolean).join('; ');
        const details = { stage: fetchFailure ? 'fetch' : 'direct-image-load', url, assetId: entry.id, family: entry.family, preferredApi: capabilities.createImageBitmap ? 'fetch→createImageBitmap→HTMLImageElement(blob)→HTMLImageElement(url)' : 'fetch→HTMLImageElement(blob)→HTMLImageElement(url)', cause: causes, capabilities };
        if (response)
            details.httpStatus = response.status;
        throw new TerrainSurfaceResourceError(`All terrain image decode/load paths failed: ${url}`, details);
    }
}
function createImageCache(set) {
    const cache = new Map(), resolved = new Map(), urls = new Set(), capabilities = terrainSurfaceCapabilities();
    function touch(url, image) { resolved.delete(url); resolved.set(url, image); while (resolved.size > MAX_RETAINED_TERRAIN_IMAGES) {
        const oldest = resolved.keys().next().value;
        if (!oldest)
            break;
        const victim = resolved.get(oldest);
        resolved.delete(oldest);
        cache.delete(oldest);
        victim?.release?.();
    } }
    return { urls, get(entry) { const url = absAssetUrl(entry, set); urls.add(url); const existing = resolved.get(url); if (existing) {
            touch(url, existing);
            return Promise.resolve(existing);
        } let promise = cache.get(url); if (!promise) {
            promise = loadTerrainImage(entry, set, capabilities).then(image => { touch(url, image); return image; }).catch(error => { cache.delete(url); throw error; });
            cache.set(url, promise);
        } return promise; }, releaseAll() { for (const image of resolved.values())
            image.release?.(); resolved.clear(); cache.clear(); } };
}
function pathHex(ctx, c) { const pts = hexPolygon(c); ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++)
    ctx.lineTo(pts[i].x, pts[i].y); ctx.closePath(); }
function terrainBaseFill(t) { switch (t) {
    case 'LAKE': return '#6f8f94';
    case 'HILL': return '#a99f78';
    case 'ROUGH': return '#91896f';
    default: return '#aca888';
} }
function drawCover(ctx, img, x, y, w, h) { const sw = img.width || w, sh = img.height || h, scale = Math.max(w / sw, h / sh), cw = w / scale, ch = h / scale, sx = (sw - cw) / 2, sy = (sh - ch) / 2; ctx.drawImage(img.source, sx, sy, cw, ch, x, y, w, h); }
function rotation(entry, c, seed, salt) { return entry.rotation === '60deg' ? (visualSeed(seed, c, `${entry.id}|${salt}|rot`) % 6) * (Math.PI / 3) : 0; }
function mirror(entry, c, seed, salt) { return entry.mirror && visualSeed(seed, c, `${entry.id}|${salt}|mirror`) % 2 === 1 ? -1 : 1; }
async function drawHexAsset(ctx, cache, entry, c, size, seed, opacity, salt, composite = 'source-over') {
    const img = await cache.get(entry), p = hexToPixel(c);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = composite;
    ctx.translate(p.x, p.y);
    ctx.rotate(rotation(entry, c, seed, salt));
    ctx.scale(mirror(entry, c, seed, salt), 1);
    drawCover(ctx, img, -size / 2, -size / 2, size, size);
    ctx.restore();
}
function neighborTerrain(model, c, terrain) { const map = new Map(model.hexes.map(h => [`${h.coord.q},${h.coord.r}`, h.terrain])); return [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map(([dq, dr]) => ({ q: c.q + dq, r: c.r + dr })).filter(n => map.get(`${n.q},${n.r}`) === terrain); }
function bump(cat, key, n = 1) { cat[key] = (cat[key] ?? 0) + n; }
async function drawTerrainHex(ctx, cache, model, hex, seed, lod, set, cats) {
    const c = hex.coord;
    ctx.save();
    pathHex(ctx, c);
    ctx.clip();
    ctx.globalAlpha = hex.terrain === 'PLAIN' ? .15 : hex.terrain === 'HILL' || hex.terrain === 'ROUGH' ? .22 : .1;
    ctx.fillStyle = terrainBaseFill(hex.terrain);
    ctx.fill();
    ctx.restore();
    let draws = 0;
    const draw = async (e, size, op, salt, comp = 'source-over') => { if (!e)
        return; ctx.save(); pathHex(ctx, c); ctx.clip(); await drawHexAsset(ctx, cache, e, c, size, seed, op, salt, comp); ctx.restore(); draws++; };
    switch (hex.terrain) {
        case 'PLAIN': {
            const base = terrainAssetCatalog.selectVariant('plain_ground', seed, c);
            if (base && entryVisibleAtLod(base, lod))
                await draw(base, HEX_SIZE * 2.45, .46, 'plain-base');
            if (lod !== 'far' && visualSeed(seed, c, 'plain-field') % 100 < 34)
                await draw(terrainAssetCatalog.selectVariant('plain_field', seed, c), HEX_SIZE * 2.35, lod === 'close' ? .68 : .48, 'plain-field');
            bump(cats, 'Plain');
            break;
        }
        case 'FOREST': {
            await draw(terrainAssetCatalog.selectVariant('forest_mass', seed, c), HEX_SIZE * (lod === 'far' ? 2.15 : 2.5), lod === 'far' ? .88 : .98, 'forest-mass');
            if (lod !== 'far') {
                if (lod === 'close' && visualSeed(seed, c, 'forest-clearing') % 4 === 0)
                    await draw(terrainAssetCatalog.selectVariant('forest_clearing', seed, c), HEX_SIZE * 2.05, .19, 'forest-clearing', 'screen');
                for (const n of neighborTerrain(model, c, 'FOREST'))
                    if (unorderedEdgeVisualSeed(seed, c, n, 'forest-fringe') % 100 < 46)
                        await draw(terrainAssetCatalog.selectVariant('forest_fringe', seed, c, `${n.q},${n.r}`), HEX_SIZE * 2.65, .62, 'forest-fringe');
            }
            bump(cats, 'Forest');
            break;
        }
        case 'HILL': {
            const e = terrainAssetCatalog.selectVariant('hill', seed, c);
            if (e?.companion) {
                await draw({ ...e, file: e.companion, id: `${e.id}-material`, family: 'hill_material' }, HEX_SIZE * 2.38, lod === 'far' ? .62 : .9, 'hill-material');
            }
            ctx.save();
            pathHex(ctx, c);
            ctx.clip();
            ctx.globalAlpha = lod === 'far' ? .12 : .20;
            ctx.fillStyle = '#efe6bd';
            ctx.translate(-2, -2);
            ctx.fill();
            ctx.restore();
            bump(cats, 'Hill/Rough');
            break;
        }
        case 'ROUGH': {
            if (lod === 'far') {
                ctx.save();
                pathHex(ctx, c);
                ctx.globalAlpha = .28;
                ctx.fillStyle = '#6f6753';
                ctx.fill();
                ctx.restore();
            }
            else {
                await draw(terrainAssetCatalog.selectVariant('rough', seed, c), HEX_SIZE * 2.4, .9, 'rough-base');
                if (lod === 'close' && visualSeed(seed, c, 'rock-cluster') % 2 === 0)
                    await draw(terrainAssetCatalog.selectVariant('rough_rock_cluster', seed, c), HEX_SIZE * 1.5, .78, 'rough-rock');
            }
            bump(cats, 'Hill/Rough');
            break;
        }
        case 'MARSH': {
            await draw(terrainAssetCatalog.selectVariant('marsh_wet', seed, c), HEX_SIZE * 2.4, lod === 'far' ? .55 : .9, 'marsh-wet');
            if (lod !== 'far' && visualSeed(seed, c, 'pool') % 100 < 72)
                await draw(terrainAssetCatalog.selectVariant('marsh_pool', seed, c), HEX_SIZE * 2.05, .72, 'marsh-pool');
            if (lod === 'close' && visualSeed(seed, c, 'reed') % 100 < 58)
                await draw(terrainAssetCatalog.selectVariant('marsh_reed', seed, c), HEX_SIZE * 1.55, .84, 'marsh-reed');
            bump(cats, 'Marsh');
            break;
        }
        case 'CITY':
        case 'MAIN_CITY':
        case 'OUTER_CITY': {
            const fam = hex.terrain === 'MAIN_CITY' ? 'city_major' : hex.terrain === 'OUTER_CITY' ? 'city_small' : 'city_medium';
            await draw(terrainAssetCatalog.selectVariant(fam, seed, c), HEX_SIZE * (hex.terrain === 'MAIN_CITY' ? 2.5 : 2.2), .96, 'city-primary');
            if (lod === 'close' && visualSeed(seed, c, 'city-component') % 2 === 0)
                await draw(terrainAssetCatalog.selectVariant('city_component', seed, c), HEX_SIZE * 1.35, .72, 'city-component');
            bump(cats, 'City');
            break;
        }
        case 'LAKE': {
            ctx.save();
            pathHex(ctx, c);
            ctx.globalAlpha = .93;
            ctx.fillStyle = '#71989d';
            ctx.fill();
            ctx.restore();
            bump(cats, 'Lake');
            break;
        }
    }
    return draws;
}
async function drawSegment(ctx, cache, e, a, b, height, opacity) { const img = await cache.get(e), dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), angle = Math.atan2(dy, dx); ctx.save(); ctx.globalAlpha = opacity; ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2); ctx.rotate(angle); ctx.drawImage(img.source, -len / 2, -height / 2, len, height); ctx.restore(); }
async function drawInfrastructure(ctx, cache, model, seed, lod, cats) {
    let draws = 0;
    for (const edge of model.edges) {
        if (edge.road) {
            const list = terrainAssetCatalog.byFamily('road'), e = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'road') % list.length];
            if (e) {
                await drawSegment(ctx, cache, e, hexToPixel(edge.a), hexToPixel(edge.b), lod === 'far' ? 7 : 11, .88);
                draws++;
                bump(cats, 'Road');
            }
        }
        if (edge.railway?.present) {
            const a = hexToPixel(edge.a), b = hexToPixel(edge.b), list = terrainAssetCatalog.byFamily('railway_ballast'), ballast = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'ballast') % list.length];
            if (lod !== 'far') {
                const shadow = terrainAssetCatalog.byId('RAIL_SHADOW');
                if (shadow) {
                    await drawSegment(ctx, cache, shadow, a, b, 12, .48);
                    draws++;
                }
            }
            if (ballast) {
                await drawSegment(ctx, cache, ballast, a, b, lod === 'far' ? 7 : 10, .9);
                draws++;
            }
            if (lod !== 'far') {
                for (const [id, h, op] of [['RAIL_SLEEP', 8, .84], ['RAIL_PAIR', 6, .95]]) {
                    const e = terrainAssetCatalog.byId(id);
                    if (e) {
                        await drawSegment(ctx, cache, e, a, b, h, op);
                        draws++;
                    }
                }
            }
            bump(cats, 'Railway');
        }
        if (edge.river) {
            const s = sharedHexEdge(edge.a, edge.b);
            if (s) {
                const major = edge.river === 'MAJOR';
                for (const [id, h, op, enabled] of [['RIV_SHADOW', major ? 18 : 14, .48, lod !== 'far'], ['RIV_BANK01', major ? 14 : 10, .88, lod !== 'far'], ['RIV_WATER01', major ? 11 : 7, .96, true], ['RIV_HI01', major ? 6 : 4, .7, lod !== 'far'], ['RIV_VEG01', major ? 17 : 12, .58, lod === 'close']]) {
                    const e = terrainAssetCatalog.byId(id);
                    if (e && enabled) {
                        await drawSegment(ctx, cache, e, s[0], s[1], h, op);
                        draws++;
                    }
                }
                bump(cats, 'River');
            }
        }
        if (edge.bridge && !edge.bridge.destroyed) {
            const a = hexToPixel(edge.a), b = hexToPixel(edge.b), family = edge.railway?.present ? 'bridge_rail' : 'bridge_road', list = terrainAssetCatalog.byFamily(family), br = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'bridge') % list.length];
            if (br) {
                const img = await cache.get(br), angle = Math.atan2(b.y - a.y, b.x - a.x);
                ctx.save();
                ctx.translate((a.x + b.x) / 2, (a.y + b.y) / 2);
                ctx.rotate(angle);
                drawCover(ctx, img, -27, -14, 54, 28);
                ctx.restore();
                draws++;
                bump(cats, 'Bridge');
            }
        }
    }
    return draws;
}
function continuityBand(a, b, seed, lod) { const d = marshContinuityDecision(seed, a, b); if (!d.wet)
    return null; const s = sharedHexEdge(a, b); if (!s)
    return null; const [p1, p2] = s, dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2; const shape = unorderedEdgeVisualSeed(seed, a, b, 'marsh-wet-shape'), j = (n) => ((shape >>> n) & 15) / 15, half = len * .27 * (.92 + j(0) * .16), base = (lod === 'far' ? 5.8 : lod === 'medium' ? 8.2 : 10.4), ws = [.82 + j(4) * .26, 1 + j(8) * .22, .84 + j(12) * .25, .9 + j(16) * .22, 1 + j(20) * .18, .86 + j(24) * .24].map(v => v * base), raw = [[-half, ws[0]], [0, ws[1]], [half, ws[2]], [half, -ws[3]], [0, -ws[4]], [-half, -ws[5]]]; return { points: raw.map(([along, normal]) => ({ x: mx + ux * along + nx * normal, y: my + uy * along + ny * normal })), mud: d.mud }; }
function drawMarshContinuity(ctx, model, seed, lod) { const terrain = new Map(model.hexes.map(h => [`${h.coord.q},${h.coord.r}`, h.terrain])); const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; for (const h of model.hexes) {
    if (h.terrain !== 'MARSH')
        continue;
    const a = h.coord, ka = `${a.q},${a.r}`;
    for (const [dq, dr] of dirs) {
        const b = { q: a.q + dq, r: a.r + dr }, kb = `${b.q},${b.r}`;
        if (ka >= kb || terrain.get(kb) !== 'MARSH')
            continue;
        const band = continuityBand(a, b, seed, lod);
        if (!band)
            continue;
        ctx.save();
        ctx.beginPath();
        for (const c of [a, b]) {
            const pts = hexPolygon(c);
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++)
                ctx.lineTo(pts[i].x, pts[i].y);
            ctx.closePath();
        }
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(band.points[0].x, band.points[0].y);
        for (let i = 1; i < band.points.length; i++)
            ctx.lineTo(band.points[i].x, band.points[i].y);
        ctx.closePath();
        ctx.globalAlpha = lod === 'far' ? .20 : lod === 'medium' ? .28 : .34;
        ctx.fillStyle = '#729092';
        ctx.fill();
        ctx.restore();
    }
} }
function addPlannedEntry(entries, entry) { if (entry)
    entries.set(`${entry.id}|${entry.file}`, entry); }
function buildSurfacePlan(model, seed, lod) {
    const entries = new Map(), categories = {};
    const ground = terrainAssetCatalog.byFamily('ground'), g = ground[seed % ground.length] ?? ground[0];
    addPlannedEntry(entries, g);
    if (g)
        bump(categories, 'Ground');
    for (const hex of model.hexes) {
        const c = hex.coord;
        switch (hex.terrain) {
            case 'PLAIN': {
                const e = terrainAssetCatalog.selectVariant('plain_ground', seed, c);
                if (e && entryVisibleAtLod(e, lod))
                    addPlannedEntry(entries, e);
                if (lod !== 'far' && visualSeed(seed, c, 'plain-field') % 100 < 34)
                    addPlannedEntry(entries, terrainAssetCatalog.selectVariant('plain_field', seed, c));
                bump(categories, 'Plain');
                break;
            }
            case 'FOREST': {
                addPlannedEntry(entries, terrainAssetCatalog.selectVariant('forest_mass', seed, c));
                if (lod !== 'far') {
                    if (lod === 'close' && visualSeed(seed, c, 'forest-clearing') % 4 === 0)
                        addPlannedEntry(entries, terrainAssetCatalog.selectVariant('forest_clearing', seed, c));
                    for (const n of neighborTerrain(model, c, 'FOREST'))
                        if (unorderedEdgeVisualSeed(seed, c, n, 'forest-fringe') % 100 < 46)
                            addPlannedEntry(entries, terrainAssetCatalog.selectVariant('forest_fringe', seed, c, `${n.q},${n.r}`));
                }
                bump(categories, 'Forest');
                break;
            }
            case 'HILL': {
                const e = terrainAssetCatalog.selectVariant('hill', seed, c);
                if (e?.companion)
                    addPlannedEntry(entries, { ...e, file: e.companion, id: `${e.id}-material`, family: 'hill_material' });
                bump(categories, 'Hill/Rough');
                break;
            }
            case 'ROUGH': {
                if (lod !== 'far') {
                    addPlannedEntry(entries, terrainAssetCatalog.selectVariant('rough', seed, c));
                    if (lod === 'close' && visualSeed(seed, c, 'rock-cluster') % 2 === 0)
                        addPlannedEntry(entries, terrainAssetCatalog.selectVariant('rough_rock_cluster', seed, c));
                }
                bump(categories, 'Hill/Rough');
                break;
            }
            case 'MARSH': {
                addPlannedEntry(entries, terrainAssetCatalog.selectVariant('marsh_wet', seed, c));
                if (lod !== 'far' && visualSeed(seed, c, 'pool') % 100 < 72)
                    addPlannedEntry(entries, terrainAssetCatalog.selectVariant('marsh_pool', seed, c));
                if (lod === 'close' && visualSeed(seed, c, 'reed') % 100 < 58)
                    addPlannedEntry(entries, terrainAssetCatalog.selectVariant('marsh_reed', seed, c));
                bump(categories, 'Marsh');
                break;
            }
            case 'CITY':
            case 'MAIN_CITY':
            case 'OUTER_CITY': {
                const fam = hex.terrain === 'MAIN_CITY' ? 'city_major' : hex.terrain === 'OUTER_CITY' ? 'city_small' : 'city_medium';
                addPlannedEntry(entries, terrainAssetCatalog.selectVariant(fam, seed, c));
                if (lod === 'close' && visualSeed(seed, c, 'city-component') % 2 === 0)
                    addPlannedEntry(entries, terrainAssetCatalog.selectVariant('city_component', seed, c));
                bump(categories, 'City');
                break;
            }
            case 'LAKE':
                bump(categories, 'Lake');
                break;
        }
    }
    for (const edge of model.edges) {
        if (edge.road) {
            const list = terrainAssetCatalog.byFamily('road');
            addPlannedEntry(entries, list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'road') % list.length]);
            bump(categories, 'Road');
        }
        if (edge.railway?.present) {
            const list = terrainAssetCatalog.byFamily('railway_ballast');
            addPlannedEntry(entries, list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'ballast') % list.length]);
            if (lod !== 'far') {
                addPlannedEntry(entries, terrainAssetCatalog.byId('RAIL_SHADOW'));
                addPlannedEntry(entries, terrainAssetCatalog.byId('RAIL_SLEEP'));
                addPlannedEntry(entries, terrainAssetCatalog.byId('RAIL_PAIR'));
            }
            bump(categories, 'Railway');
        }
        if (edge.river) {
            addPlannedEntry(entries, terrainAssetCatalog.byId('RIV_WATER01'));
            if (lod !== 'far') {
                addPlannedEntry(entries, terrainAssetCatalog.byId('RIV_SHADOW'));
                addPlannedEntry(entries, terrainAssetCatalog.byId('RIV_BANK01'));
                addPlannedEntry(entries, terrainAssetCatalog.byId('RIV_HI01'));
            }
            if (lod === 'close')
                addPlannedEntry(entries, terrainAssetCatalog.byId('RIV_VEG01'));
            bump(categories, 'River');
        }
        if (edge.bridge && !edge.bridge.destroyed) {
            const family = edge.railway?.present ? 'bridge_rail' : 'bridge_road', list = terrainAssetCatalog.byFamily(family);
            addPlannedEntry(entries, list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'bridge') % list.length]);
            bump(categories, 'Bridge');
        }
    }
    const planned = [...entries.values()];
    return { entries: planned, publicPlan: Object.freeze({ assetIds: Object.freeze(planned.map(e => e.id)), assetFiles: Object.freeze(planned.map(e => e.file)), categories: Object.freeze({ ...categories }) }) };
}
export function terrainSurfacePlan(model, seed, lod = 'medium') { return buildSurfacePlan(model, seed, lod).publicPlan; }
async function drawGround(ctx, cache, model, seed) { const ground = terrainAssetCatalog.byFamily('ground'), e = ground[seed % ground.length] ?? ground[0]; if (!e)
    return 0; const img = await cache.get(e), pts = model.hexes.flatMap(h => hexPolygon(h.coord)), xs = pts.map(p => p.x), ys = pts.map(p => p.y), minX = Math.min(...xs) - HEX_SIZE, maxX = Math.max(...xs) + HEX_SIZE, minY = Math.min(...ys) - HEX_SIZE, maxY = Math.max(...ys) + HEX_SIZE; ctx.save(); ctx.translate(seed % 97, seed % 71); const tile = 220; for (let y = Math.floor((minY - (seed % 71)) / tile) * tile; y < maxY; y += tile)
    for (let x = Math.floor((minX - (seed % 97)) / tile) * tile; x < maxX; x += tile)
        drawCover(ctx, img, x, y, tile, tile); ctx.restore(); return Math.ceil((maxX - minX) / tile) * Math.ceil((maxY - minY) / tile); }
export async function buildCachedTerrainSurface(model, seed, assetSet = 'p5', lod = 'medium') {
    const viewBox = viewBoxForHexes(model.hexes), canvas = document.createElement('canvas');
    canvas.id = 'terrain-surface';
    canvas.className = 'terrain-surface';
    canvas.width = Math.ceil(viewBox.width);
    canvas.height = Math.ceil(viewBox.height);
    canvas.dataset.surface = 'cached-production';
    canvas.dataset.seed = String(seed);
    canvas.dataset.lod = lod;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx)
        throw new TerrainSurfaceResourceError('Canvas 2D is unavailable for production terrain surface.', { stage: 'canvas-context', capabilities: terrainSurfaceCapabilities() });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.fillStyle = '#bbb393';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.translate(-viewBox.minX, -viewBox.minY);
    const cache = createImageCache(assetSet), planned = buildSurfacePlan(model, seed, lod), cats = {};
    try {
        let imageDraws = await drawGround(ctx, cache, model, seed);
        bump(cats, 'Ground');
        for (const h of model.hexes)
            imageDraws += await drawTerrainHex(ctx, cache, model, h, seed, lod, assetSet, cats);
        drawMarshContinuity(ctx, model, seed, lod);
        imageDraws += await drawInfrastructure(ctx, cache, model, seed, lod, cats);
        canvas.setAttribute('aria-hidden', 'true');
        const stats = { width: canvas.width, height: canvas.height, imageDraws, uniqueAssets: cache.urls.size, categories: planned.publicPlan.categories };
        canvas.dataset.buildCount = String(++terrainSurfaceBuildCount);
        canvas.dataset.categories = JSON.stringify(stats.categories);
        return { canvas, viewBox, seed, assetSet, lod, stats };
    }
    catch (error) {
        if (error instanceof TerrainSurfaceResourceError)
            throw error;
        throw new TerrainSurfaceResourceError('Terrain surface canvas draw failed', { stage: 'canvas-draw', cause: errorText(error), capabilities: terrainSurfaceCapabilities() });
    }
    finally {
        cache.releaseAll();
    }
}
