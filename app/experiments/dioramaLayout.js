import { hexToPixel, hexPolygon } from '../geometry/hex.js';
import { corridors, inside, label } from './mapData.js';
import { vs2RectangleSegmentDistance } from '../render/vs2Projection.js';
// A connected eight-cell composition, not a new whole-map distribution rule.
export const settlementCells = new Set(['X14', 'W13', 'W14', 'V13', 'V14', 'W15', 'X15', 'Y15']);
export const inSettlement = (h) => settlementCells.has(label(h.coord));
export function composeSettlement(data, base) {
    const lanes = corridors(data), out = base.filter(p => !settlementCells.has(p.cell));
    const specs = {
        // Buildings face shared open court ground. Three roof families and one civic accent.
        X14: [[0, 20, 26, 28, 3], [-21, 16, 18, 20, 0], [21, 16, 18, 20, 1], [-10, 28, 10, 10, 0], [10, 28, 10, 10, 2], [-27, -14, 18, 18, 1], [27, -14, 18, 18, 0]],
        // Two connected canopy masses divided only by the real railway corridor.
        W13: [[-16, -18, 32, 28], [5, -20, 33, 30], [22, -14, 22, 23], [7, 17, 30, 28], [19, 15, 20, 22]],
        V13: [[-11, -4, 35, 29], [9, -7, 30, 28], [-17, 12, 30, 27], [2, 9, 35, 32], [18, 15, 24, 25], [-1, 24, 27, 20]],
        // Different relief scale/aspect and ridge center; old hill cutout reused without mirroring light.
        W14: [[-7, -5, 67, 48]], V14: [[-1, 5, 48, 68]], Y15: [[4, -3, 58, 42]]
    };
    for (const h of data.hexes.filter(inSettlement)) {
        const cell = label(h.coord), c = hexToPixel(h.coord), poly = hexPolygon(h.coord);
        for (const [dx, dy, width, height, roof] of specs[cell] ?? []) {
            const p = { cell, kind: h.terrain === 'CITY' ? 'city' : h.terrain === 'FOREST' ? 'forest' : h.terrain, x: c.x + dx, y: c.y + dy, width: width, height: height, ...(roof === undefined ? {} : { roof }) };
            // Forest/roof rectangles fit canonical cells and leave all actual transport/water corridors open.
            // Relief alpha can be clipped to its original cell; roads/water paint above relief as in 007.
            if (p.kind === 'city' || p.kind === 'forest') {
                const fits = () => [-1, 1].every(a => [-1, 1].every(b => inside({ x: p.x + a * p.width / 2, y: p.y + b * p.height / 2 }, poly)))
                    && !lanes.some(l => vs2RectangleSegmentDistance(p, p.width / 2, p.height / 2, l.a, l.b) < l.width + .5)
                    && !data.counters.some(u => { const q = hexToPixel(u.hex); return Math.abs(q.x - p.x) < 34 + p.width / 2 && Math.abs(q.y - p.y) < 34 + p.height / 2; });
                for (let attempt = 0; attempt < 20 && !fits(); attempt++) {
                    p.width *= .95;
                    p.height *= .95;
                }
                if (!fits() || p.width < (p.kind === 'city' ? 9 : 15))
                    throw Error('Unsafe composition ' + cell + ' ' + dx + ',' + dy);
            }
            out.push(p);
        }
    }
    return out;
}
/** Broad, feathered material masses. No new linear tracks, crossings or settlement symbols. */
export function paintSettlementGround(ctx, data, list) {
    const polygon = (points) => { ctx.moveTo(points[0].x, points[0].y); for (const p of points.slice(1))
        ctx.lineTo(p.x, p.y); ctx.closePath(); };
    const wash = (x, y, rx, ry, color) => { ctx.save(); ctx.translate(x, y); ctx.scale(rx, ry); const g = ctx.createRadialGradient(0, 0, .1, 0, 0, 1); g.addColorStop(0, color); g.addColorStop(.5, color); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.fillRect(-1, -1, 2, 2); ctx.restore(); };
    ctx.save();
    ctx.beginPath();
    data.hexes.filter(inSettlement).forEach(h => polygon(hexPolygon(h.coord)));
    ctx.clip();
    const city = hexToPixel(data.hexes.find(h => label(h.coord) === 'X14').coord);
    // One readable town ground mass and broad cultivated approach, not a halo per tiny house.
    wash(city.x, city.y + 17, 43, 34, 'rgba(156,121,77,.68)');
    wash(city.x - 11, city.y + 23, 30, 20, 'rgba(211,184,139,.74)');
    wash(city.x + 12, city.y + 23, 30, 20, 'rgba(195,165,117,.69)');
    wash(city.x, city.y - 25, 14, 17, 'rgba(164,145,111,.48)');
    wash(city.x - 27, city.y - 13, 14, 17, 'rgba(153,135,103,.43)');
    wash(city.x + 28, city.y - 13, 14, 17, 'rgba(153,135,103,.43)');
    // Shared courtyard paving; decorative surface only, no walls, road edges or facilities.
    ctx.save();
    ctx.beginPath();
    polygon(hexPolygon(data.hexes.find(h => label(h.coord) === 'X14').coord));
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(city.x - 29, city.y + 7);
    ctx.lineTo(city.x + 30, city.y + 7);
    ctx.lineTo(city.x + 22, city.y + 32);
    ctx.lineTo(city.x, city.y + 44);
    ctx.lineTo(city.x - 23, city.y + 32);
    ctx.closePath();
    const court = ctx.createLinearGradient(city.x - 20, city.y + 7, city.x + 24, city.y + 40);
    court.addColorStop(0, 'rgba(220,194,143,.30)');
    court.addColorStop(1, 'rgba(135,109,77,.18)');
    ctx.fillStyle = court;
    ctx.fill();
    // Low-contrast broad paving joints establish scale, visible as a coherent mass at medium zoom.
    ctx.clip();
    ctx.strokeStyle = 'rgba(107,92,68,.15)';
    ctx.lineWidth = .26;
    for (let i = -36; i < 44; i += 5) {
        ctx.beginPath();
        ctx.moveTo(city.x - 42, city.y + i);
        ctx.lineTo(city.x + 42, city.y + i + 14);
        ctx.stroke();
    }
    ctx.restore();
    // Forest litter and damp meadow extend under the existing bank/transport paint, unifying seams.
    for (const cell of ['W13', 'V13']) {
        const h = data.hexes.find(h => label(h.coord) === cell), c = hexToPixel(h.coord);
        wash(c.x, c.y, 49, 48, 'rgba(44,66,37,.38)');
        for (const p of list.filter(p => p.cell === cell))
            wash(p.x + 2, p.y + 3, p.width * .67, p.height * .64, 'rgba(26,44,32,.42)');
    }
    for (const cell of ['W14', 'V14', 'Y15']) {
        const h = data.hexes.find(h => label(h.coord) === cell), c = hexToPixel(h.coord);
        wash(c.x + 13, c.y + 12, 43, 27, 'rgba(87,83,52,.22)');
        wash(c.x - 12, c.y - 12, 33, 27, 'rgba(171,157,108,.22)');
    }
    for (const lane of corridors(data).filter(l => l.kind === 'river')) {
        // Only segments near this small composition; broad banks fade rather than add a new hard ribbon.
        if (!data.hexes.filter(inSettlement).some(h => { const c = hexToPixel(h.coord); return Math.hypot(c.x - (lane.a.x + lane.b.x) / 2, c.y - (lane.a.y + lane.b.y) / 2) < 60; }))
            continue;
        for (let i = 0; i <= 4; i++) {
            const t = i / 4, x = lane.a.x + (lane.b.x - lane.a.x) * t, y = lane.a.y + (lane.b.y - lane.a.y) * t;
            wash(x, y, 19, 19, 'rgba(60,83,58,.17)');
        }
    }
    ctx.restore();
}
