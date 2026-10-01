import { composeWorld, paintWorldGround } from './map015Layout.js';
import { sceneGeometry } from './scene012Geometry.js';
import { composeSettlement, paintSettlementGround, inSettlement, settlementCells, clipNaturalSpace, bakeNatural, paintNaturalBanks } from './blend011Layout.js';
import { inPolish, detailLayout, drawDetails, prepareDetails, tintedTile } from './polishDetails.js';
import { hexPolygon, hexToPixel, sharedHexEdge, hexKey } from '../geometry/hex.js';
import { deriveBridgeGeometry } from '../render/derive.js';
import { vs2RectangleSegmentDistance } from '../render/vs2Projection.js';
import { viewBoxForHexes } from '../render/coreSvg.js';
import { corridors, inside, segmentDistance, label } from './mapData.js';
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
export const isCity = (terrain) => ['CITY', 'MAIN_CITY', 'OUTER_CITY'].includes(terrain);
export function placements(data) {
    const lanes = corridors(data), out = [];
    for (const h of data.hexes) {
        const c = hexToPixel(h.coord), poly = hexPolygon(h.coord), random = rng(h.coord.q * 197 + h.coord.r * 719 + 17), local = [];
        // Only neighboring corridors can intersect a cell. Never repeatedly scan all placed sprites.
        const nearby = lanes.filter(l => Math.max(l.a.x, l.b.x) + l.width >= c.x - 45 && Math.min(l.a.x, l.b.x) - l.width <= c.x + 45 && Math.max(l.a.y, l.b.y) + l.width >= c.y - 45 && Math.min(l.a.y, l.b.y) - l.width <= c.y + 45);
        if (h.terrain === 'HILL' || h.terrain === 'ROUGH') {
            const rough = h.terrain === 'ROUGH', count = rough ? 2 : 1 + (random() > .58 ? 1 : 0);
            for (let j = 0; j < count; j++)
                out.push({ cell: label(h.coord), kind: h.terrain, x: c.x + (random() - .5) * (count > 1 ? 30 : 9), y: c.y + (random() - .5) * 18, width: (rough ? 36 : 50) + random() * 22, height: (rough ? 29 : 43) + random() * 21 });
            continue;
        }
        if (h.terrain !== 'FOREST' && !isCity(h.terrain))
            continue;
        const forest = h.terrain === 'FOREST', max = forest ? 13 + Math.floor(random() * 9) : h.terrain === 'MAIN_CITY' ? 30 : h.terrain === 'OUTER_CITY' ? 24 : 20;
        const biasX = (random() - .5) * 15, biasY = (random() - .5) * 15;
        for (let i = 0; i < 350 && local.length < max; i++) {
            const x = c.x + biasX + (random() - .5) * 67, y = c.y + biasY + (random() - .5) * 67, w = forest ? 15 + random() * 19 : 7.5 + random() * 3, hg = forest ? w * (.76 + random() * .19) : w * .94;
            const corners = [{ x: x - w / 2, y: y - hg / 2 }, { x: x + w / 2, y: y - hg / 2 }, { x: x + w / 2, y: y + hg / 2 }, { x: x - w / 2, y: y + hg / 2 }];
            if (!corners.every(p => inside(p, poly)))
                continue;
            if (nearby.some(l => vs2RectangleSegmentDistance({ x, y }, w / 2, hg / 2, l.a, l.b) < l.width))
                continue;
            if (local.some(p => Math.hypot(p.x - x, p.y - y) < (forest ? 10 : 7.5)))
                continue;
            local.push({ cell: label(h.coord), kind: forest ? (random() > .32 ? 'forest' : 'fringe') : 'city', x, y, width: w, height: hg });
        }
        out.push(...local);
    }
    return out;
}
/** Trace only original river segments. Rounded corners remain in a 3-world-pixel junction envelope. */
function riverChains(data, kind) {
    const edges = data.edges.filter(e => e.river === kind).map(e => sharedHexEdge(e.a, e.b));
    const key = (p) => p.x.toFixed(4) + ',' + p.y.toFixed(4), links = new Map();
    edges.forEach((e, i) => e.forEach(p => links.set(key(p), [...(links.get(key(p)) ?? []), i])));
    const used = new Set(), paths = [];
    function walk(start, index) { const out = [start]; let p = start, i = index; while (!used.has(i)) {
        used.add(i);
        const e = edges[i], next = key(e[0]) === key(p) ? e[1] : e[0];
        out.push(next);
        const attached = links.get(key(next));
        if (attached.length !== 2)
            break;
        const more = attached.find(j => !used.has(j));
        if (more === undefined)
            break;
        p = next;
        i = more;
    } paths.push(out); }
    edges.forEach((e, i) => { for (const p of e)
        if (links.get(key(p)).length !== 2 && !used.has(i))
            walk(p, i); });
    edges.forEach((e, i) => { if (!used.has(i))
        walk(e[0], i); });
    return paths;
}
export async function loadImage(url) { const image = new Image(); image.src = url; await image.decode(); return image; }
export async function paintBlend011(canvas, data, scene = false) {
    const world = scene === '015', finish = world ? '014' : scene;
    const geometry = sceneGeometry(data);
    const started = performance.now(), [detailsAtlas, ground, atlas, buildings, newTerrain] = await Promise.all([loadImage('./assets/details.webp'), loadImage('./assets/meadow.webp'), loadImage('./assets/terrain-atlas.webp'), loadImage('./assets/buildings.webp'), loadImage('./assets/terrain010.webp')]);
    const box = viewBoxForHexes(data.hexes, 8), scale = Math.min(2, 4096 / Math.max(box.width, box.height));
    canvas.width = Math.ceil(box.width * scale);
    canvas.height = Math.ceil(box.height * scale);
    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.scale(scale, scale);
    ctx.translate(-box.minX, -box.minY);
    const path = (points) => { ctx.moveTo(points[0].x, points[0].y); points.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.closePath(); };
    ctx.save();
    ctx.beginPath();
    data.hexes.forEach(h => path(hexPolygon(h.coord)));
    ctx.clip();
    const pattern = ctx.createPattern(ground, 'repeat');
    pattern.setTransform(new DOMMatrix().scale(.15));
    ctx.fillStyle = pattern;
    ctx.fillRect(box.minX, box.minY, box.width, box.height);
    ctx.fillStyle = 'rgba(104,121,73,.34)';
    ctx.fillRect(box.minX, box.minY, box.width, box.height);
    // Soft world-space variation: no per-cell colored fills.
    const random = rng(5005);
    for (let i = 0; i < data.hexes.length * 2; i++) {
        const x = box.minX + random() * box.width, y = box.minY + random() * box.height, r = 15 + random() * 40, g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, i % 3 ? 'rgba(158,143,97,.16)' : 'rgba(57,83,49,.19)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Local material balance: warm sunlit meadow and cooler damp edges, never a full-map filter.
    for (const h of data.hexes.filter(h => inPolish(h) && (!world || inSettlement(h)))) {
        const c = hexToPixel(h.coord);
        ctx.save();
        ctx.beginPath();
        path(hexPolygon(h.coord));
        ctx.clip();
        const g = ctx.createRadialGradient(c.x - 7, c.y - 10, 3, c.x, c.y, 43);
        g.addColorStop(0, h.terrain === 'FOREST' ? 'rgba(44,100,58,.19)' : 'rgba(156,173,67,.19)');
        g.addColorStop(1, 'transparent');
        ctx.globalCompositeOperation = 'soft-light';
        ctx.fillStyle = g;
        ctx.fillRect(c.x - 44, c.y - 44, 88, 88);
        ctx.restore();
    }
    const layoutStarted = performance.now(), baseList = placements(data), approved = composeSettlement(data, baseList, finish), list = world ? composeWorld(data, approved) : approved, layoutMs = performance.now() - layoutStarted, cells = new Map(data.hexes.map(h => [label(h.coord), h]));
    const source = { forest: [15, 20, 705, 625], fringe: [740, 105, 494, 510], HILL: [20, 655, 660, 590], ROUGH: [20, 655, 660, 590], city: [678, 670, 568, 550] };
    const cityIndices = new Map(baseList.filter(p => p.kind === 'city').map((p, i) => [p, i]));
    const tintStarted = performance.now(), terrainTiles = Object.fromEntries(Object.entries(source).filter(([k]) => k !== 'city').map(([kind, rect]) => [kind, tintedTile(atlas, rect, kind === 'forest' || kind === 'fringe' ? 'saturate(1.21) contrast(1.09) brightness(1.08)' : 'contrast(1.14) brightness(1.08)', 256)]));
    const tileRects = [[72, 60, 550, 505], [740, 65, 490, 510], [35, 645, 640, 560], [735, 590, 505, 650]], roofTiles = tileRects.map(rect => tintedTile(buildings, rect, 'saturate(1.32) contrast(1.06) brightness(1.09)', 128)), detailTiles = prepareDetails(detailsAtlas), tintMs = performance.now() - tintStarted;
    const tiles = [...Object.values(terrainTiles), ...roofTiles, ...Object.values(detailTiles).flat()], tintBackingBytes = tiles.reduce((s, t) => s + t.width * t.height * 4, 0);
    // Bake local directional light and contact shadows into a few reusable tiles once.
    // The map is still a static canvas: no light/animation pass runs during gestures.
    const localBakeStart = performance.now();
    const bake = (tile, forest = false) => {
        const baked = document.createElement('canvas');
        baked.width = baked.height = 256;
        const b = baked.getContext('2d');
        b.shadowColor = forest ? 'rgba(15,30,23,.80)' : 'rgba(32,30,28,.75)';
        b.shadowOffsetX = 7;
        b.shadowOffsetY = 11;
        b.shadowBlur = 7;
        b.drawImage(tile, 8, 5, 235, 235);
        b.shadowColor = 'transparent';
        b.globalCompositeOperation = 'source-atop';
        const light = b.createLinearGradient(0, 0, 256, 256);
        light.addColorStop(0, forest ? 'rgba(215,224,119,.23)' : 'rgba(255,219,147,.24)');
        light.addColorStop(.48, 'rgba(0,0,0,0)');
        light.addColorStop(1, 'rgba(19,40,38,.29)');
        b.fillStyle = light;
        b.fillRect(0, 0, 256, 256);
        return baked;
    };
    const localRoofs = tileRects.map(rect => bake(tintedTile(buildings, rect, finish === '014' ? 'saturate(1.12) contrast(1.12) brightness(1.12)' : 'saturate(1.42) contrast(1.16) brightness(1.16)', 256)));
    // Crop the same prepared roof tiles tightly for the connected ranges. This is
    // static atlas composition, with no new image or gesture-time pass.
    const drawLocalRoof = (p, index) => { const roof = localRoofs[index]; if (finish === '014')
        ctx.drawImage(roof, 10, 10, 231, 231, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    else
        ctx.drawImage(roof, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); };
    const terrain010Tiles = [0, 1, 2, 3].map(i => {
        const tile = tintedTile(newTerrain, [(i % 2) * 627, Math.floor(i / 2) * 627, 627, 627], finish === '014' ? 'saturate(.89) contrast(1.02) brightness(1.02)' : 'saturate(.89) contrast(.96) brightness(.96)', 384), b = tile.getContext('2d');
        // Static alpha feather avoids a rectangular ground skirt; no extra animated material pass.
        b.globalCompositeOperation = 'destination-in';
        for (const vertical of [false, true]) {
            const g = b.createLinearGradient(0, 0, vertical ? 0 : 384, vertical ? 384 : 0);
            g.addColorStop(0, 'transparent');
            g.addColorStop(.085, 'white');
            g.addColorStop(.915, 'white');
            g.addColorStop(1, 'transparent');
            b.fillStyle = g;
            b.fillRect(0, 0, 384, 384);
        }
        b.globalCompositeOperation = 'source-over';
        return tile;
    });
    const terrain010TileBytes = 4 * 384 * 384 * 4;
    const localBakeMs = performance.now() - localBakeStart, localTileBytes = localRoofs.length * 256 * 256 * 4;
    const naturalTiles = new Map(list.filter(p => settlementCells.has(p.cell) && p.kind !== 'city').map(p => [p, bakeNatural(terrain010Tiles[p.tile ?? 0], p, data, finish)]));
    const blendTileBytes = [...naturalTiles.values()].reduce((n, c) => n + c.width * c.height * 4, 0);
    // One reusable, <= 144 x 144 world-terrain scratch buffer; never retained per cell.
    const scratch = world ? document.createElement('canvas') : undefined;
    let scratchPeakBytes = 0;
    if (scratch)
        scratch.width = scratch.height = 1;
    const drawStamp = (p) => {
        const rect = source[p.kind], h = cells.get(p.cell);
        ctx.save();
        ctx.beginPath();
        path(hexPolygon(h.coord));
        ctx.clip();
        if (p.kind === 'city') {
            const index = p.roof ?? ((cityIndices.get(p) ?? 0) % 19 === 0 ? 3 : (cityIndices.get(p) ?? 0) % 3);
            if (world || inSettlement(h))
                drawLocalRoof(p, index);
            else if (inPolish(h))
                ctx.drawImage(roofTiles[index], p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
            else
                ctx.drawImage(buildings, ...tileRects[index], p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        }
        else if (world || inSettlement(h)) {
            clipNaturalSpace(ctx, data, h);
            const tile = naturalTiles.get(p) ?? bakeNatural(terrain010Tiles[p.tile ?? 0], p, data, '014', scratch, 2, true);
            scratchPeakBytes = Math.max(scratchPeakBytes, scratch ? scratch.width * scratch.height * 4 : 0);
            ctx.drawImage(tile, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        }
        else if (inPolish(h))
            ctx.drawImage(terrainTiles[p.kind], p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        else
            ctx.drawImage(atlas, ...rect, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        ctx.restore();
    };
    if (world)
        paintWorldGround(ctx, data, list);
    const groundField = paintSettlementGround(ctx, data, list.filter(p => !world || settlementCells.has(p.cell)), finish);
    list.filter(p => p.kind === 'HILL' || p.kind === 'ROUGH').forEach(drawStamp);
    // Marsh/lake material is original procedural world-space detail over the accepted meadow.
    // Clip to each canonical terrain polygon: no invented adjacent water or wetland cells.
    for (const h of data.hexes.filter(h => h.terrain === 'MARSH' || h.terrain === 'LAKE')) {
        const c = hexToPixel(h.coord), rand = rng(h.coord.q * 151 + h.coord.r * 641 + 29), lake = h.terrain === 'LAKE';
        ctx.save();
        ctx.beginPath();
        path(hexPolygon(h.coord));
        ctx.clip();
        if (lake)
            ctx.fillStyle = '#426e70';
        else {
            const wet = ctx.createRadialGradient(c.x, c.y, 8, c.x, c.y, 43);
            wet.addColorStop(0, 'rgba(46,72,57,.62)');
            wet.addColorStop(.68, 'rgba(60,82,60,.36)');
            wet.addColorStop(1, 'rgba(60,82,60,0)');
            ctx.fillStyle = wet;
        }
        ctx.fillRect(c.x - 45, c.y - 43, 90, 86);
        for (let i = 0; i < (lake ? 100 : 65); i++) {
            const x = c.x + (rand() - .5) * 88, y = c.y + (rand() - .5) * 84, w = lake ? 2 + rand() * 8 : 2 + rand() * 7;
            ctx.fillStyle = lake ? 'rgba(153,180,160,.18)' : i % 3 ? 'rgba(61,89,76,.45)' : 'rgba(135,126,75,.26)';
            ctx.beginPath();
            if (lake)
                ctx.ellipse(x, y, w, .18 + rand() * .4, -.17, 0, Math.PI * 2);
            else {
                for (let j = 0; j < 12; j++) {
                    const a = j / 12 * Math.PI * 2, r = .65 + rand() * .35, px = x + Math.cos(a) * w * r, py = y + Math.sin(a) * w * .38 * r;
                    if (j)
                        ctx.lineTo(px, py);
                    else
                        ctx.moveTo(px, py);
                }
                ctx.closePath();
            }
            ctx.fill();
            if (!lake && i % 2) {
                ctx.strokeStyle = '#a6a378';
                ctx.lineWidth = .38;
                ctx.beginPath();
                ctx.moveTo(x - 1, y);
                ctx.lineTo(x - 1.4, y - 2.8);
                ctx.moveTo(x, y);
                ctx.lineTo(x + .4, y - 3.9);
                ctx.moveTo(x + 1, y);
                ctx.lineTo(x + 2, y - 2.5);
                ctx.stroke();
            }
        }
        if (lake) {
            const poly = hexPolygon(h.coord);
            ctx.beginPath();
            for (let j = 0; j < 6; j++) {
                const a = poly[j], b = poly[(j + 1) % 6], neighbor = { x: a.x + b.x - c.x, y: a.y + b.y - c.y };
                if (data.hexes.some(k => k.terrain === 'LAKE' && Math.hypot(hexToPixel(k.coord).x - neighbor.x, hexToPixel(k.coord).y - neighbor.y) < .1))
                    continue;
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
            }
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#a49c77';
            ctx.stroke();
        }
        ctx.restore();
    }
    for (const p of list.filter(p => !world && p.kind === 'city' && inPolish(cells.get(p.cell)) && !settlementCells.has(p.cell))) {
        ctx.save();
        ctx.beginPath();
        path(hexPolygon(cells.get(p.cell).coord));
        ctx.clip();
        const g = ctx.createRadialGradient(p.x, p.y + 1, 1, p.x, p.y + 1, p.width * .95);
        g.addColorStop(0, 'rgba(189,164,120,.42)');
        g.addColorStop(.6, 'rgba(151,132,92,.27)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.width, p.y - p.width, p.width * 2, p.width * 2);
        ctx.restore();
    }
    const stroke = (a, b, width, color) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
    // Water passes draw all connected banks first, then all water: no false dams at junctions.
    const rivers = data.edges.filter(e => e.river).map(e => ({ e, p: sharedHexEdge(e.a, e.b) }));
    const chains = ['MAJOR', 'MINOR'].flatMap(kind => riverChains(data, kind).map(points => ({ kind, points })));
    // Densely sampled, gently rounded centerlines retain their original edge corridors.
    const smooth = (points) => { const out = [points[0]]; const lineTo = (b) => { const a = out.at(-1), n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 1.6)); for (let j = 1; j <= n; j++)
        out.push({ x: a.x + (b.x - a.x) * j / n, y: a.y + (b.y - a.y) * j / n }); }; for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1], p = points[i], b = points[i + 1], f = Math.min(.2, 3 / Math.hypot(p.x - a.x, p.y - a.y)), g = Math.min(.2, 3 / Math.hypot(b.x - p.x, b.y - p.y)), from = { x: p.x + (a.x - p.x) * f, y: p.y + (a.y - p.y) * f }, to = { x: p.x + (b.x - p.x) * g, y: p.y + (b.y - p.y) * g };
        lineTo(from);
        for (let j = 1; j <= 6; j++) {
            const t = j / 6;
            out.push({ x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * p.x + t * t * to.x, y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * p.y + t * t * to.y });
        }
    } lineTo(points.at(-1)); return out; };
    const waterPaths = chains.map(c => ({ ...c, points: scene ? geometry.water(smooth(c.points)) : smooth(c.points) }));
    const ribbon = (points, half, color) => { const left = [], right = []; for (let i = 0; i < points.length; i++) {
        const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, variation = .38 * Math.sin(p.x * .44 + p.y * .27) + .18 * Math.sin(p.x * 1.17 - p.y * .78), w = half + variation + (scene ? geometry.weight(p) * geometry.bridgeWeight(p) * (.60 * Math.sin(p.x * .075 - p.y * .046)) : 0);
        left.push({ x: p.x + nx * w, y: p.y + ny * w });
        right.push({ x: p.x - nx * w, y: p.y - ny * w });
    } ctx.beginPath(); path([...left, ...right.reverse()]); ctx.fillStyle = color; ctx.fill(); };
    paintNaturalBanks(ctx, data);
    for (const [major, minor, color] of [[7.4, 5.4, '#53614b'], [6.2, 4.4, '#938c69'], [4.7, 3.1, '#747c65'], [3.8, 2.35, '#426e70']]) {
        ctx.save();
        if (color !== '#426e70') {
            ctx.beginPath();
            ctx.rect(box.minX - 10, box.minY - 10, box.width + 20, box.height + 20);
            data.hexes.filter(inSettlement).forEach(h => path(hexPolygon(h.coord)));
            ctx.clip('evenodd');
        }
        for (const { kind, points } of waterPaths)
            ribbon(points, kind === 'MAJOR' ? major : minor, color);
        ctx.restore();
    }
    ctx.save();
    ctx.beginPath();
    data.hexes.filter(h => world || inPolish(h)).forEach(h => path(hexPolygon(h.coord)));
    ctx.clip();
    for (const { kind, points } of waterPaths)
        ribbon(points, kind === 'MAJOR' ? 3.8 : 2.35, '#397f80');
    ctx.restore();
    // Depth and reflected sky stay inside the existing water centerline envelope.
    ctx.save();
    ctx.beginPath();
    data.hexes.filter(h => world || inSettlement(h)).forEach(h => path(hexPolygon(h.coord)));
    ctx.clip();
    for (const { kind, points } of waterPaths) {
        ribbon(points, kind === 'MAJOR' ? 3.35 : 1.95, '#2f737e');
        ribbon(points, kind === 'MAJOR' ? 1.65 : .8, '#559c9a');
    }
    ctx.restore();
    for (const { kind, points } of waterPaths)
        for (let i = 0; i < points.length; i += 2) {
            const p = points[i], spread = kind === 'MAJOR' ? 2.6 : 1.3, x = p.x + (random() - .5) * spread, y = p.y + (random() - .5) * spread;
            stroke({ x: x - .45, y }, { x: x + .65, y: y - .12 }, .18, i % 3 ? 'rgba(146,176,151,.32)' : 'rgba(21,57,62,.28)');
        }
    for (const { e, p } of rivers) {
        const dx = p[1].x - p[0].x, dy = p[1].y - p[0].y, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l, r = e.river === 'MAJOR' ? 5.8 : 4.1;
        for (let i = 0; i < 45; i++) {
            const t = random(), sign = i % 2 ? 1 : -1, x = p[0].x + dx * t + nx * (r + random() * 1.8) * sign, y = p[0].y + dy * t + ny * (r + random() * 1.8) * sign;
            ctx.fillStyle = i % 3 ? '#aaa585' : '#5a704e';
            ctx.beginPath();
            ctx.ellipse(x, y, .23 + random() * .5, .18 + random() * .45, 0, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    // Do not draw a crossing unless the imported registry explicitly has a bridge.
    const segments = data.edges.filter(e => e.road || e.railway?.present);
    const localClip = () => { ctx.beginPath(); data.hexes.filter(inSettlement).forEach(h => path(hexPolygon(h.coord))); ctx.clip(); };
    ctx.save();
    if (scene) {
        ctx.beginPath();
        ctx.rect(box.minX - 10, box.minY - 10, box.width + 20, box.height + 20);
        data.hexes.filter(inSettlement).forEach(h => path(hexPolygon(h.coord)));
        ctx.clip('evenodd');
    }
    const transportLine = (e, width, color) => {
        const a = hexToPixel(e.a), b = hexToPixel(e.b);
        if (!e.river || e.bridge && !e.bridge.destroyed) {
            stroke(a, b, width, color);
            return;
        }
        const t = .38, u = .62;
        stroke(a, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, width, color);
        stroke({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u }, b, width, color);
    };
    for (const e of segments)
        transportLine(e, e.road ? 7 : 5.6, 'rgba(108,102,73,.7)');
    for (const e of segments)
        transportLine(e, e.road ? 4.5 : 4.2, e.road ? '#b7a77a' : '#847e68');
    for (const e of segments) {
        if (e.road)
            transportLine(e, 2.7, '#c3b58c');
        if (e.railway?.present) {
            const a = hexToPixel(e.a), b = hexToPixel(e.b), dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
            for (let d = 0; d < l; d += 3) {
                if (e.river && (!e.bridge || e.bridge.destroyed) && d / l > .38 && d / l < .62)
                    continue;
                const x = a.x + dx * d / l, y = a.y + dy * d / l;
                stroke({ x: x - nx * 2, y: y - ny * 2 }, { x: x + nx * 2, y: y + ny * 2 }, .65, '#4e4a3e');
            }
            for (const s of [-.95, .95]) {
                const from = { x: a.x + nx * s, y: a.y + ny * s }, to = { x: b.x + nx * s, y: b.y + ny * s };
                if (e.river && (!e.bridge || e.bridge.destroyed)) {
                    stroke(from, { x: from.x + dx * .38, y: from.y + dy * .38 }, .47, '#303935');
                    stroke({ x: from.x + dx * .62, y: from.y + dy * .62 }, to, .47, '#303935');
                }
                else
                    stroke(from, to, .47, '#303935');
            }
        }
    }
    ctx.restore();
    if (scene) {
        ctx.save();
        localClip();
        const transportLine = (e, width, color, offset = 0) => { const points = geometry.route(e); for (let i = 1; i < points.length; i++) {
            const a = points[i - 1], b = points[i];
            if (e.river && (!e.bridge || e.bridge.destroyed) && b.t > .38 && a.t < .62)
                continue;
            const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
            stroke({ x: a.x - dy / l * offset, y: a.y + dx / l * offset }, { x: b.x - dy / l * offset, y: b.y + dx / l * offset }, width, color);
        } };
        for (const e of segments)
            transportLine(e, e.road ? 7 : 5.6, 'rgba(108,102,73,.7)');
        for (const e of segments)
            transportLine(e, e.road ? 4.5 : 4.2, e.road ? '#b7a77a' : '#847e68');
        for (const e of segments) {
            if (e.road)
                transportLine(e, 2.7, '#c3b58c');
            if (e.railway?.present) {
                const points = geometry.route(e), a = hexToPixel(e.a), b = hexToPixel(e.b), len = Math.hypot(b.x - a.x, b.y - a.y);
                for (let d = 0; d < len; d += 3) {
                    const t = d / len;
                    if (e.river && (!e.bridge || e.bridge.destroyed) && t > .38 && t < .62)
                        continue;
                    const i = Math.min(31, Math.floor(t * 32)), u = points[i], v = points[i + 1], f = t * 32 - i, dx = v.x - u.x, dy = v.y - u.y, l = Math.hypot(dx, dy) || 1, x = u.x + dx * f, y = u.y + dy * f;
                    stroke({ x: x + dy / l * 2, y: y - dx / l * 2 }, { x: x - dy / l * 2, y: y + dx / l * 2 }, .65, '#4e4a3e');
                }
                for (const side of [-.95, .95])
                    transportLine(e, .47, '#303935', side);
            }
        }
        ctx.restore();
    }
    for (const e of data.edges.filter(e => e.bridge && !e.bridge.destroyed)) {
        const g = deriveBridgeGeometry(e.a, e.b);
        stroke(g.from, g.to, 8, '#414943');
        stroke(g.from, g.to, 6, '#b9ad8e');
        stroke(g.from, g.to, 2, e.bridge.kind === 'ROAD' ? '#d2c19a' : '#4c5046');
        const dx = g.to.x - g.from.x, dy = g.to.y - g.from.y, l = Math.hypot(dx, dy);
        for (const s of [-3.3, 3.3])
            stroke({ x: g.from.x - dy / l * s, y: g.from.y + dx / l * s }, { x: g.to.x - dy / l * s, y: g.to.y + dx / l * s }, .55, '#eee2bc');
    }
    for (const h of data.hexes.filter(h => !world && isCity(h.terrain) && !inSettlement(h))) {
        const c = hexToPixel(h.coord), g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 35);
        g.addColorStop(0, 'rgba(168,144,99,.22)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - 35, c.y - 35, 70, 70);
    }
    list.filter(p => p.kind !== 'HILL' && p.kind !== 'ROUGH').sort((a, b) => a.y - b.y).forEach(drawStamp);
    const detailStarted = performance.now(), details = world ? [] : detailLayout(data).filter(p => !settlementCells.has(p.cell));
    drawDetails(ctx, detailTiles, details);
    const detailMs = performance.now() - detailStarted;
    ctx.restore();
    return { ...groundField, scratchPeakBytes, blendTileBytes, terrain010DecodedBytes: newTerrain.width * newTerrain.height * 4, terrain010TileBytes, localBakeMs, localTileBytes, settlementCells: [...settlementCells], tintMs, tintBackingBytes, details, detailCount: details.length, detailMs, detailDecodedBytes: detailsAtlas.width * detailsAtlas.height * 4, box, rasterScale: scale, layoutMs, placements: list, paintAndDecodeMs: performance.now() - started, canvasPixels: canvas.width * canvas.height, estimatedCanvasBytes: canvas.width * canvas.height * 4 };
}
