import { reportTerrainLoad } from './terrainLoadProgress.js';
import { HEX_SIZE, SQRT3, hexToPixel, sharedHexEdge } from '../geometry/hex.js';
import { vs2AssetCatalog } from './vs2Assets.js';
import { loadTerrainImage, terrainSurfaceCapabilities } from './terrainSurface.js';
import { VS2_PRESENTATION } from './vs2Presentation.js';
// Rounded keys weld equivalent floating-point hex vertices, without moving coordinates.
const pointKey = (p) => `${p.x.toFixed(6)},${p.y.toFixed(6)}`;
export function chainVS2Edges(edges, kind) {
    const sorted = [...edges].sort((a, b) => a.key.localeCompare(b.key));
    const nodes = new Map(), visited = new Set(), result = [];
    sorted.forEach((e, i) => { for (const p of [e.a, e.b]) {
        const k = pointKey(p), list = nodes.get(k) ?? [];
        list.push(i);
        nodes.set(k, list);
    } });
    const walk = (start, first) => {
        let node = start, next = first, offset = 0;
        const segments = [];
        while (next !== undefined && !visited.has(next)) {
            const edge = sorted[next];
            visited.add(next);
            const a = pointKey(edge.a) === node ? edge.a : edge.b, b = a === edge.a ? edge.b : edge.a;
            const length = Math.hypot(b.x - a.x, b.y - a.y);
            segments.push({ key: edge.key, a, b, length, offset });
            offset += length;
            node = pointKey(b);
            const adjacent = nodes.get(node);
            next = adjacent.length === 2 ? adjacent.find(i => !visited.has(i)) : undefined;
        }
        if (segments.length)
            result.push({ kind, segments });
    };
    for (const node of [...nodes.keys()].sort())
        if (nodes.get(node).length !== 2)
            for (const i of nodes.get(node))
                if (!visited.has(i))
                    walk(node, i);
    for (const node of [...nodes.keys()].sort())
        for (const i of nodes.get(node))
            if (!visited.has(i))
                walk(node, i);
    return result;
}
export function planVS2Infrastructure(model) {
    const road = [], rail = [], river = [];
    const bridges = [];
    for (const edge of [...model.edges].sort((a, b) => a.key.localeCompare(b.key))) {
        const a = hexToPixel(edge.a), b = hexToPixel(edge.b), item = { key: edge.key, a, b };
        if (edge.road)
            road.push(item);
        if (edge.railway?.present)
            rail.push(item);
        if (edge.river) {
            const shared = sharedHexEdge(edge.a, edge.b);
            if (!shared)
                throw new Error(`Non-adjacent river ${edge.key}`);
            river.push({ key: edge.key, a: shared[0], b: shared[1] });
        }
        if (edge.bridge && !edge.bridge.destroyed)
            bridges.push({ ...item, railway: Boolean(edge.railway?.present), road: Boolean(edge.road) });
    }
    return { chains: [...chainVS2Edges(river, 'river'), ...chainVS2Edges(road, 'road'), ...chainVS2Edges(rail, 'rail')], bridges };
}
export async function paintVS2Infrastructure(ctx, model, lod, assets = vs2AssetCatalog) {
    const plan = planVS2Infrastructure(model), style = VS2_PRESENTATION[lod], capabilities = terrainSurfaceCapabilities();
    // Draw calls depend on actual path/bridge branches; no invented total.
    reportTerrainLoad({ kind: 'assets', total: null });
    let imageDraws = 0;
    const used = new Set();
    const draw = async (id, chains, width, opacity) => {
        if (!chains.length)
            return;
        const entry = assets.byId(id);
        if (!entry || !entry.LOD.includes(lod) || entry.rotationAllowed.mode !== 'canonicalPathTangent')
            throw new Error(`Invalid VS2 path material/LOD: ${id}/${lod}`);
        const range = entry.recommendedWorldScale.width;
        const H = SQRT3 * HEX_SIZE;
        if (width < range[0] * H || width > range[1] * H || opacity < entry.opacityRange[0] || opacity > entry.opacityRange[1])
            throw new Error(`VS2 path presentation outside manifest: ${id}`);
        const image = await loadTerrainImage({ id, family: entry.family, file: entry.file, sourceSize: [entry.sourceSize[0], entry.sourceSize[1]] }, 'p5', capabilities, new URL(assets.url(entry), document.baseURI).href);
        used.add(id);
        try {
            // Preserve source aspect ratio and phase through every edge of each chain.
            const repeat = width * entry.sourceSize[0] / entry.sourceSize[1];
            for (const chain of chains)
                for (const segment of chain.segments) {
                    ctx.save();
                    try {
                        ctx.globalAlpha = opacity;
                        ctx.translate(segment.a.x, segment.a.y);
                        ctx.rotate(Math.atan2(segment.b.y - segment.a.y, segment.b.x - segment.a.x));
                        for (let cursor = 0; cursor < segment.length - 1e-8;) {
                            const phase = ((segment.offset + cursor) % repeat + repeat) % repeat;
                            const length = Math.min(segment.length - cursor, repeat - phase);
                            if (length < 1e-8)
                                break;
                            ctx.drawImage(image.source, phase / repeat * image.width, 0, length / repeat * image.width, image.height, cursor, -width / 2, length, width);
                            imageDraws++;
                            cursor += length;
                        }
                    }
                    finally {
                        ctx.restore();
                    }
                }
        }
        finally {
            image.release?.();
        }
    };
    const paths = (kind) => plan.chains.filter(c => c.kind === kind);
    // Continuous round joins underneath the textures close bends and graph junctions.
    const joins = (chains, width, color, opacity) => {
        ctx.save();
        try {
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            for (const chain of chains) {
                const first = chain.segments[0];
                if (!first)
                    continue;
                ctx.moveTo(first.a.x, first.a.y);
                for (const s of chain.segments)
                    ctx.lineTo(s.b.x, s.b.y);
            }
            ctx.stroke();
        }
        finally {
            ctx.restore();
        }
    };
    const rivers = paths('river'), roads = paths('road'), rails = paths('rail');
    // Keep major/minor semantic widths while sharing chain arc-length phase.
    const major = new Set(model.edges.filter(e => e.river === 'MAJOR').map(e => e.key));
    for (const isMajor of [false, true]) {
        const selected = rivers.flatMap(c => c.segments.filter(s => major.has(s.key) === isMajor).map(s => ({ kind: 'river', segments: [s] })));
        const width = isMajor ? 8.8 : 5.2;
        joins(selected, width + 8, '#8b9561', 0.24);
        joins(selected, width + 3.5, '#a0956b', 0.34);
        joins(selected, width, '#62858a', 0.9);
        if (lod !== 'far')
            await draw('VS2_RIVER_WET_BANK', selected, isMajor ? 9.4 : 7, 0.80);
        await draw('VS2_RIVER_WATER', selected, width, 0.95);
        // A continuous water body unifies tangent-rotated texture brightness at bends.
        joins(selected, width * 0.82, '#4d8997', 0.77);
        joins(selected, width * 0.25, '#adcfca', 0.22);
    }
    joins(roads, style.roadWidth + 1.2, '#817c52', 0.26);
    joins(roads, style.roadWidth, '#c8b586', 0.85);
    await draw('VS2_ROAD_SURFACE_01', roads, style.roadWidth, 0.86);
    joins(roads, style.roadWidth * 0.46, '#d9c99e', 0.36);
    joins(rails, style.railWidth * 0.65, '#74776d', 0.55);
    await draw('VS2_RAIL_BALLAST', rails, style.railWidth, style.railOpacity);
    if (lod !== 'far') {
        await draw('VS2_RAIL_SLEEPERS', rails, 2.8, 0.70);
        await draw('VS2_RAIL_RAIL_PAIR', rails, 2.2, 0.80);
    }
    // Bridges are a final global pass, never hidden by a later river edge.
    for (const bridge of plan.bridges) {
        const dx = bridge.b.x - bridge.a.x, dy = bridge.b.y - bridge.a.y, len = Math.hypot(dx, dy);
        const center = { x: (bridge.a.x + bridge.b.x) / 2, y: (bridge.a.y + bridge.b.y) / 2 };
        const a = { x: center.x - dx / len * 27, y: center.y - dy / len * 27 }, b = { x: center.x + dx / len * 27, y: center.y + dy / len * 27 };
        const chain = [{ kind: 'road', segments: [{ key: bridge.key, a, b, offset: 0, length: 54 }] }];
        await draw('VS2_BRIDGE_DECK_MATERIAL', chain, 8.5, 1);
        for (const kind of ['road', 'rail']) {
            if (!(kind === 'road' ? bridge.road : bridge.railway))
                continue;
            const segment = paths(kind).flatMap(c => c.segments).find(s => s.key === bridge.key);
            const direction = { x: (segment.b.x - segment.a.x) / segment.length, y: (segment.b.y - segment.a.y) / segment.length };
            const start = { x: center.x - direction.x * 27, y: center.y - direction.y * 27 }, end = { x: center.x + direction.x * 27, y: center.y + direction.y * 27 };
            const top = [{ kind, segments: [{ ...segment, a: start, b: end, length: 54, offset: segment.offset + (segment.length - 54) / 2 }] }];
            await draw(kind === 'road' ? 'VS2_ROAD_SURFACE_01' : lod === 'far' ? 'VS2_RAIL_BALLAST' : 'VS2_RAIL_RAIL_PAIR', top, kind === 'road' ? style.roadWidth : lod === 'far' ? style.railWidth : 2.2, kind === 'road' ? 0.86 : 0.8);
        }
    }
    reportTerrainLoad({ kind: 'building' });
    return { imageDraws, uniqueAssets: used.size };
}
