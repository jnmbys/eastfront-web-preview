import { EPSILON, hexDistance, hexPolygon, hexToPixel, polygonPointsString, sharedHexEdge } from '../geometry/hex.js';
import { attackTargetHexes, bridgeEdges, enemyZocHexes, initialSelectedUnitId, railPath, reachableHexes, riverEdges, roadPath, units } from '../model/prototypeData.js';
import { SELECTED_VISUAL_SCALE, deriveCounterBounds, deriveCounterPlacement, deriveOverlayPolygon, deriveRiverEdge, deriveTargetBrackets, deriveTouchHitArea, } from '../render/derive.js';
import { MAP_VIEWBOX, makePath, svgMarkup } from '../render/svg.js';
const near = (a, b) => Math.abs(a - b) < EPSILON;
const samePoint = (a, b) => near(a.x, b.x) && near(a.y, b.y);
const routeHasEdge = (route, a, b) => route.slice(1).some((h, i) => (h.q === b.q && h.r === b.r && route[i].q === a.q && route[i].r === a.r) || (h.q === a.q && h.r === a.r && route[i].q === b.q && route[i].r === b.r));
function insideConvex(point, polygon) {
    let sign = 0;
    for (let i = 0; i < polygon.length; i += 1) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
        if (Math.abs(cross) < EPSILON)
            continue;
        const s = Math.sign(cross);
        if (sign === 0)
            sign = s;
        else if (sign !== s)
            return false;
    }
    return true;
}
export function runGeometryAssertions() {
    const results = [];
    const check = (name, pass) => results.push({ name, pass });
    check('hex polygon = 6 vertices', hexPolygon({ q: 0, r: 0 }).length === 6);
    check('road path adjacency', roadPath.slice(1).every((h, i) => hexDistance(roadPath[i], h) === 1));
    check('rail path adjacency', railPath.slice(1).every((h, i) => hexDistance(railPath[i], h) === 1));
    check('reachable = base polygon', reachableHexes.every(h => deriveOverlayPolygon(h) === polygonPointsString(h)));
    check('ZOC = base polygon', enemyZocHexes.every(h => deriveOverlayPolygon(h) === polygonPointsString(h)));
    check('target = base polygon', attackTargetHexes.every(h => deriveOverlayPolygon(h) === polygonPointsString(h)));
    check('counter anchor = hex center', units.every(u => {
        const p = deriveCounterPlacement(u);
        const c = hexToPixel(u.hex);
        return samePoint(p.authoritativeAnchor, c);
    }));
    check('selected anchor unchanged', SELECTED_VISUAL_SCALE > 1 && units.every(u => samePoint(deriveCounterPlacement(u).authoritativeAnchor, hexToPixel(u.hex))));
    check('damage/OOS anchor unchanged', units.every(u => {
        const base = deriveCounterPlacement(u).authoritativeAnchor;
        const damage = { ...u, damage: (u.damage === 2 ? 0 : 2) };
        const oos = { ...u, oos: !u.oos };
        return samePoint(base, deriveCounterPlacement(damage).authoritativeAnchor) && samePoint(base, deriveCounterPlacement(oos).authoritativeAnchor);
    }));
    check('touch hit centered on anchor', units.every(u => samePoint(deriveTouchHitArea(u).center, hexToPixel(u.hex))));
    check('river = shared edge', riverEdges.every(({ a, b }) => {
        const d = deriveRiverEdge(a, b);
        const s = sharedHexEdge(a, b);
        return !!s && samePoint(d[0], s[0]) && samePoint(d[1], s[1]);
    }));
    check('river segments continuous', riverEdges.slice(1).every((edge, i) => {
        const prev = deriveRiverEdge(riverEdges[i].a, riverEdges[i].b);
        const cur = deriveRiverEdge(edge.a, edge.b);
        return prev.some(p => cur.some(q => samePoint(p, q)));
    }));
    check('bridges are route crossings', bridgeEdges.every(({ a, b }) => routeHasEdge(roadPath, a, b) || routeHasEdge(railPath, a, b)));
    check('target brackets stay on target hex', attackTargetHexes.every(h => deriveTargetBrackets(h).flat().every(p => insideConvex(p, hexPolygon(h)))));
    check('stack bounds stay inside owning hex', (() => {
        const groups = new Map();
        for (const u of units) {
            const key = `${u.hex.q},${u.hex.r}`;
            const list = groups.get(key) ?? [];
            groups.set(key, [...list, u]);
        }
        for (const group of groups.values())
            for (let i = 0; i < group.length; i += 1) {
                const u = group[i];
                const b = deriveCounterBounds(u, i, group.length);
                const corners = [{ x: b.x, y: b.y }, { x: b.x + b.width, y: b.y }, { x: b.x + b.width, y: b.y + b.height }, { x: b.x, y: b.y + b.height }];
                if (corners.some(c => !insideConvex(c, hexPolygon(u.hex))))
                    return false;
            }
        return true;
    })());
    check('unit model has no x/y truth', units.every(u => !('x' in u) && !('y' in u)));
    check('overlay model has no pixel vertices', [...reachableHexes, ...enemyZocHexes, ...attackTargetHexes].every(h => Object.keys(h).every(k => k === 'q' || k === 'r')));
    check('single responsive SVG viewBox', (() => {
        const path = makePath(initialSelectedUnitId, reachableHexes[0]);
        const normal = svgMarkup({ selectedUnitId: initialSelectedUnitId, plannedPath: path, debug: false });
        const debug = svgMarkup({ selectedUnitId: initialSelectedUnitId, plannedPath: path, debug: true });
        const expected = `${MAP_VIEWBOX.minX} ${MAP_VIEWBOX.minY} ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`;
        return normal.includes(`viewBox="${expected}"`) && debug.includes(`viewBox="${expected}"`) && normal.includes('preserveAspectRatio="xMidYMid meet"');
    })());
    return results;
}
