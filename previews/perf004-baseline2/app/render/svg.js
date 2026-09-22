import { assertAdjacentPath, hexKey, hexLine, hexPolygon, hexToPixel, polygonPointsString, } from '../geometry/hex.js';
import { attackTargetHexes, bridgeEdges, enemyZocHexes, mapHexes, railPath, reachableHexes, riverEdges, roadPath, terrainAt, units, } from '../model/prototypeData.js';
import { SELECTED_VISUAL_SCALE, deriveBridgeGeometry, deriveCenterSegment, deriveCounterBounds, deriveCounterPlacement, deriveOverlayPolygon, deriveRiverEdge, deriveTargetBrackets, deriveTouchHitArea, } from './derive.js';
function esc(value) {
    return value.replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] ?? char));
}
function line(a, b, className, extra = '') {
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${className}" ${extra}/>`;
}
function terrainClass(terrain) {
    return `terrain terrain-${terrain}`;
}
function stableVariant(hex, count) {
    const seed = Math.abs((hex.q * 37) + (hex.r * 61) + ((hex.q + hex.r) * 17));
    return seed % count;
}
function tree(x, y, scale = 1) {
    return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 -8 L-5 1 H-2.8 L-6 7 H6 L2.8 1 H5 Z"/><path d="M0 7 V11" class="tree-trunk"/></g>`;
}
function forestDetail(hex) {
    const c = hexToPixel(hex);
    const variants = [
        `${tree(-12, 2, .82)}${tree(2, -6, 1)}${tree(13, 7, .7)}`,
        `${tree(-13, -6, .68)}${tree(-2, 8, .9)}${tree(12, -3, .9)}${tree(16, 9, .55)}`,
        `${tree(-14, 7, .62)}${tree(-4, -5, .92)}${tree(9, -7, .68)}${tree(14, 7, .86)}`,
        `${tree(-12, -1, .92)}${tree(1, 6, .68)}${tree(11, -7, .82)}`,
    ];
    const variant = stableVariant(hex, variants.length);
    return `<g class="terrain-detail forest-detail" data-forest-variant="${variant}" transform="translate(${c.x} ${c.y})">${variants[variant]}</g>`;
}
function terrainDetail(hex, terrain) {
    const c = hexToPixel(hex);
    if (terrain === 'forest')
        return forestDetail(hex);
    if (terrain === 'city') {
        const variant = stableVariant(hex, 3);
        const layouts = [
            `<rect x="-13" y="-5" width="8" height="14"/><rect x="-2" y="-12" width="9" height="21"/><rect x="10" y="-2" width="6" height="11"/>`,
            `<rect x="-14" y="-10" width="9" height="18"/><rect x="-2" y="-4" width="8" height="13"/><rect x="9" y="-11" width="7" height="20"/>`,
            `<rect x="-12" y="-2" width="7" height="11"/><rect x="-1" y="-13" width="9" height="22"/><rect x="11" y="1" width="5" height="8"/>`,
        ];
        return `<g class="terrain-detail city-detail" data-city-variant="${variant}" transform="translate(${c.x} ${c.y})">${layouts[variant]}<path d="M-18 12 H18"/></g>`;
    }
    if (terrain === 'marsh') {
        return `<g class="terrain-detail marsh-detail" transform="translate(${c.x} ${c.y})"><path d="M-17 -8 H-3 M3 -8 H15 M-13 0 H7 M11 0 H18 M-17 8 H-5 M1 8 H13"/><path d="M-9 7 Q-6 1 -3 7 M5 6 Q8 0 11 6"/></g>`;
    }
    if (terrain === 'hill') {
        const variant = stableVariant(hex, 2);
        return `<g class="terrain-detail hill-detail" data-hill-variant="${variant}" transform="translate(${c.x} ${c.y})">${variant === 0 ? '<path d="M-19 12 Q-12 -7 -2 4 Q7 -15 19 12"/><path d="M-12 13 Q-5 2 2 9"/>' : '<path d="M-18 11 Q-8 -14 2 5 Q10 -9 18 11"/><path d="M-11 13 Q-2 1 8 11"/>'}</g>`;
    }
    return '';
}
function renderTerrain() {
    return mapHexes.map((hex) => {
        const terrain = terrainAt(hex);
        return `<g data-hex="${hexKey(hex)}"><polygon points="${polygonPointsString(hex)}" class="${terrainClass(terrain)}"/>${terrainDetail(hex, terrain)}</g>`;
    }).join('');
}
function pathSegments(path, className) {
    return path.slice(1).map((hex, i) => {
        const [a, b] = deriveCenterSegment(path[i], hex);
        return line(a, b, className);
    }).join('');
}
function railSleepers() {
    return railPath.slice(1).map((hex, i) => {
        const [a, b] = deriveCenterSegment(railPath[i], hex);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        return [0.18, 0.38, 0.58, 0.78].map((t) => {
            const x = a.x + dx * t;
            const y = a.y + dy * t;
            const half = 4.6;
            return line({ x: x - nx * half, y: y - ny * half }, { x: x + nx * half, y: y + ny * half }, 'rail-sleeper');
        }).join('');
    }).join('');
}
function renderBridge(a, b) {
    const g = deriveBridgeGeometry(a, b);
    const dx = g.to.x - g.from.x;
    const dy = g.to.y - g.from.y;
    const len = Math.hypot(dx, dy);
    const nx = -dy / len;
    const ny = dx / len;
    const railOffset = 3.8;
    const railAFrom = { x: g.from.x + nx * railOffset, y: g.from.y + ny * railOffset };
    const railATo = { x: g.to.x + nx * railOffset, y: g.to.y + ny * railOffset };
    const railBFrom = { x: g.from.x - nx * railOffset, y: g.from.y - ny * railOffset };
    const railBTo = { x: g.to.x - nx * railOffset, y: g.to.y - ny * railOffset };
    return `<g class="bridge" data-bridge="${hexKey(a)}|${hexKey(b)}">${line(g.from, g.to, 'bridge-shadow')}${line(g.from, g.to, 'bridge-deck')}${line(railAFrom, railATo, 'bridge-rail')}${line(railBFrom, railBTo, 'bridge-rail')}</g>`;
}
function renderInfrastructure() {
    const roads = `${pathSegments(roadPath, 'road-underlay')}${pathSegments(roadPath, 'road-center')}`;
    const railway = `${pathSegments(railPath, 'rail-underlay')}${pathSegments(railPath, 'rail-base')}${railSleepers()}`;
    const rivers = riverEdges.map(({ a, b }) => {
        const edge = deriveRiverEdge(a, b);
        return `${line(edge[0], edge[1], 'river-bank')}${line(edge[0], edge[1], 'river-water')}`;
    }).join('');
    const bridges = bridgeEdges.map(({ a, b }) => renderBridge(a, b)).join('');
    return `<g id="infrastructure-layer">${roads}${railway}${rivers}${bridges}</g>`;
}
function renderBaseOverlays() {
    const reachable = reachableHexes.map((hex) => `<polygon data-role="reachable" data-hex="${hexKey(hex)}" points="${deriveOverlayPolygon(hex)}" class="overlay reachable" role="button" tabindex="0" aria-label="Reachable hex ${hex.q},${hex.r}"/>`).join('');
    const zoc = enemyZocHexes.map((hex) => `<polygon data-role="zoc" data-hex="${hexKey(hex)}" points="${deriveOverlayPolygon(hex)}" class="overlay zoc"/>`).join('');
    return `<g id="overlay-base-layer">${reachable}${zoc}</g>`;
}
function renderTargets() {
    return `<g id="target-layer">${attackTargetHexes.map((hex) => {
        const brackets = deriveTargetBrackets(hex).map(([a, b]) => line(a, b, 'target-bracket')).join('');
        return `<g data-target-hex="${hexKey(hex)}"><polygon data-role="target" data-hex="${hexKey(hex)}" points="${deriveOverlayPolygon(hex)}" class="attack-target-base"/>${brackets}</g>`;
    }).join('')}</g>`;
}
function renderPath(path) {
    if (path.length < 2)
        return '';
    assertAdjacentPath(path);
    const points = path.map(hexToPixel);
    const polyline = `<polyline points="${points.map(p => `${p.x},${p.y}`).join(' ')}" class="planned-path"/>`;
    const nodes = points.map((p, i) => `<g><circle cx="${p.x}" cy="${p.y}" r="${i === points.length - 1 ? 6 : 3.5}" class="path-node ${i === points.length - 1 ? 'destination-node' : ''}"/>${i > 0 && i < points.length - 1 ? `<circle cx="${p.x}" cy="${p.y}" r="1.2" class="path-node-core"/>` : ''}</g>`).join('');
    const dest = path[path.length - 1];
    return `<g id="path-layer">${polyline}${nodes}<polygon points="${polygonPointsString(dest)}" class="destination-hex"/></g>`;
}
function unitSymbol(unit) {
    if (unit.kind === 'infantry')
        return `<path d="M-10 -9 L10 9 M10 -9 L-10 9"/>`;
    if (unit.kind === 'armor' || unit.kind === 'tank')
        return `<ellipse cx="0" cy="0" rx="11" ry="6.5"/>`;
    if (unit.kind === 'artillery')
        return `<circle cx="0" cy="0" r="5.5" fill="currentColor"/><path d="M-13 0 H13"/>`;
    return `<text x="0" y="4" text-anchor="middle" class="at-label">AT</text>`;
}
function factionMark(unit, side) {
    const label = unit.faction === 'german' ? 'G' : 'S';
    return `<g class="faction-mark" transform="translate(${side / 2 - 7} ${side / 2 - 7})"><circle cx="0" cy="0" r="4.2"/><text x="0" y="2.4" text-anchor="middle">${label}</text></g>`;
}
function renderCounterVisual(unit, selected, stackIndex, stackSize) {
    const p = deriveCounterPlacement(unit, stackIndex, stackSize);
    const side = p.side;
    const classes = ['counter-visual', 'counter', unit.faction, selected ? 'selected' : '', stackSize > 1 ? (stackIndex === stackSize - 1 ? 'stack-front' : 'stack-back') : 'single'].filter(Boolean).join(' ');
    const damage = unit.damage === 1 ? '/' : unit.damage === 2 ? '//' : '';
    const oos = unit.oos ? `<g class="oos-icon" transform="translate(${side / 2 - 7} ${-side / 2 + 8})"><path d="M-5 -2 q3 -5 7 -1 l2 2 M5 2 q-3 5 -7 1 l-2 -2 M-2 -2 l4 4"/></g>` : '';
    const stackBadge = stackSize > 1 && stackIndex === stackSize - 1 ? `<g class="stack-badge" transform="translate(${-side / 2 + 5.5} ${side / 2 - 5.5})"><circle r="5.2"/><text y="2.2" text-anchor="middle">${stackSize}</text></g>` : '';
    const scale = selected ? SELECTED_VISUAL_SCALE : 1;
    return `<g data-unit-id="${unit.id}" data-hex="${hexKey(unit.hex)}" data-anchor-x="${p.authoritativeAnchor.x}" data-anchor-y="${p.authoritativeAnchor.y}" class="${classes}" transform="translate(${p.visualCenter.x} ${p.visualCenter.y})" role="button" tabindex="0" aria-label="${unit.faction} ${unit.kind} ${unit.id}" aria-pressed="${selected}">
    <g class="counter-face" transform="scale(${scale})">
      <rect class="counter-body" x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}" rx="2.8"/>
      <path class="counter-top-rule" d="M${-side / 2 + 5} ${-side / 2 + 8} H${side / 2 - 5}"/>
      <g class="unit-symbol" transform="translate(0 -5)">${unitSymbol(unit)}</g>
      <line x1="${-side / 2 + 5}" y1="${side / 2 - 13}" x2="${side / 2 - 5}" y2="${side / 2 - 13}" class="stats-rule"/>
      <text x="0" y="${side / 2 - 3.8}" text-anchor="middle" class="counter-stats">${esc(unit.stats)}</text>
      ${damage ? `<text x="${-side / 2 + 5}" y="${-side / 2 + 11}" class="damage-mark">${damage}</text>` : ''}${oos}${factionMark(unit, side)}${stackBadge}
    </g>
  </g>`;
}
function groupedUnits() {
    const grouped = new Map();
    for (const unit of units) {
        const key = hexKey(unit.hex);
        const list = grouped.get(key) ?? [];
        list.push(unit);
        grouped.set(key, list);
    }
    return [...grouped.entries()].map(([key, group]) => ({ key, group }));
}
function renderUnits(state) {
    const groups = groupedUnits();
    const hitAreas = groups.map(({ group }) => {
        const primary = group[group.length - 1];
        const hit = deriveTouchHitArea(primary);
        return `<rect data-hit-unit-id="${primary.id}" data-hit-hex="${hexKey(primary.hex)}" class="unit-hit-area" x="${hit.center.x - hit.side / 2}" y="${hit.center.y - hit.side / 2}" width="${hit.side}" height="${hit.side}" rx="5" aria-hidden="true"/>`;
    }).join('');
    const visuals = groups.flatMap(({ group }) => group.map((unit, index) => renderCounterVisual(unit, state.selectedUnitId === unit.id, index, group.length))).join('');
    return `<g id="counter-layer"><g id="counter-hit-layer">${hitAreas}</g><g id="counter-visual-layer">${visuals}</g></g>`;
}
function renderDebugInfrastructure() {
    return [
        roadPath.map((hex) => { const c = hexToPixel(hex); return `<circle cx="${c.x}" cy="${c.y}" r="2.2" class="debug-road-node"/>`; }).join(''),
        railPath.map((hex) => { const c = hexToPixel(hex); return `<circle cx="${c.x}" cy="${c.y}" r="2.2" class="debug-rail-node"/>`; }).join(''),
        riverEdges.map(({ a, b }) => { const e = deriveRiverEdge(a, b); return line(e[0], e[1], 'debug-river-edge'); }).join(''),
        bridgeEdges.map(({ a, b }) => { const g = deriveBridgeGeometry(a, b); return `<circle cx="${g.crossing.x}" cy="${g.crossing.y}" r="4" class="debug-bridge-crossing"/>`; }).join(''),
    ].join('');
}
function renderDebugUnits() {
    return groupedUnits().flatMap(({ group }) => group.map((unit, index) => {
        const p = deriveCounterPlacement(unit, index, group.length);
        const bounds = deriveCounterBounds(unit, index, group.length);
        const hit = deriveTouchHitArea(unit);
        const offsetLine = group.length > 1 ? line(p.authoritativeAnchor, p.visualCenter, 'debug-stack-offset') : '';
        return `<g data-debug-unit="${unit.id}">${offsetLine}<rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" class="debug-counter-bounds"/><rect x="${hit.center.x - hit.side / 2}" y="${hit.center.y - hit.side / 2}" width="${hit.side}" height="${hit.side}" rx="5" class="debug-touch-bounds"/><g class="counter-anchor-debug"><line x1="${p.authoritativeAnchor.x - 5}" y1="${p.authoritativeAnchor.y}" x2="${p.authoritativeAnchor.x + 5}" y2="${p.authoritativeAnchor.y}"/><line x1="${p.authoritativeAnchor.x}" y1="${p.authoritativeAnchor.y - 5}" x2="${p.authoritativeAnchor.x}" y2="${p.authoritativeAnchor.y + 5}"/><circle cx="${p.authoritativeAnchor.x}" cy="${p.authoritativeAnchor.y}" r="2"/></g></g>`;
    })).join('');
}
function renderDebug(path) {
    const base = mapHexes.map((hex) => {
        const c = hexToPixel(hex);
        return `<polygon points="${polygonPointsString(hex)}" class="debug-boundary"/><circle cx="${c.x}" cy="${c.y}" r="2" class="debug-center"/><text x="${c.x + 4}" y="${c.y - 5}" class="debug-label">${hex.q},${hex.r}</text>`;
    }).join('');
    const pathNodes = path.map((hex) => { const c = hexToPixel(hex); return `<circle cx="${c.x}" cy="${c.y}" r="4.3" class="debug-path-node"/>`; }).join('');
    return `<g id="debug-geometry-layer">${base}${renderDebugInfrastructure()}${renderDebugUnits()}${pathNodes}</g>`;
}
export function makePath(selectedUnitId, destination) {
    const unit = units.find((u) => u.id === selectedUnitId);
    if (!unit)
        return [];
    const path = hexLine(unit.hex, destination);
    assertAdjacentPath(path);
    return path;
}
function computeMapViewBox() {
    const polygons = mapHexes.flatMap((hex) => hexPolygon(hex));
    const xs = polygons.map(p => p.x);
    const ys = polygons.map(p => p.y);
    const minX = Math.min(...xs) - 24;
    const maxX = Math.max(...xs) + 24;
    const minY = Math.min(...ys) - 24;
    const maxY = Math.max(...ys) + 24;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
}
export const MAP_VIEWBOX = Object.freeze(computeMapViewBox());
export function svgMarkup(state) {
    const v = MAP_VIEWBOX;
    return `<svg id="eastfront-map" viewBox="${v.minX} ${v.minY} ${v.width} ${v.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Eastfront programmatic hex map visual and touch prototype">
    <defs>
      <filter id="counterShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="0" dy="2" stdDeviation="1.7" flood-opacity="0.30"/></filter>
      <filter id="selectedShadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-opacity="0.42"/></filter>
    </defs>
    <g id="terrain-layer">${renderTerrain()}</g>
    ${renderInfrastructure()}
    ${renderBaseOverlays()}
    ${renderPath(state.plannedPath)}
    ${renderTargets()}
    ${renderUnits(state)}
    ${state.debug ? renderDebug(state.plannedPath) : ''}
  </svg>`;
}
