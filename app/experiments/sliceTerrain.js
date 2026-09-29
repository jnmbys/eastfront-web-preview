import { hexPolygon, hexToPixel, sharedHexEdge } from '../geometry/hex.js';
import { deriveBridgeGeometry } from '../render/derive.js';
import { vs2RectangleSegmentDistance } from '../render/vs2Projection.js';
import { viewBoxForHexes } from '../render/coreSvg.js';
import { corridors, inside, segmentDistance, label } from './sliceData.js';
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
export function placements(data) {
    const lanes = corridors(data), out = [];
    for (const h of data.hexes) {
        const c = hexToPixel(h.coord), poly = hexPolygon(h.coord), random = rng(h.coord.q * 197 + h.coord.r * 719 + 17);
        if (h.terrain === 'HILL' || h.terrain === 'ROUGH') {
            out.push({ cell: label(h.coord), kind: h.terrain, x: c.x, y: c.y, width: 66 + random() * 9, height: 54 + random() * 9 });
            continue;
        }
        if (h.terrain !== 'FOREST' && h.terrain !== 'CITY')
            continue;
        const forest = h.terrain === 'FOREST', max = forest ? 20 : 22;
        for (let i = 0; i < 500 && out.filter(p => p.cell === label(h.coord)).length < max; i++) {
            const x = c.x + (random() - .5) * 64, y = c.y + (random() - .5) * 65, w = forest ? 21 + random() * 17 : 9 + random() * 2, hg = forest ? w * .88 : w * .94;
            const corners = [{ x: x - w / 2, y: y - hg / 2 }, { x: x + w / 2, y: y - hg / 2 }, { x: x + w / 2, y: y + hg / 2 }, { x: x - w / 2, y: y + hg / 2 }];
            if (!corners.every(p => inside(p, poly)))
                continue;
            // Entire sprite rectangle stays outside every river/transport envelope.
            if (lanes.some(l => vs2RectangleSegmentDistance({ x, y }, w / 2, hg / 2, l.a, l.b) < l.width))
                continue;
            if (out.some(p => p.cell === label(h.coord) && Math.hypot(p.x - x, p.y - y) < (forest ? 12 : 9)))
                continue;
            out.push({ cell: label(h.coord), kind: forest ? (i % 3 ? 'forest' : 'fringe') : 'city', x, y, width: w, height: hg });
        }
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
export async function paintSlice(canvas, data) {
    const started = performance.now(), [ground, atlas, buildings] = await Promise.all([loadImage('./assets/meadow.webp'), loadImage('./assets/terrain-atlas.webp'), loadImage('./assets/buildings.webp')]);
    const box = viewBoxForHexes(data.hexes, 8), scale = 3;
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
    for (let i = 0; i < 65; i++) {
        const x = box.minX + random() * box.width, y = box.minY + random() * box.height, r = 15 + random() * 40, g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, i % 3 ? 'rgba(158,143,97,.16)' : 'rgba(57,83,49,.19)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    const list = placements(data), cells = new Map(data.hexes.map(h => [label(h.coord), h]));
    const source = { forest: [15, 20, 705, 625], fringe: [740, 105, 494, 510], HILL: [20, 655, 660, 590], ROUGH: [20, 655, 660, 590], city: [678, 670, 568, 550] };
    const drawStamp = (p) => { const rect = source[p.kind], h = cells.get(p.cell); ctx.save(); ctx.beginPath(); path(hexPolygon(h.coord)); ctx.clip(); if (p.kind === 'city') {
        const index = list.filter(v => v.kind === 'city').indexOf(p) === 0 ? 3 : list.filter(v => v.kind === 'city').indexOf(p) % 3;
        const tileRects = [[72, 60, 550, 505], [740, 65, 490, 510], [35, 645, 640, 560], [735, 590, 505, 650]];
        ctx.drawImage(buildings, ...tileRects[index], p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
    }
    else
        ctx.drawImage(atlas, ...rect, p.x - p.width / 2, p.y - p.height / 2, p.width, p.height); ctx.restore(); };
    list.filter(p => p.kind === 'HILL' || p.kind === 'ROUGH').forEach(drawStamp);
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
    const waterPaths = chains.map(c => ({ ...c, points: smooth(c.points) }));
    const ribbon = (points, half, color) => { const left = [], right = []; for (let i = 0; i < points.length; i++) {
        const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, variation = .38 * Math.sin(p.x * .44 + p.y * .27) + .18 * Math.sin(p.x * 1.17 - p.y * .78), w = half + variation;
        left.push({ x: p.x + nx * w, y: p.y + ny * w });
        right.push({ x: p.x - nx * w, y: p.y - ny * w });
    } ctx.beginPath(); path([...left, ...right.reverse()]); ctx.fillStyle = color; ctx.fill(); };
    for (const [major, minor, color] of [[7.4, 5.4, '#53614b'], [6.2, 4.4, '#938c69'], [4.7, 3.1, '#747c65'], [3.8, 2.35, '#426e70']])
        for (const { kind, points } of waterPaths)
            ribbon(points, kind === 'MAJOR' ? major : minor, color);
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
                const x = a.x + dx * d / l, y = a.y + dy * d / l;
                stroke({ x: x - nx * 2, y: y - ny * 2 }, { x: x + nx * 2, y: y + ny * 2 }, .65, '#4e4a3e');
            }
            for (const s of [-.95, .95])
                stroke({ x: a.x + nx * s, y: a.y + ny * s }, { x: b.x + nx * s, y: b.y + ny * s }, .47, '#303935');
        }
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
    for (const h of data.hexes.filter(h => h.terrain === 'CITY')) {
        const c = hexToPixel(h.coord), g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 35);
        g.addColorStop(0, 'rgba(168,144,99,.22)');
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.fillRect(c.x - 35, c.y - 35, 70, 70);
    }
    list.filter(p => p.kind !== 'HILL' && p.kind !== 'ROUGH').sort((a, b) => a.y - b.y).forEach(drawStamp);
    ctx.restore();
    return { box, placements: list, paintAndDecodeMs: performance.now() - started, canvasPixels: canvas.width * canvas.height, estimatedCanvasBytes: canvas.width * canvas.height * 4 };
}
