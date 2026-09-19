import { coreHexKey } from '../core-adapter/core.js';
import { HEX_SIZE, hexPolygon, hexToPixel, pointString, polygonPointsString, sharedHexEdge } from '../geometry/hex.js';
import { deriveBridgeGeometry, deriveCounterBounds, deriveCounterPlacement, deriveTouchHitArea, SELECTED_VISUAL_SCALE } from './derive.js';
import { renderProductionBase } from './productionTerrain.js';
function esc(value) { return value.replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] ?? char)); }
function line(a, b, className, extra = '') { return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${className}" ${extra}/>`; }
export function viewBoxForHexes(hexes, margin = HEX_SIZE * 0.8) {
    const points = hexes.flatMap((hex) => hexPolygon(hex.coord));
    if (points.length === 0)
        return { minX: 0, minY: 0, width: 1, height: 1 };
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - margin, maxX = Math.max(...xs) + margin;
    const minY = Math.min(...ys) - margin, maxY = Math.max(...ys) + margin;
    return { minX, minY, width: maxX - minX, height: maxY - minY };
}
function stableVariant(hex, count) {
    const seed = Math.abs((hex.q * 37) + (hex.r * 61) + ((hex.q + hex.r) * 17));
    return seed % count;
}
function tree(x, y, scale = 1) { return `<g transform="translate(${x} ${y}) scale(${scale})"><path d="M0 -8 L-5 1 H-2.8 L-6 7 H6 L2.8 1 H5 Z"/><path d="M0 7 V11" class="tree-trunk"/></g>`; }
function terrainClass(terrain) { return `terrain terrain-${terrain.toLowerCase().replace('_', '-')}`; }
function terrainDetail(hex, terrain) {
    const c = hexToPixel(hex);
    if (terrain === 'FOREST') {
        const variants = [
            `${tree(-12, 2, .82)}${tree(2, -6, 1)}${tree(13, 7, .7)}`,
            `${tree(-13, -6, .68)}${tree(-2, 8, .9)}${tree(12, -3, .9)}${tree(16, 9, .55)}`,
            `${tree(-14, 7, .62)}${tree(-4, -5, .92)}${tree(9, -7, .68)}${tree(14, 7, .86)}`,
            `${tree(-12, -1, .92)}${tree(1, 6, .68)}${tree(11, -7, .82)}`,
        ];
        const variant = stableVariant(hex, variants.length);
        return `<g class="terrain-detail forest-detail" data-forest-variant="${variant}" transform="translate(${c.x} ${c.y})">${variants[variant]}</g>`;
    }
    if (terrain === 'CITY' || terrain === 'MAIN_CITY' || terrain === 'OUTER_CITY') {
        const major = terrain === 'MAIN_CITY';
        return `<g class="terrain-detail city-detail ${major ? 'capital-detail' : ''}" transform="translate(${c.x} ${c.y})"><rect x="-13" y="-7" width="8" height="15"/><rect x="-2" y="-12" width="9" height="20"/><rect x="10" y="-3" width="6" height="12"/>${major ? '<rect x="-8" y="10" width="19" height="4"/>' : ''}<path d="M-18 14 H18"/></g>`;
    }
    if (terrain === 'MARSH')
        return `<g class="terrain-detail marsh-detail" transform="translate(${c.x} ${c.y})"><path d="M-17 -8 H-3 M3 -8 H15 M-13 0 H7 M11 0 H18 M-17 8 H-5 M1 8 H13"/><path d="M-9 7 Q-6 1 -3 7 M5 6 Q8 0 11 6"/></g>`;
    if (terrain === 'HILL' || terrain === 'ROUGH')
        return `<g class="terrain-detail hill-detail ${terrain === 'ROUGH' ? 'rough-detail' : ''}" transform="translate(${c.x} ${c.y})"><path d="M-19 12 Q-12 -7 -2 4 Q7 -15 19 12"/><path d="M-12 13 Q-5 2 2 9"/>${terrain === 'ROUGH' ? '<path d="M-15 -8 l5 -5 4 6 5 -7 6 8 5 -4"/>' : ''}</g>`;
    if (terrain === 'LAKE')
        return `<g class="terrain-detail lake-detail" transform="translate(${c.x} ${c.y})"><path d="M-19 -4 Q-11 -9 -3 -4 T13 -4 M-15 5 Q-7 0 1 5 T17 5"/></g>`;
    return '';
}
function renderTerrain(model) {
    return model.hexes.map((hex) => `<g data-hex="${coreHexKey(hex.coord)}"><polygon points="${polygonPointsString(hex.coord)}" class="${terrainClass(hex.terrain)}"/>${terrainDetail(hex.coord, hex.terrain)}</g>`).join('');
}
function railSleepers(edge) {
    const a = hexToPixel(edge.a), b = hexToPixel(edge.b);
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    const nx = -dy / len, ny = dx / len;
    return [0.18, 0.38, 0.58, 0.78].map((t) => { const x = a.x + dx * t, y = a.y + dy * t, half = 4.6; return line({ x: x - nx * half, y: y - ny * half }, { x: x + nx * half, y: y + ny * half }, 'rail-sleeper'); }).join('');
}
function renderBridge(edge) {
    const g = deriveBridgeGeometry(edge.a, edge.b);
    const dx = g.to.x - g.from.x, dy = g.to.y - g.from.y, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, offset = 3.8;
    const a1 = { x: g.from.x + nx * offset, y: g.from.y + ny * offset }, a2 = { x: g.to.x + nx * offset, y: g.to.y + ny * offset };
    const b1 = { x: g.from.x - nx * offset, y: g.from.y - ny * offset }, b2 = { x: g.to.x - nx * offset, y: g.to.y - ny * offset };
    return `<g class="bridge" data-edge-key="${esc(edge.key)}">${line(g.from, g.to, 'bridge-shadow')}${line(g.from, g.to, 'bridge-deck')}${line(a1, a2, 'bridge-rail')}${line(b1, b2, 'bridge-rail')}</g>`;
}
function renderInfrastructure(model) {
    const edges = model.edges;
    const roads = edges.filter((edge) => edge.road).map((edge) => { const a = hexToPixel(edge.a), b = hexToPixel(edge.b); return `${line(a, b, 'road-underlay', `data-edge-key="${esc(edge.key)}"`)}${line(a, b, 'road-center')}`; }).join('');
    const rails = edges.filter((edge) => edge.railway?.present).map((edge) => { const a = hexToPixel(edge.a), b = hexToPixel(edge.b); return `${line(a, b, 'rail-underlay', `data-edge-key="${esc(edge.key)}"`)}${line(a, b, 'rail-base')}${railSleepers(edge)}`; }).join('');
    const rivers = edges.filter((edge) => edge.river).map((edge) => { const shared = sharedHexEdge(edge.a, edge.b); if (!shared)
        throw new Error(`Core river edge ${edge.key} is not adjacent in UI geometry.`); return `${line(shared[0], shared[1], 'river-bank', `data-edge-key="${esc(edge.key)}"`)}${line(shared[0], shared[1], edge.river === 'MAJOR' ? 'river-water river-major' : 'river-water')}`; }).join('');
    const bridges = edges.filter((edge) => edge.bridge && !edge.bridge.destroyed).map(renderBridge).join('');
    return `<g id="infrastructure-layer">${roads}${rails}${rivers}${bridges}</g>`;
}
function renderDeploymentZone(model) {
    if (!model.deployment)
        return '';
    return `<g id="deployment-zone-layer">${model.deployment.zoneKeys.map((key) => { const hex = model.hexes.find((candidate) => coreHexKey(candidate.coord) === key); if (!hex)
        return ''; return `<polygon data-role="deployment-hex" data-hex="${key}" points="${polygonPointsString(hex.coord)}" class="deployment-zone" role="button" tabindex="0" aria-label="Deployment hex ${key}"/>`; }).join('')}</g>`;
}
function renderMoveOptions(model) {
    if (model.moveOptions.length === 0)
        return '';
    return `<g id="movement-preview-layer">${model.moveOptions.map((option) => `<polygon data-role="move-option" data-hex="${coreHexKey(option.hex)}" data-legal="${option.legal}" points="${polygonPointsString(option.hex)}" class="move-option ${option.legal ? 'move-legal' : 'move-illegal'}" role="button" tabindex="0" aria-label="${option.legal ? 'Legal' : 'Illegal'} move ${coreHexKey(option.hex)}"/>`).join('')}</g>`;
}
function renderMovementPath(model) {
    if (!model.movement || !model.selectedCounter || model.movement.path.length === 0)
        return '';
    const hexes = [model.selectedCounter.hex, ...model.movement.path];
    const points = hexes.map((hex) => hexToPixel(hex));
    return `<g id="movement-path-layer"><polyline class="planned-path movement-draft" points="${points.map(pointString).join(' ')}"/>${points.map((p, index) => `<circle cx="${p.x}" cy="${p.y}" r="${index === points.length - 1 ? 4.4 : 3}" class="path-node ${index === points.length - 1 ? 'destination-node' : ''}"/>`).join('')}<polygon points="${polygonPointsString(hexes.at(-1))}" class="destination-hex"/></g>`;
}
function renderRailInteraction(model) {
    if (!model.railRepair)
        return '';
    const selected = new Set(model.railRepair.selectedEdgeKeys), active = new Set(model.railRepair.activeEdgeKeys);
    return `<g id="rail-interaction-layer">${model.edges.filter((edge) => edge.railway?.present).map((edge) => { const a = hexToPixel(edge.a), b = hexToPixel(edge.b); return `${line(a, b, `rail-repair-highlight ${active.has(edge.key) ? 'rail-active' : ''} ${selected.has(edge.key) ? 'rail-selected' : ''}`, `data-edge-key="${esc(edge.key)}"`)}${line(a, b, 'rail-hit-corridor', `data-role="rail-repair-edge" data-edge-key="${esc(edge.key)}" role="button" tabindex="0" aria-label="Rail edge ${esc(edge.key)}"`)}`; }).join('')}</g>`;
}
function renderReinforcementEntries(model) {
    if (!model.reinforcement)
        return '';
    const keys = new Set(model.reinforcement.legalEntryKeys);
    return `<g id="reinforcement-entry-layer">${model.hexes.filter((hex) => keys.has(coreHexKey(hex.coord))).map((hex) => `<polygon data-role="reinforcement-entry" data-hex="${coreHexKey(hex.coord)}" points="${polygonPointsString(hex.coord)}" class="reinforcement-entry" role="button" tabindex="0"/>`).join('')}</g>`;
}
function renderRecoveryBases(model) {
    if (!model.recovery)
        return '';
    const keys = new Set(model.recovery.baseKeys);
    return `<g id="recovery-base-layer">${model.hexes.filter((hex) => keys.has(coreHexKey(hex.coord))).map((hex) => `<polygon points="${polygonPointsString(hex.coord)}" class="recovery-base" data-recovery-base="${coreHexKey(hex.coord)}"/>`).join('')}</g>`;
}
function unitSymbol(type) {
    if (type === 'INFANTRY' || type === 'JAGER' || type === 'ELITE_INFANTRY')
        return `<path d="M-10 -9 L10 9 M10 -9 L-10 9"/>${type === 'JAGER' ? '<text x="0" y="4" text-anchor="middle" class="unit-mini-label">J</text>' : type === 'ELITE_INFANTRY' ? '<text x="0" y="4" text-anchor="middle" class="unit-mini-label">E</text>' : ''}`;
    if (type === 'PANZER' || type === 'TANK' || type === 'HEAVY_TANK')
        return `<ellipse cx="0" cy="0" rx="11" ry="6.5"/>${type === 'HEAVY_TANK' ? '<text x="0" y="3" text-anchor="middle" class="unit-mini-label">H</text>' : ''}`;
    if (type === 'MOTORIZED')
        return `<ellipse cx="0" cy="0" rx="12" ry="7"/><path d="M-9 -7 L9 7 M9 -7 L-9 7"/>`;
    if (type === 'ARTILLERY')
        return `<circle cx="0" cy="0" r="5.5" fill="currentColor"/><path d="M-13 0 H13"/>`;
    if (type === 'ENGINEER')
        return `<text x="0" y="4" text-anchor="middle" class="unit-letter-label">E</text>`;
    if (type === 'RECON')
        return `<path d="M0 -9 L10 0 L0 9 L-10 0 Z"/>`;
    if (type === 'ANTI_TANK')
        return `<text x="0" y="4" text-anchor="middle" class="unit-letter-label">AT</text>`;
    return `<text x="0" y="4" text-anchor="middle" class="unit-letter-label">HQ</text>`;
}
function renderCounter(counter, stackIndex, stackSize) {
    const p = deriveCounterPlacement(counter, stackIndex, stackSize);
    const side = p.side;
    const scale = counter.selected ? SELECTED_VISUAL_SCALE : 1;
    const faction = counter.side === 'GERMAN' ? 'german' : 'soviet';
    const damage = counter.step === 1 ? '/' : counter.step === 2 ? '//' : '';
    const oos = counter.supplyState === 'OUT_OF_SUPPLY' ? `<g class="oos-icon" transform="translate(${side / 2 - 7} ${-side / 2 + 8})"><path d="M-5 -2 q3 -5 7 -1 l2 2 M5 2 q-3 5 -7 1 l-2 -2 M-2 -2 l4 4"/></g>` : '';
    const entrenched = counter.entrenched ? `<g class="entrench-icon" transform="translate(${-side / 2 + 7} ${-side / 2 + 9})"><path d="M-5 2 Q0 -4 5 2 M-6 4 H6"/></g>` : '';
    const stackBadge = stackSize > 1 && stackIndex === stackSize - 1 ? `<g class="stack-badge" transform="translate(${-side / 2 + 5.5} ${side / 2 - 5.5})"><circle r="5.2"/><text y="2.2" text-anchor="middle">${stackSize}</text></g>` : '';
    const stat = `${counter.stats.attack}-${counter.stats.defense}-${counter.stats.movement}`;
    return `<g data-unit-id="${esc(counter.id)}" data-hex="${coreHexKey(counter.hex)}" data-anchor-x="${p.authoritativeAnchor.x}" data-anchor-y="${p.authoritativeAnchor.y}" class="counter-visual counter ${faction} ${counter.selected ? 'selected' : ''}" transform="translate(${p.visualCenter.x} ${p.visualCenter.y})" role="button" tabindex="0" aria-label="${counter.side} ${counter.type} ${esc(counter.id)}" aria-pressed="${counter.selected}"><g class="counter-face" transform="scale(${scale})"><rect class="counter-body" x="${-side / 2}" y="${-side / 2}" width="${side}" height="${side}" rx="2.8"/><path class="counter-top-rule" d="M${-side / 2 + 5} ${-side / 2 + 8} H${side / 2 - 5}"/><text x="${-side / 2 + 4}" y="${-side / 2 + 7}" class="counter-id">${esc(counter.id.replace(/^(G|S)-/, ''))}</text><g class="unit-symbol" transform="translate(0 -4)">${unitSymbol(counter.type)}</g><line x1="${-side / 2 + 5}" y1="${side / 2 - 13}" x2="${side / 2 - 5}" y2="${side / 2 - 13}" class="stats-rule"/><text x="0" y="${side / 2 - 4}" text-anchor="middle" class="counter-stats">${stat}</text>${damage ? `<text x="${-side / 2 + 5}" y="${-side / 2 + 17}" class="damage-mark">${damage}</text>` : ''}${oos}${entrenched}${stackBadge}</g></g>`;
}
function renderCombatGeometry(model) {
    const combat = model.combat;
    if (!combat)
        return '';
    let out = '<g id="combat-geometry-layer">';
    if (!combat.pending) {
        const selected = new Set(combat.attackDraft.attackerUnitIds);
        for (const hex of combat.attackDraft.targetHexes)
            out += `<polygon data-role="attack-target" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="combat-target-option ${combat.attackDraft.target && coreHexKey(combat.attackDraft.target) === coreHexKey(hex) ? 'selected' : ''}" role="button" tabindex="0"/>`;
        if (combat.attackDraft.target) {
            const target = hexToPixel(combat.attackDraft.target);
            for (const id of selected) {
                const c = model.counters.find((u) => u.id === id);
                if (c)
                    out += line(hexToPixel(c.hex), target, 'combat-attack-line');
            }
        }
    }
    if (combat.retreat) {
        for (const hex of combat.retreat.options)
            out += `<polygon data-role="retreat-option" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="retreat-option" role="button" tabindex="0"/>`;
        for (const [id, path] of Object.entries(combat.retreat.drafts)) {
            const c = model.counters.find((u) => u.id === id);
            if (!c || path.length === 0)
                continue;
            const pts = [c.hex, ...path].map(hexToPixel);
            out += `<polyline class="retreat-draft-line" points="${pts.map(pointString).join(' ')}"/>`;
        }
    }
    if (combat.breakthrough) {
        for (const option of combat.breakthrough.options)
            out += `<polygon data-role="breakthrough-option" data-hex="${coreHexKey(option.hex)}" data-legal="${option.legal}" points="${polygonPointsString(option.hex)}" class="breakthrough-option ${option.legal ? 'legal' : 'illegal'}" role="button" tabindex="0"/>`;
        const tx = combat.battle;
        if (tx && combat.breakthrough.path.length) {
            const pts = [tx.targetHex, ...combat.breakthrough.path].map(hexToPixel);
            out += `<polyline class="breakthrough-draft-line" points="${pts.map(pointString).join(' ')}"/>`;
        }
    }
    if (combat.schwerpunkt) {
        for (const hex of combat.schwerpunkt.targetOptions)
            out += `<polygon data-role="schwerpunkt-target" data-hex="${coreHexKey(hex)}" points="${polygonPointsString(hex)}" class="schwerpunkt-target ${combat.schwerpunkt.target && coreHexKey(combat.schwerpunkt.target) === coreHexKey(hex) ? 'selected' : ''}" role="button" tabindex="0"/>`;
    }
    if (combat.battle) {
        out += `<polygon points="${polygonPointsString(combat.battle.targetHex)}" class="combat-battle-target" data-battle-id="${esc(combat.battle.battleId)}"/>`;
    }
    return out + '</g>';
}
function renderCounters(model) {
    const groups = new Map();
    for (const counter of model.counters) {
        const key = coreHexKey(counter.hex);
        const list = groups.get(key) ?? [];
        list.push(counter);
        groups.set(key, list);
    }
    const hits = [...groups.values()].flatMap((group) => group.map((counter) => { const hit = deriveTouchHitArea(counter); return `<rect data-hit-unit-id="${esc(counter.id)}" x="${hit.center.x - hit.side / 2}" y="${hit.center.y - hit.side / 2}" width="${hit.side}" height="${hit.side}" class="unit-hit-area"/>`; })).join('');
    const visuals = [...groups.values()].flatMap((group) => group.sort((a, b) => a.id.localeCompare(b.id)).map((counter, index) => renderCounter(counter, index, group.length))).join('');
    return `<g id="counter-hit-layer">${hits}</g><g id="counter-layer">${visuals}</g>`;
}
function renderDebug(model) {
    const hexes = model.hexes.map((hex) => { const c = hexToPixel(hex.coord); return `<g><polygon points="${polygonPointsString(hex.coord)}" class="debug-boundary"/><circle cx="${c.x}" cy="${c.y}" r="2.2" class="debug-center"/><text x="${c.x}" y="${c.y + 9}" text-anchor="middle" class="debug-label">${hex.coord.q},${hex.coord.r}</text></g>`; }).join('');
    const edges = model.edges.map((edge) => { const a = hexToPixel(edge.a), b = hexToPixel(edge.b); let out = ''; if (edge.road)
        out += `<circle cx="${a.x}" cy="${a.y}" r="2.7" class="debug-road-node"/><circle cx="${b.x}" cy="${b.y}" r="2.7" class="debug-road-node"/>`; if (edge.railway?.present)
        out += `<circle cx="${a.x}" cy="${a.y}" r="2" class="debug-rail-node"/><circle cx="${b.x}" cy="${b.y}" r="2" class="debug-rail-node"/>`; if (edge.river) {
        const shared = sharedHexEdge(edge.a, edge.b);
        if (shared)
            out += line(shared[0], shared[1], 'debug-river-edge');
    } if (edge.bridge) {
        const g = deriveBridgeGeometry(edge.a, edge.b);
        out += `<circle cx="${g.crossing.x}" cy="${g.crossing.y}" r="3.5" class="debug-bridge-crossing"/>`;
    } return out; }).join('');
    const counters = model.counters.map((counter) => { const group = model.counters.filter((other) => coreHexKey(other.hex) === coreHexKey(counter.hex)).sort((a, b) => a.id.localeCompare(b.id)); const index = group.findIndex((other) => other.id === counter.id); const bounds = deriveCounterBounds(counter, index, group.length); const hit = deriveTouchHitArea(counter); const anchor = hexToPixel(counter.hex); return `<g><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" class="debug-counter-bounds"/><rect x="${hit.center.x - hit.side / 2}" y="${hit.center.y - hit.side / 2}" width="${hit.side}" height="${hit.side}" class="debug-touch-bounds"/><path d="M${anchor.x - 4} ${anchor.y} H${anchor.x + 4} M${anchor.x} ${anchor.y - 4} V${anchor.y + 4}" class="counter-anchor-debug"/></g>`; }).join('');
    return `<g id="debug-layer">${hexes}${edges}${counters}</g>`;
}
export function coreSvgStaticMarkup(model, options) {
    const mode = options.rendererMode ?? 'prototype', assetSet = options.assetSet ?? 'p5', lod = options.lod ?? 'medium', seed = options.scenarioSeed ?? 17;
    return mode === 'production' ? renderProductionBase(model, seed, lod, assetSet, options.marshContinuity ?? true) : `<g id="terrain-layer">${renderTerrain(model)}</g>${renderInfrastructure(model)}`;
}
export function coreSvgDynamicMarkup(model, options) {
    return `${renderRecoveryBases(model)}${renderDeploymentZone(model)}${renderReinforcementEntries(model)}${renderRailInteraction(model)}${renderMoveOptions(model)}${renderMovementPath(model)}${renderCombatGeometry(model)}${renderCounters(model)}${options.debug ? renderDebug(model) : ''}`;
}
export function coreSvgMarkup(model, options) {
    const vb = viewBoxForHexes(model.hexes), mode = options.rendererMode ?? 'prototype', assetSet = options.assetSet ?? 'p5', lod = options.lod ?? 'medium';
    const staticMarkup = coreSvgStaticMarkup(model, options), dynamicMarkup = coreSvgDynamicMarkup(model, options);
    return `<svg id="eastfront-map" data-renderer-mode="${mode}" data-asset-set="${assetSet}" data-lod="${lod}" viewBox="${vb.minX} ${vb.minY} ${vb.width} ${vb.height}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Strategic Reset F operational map"><defs><filter id="counterShadow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.4" flood-opacity=".33"/></filter><filter id="selectedShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".46"/></filter></defs><g id="map-static-layer">${staticMarkup}</g><g id="map-dynamic-layer">${dynamicMarkup}</g></svg>`;
}
