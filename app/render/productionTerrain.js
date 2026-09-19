import { coreHexKey } from '../core-adapter/core.js';
import { HEX_SIZE, hexPolygon, hexToPixel, polygonPointsString, sharedHexEdge } from '../geometry/hex.js';
import { assetUrl, entryVisibleAtLod, terrainAssetCatalog, unorderedEdgeVisualSeed, visualSeed } from './terrainAssets.js';
function imageTransform(entry, c, seed, salt = '') {
    const p = hexToPixel(c);
    const rot = entry.rotation === '60deg' ? (visualSeed(seed, c, `${entry.id}|${salt}|rot`) % 6) * 60 : 0;
    const mirror = (entry.mirror && visualSeed(seed, c, `${entry.id}|${salt}|mirror`) % 2 === 1) ? -1 : 1;
    return `translate(${p.x} ${p.y}) rotate(${rot}) scale(${mirror} 1) translate(${-p.x} ${-p.y})`;
}
export function terrainAssetTransform(entry, c, seed, salt = '') { return imageTransform(entry, c, seed, salt); }
function image(entry, c, size, seed, assetSet, opacity = 1, extra = '', salt = '') {
    const p = hexToPixel(c);
    return `<image href="${assetUrl(entry, assetSet)}" x="${p.x - size / 2}" y="${p.y - size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" opacity="${opacity}" transform="${imageTransform(entry, c, seed, salt)}" data-asset-id="${entry.id}" data-family="${entry.family}" ${extra}/>`;
}
function clipId(c) { return `prod-clip-${c.q}-${c.r}`.replaceAll('-', 'n'); }
function hillMaskId(c) { return `prod-hill-mask-${c.q}-${c.r}`.replaceAll('-', 'n'); }
export function productionFamilyForTerrain(t) { switch (t) {
    case 'PLAIN': return 'plain_ground';
    case 'FOREST': return 'forest_mass';
    case 'HILL': return 'hill';
    case 'ROUGH': return 'rough';
    case 'MARSH': return 'marsh_wet';
    case 'CITY': return 'city_medium';
    case 'MAIN_CITY': return 'city_major';
    case 'OUTER_CITY': return 'city_small';
    default: return null;
} }
function terrainBaseFill(t) { switch (t) {
    case 'LAKE': return '#6f8f94';
    case 'HILL': return '#a99f78';
    case 'ROUGH': return '#91896f';
    default: return '#aca888';
} }
function hasNeighborTerrain(model, hex, terrain) { const keys = new Map(model.hexes.map(h => [coreHexKey(h.coord), h.terrain])); const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]]; return dirs.map(([dq, dr]) => ({ q: hex.q + dq, r: hex.r + dr })).filter(c => keys.get(coreHexKey(c)) === terrain); }
export function marshContinuityDecision(seed, a, b) {
    const edgeSeed = unorderedEdgeVisualSeed(seed, a, b, 'marsh-continuity');
    const wet = (edgeSeed % 100) < 42;
    return { wet, mud: wet && (((edgeSeed >>> 8) % 100) < 44), reeds: wet && (((edgeSeed >>> 16) % 100) < 38), edgeSeed };
}
function marshEdgeId(a, b) { const ka = coreHexKey(a), kb = coreHexKey(b); return `${ka < kb ? ka : kb}|${ka < kb ? kb : ka}`; }
function marshEdgeClipId(a, b) { return `prod-marsh-edge-${marshEdgeId(a, b)}`.replace(/[^a-zA-Z0-9_]/g, 'n'); }
function organicEdgeBandPoints(a, b, seed, lod, kind) {
    const shared = sharedHexEdge(a, b);
    if (!shared)
        return '';
    const [p1, p2] = shared, dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
    const shape = unorderedEdgeVisualSeed(seed, a, b, `marsh-${kind}-shape`), j = (n) => ((shape >>> n) & 15) / 15;
    const halfSpan = len * (kind === 'wet' ? .27 : .21) * (0.92 + j(0) * .16);
    const baseWidth = (lod === 'far' ? 5.8 : lod === 'medium' ? 8.2 : 10.4) * (kind === 'wet' ? 1 : .58);
    const widths = [.82 + j(4) * .26, 1 + j(8) * .22, .84 + j(12) * .25, .9 + j(16) * .22, 1 + j(20) * .18, .86 + j(24) * .24].map(v => v * baseWidth);
    const raw = [[-halfSpan, widths[0]], [0, widths[1]], [halfSpan, widths[2]], [halfSpan, -widths[3]], [0, -widths[4]], [-halfSpan, -widths[5]]];
    return raw.map(([along, normal]) => `${(mx + ux * along + nx * normal).toFixed(2)},${(my + uy * along + ny * normal).toFixed(2)}`).join(' ');
}
function renderMarshReeds(a, b, seed, lod) {
    if (lod === 'far')
        return '';
    const shared = sharedHexEdge(a, b);
    if (!shared)
        return '';
    const [p1, p2] = shared, dx = p2.x - p1.x, dy = p2.y - p1.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux, mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2, es = unorderedEdgeVisualSeed(seed, a, b, 'marsh-reed-shape');
    const count = lod === 'close' ? 5 : 3, paths = [];
    for (let i = 0; i < count; i++) {
        const frac = (i + 1) / (count + 1), along = (frac - .5) * len * .52 + (((es >>> (i * 3)) & 7) - 3) * .45, normal = (((es >>> (i * 4 + 2)) & 7) - 3) * .55;
        const cx = mx + ux * along + nx * normal, cy = my + uy * along + ny * normal, h = (lod === 'close' ? 5.6 : 4.2) + ((es >>> (i * 2 + 1)) & 3) * .45;
        paths.push(`<path d="M${(cx - nx * h * .48).toFixed(2)} ${(cy - ny * h * .48).toFixed(2)} Q${(cx + ux * 1.2).toFixed(2)} ${(cy + uy * 1.2).toFixed(2)} ${(cx + nx * h * .52).toFixed(2)} ${(cy + ny * h * .52).toFixed(2)}"/>`);
    }
    return `<g class="prod-marsh-edge-reeds" data-role="marsh-reed-continuity" fill="none" stroke="#556a55" stroke-width="1.15" stroke-linecap="round" opacity="${lod === 'close' ? '.56' : '.38'}">${paths.join('')}</g>`;
}
export function renderMarshContinuity(model, seed, lod) {
    const terrainByKey = new Map(model.hexes.map(h => [coreHexKey(h.coord), h.terrain]));
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    const parts = [];
    for (const h of model.hexes) {
        if (h.terrain !== 'MARSH')
            continue;
        const a = h.coord, ka = coreHexKey(a);
        for (const [dq, dr] of dirs) {
            const b = { q: a.q + dq, r: a.r + dr }, kb = coreHexKey(b);
            if (ka >= kb || terrainByKey.get(kb) !== 'MARSH')
                continue;
            const d = marshContinuityDecision(seed, a, b);
            if (!d.wet)
                continue;
            const shared = sharedHexEdge(a, b);
            if (!shared)
                continue;
            const clip = marshEdgeClipId(a, b), edge = marshEdgeId(a, b), wetPts = organicEdgeBandPoints(a, b, seed, lod, 'wet'), mudPts = organicEdgeBandPoints(a, b, seed, lod, 'mud');
            const mud = d.mud && lod !== 'far' ? `<polygon points="${mudPts}" fill="#776d58" opacity="${lod === 'close' ? '.22' : '.16'}" data-role="marsh-mud-continuity"/>` : '';
            const reeds = d.reeds ? renderMarshReeds(a, b, seed, lod) : '';
            parts.push(`<g class="prod-marsh-continuity" data-marsh-edge="${edge}" data-marsh-wet="1" data-marsh-mud="${d.mud ? 1 : 0}" data-marsh-reeds="${d.reeds ? 1 : 0}" data-edge-seed="${d.edgeSeed}" pointer-events="none"><defs><clipPath id="${clip}"><polygon points="${polygonPointsString(a)}"/><polygon points="${polygonPointsString(b)}"/></clipPath></defs><g clip-path="url(#${clip})"><polygon points="${wetPts}" fill="#729092" opacity="${lod === 'far' ? '.20' : lod === 'medium' ? '.28' : '.34'}" data-role="marsh-wet-continuity"/>${mud}${reeds}</g></g>`);
        }
    }
    return `<g id="production-marsh-continuity-layer">${parts.join('')}</g>`;
}
function renderGlobalSubstrate(model, seed, assetSet) {
    const ground = terrainAssetCatalog.byFamily('ground');
    const chosen = ground[seed % ground.length] ?? ground[0];
    if (!chosen)
        return '';
    const pts = model.hexes.flatMap(h => hexPolygon(h.coord));
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
    const minX = Math.min(...xs) - HEX_SIZE, maxX = Math.max(...xs) + HEX_SIZE, minY = Math.min(...ys) - HEX_SIZE, maxY = Math.max(...ys) + HEX_SIZE;
    return `<defs><pattern id="prod-ground-pattern" patternUnits="userSpaceOnUse" width="220" height="220" patternTransform="translate(${seed % 97} ${seed % 71}) rotate(${(seed % 4) * 90})"><image href="${assetUrl(chosen, assetSet)}" x="0" y="0" width="220" height="220" preserveAspectRatio="xMidYMid slice"/></pattern></defs><rect x="${minX}" y="${minY}" width="${maxX - minX}" height="${maxY - minY}" fill="url(#prod-ground-pattern)" class="prod-ground-substrate"/>`;
}
function renderPlain(c, seed, lod, assetSet) {
    let layers = '';
    const base = terrainAssetCatalog.selectVariant('plain_ground', seed, c);
    if (base && entryVisibleAtLod(base, lod))
        layers += image(base, c, HEX_SIZE * 2.45, seed, assetSet, .46, '', 'plain-base');
    if (lod !== 'far' && visualSeed(seed, c, 'plain-field') % 100 < 34) {
        const f = terrainAssetCatalog.selectVariant('plain_field', seed, c);
        if (f)
            layers += image(f, c, HEX_SIZE * 2.35, seed, assetSet, lod === 'close' ? .68 : .48, '', 'plain-field');
    }
    return layers;
}
function renderForest(model, c, seed, lod, assetSet) {
    let layers = '';
    const mass = terrainAssetCatalog.selectVariant('forest_mass', seed, c);
    if (mass)
        layers += image(mass, c, HEX_SIZE * (lod === 'far' ? 2.15 : 2.5), seed, assetSet, lod === 'far' ? .88 : .98, '', 'forest-mass');
    if (lod !== 'far') {
        if (lod === 'close' && visualSeed(seed, c, 'forest-clearing') % 4 === 0) {
            const cl = terrainAssetCatalog.selectVariant('forest_clearing', seed, c);
            if (cl)
                layers += image(cl, c, HEX_SIZE * 2.05, seed, assetSet, .19, 'style="mix-blend-mode:screen"', 'forest-clearing');
        }
        for (const n of hasNeighborTerrain(model, c, 'FOREST')) {
            if (unorderedEdgeVisualSeed(seed, c, n, 'forest-fringe') % 100 < 46) {
                const fr = terrainAssetCatalog.selectVariant('forest_fringe', seed, c, coreHexKey(n));
                if (fr)
                    layers += image(fr, c, HEX_SIZE * 2.65, seed, assetSet, .62, '', 'forest-fringe');
            }
        }
    }
    return layers;
}
function renderHill(c, seed, lod, assetSet) {
    const e = terrainAssetCatalog.selectVariant('hill', seed, c);
    if (!e)
        return '';
    const material = e.companion ? ({ ...e, file: e.companion, id: `${e.id}-material`, family: 'hill_material' }) : undefined;
    let layers = '';
    if (material)
        layers += image(material, c, HEX_SIZE * 2.38, seed, assetSet, lod === 'far' ? .62 : .9, '', 'hill-material');
    const p = hexToPixel(c), size = HEX_SIZE * 2.38, mask = hillMaskId(c), t = imageTransform(e, c, seed, 'hill-height-mask');
    layers += `<defs><mask id="${mask}" maskUnits="userSpaceOnUse" x="${p.x - size / 2}" y="${p.y - size / 2}" width="${size}" height="${size}"><image href="${assetUrl(e, assetSet)}" x="${p.x - size / 2}" y="${p.y - size / 2}" width="${size}" height="${size}" preserveAspectRatio="xMidYMid slice" transform="${t}" data-role="hill-height-mask"/></mask></defs>`;
    layers += `<polygon points="${polygonPointsString(c)}" fill="#efe6bd" opacity="${lod === 'far' ? .12 : .20}" mask="url(#${mask})" transform="translate(-2 -2)" data-role="hill-nw-light"/>`;
    return layers;
}
function renderRough(c, seed, lod, assetSet) {
    if (lod === 'far')
        return `<polygon points="${polygonPointsString(c)}" fill="#6f6753" opacity=".28" data-role="rough-far-mass"/>`;
    let layers = '';
    const base = terrainAssetCatalog.selectVariant('rough', seed, c);
    if (base)
        layers += image(base, c, HEX_SIZE * 2.4, seed, assetSet, .9, '', 'rough-base');
    if (lod === 'close' && visualSeed(seed, c, 'rock-cluster') % 2 === 0) {
        const rc = terrainAssetCatalog.selectVariant('rough_rock_cluster', seed, c);
        if (rc)
            layers += image(rc, c, HEX_SIZE * 1.5, seed, assetSet, .78, '', 'rough-rock');
    }
    return layers;
}
function renderMarsh(c, seed, lod, assetSet) {
    let layers = '';
    const wet = terrainAssetCatalog.selectVariant('marsh_wet', seed, c);
    if (wet)
        layers += image(wet, c, HEX_SIZE * 2.4, seed, assetSet, lod === 'far' ? .55 : .9, '', 'marsh-wet');
    if (lod !== 'far') {
        const pool = terrainAssetCatalog.selectVariant('marsh_pool', seed, c);
        if (pool && visualSeed(seed, c, 'pool') % 100 < 72)
            layers += image(pool, c, HEX_SIZE * 2.05, seed, assetSet, .72, '', 'marsh-pool');
    }
    if (lod === 'close') {
        const reed = terrainAssetCatalog.selectVariant('marsh_reed', seed, c);
        if (reed && visualSeed(seed, c, 'reed') % 100 < 58)
            layers += image(reed, c, HEX_SIZE * 1.55, seed, assetSet, .84, '', 'marsh-reed');
    }
    return layers;
}
function renderCity(t, c, seed, lod, assetSet) {
    const fam = t === 'MAIN_CITY' ? 'city_major' : t === 'OUTER_CITY' ? 'city_small' : 'city_medium';
    let layers = '';
    const city = terrainAssetCatalog.selectVariant(fam, seed, c);
    if (city)
        layers += image(city, c, HEX_SIZE * (t === 'MAIN_CITY' ? 2.5 : 2.2), seed, assetSet, .96, '', 'city-primary');
    if (lod === 'close' && visualSeed(seed, c, 'city-component') % 2 === 0) {
        const comp = terrainAssetCatalog.selectVariant('city_component', seed, c);
        if (comp)
            layers += image(comp, c, HEX_SIZE * 1.35, seed, assetSet, .72, '', 'city-component');
    }
    return layers;
}
function renderHexTerrain(model, hex, seed, lod, assetSet) {
    const c = hex.coord, key = coreHexKey(c), clip = clipId(c);
    let layers = '';
    switch (hex.terrain) {
        case 'PLAIN':
            layers = renderPlain(c, seed, lod, assetSet);
            break;
        case 'FOREST':
            layers = renderForest(model, c, seed, lod, assetSet);
            break;
        case 'HILL':
            layers = renderHill(c, seed, lod, assetSet);
            break;
        case 'ROUGH':
            layers = renderRough(c, seed, lod, assetSet);
            break;
        case 'MARSH':
            layers = renderMarsh(c, seed, lod, assetSet);
            break;
        case 'CITY':
        case 'MAIN_CITY':
        case 'OUTER_CITY':
            layers = renderCity(hex.terrain, c, seed, lod, assetSet);
            break;
        case 'LAKE':
            layers = `<polygon points="${polygonPointsString(c)}" fill="#71989d" opacity=".93"/>`;
            break;
    }
    const baseOpacity = hex.terrain === 'PLAIN' ? .15 : hex.terrain === 'HILL' || hex.terrain === 'ROUGH' ? .22 : .1;
    return `<g data-hex="${key}" class="production-terrain-cell terrain-${hex.terrain.toLowerCase().replace('_', '-')}"><defs><clipPath id="${clip}"><polygon points="${polygonPointsString(c)}"/></clipPath></defs><polygon points="${polygonPointsString(c)}" fill="${terrainBaseFill(hex.terrain)}" opacity="${baseOpacity}"/><g clip-path="url(#${clip})">${layers}</g></g>`;
}
function segmentAsset(entry, a, b, height, assetSet, opacity = 1, className = '') { const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy), angle = Math.atan2(dy, dx) * 180 / Math.PI, cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; return `<image href="${assetUrl(entry, assetSet)}" x="${-len / 2}" y="${-height / 2}" width="${len}" height="${height}" preserveAspectRatio="none" opacity="${opacity}" class="${className}" data-asset-id="${entry.id}" data-family="${entry.family}" transform="translate(${cx} ${cy}) rotate(${angle})"/>`; }
function renderProductionInfrastructure(model, seed, lod, assetSet) {
    let out = '';
    for (const edge of model.edges) {
        if (edge.road) {
            const list = terrainAssetCatalog.byFamily('road'), e = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'road') % list.length];
            if (e)
                out += segmentAsset(e, hexToPixel(edge.a), hexToPixel(edge.b), lod === 'far' ? 7 : 11, assetSet, .88, 'prod-road');
        }
        if (edge.railway?.present) {
            const a = hexToPixel(edge.a), b = hexToPixel(edge.b), list = terrainAssetCatalog.byFamily('railway_ballast'), ballast = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'ballast') % list.length];
            if (lod !== 'far') {
                const shadow = terrainAssetCatalog.byId('RAIL_SHADOW');
                if (shadow)
                    out += segmentAsset(shadow, a, b, 12, assetSet, .48, 'prod-rail-shadow');
            }
            if (ballast)
                out += segmentAsset(ballast, a, b, lod === 'far' ? 7 : 10, assetSet, .9, 'prod-rail-ballast');
            if (lod !== 'far') {
                const sleep = terrainAssetCatalog.byId('RAIL_SLEEP'), pair = terrainAssetCatalog.byId('RAIL_PAIR');
                if (sleep)
                    out += segmentAsset(sleep, a, b, 8, assetSet, .84, 'prod-rail-sleep');
                if (pair)
                    out += segmentAsset(pair, a, b, 6, assetSet, .95, 'prod-rail-pair');
            }
        }
        if (edge.river) {
            const s = sharedHexEdge(edge.a, edge.b);
            if (s) {
                const major = edge.river === 'MAJOR', water = terrainAssetCatalog.byId('RIV_WATER01'), bank = terrainAssetCatalog.byId('RIV_BANK01'), shadow = terrainAssetCatalog.byId('RIV_SHADOW'), hi = terrainAssetCatalog.byId('RIV_HI01'), veg = terrainAssetCatalog.byId('RIV_VEG01');
                if (lod !== 'far' && shadow)
                    out += segmentAsset(shadow, s[0], s[1], major ? 18 : 14, assetSet, .48, 'prod-river-shadow');
                if (lod !== 'far' && bank)
                    out += segmentAsset(bank, s[0], s[1], major ? 14 : 10, assetSet, .88, 'prod-river-bank');
                if (water)
                    out += segmentAsset(water, s[0], s[1], major ? 11 : 7, assetSet, .96, 'prod-river-water');
                if (lod !== 'far' && hi)
                    out += segmentAsset(hi, s[0], s[1], major ? 6 : 4, assetSet, .7, 'prod-river-highlight');
                if (lod === 'close' && veg)
                    out += segmentAsset(veg, s[0], s[1], major ? 17 : 12, assetSet, .58, 'prod-river-vegetation');
            }
        }
        if (edge.bridge && !edge.bridge.destroyed) {
            const a = hexToPixel(edge.a), b = hexToPixel(edge.b), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2, angle = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
            const family = edge.railway?.present ? 'bridge_rail' : 'bridge_road', list = terrainAssetCatalog.byFamily(family), br = list[unorderedEdgeVisualSeed(seed, edge.a, edge.b, 'bridge') % list.length];
            if (br)
                out += `<image href="${assetUrl(br, assetSet)}" x="-27" y="-14" width="54" height="28" preserveAspectRatio="xMidYMid meet" class="prod-bridge" data-asset-id="${br.id}" transform="translate(${cx} ${cy}) rotate(${angle})"/>`;
        }
    }
    return `<g id="production-infrastructure-layer">${out}</g>`;
}
export function renderProductionBase(model, seed, lod, assetSet = 'p5', marshContinuity = true) {
    const clips = model.hexes.map(h => `<clipPath id="${clipId(h.coord)}"><polygon points="${polygonPointsString(h.coord)}"/></clipPath>`).join('');
    const terrain = model.hexes.map(h => renderHexTerrain(model, h, seed, lod, assetSet)).join('');
    const grid = model.hexes.map(h => `<polygon points="${polygonPointsString(h.coord)}" class="production-grid" data-grid-hex="${coreHexKey(h.coord)}"/>`).join('');
    return `<g id="production-base-layer"><defs>${clips}</defs>${renderGlobalSubstrate(model, seed, assetSet)}<g id="production-terrain-layer">${terrain}</g>${marshContinuity ? renderMarshContinuity(model, seed, lod) : ''}${renderProductionInfrastructure(model, seed, lod, assetSet)}<g id="production-grid-layer">${grid}</g></g>`;
}
