import { HEX_SIZE, hexPolygon, hexToPixel, midpoint, polygonPointsString, sharedHexEdge, } from '../geometry/hex.js';
export const SELECTED_VISUAL_SCALE = 1.045;
export const TOUCH_HIT_SIZE = Math.max(44, HEX_SIZE * 1.22);
export function deriveCounterPlacement(unit, stackIndex = 0, stackSize = 1) {
    const authoritativeAnchor = hexToPixel(unit.hex);
    if (stackSize === 1) {
        return { authoritativeAnchor, visualCenter: authoritativeAnchor, side: HEX_SIZE * 1.14 };
    }
    // Presentation-only local offsets. Both counters share one authoritative hex anchor.
    const offsets = stackIndex === 0 ? { x: -6.5, y: -6 } : { x: 6.5, y: 7 };
    return {
        authoritativeAnchor,
        visualCenter: { x: authoritativeAnchor.x + offsets.x, y: authoritativeAnchor.y + offsets.y },
        side: HEX_SIZE * 0.90,
    };
}
export function deriveCounterBounds(unit, stackIndex = 0, stackSize = 1) {
    const placement = deriveCounterPlacement(unit, stackIndex, stackSize);
    return {
        x: placement.visualCenter.x - placement.side / 2,
        y: placement.visualCenter.y - placement.side / 2,
        width: placement.side,
        height: placement.side,
    };
}
export function deriveTouchHitArea(unit) {
    // Touch expansion is presentation-only and remains centered on the canonical Hex anchor.
    return { center: hexToPixel(unit.hex), side: TOUCH_HIT_SIZE };
}
export function deriveOverlayPolygon(hex) {
    return polygonPointsString(hex);
}
export function deriveTargetBrackets(hex) {
    const vertices = hexPolygon(hex);
    const t = 0.28;
    const segments = [];
    for (const index of [0, 2, 4]) {
        const vertex = vertices[index];
        const prev = vertices[(index + 5) % 6];
        const next = vertices[(index + 1) % 6];
        const toward = (point) => ({
            x: vertex.x + (point.x - vertex.x) * t,
            y: vertex.y + (point.y - vertex.y) * t,
        });
        segments.push([vertex, toward(prev)], [vertex, toward(next)]);
    }
    return segments;
}
export function deriveCenterSegment(a, b) {
    return [hexToPixel(a), hexToPixel(b)];
}
export function deriveRiverEdge(a, b) {
    const edge = sharedHexEdge(a, b);
    if (!edge)
        throw new Error('River edge requires adjacent hexes.');
    return edge;
}
export function deriveBridgeGeometry(a, b) {
    const edge = deriveRiverEdge(a, b);
    const crossing = midpoint(edge);
    const ca = hexToPixel(a);
    const cb = hexToPixel(b);
    const dx = cb.x - ca.x;
    const dy = cb.y - ca.y;
    const len = Math.hypot(dx, dy);
    const half = 12;
    const ux = dx / len;
    const uy = dy / len;
    return {
        crossing,
        from: { x: crossing.x - ux * half, y: crossing.y - uy * half },
        to: { x: crossing.x + ux * half, y: crossing.y + uy * half },
        angleDeg: Math.atan2(dy, dx) * 180 / Math.PI,
    };
}
