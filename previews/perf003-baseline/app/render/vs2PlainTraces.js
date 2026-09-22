import { vs2MarshEnvironment } from './vs2TerrainDetail.js';
import { vs2SegmentDistance } from './vs2Projection.js';
import { VS2_WORLD_H, vs2VisualValue, vs2WorldNoise } from './vs2WorldField.js';
/** Agricultural traces, not traversable roads or scenario features. Fixed world lattice. */
export function paintVS2PlainTraces(ctx, p, seed) {
    const step = VS2_WORLD_H * 0.85, bounds = p.viewBox;
    ctx.save();
    try {
        for (let iy = Math.floor(bounds.minY / step); iy < (bounds.minY + bounds.height) / step; iy++) {
            for (let ix = Math.floor(bounds.minX / step); ix < (bounds.minX + bounds.width) / step; ix++) {
                const r = (tag) => vs2VisualValue(seed, `F-fields:${tag}`, ix, iy);
                const cultivated = vs2WorldNoise(seed, 'F1-cultivation-region', ix * step, iy * step, VS2_WORLD_H * 3);
                if (r('presence') < 0.24 + cultivated * 0.3)
                    continue;
                const x = (ix + r('x') * 0.4) * step, y = (iy + r('y') * 0.4) * step;
                const w = step * (0.38 + r('w') * 0.3), h = step * (0.2 + r('h') * 0.25);
                const halfX = (w * Math.cos(0.18) + h * Math.sin(0.18)) / 2, halfY = (h * Math.cos(0.18) + w * Math.sin(0.18)) / 2;
                if ([-1, 0, 1].some(dx => [-1, 0, 1].some(dy => p.field.sample(x + dx * halfX, y + dy * halfY).weights[0] < 0.96)))
                    continue;
                if (p.corridors.some(e => vs2SegmentDistance({ x, y }, e.a, e.b) < Math.hypot(w, h) / 2 + e.radius))
                    continue;
                ctx.translate(x, y);
                ctx.rotate(-0.18);
                ctx.globalAlpha = 0.27;
                ctx.fillStyle = ['#cdb071', '#73914e', '#bc985f', '#8c9958'][Math.floor(r('crop') * 4)];
                ctx.fillRect(-w / 2, -h / 2, w, h);
                ctx.globalAlpha = 0.20;
                ctx.strokeStyle = '#677442';
                ctx.lineWidth = 0.6;
                ctx.beginPath();
                for (let dy = -h / 2 + 2; dy < h / 2; dy += 3) {
                    ctx.moveTo(-w / 2 + 1, dy);
                    ctx.lineTo(w / 2 - 1, dy);
                }
                ctx.stroke();
                // Broken field boundary, not a new traversable path.
                ctx.globalAlpha = 0.34;
                ctx.strokeStyle = '#847148';
                ctx.lineWidth = 0.55;
                ctx.beginPath();
                ctx.moveTo(-w / 2, -h / 2 + 2);
                ctx.lineTo(-w / 2, h / 2 - 2);
                ctx.stroke();
                if (r('fence') > 0.68) {
                    ctx.beginPath();
                    for (let dy = -h / 2 + 3; dy < h / 2 - 1; dy += 6) {
                        ctx.moveTo(-w / 2 - 0.6, dy);
                        ctx.lineTo(-w / 2 + 0.6, dy - 1.7);
                    }
                    ctx.stroke();
                }
                if (r('farm') > 0.955) {
                    ctx.globalAlpha = 0.88;
                    ctx.fillStyle = '#726b4e';
                    ctx.fillRect(-w / 2 + 3, -h / 2 + 3, 4.8, 3.4);
                    ctx.fillStyle = '#a87c4f';
                    ctx.fillRect(-w / 2 + 2.5, -h / 2 + 2.5, 4.8, 1.7);
                }
                ctx.rotate(0.18);
                ctx.translate(-x, -y);
            }
        }
    }
    finally {
        ctx.restore();
    }
}
/** Sparse reed tufts give marsh a land/water identity distinct from the lake fill. */
export function paintVS2MarshReeds(ctx, p, seed) {
    const step = 13, b = p.viewBox;
    ctx.save();
    try {
        ctx.strokeStyle = '#8f8745';
        ctx.lineWidth = 0.85;
        ctx.globalAlpha = 0.65;
        for (let iy = Math.floor(b.minY / step); iy < (b.minY + b.height) / step; iy++) {
            for (let ix = Math.floor(b.minX / step); ix < (b.minX + b.width) / step; ix++) {
                const r = vs2VisualValue(seed, 'F-reeds', ix, iy);
                const x = (ix + r) * step, y = (iy + r * 0.7) * step;
                const marshWeight = p.field.sample(x, y).weights[4];
                if (marshWeight < 0.55 || p.field.regionAt(x, y) !== 'marsh')
                    continue;
                const environment = vs2MarshEnvironment(seed, x, y);
                if (r < 0.25 + (1 - environment.reeds) * 0.6)
                    continue;
                if (p.corridors.some(e => vs2SegmentDistance({ x, y }, e.a, e.b) < e.radius + 4))
                    continue;
                ctx.globalAlpha = 0.22;
                ctx.fillStyle = environment.mud > 0.5 ? '#887550' : '#a29b60';
                ctx.beginPath();
                ctx.ellipse(x, y, 3.8 + r * 2, 1.8, -0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = environment.mud > 0.5 ? '#777349' : '#92914f';
                ctx.globalAlpha = 0.45 + marshWeight * 0.27;
                ctx.beginPath();
                for (const dx of [-1.5, 0, 1.5]) {
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + dx, y - 2.2 - r * 2);
                }
                ctx.stroke();
            }
        }
    }
    finally {
        ctx.restore();
    }
}
/** Small riparian vegetation groups follow actual river segments, avoiding all transport.
 * This pass is below infrastructure, so it cannot cover water, rails or bridge decks. */
export function paintVS2RiverbankDetails(ctx, p, seed) {
    const rivers = p.corridors.filter(e => e.kind === 'river'), transport = p.corridors.filter(e => e.kind !== 'river');
    ctx.save();
    try {
        for (const e of rivers) {
            const dx = e.b.x - e.a.x, dy = e.b.y - e.a.y, length = Math.hypot(dx, dy);
            for (let i = 0; i < 2; i++)
                for (const side of [-1, 1]) {
                    const r = vs2VisualValue(seed, `F1-bank:${e.key}:${side}`, i, 0);
                    const band = vs2WorldNoise(seed, 'F1-riparian-regions', e.a.x, e.a.y, VS2_WORLD_H * 2);
                    if (r < 0.28 + band * 0.45)
                        continue;
                    const t = (i + 0.2 + r * 0.6) / 2, offset = e.radius + 2.5 + r * 3;
                    const x = e.a.x + dx * t - dy / length * offset * side, y = e.a.y + dy * t + dx / length * offset * side;
                    if ([-4, 0, 4].some(ox => [-3, 0, 3].some(oy => p.field.sample(x + ox, y + oy).coverage < 0.999 || ['city', 'lake'].includes(p.field.regionAt(x + ox, y + oy) ?? ''))))
                        continue;
                    if (transport.some(c => vs2SegmentDistance({ x, y }, c.a, c.b) < c.radius + 4))
                        continue;
                    if (rivers.some(c => vs2SegmentDistance({ x, y }, c.a, c.b) < c.radius + 4))
                        continue;
                    ctx.globalAlpha = 0.34;
                    ctx.fillStyle = '#867653';
                    ctx.beginPath();
                    ctx.ellipse(x, y, 4, 2.3, Math.atan2(dy, dx), 0, Math.PI * 2);
                    ctx.fill();
                    for (let j = 0; j < (r > 0.75 ? 3 : 2); j++) {
                        const bx = x + (j - 1) * 1.9, by = y - (j % 2) * 1.1;
                        ctx.globalAlpha = 0.7;
                        ctx.fillStyle = j % 2 ? '#6f8747' : '#497351';
                        ctx.beginPath();
                        ctx.ellipse(bx, by, 1.9, 1.3, 0, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.globalAlpha = 0.55;
                        ctx.fillStyle = '#a5ae66';
                        ctx.beginPath();
                        ctx.ellipse(bx - 0.4, by - 0.4, 1.1, 0.5, 0, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
        }
    }
    finally {
        ctx.restore();
    }
}
