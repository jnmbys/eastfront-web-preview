import { axialToPaper } from '../../vendor/eastfront-digital-core/dist/index.js';
import { hexToPixel, hexPolygon } from '../geometry/hex.js';
import { corridors, inside, label } from './mapData.js';
import { placements } from './mapTerrain.js';
import { vs2RectangleSegmentDistance } from '../render/vs2Projection.js';
export const POLISH_BOUNDS = { firstColumn: 20, lastColumn: 26, firstRow: 11, lastRow: 17 };
export const inPolish = (h) => { const p = axialToPaper(h.coord); return h.coord.q + 1 >= 20 && h.coord.q + 1 <= 26 && p.row >= 11 && p.row <= 17; };
export const detailRects = { grass: [0, 80, 417, 540], shrub: [422, 80, 429, 545], stone: [854, 80, 396, 552], reeds: [0, 627, 424, 568], garden: [427, 658, 406, 533], yard: [854, 675, 395, 522] };
const rng = (seed) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
export function detailLayout(data) {
    const lanes = corridors(data), base = placements(data), details = [], city = data.hexes.filter(h => h.terrain === 'CITY').map(h => hexToPixel(h.coord));
    for (const h of data.hexes.filter(inPolish)) {
        const center = hexToPixel(h.coord), polygon = hexPolygon(h.coord), rand = rng(h.coord.q * 9901 + h.coord.r * 3137 + 7007), cell = label(h.coord), local = [];
        const nearby = lanes.filter(l => Math.min(l.a.x, l.b.x) < center.x + 55 && Math.max(l.a.x, l.b.x) > center.x - 55 && Math.min(l.a.y, l.b.y) < center.y + 55 && Math.max(l.a.y, l.b.y) > center.y - 55);
        const units = data.counters.filter(u => Math.hypot(hexToPixel(u.hex).x - center.x, hexToPixel(u.hex).y - center.y) < 95).map(u => hexToPixel(u.hex));
        const buildings = base.filter(p => p.cell === cell && p.kind === 'city'), trees = base.filter(p => p.cell === cell && (p.kind === 'forest' || p.kind === 'fringe'));
        function add(kind, x, y, width, height) {
            if (![-1, 1].every(s => [-1, 1].every(t => inside({ x: x + s * width / 2, y: y + t * height / 2 }, polygon))))
                return false;
            if (nearby.some(l => vs2RectangleSegmentDistance({ x, y }, width / 2, height / 2, l.a, l.b) < l.width + 1.5))
                return false;
            // Keep decoration out of the fixed display-counter footprint (larger stack envelope).
            if (units.some(u => Math.abs(x - u.x) < 34 + width / 2 && Math.abs(y - u.y) < 34 + height / 2))
                return false;
            if (buildings.some(b => Math.abs(x - b.x) < (width + b.width) / 2 + 1 && Math.abs(y - b.y) < (height + b.height) / 2 + 1))
                return false;
            if (local.some(p => Math.abs(p.x - x) < (p.width + width) * .42 && Math.abs(p.y - y) < (p.height + height) * .42))
                return false;
            local.push({ cell, kind, x, y, width, height, tone: rand() });
            return true;
        }
        // Clusters separated by real open ground, not uniform per-hex scatter.
        const anchors = Array.from({ length: 2 + Math.floor(rand() * 2) }, () => ({ x: center.x + (rand() - .5) * 52, y: center.y + (rand() - .5) * 52 }));
        const budget = h.terrain === 'FOREST' ? 14 : h.terrain === 'CITY' ? 22 : 3 + Math.floor(rand() * 7);
        for (let i = 0; i < budget * 7 && local.length < budget; i++) {
            const a = anchors[Math.floor(rand() * anchors.length)], x = a.x + (rand() - .5) * 20, y = a.y + (rand() - .5) * 21;
            let kind = 'grass', w = 3.5 + rand() * 5.5;
            if (h.terrain === 'FOREST') {
                kind = rand() < .7 ? 'shrub' : 'grass';
                w = 4 + rand() * 7;
                if (trees.some(t => Math.hypot(t.x - x, t.y - y) < t.width * .28))
                    continue;
            }
            else if (h.terrain === 'HILL' || h.terrain === 'ROUGH') {
                kind = rand() < .5 ? 'stone' : 'grass';
                w = 3 + rand() * 6;
            }
            else if (h.terrain === 'CITY') {
                kind = rand() < .4 ? 'yard' : rand() < .45 ? 'garden' : 'grass';
                w = kind === 'garden' ? 8 + rand() * 5 : 3 + rand() * 3;
            }
            else if (h.terrain === 'MARSH') {
                kind = 'reeds';
                w = 4 + rand() * 5;
            }
            else if (h.terrain !== 'PLAIN')
                continue;
            add(kind, x, y, w, w * (kind === 'garden' ? .57 : kind === 'reeds' ? .67 : .63));
        }
        // Two small cultivated plots only in plain cells touching the existing city, never new settlements.
        if (h.terrain === 'PLAIN' && city.some(c => Math.hypot(c.x - center.x, c.y - center.y) < 85))
            for (let i = 0, n = 0; i < 120 && n < 2; i++) {
                const w = 12 + rand() * 6;
                if (add('garden', center.x + (rand() - .5) * 50, center.y + (rand() - .5) * 58, w, w * .56))
                    n++;
            }
        // Follow existing river banks without covering water, routes or bridge openings.
        for (const l of nearby.filter(l => l.kind === 'river'))
            for (let i = 0; i < 14; i++) {
                const t = .05 + rand() * .9, dx = l.b.x - l.a.x, dy = l.b.y - l.a.y, len = Math.hypot(dx, dy), side = i % 2 ? 1 : -1, w = 5 + rand() * 7, offset = l.width + 6 + rand() * 4;
                add(rand() < .7 ? 'reeds' : 'shrub', l.a.x + dx * t - dy / len * offset * side, l.a.y + dy * t + dx / len * offset * side, w, w * .66);
            }
        details.push(...local);
    }
    return details;
}
export function tintedTile(image, rect, filter, width = 192) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.ceil(width * rect[3] / rect[2]);
    const ctx = canvas.getContext('2d');
    ctx.filter = filter;
    ctx.drawImage(image, ...rect, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    ctx.putImageData(pixels, 0, 0);
    return canvas;
}
export function prepareDetails(atlas) {
    return Object.fromEntries(Object.entries(detailRects).map(([kind, rect]) => [kind, [
            tintedTile(atlas, rect, kind === 'grass' ? 'saturate(.65) brightness(1.08)' : kind === 'shrub' ? 'saturate(1.07) brightness(.93)' : 'none', 128),
            tintedTile(atlas, rect, kind === 'grass' ? 'saturate(.8) brightness(.95)' : kind === 'shrub' ? 'saturate(1.1) brightness(1.08)' : 'brightness(1.04)', 128)
        ]]));
}
export function drawDetails(ctx, tiles, list) {
    for (const p of [...list].sort((a, b) => a.y - b.y))
        ctx.drawImage(tiles[p.kind][p.tone > .5 ? 1 : 0], p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
}
