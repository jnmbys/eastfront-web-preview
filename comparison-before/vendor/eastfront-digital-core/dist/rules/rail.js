import { hexDistance, hexKey } from '../core/hex.js';
import { findDuplicates } from '../core/collections.js';
/** Canonical derived rail-repair index. Never store a second repaired-edge collection in GameState. */
export function getRepairedRailEdgeKeys(state, side) {
    return Object.values(state.edges)
        .filter((edge) => edge.railway?.present && !edge.railway.destroyed && edge.railway.repairedBy !== null)
        .filter((edge) => side === undefined || edge.railway?.repairedBy === side)
        .map((edge) => edge.key)
        .sort();
}
function isTraversableGermanRailEdge(state, edge) {
    const rail = edge.railway;
    return Boolean(rail?.present === true && rail.destroyed === false && rail.repairedBy === 'GERMAN' &&
        state.hexes[hexKey(edge.a)] && state.hexes[hexKey(edge.b)] && hexDistance(edge.a, edge.b) === 1);
}
/**
 * Digital Rules Amendment DR-001 — Whole Connected Rail Network Supply.
 *
 * An active German railway edge must be repaired by Germany, undestroyed, and connected by
 * the same kind of edge to an unblocked German west rail entry. Live Soviet occupation blocks
 * entering/traversing that hex; enemy ZOC alone is intentionally irrelevant.
 */
export function computeActiveGermanRailNetwork(state, scenario) {
    const blockedHexKeys = new Set(Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'SOVIET')
        .map((unit) => hexKey(unit.hex)));
    const adjacency = new Map();
    for (const edge of Object.values(state.edges)) {
        if (!isTraversableGermanRailEdge(state, edge))
            continue;
        const aKey = hexKey(edge.a), bKey = hexKey(edge.b);
        const aList = adjacency.get(aKey) ?? [];
        aList.push({ edgeKey: edge.key, otherHexKey: bKey });
        adjacency.set(aKey, aList);
        const bList = adjacency.get(bKey) ?? [];
        bList.push({ edgeKey: edge.key, otherHexKey: aKey });
        adjacency.set(bKey, bList);
    }
    for (const list of adjacency.values())
        list.sort((a, b) => a.edgeKey.localeCompare(b.edgeKey) || a.otherHexKey.localeCompare(b.otherHexKey));
    const activeEdges = new Set();
    const activeHexes = new Set();
    const seededEntries = new Set();
    const visited = new Set();
    const queue = [];
    const scenarioEntryKeys = scenario.germanWestRailEntries.map(hexKey).sort();
    for (const entryKey of scenarioEntryKeys) {
        if (!state.hexes[entryKey] || blockedHexKeys.has(entryKey))
            continue;
        if (!adjacency.has(entryKey))
            continue;
        if (!visited.has(entryKey)) {
            visited.add(entryKey);
            queue.push(entryKey);
        }
    }
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        for (const link of adjacency.get(current) ?? []) {
            // Occupied railway hexes are not entered into the active network, so they cannot project
            // supply later and cannot be used as a bridge to rails beyond them.
            if (blockedHexKeys.has(link.otherHexKey))
                continue;
            activeEdges.add(link.edgeKey);
            activeHexes.add(current);
            activeHexes.add(link.otherHexKey);
            if (scenarioEntryKeys.includes(current))
                seededEntries.add(current);
            if (!visited.has(link.otherHexKey)) {
                visited.add(link.otherHexKey);
                queue.push(link.otherHexKey);
            }
        }
    }
    return {
        edgeKeys: [...activeEdges].sort(),
        hexKeys: [...activeHexes].sort(),
        entryHexKeys: [...seededEntries].sort()
    };
}
/** Query a previously derived network; no second graph traversal is performed. */
export function isGermanRailEdgeActive(network, edgeKey) {
    return network.edgeKeys.includes(edgeKey);
}
/** Query a previously derived network; no second graph traversal is performed. */
export function isGermanRailHexActive(network, hex) {
    return network.hexKeys.includes(hex);
}
function isTraversableSovietRailEdge(state, edge) {
    const rail = edge.railway;
    return Boolean(rail?.present === true && rail.destroyed === false &&
        state.hexes[hexKey(edge.a)] && state.hexes[hexKey(edge.b)] && hexDistance(edge.a, edge.b) === 1);
}
function getLiveGermanOccupiedHexKeys(state) {
    return new Set(Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'GERMAN')
        .map((unit) => hexKey(unit.hex)));
}
/** Shared Soviet intact-rail traversal. Seed order has no rules meaning. */
function computeSovietRailNetworkFromSeedKeys(state, seedHexKeys) {
    const blockedHexKeys = getLiveGermanOccupiedHexKeys(state);
    const adjacency = new Map();
    for (const edge of Object.values(state.edges)) {
        if (!isTraversableSovietRailEdge(state, edge))
            continue;
        const aKey = hexKey(edge.a), bKey = hexKey(edge.b);
        const aList = adjacency.get(aKey) ?? [];
        aList.push({ edgeKey: edge.key, otherHexKey: bKey });
        adjacency.set(aKey, aList);
        const bList = adjacency.get(bKey) ?? [];
        bList.push({ edgeKey: edge.key, otherHexKey: aKey });
        adjacency.set(bKey, bList);
    }
    for (const list of adjacency.values())
        list.sort((a, b) => a.edgeKey.localeCompare(b.edgeKey) || a.otherHexKey.localeCompare(b.otherHexKey));
    const canonicalSeeds = [...new Set(seedHexKeys)].sort();
    const seedSet = new Set(canonicalSeeds);
    const activeEdges = new Set();
    const activeHexes = new Set();
    const seededHexes = new Set();
    const visited = new Set();
    const queue = [];
    for (const seedKey of canonicalSeeds) {
        if (!state.hexes[seedKey] || blockedHexKeys.has(seedKey) || !adjacency.has(seedKey))
            continue;
        if (!visited.has(seedKey)) {
            visited.add(seedKey);
            queue.push(seedKey);
        }
    }
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        for (const link of adjacency.get(current) ?? []) {
            if (blockedHexKeys.has(link.otherHexKey))
                continue;
            activeEdges.add(link.edgeKey);
            activeHexes.add(current);
            activeHexes.add(link.otherHexKey);
            if (seedSet.has(current))
                seededHexes.add(current);
            if (!visited.has(link.otherHexKey)) {
                visited.add(link.otherHexKey);
                queue.push(link.otherHexKey);
            }
        }
    }
    return {
        edgeKeys: [...activeEdges].sort(),
        hexKeys: [...activeHexes].sort(),
        seedHexKeys: [...seededHexes].sort()
    };
}
/**
 * Task 002B-5A — Active Soviet East Rail Network.
 *
 * This API intentionally remains east-exit-only for explainability. Soviet east-rail
 * connectivity ignores railway.repairedBy: any present, undestroyed track may be traversed.
 * Live German occupation blocks traversal; German ZOC and HexState.control are irrelevant.
 */
export function computeActiveSovietRailNetwork(state, scenario) {
    const traversed = computeSovietRailNetworkFromSeedKeys(state, scenario.sovietEastRailExits.map(hexKey));
    return { edgeKeys: traversed.edgeKeys, hexKeys: traversed.hexKeys, exitHexKeys: traversed.seedHexKeys };
}
/**
 * Active independent Soviet normal-supply sources. These are explicit ScenarioConfig data,
 * not inferred from city/capital metadata. Live German occupation disables only that source.
 */
export function getActiveSovietIndependentSupplySourceHexKeys(state, scenario) {
    const blockedHexKeys = getLiveGermanOccupiedHexKeys(state);
    return [...new Set((scenario.sovietSupplySources ?? []).map(hexKey))]
        .filter((key) => Boolean(state.hexes[key]) && !blockedHexKeys.has(key))
        .sort();
}
/**
 * Task 002B-5C — full Soviet normal-supply rail connectivity.
 *
 * Seeds are the union of Soviet east exits and active independent Soviet supply sources.
 * Independent sources without rail adjacency remain direct supply sources but do not appear
 * in this network's seedHexKeys/hexKeys.
 */
export function computeActiveSovietSupplyRailNetwork(state, scenario) {
    const independent = getActiveSovietIndependentSupplySourceHexKeys(state, scenario);
    const seedKeys = [...scenario.sovietEastRailExits.map(hexKey), ...independent];
    const traversed = computeSovietRailNetworkFromSeedKeys(state, seedKeys);
    return traversed;
}
/** Query a previously derived Soviet east-only network; no graph traversal is performed. */
export function isSovietRailEdgeActive(network, edgeKey) {
    return network.edgeKeys.includes(edgeKey);
}
/** Query a previously derived Soviet east-only network; no graph traversal is performed. */
export function isSovietRailHexActive(network, hex) {
    return network.hexKeys.includes(hex);
}
/** True when this German full-game turn already contains one accepted side-wide rail plan. */
export function hasGermanRailRepairActionThisTurn(state) {
    return state.actionLog.some((entry) => entry.turn === state.turn && entry.accepted && entry.action.type === 'RAIL_REPAIR');
}
function repairIssue(reason, message, details = {}) {
    return { code: 'INVALID_SUPPORT', message, details: { reason, ...details } };
}
/**
 * DR-002 — validate one side-wide German rail-repair plan.
 *
 * Connectivity is intentionally validated by previewing the complete repair set and then
 * calling the canonical DR-001 network traversal. edgeKeys are therefore a set-like plan:
 * their submitted order has no rules meaning.
 */
export function validateRailRepairAction(state, rules, scenario, action) {
    const issues = [];
    const controller = state.controllers[action.controllerId];
    if (!controller) {
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
    }
    else if (controller.side !== 'GERMAN' || state.activeSide !== 'GERMAN') {
        issues.push({ code: 'WRONG_SIDE', message: 'Only the active German side may submit a rail-repair plan.' });
    }
    if (state.phase !== 'GERMAN_SUPPLY_RAIL') {
        issues.push({ code: 'WRONG_PHASE', message: 'German rail repair is only legal during GERMAN_SUPPLY_RAIL.' });
    }
    if (hasGermanRailRepairActionThisTurn(state)) {
        issues.push(repairIssue('RAIL_REPAIR_ALREADY_USED', 'The German side has already accepted its rail-repair plan this turn.'));
    }
    if (action.edgeKeys.length === 0) {
        issues.push(repairIssue('EMPTY_RAIL_REPAIR_PLAN', 'RailRepairAction.edgeKeys must contain at least one railway edge.'));
    }
    const duplicates = findDuplicates(action.edgeKeys);
    if (duplicates.length > 0) {
        issues.push({ code: 'DUPLICATE_ID', message: 'RailRepairAction.edgeKeys must be unique.', details: { field: 'edgeKeys', duplicates } });
    }
    let allowance = rules.rail.baseRepairPerTurn;
    if (action.engineerUnitId !== undefined) {
        const engineer = state.units[action.engineerUnitId];
        if (!engineer) {
            issues.push({ code: 'UNIT_NOT_FOUND', message: 'Rail-repair engineer does not exist.', unitId: action.engineerUnitId });
        }
        else {
            if (!engineer.alive)
                issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed engineer cannot assist rail repair.', unitId: engineer.id });
            if (engineer.side !== 'GERMAN')
                issues.push({ code: 'WRONG_SIDE', message: 'Rail-repair engineer must be German.', unitId: engineer.id });
            if (engineer.controllerId !== action.controllerId)
                issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Controller does not own the selected rail-repair engineer.', unitId: engineer.id });
            if (engineer.type !== 'ENGINEER')
                issues.push(repairIssue('INVALID_RAIL_ENGINEER', 'Selected rail-repair support unit is not an engineer.', { unitId: engineer.id }));
            if (engineer.supplyState !== 'SUPPLIED')
                issues.push(repairIssue('INVALID_RAIL_ENGINEER', 'Rail-repair engineer must have normal SUPPLIED status.', { unitId: engineer.id, supplyState: engineer.supplyState }));
            if (engineer.dedicatedRailRepair)
                issues.push(repairIssue('INVALID_RAIL_ENGINEER', 'Engineer is already dedicated to rail repair this turn.', { unitId: engineer.id }));
            const engineerInvalid = issues.some((issue) => issue.unitId === engineer.id || issue.details?.unitId === engineer.id);
            if (!engineerInvalid)
                allowance = rules.rail.engineerRepairPerTurn;
        }
    }
    if (action.edgeKeys.length > allowance) {
        issues.push(repairIssue('RAIL_REPAIR_LIMIT_EXCEEDED', 'Rail-repair plan exceeds this turn allowance.', { selected: action.edgeKeys.length, allowance }));
    }
    const selectedEdges = [];
    for (const edgeKey of action.edgeKeys) {
        const edge = state.edges[edgeKey];
        if (!edge) {
            issues.push(repairIssue('UNKNOWN_RAIL_EDGE', 'Selected rail edge does not exist.', { edgeKey }));
            continue;
        }
        if (!edge.railway?.present) {
            issues.push(repairIssue('EDGE_HAS_NO_RAILWAY', 'Selected edge does not contain railway track.', { edgeKey }));
            continue;
        }
        if (edge.railway.repairedBy === 'GERMAN' && !edge.railway.destroyed) {
            issues.push(repairIssue('EDGE_ALREADY_GERMAN_REPAIRED', 'Selected railway edge is already operational German track.', { edgeKey }));
            continue;
        }
        const occupiedEndpoint = [edge.a, edge.b].find((coord) => Object.values(state.units).some((unit) => unit.alive && unit.side === 'SOVIET' && hexKey(unit.hex) === hexKey(coord)));
        if (occupiedEndpoint) {
            issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'Cannot repair a railway edge whose endpoint is occupied by a live Soviet unit.', hex: occupiedEndpoint, details: { edgeKey } });
            continue;
        }
        selectedEdges.push(edge);
    }
    // Do not preview connectivity if basic selection/actor validation already failed: this keeps
    // specific validation reasons stable instead of masking them with RAIL_PLAN_DISCONNECTED.
    if (issues.length === 0) {
        const preview = structuredClone(state);
        for (const edge of selectedEdges) {
            const rail = preview.edges[edge.key].railway;
            rail.destroyed = false;
            rail.repairedBy = 'GERMAN';
        }
        const network = computeActiveGermanRailNetwork(preview, scenario);
        const active = new Set(network.edgeKeys);
        const disconnected = action.edgeKeys.filter((edgeKey) => !active.has(edgeKey)).sort();
        if (disconnected.length > 0) {
            issues.push(repairIssue('RAIL_PLAN_DISCONNECTED', 'Every selected repair must belong to the final preview Active German Rail Network.', { edgeKeys: disconnected }));
        }
    }
    return issues;
}
/** Apply a previously validated DR-002 plan. Does not refresh the current supply snapshot. */
export function applyGermanRailRepair(state, action) {
    for (const edgeKey of action.edgeKeys) {
        const rail = state.edges[edgeKey].railway;
        rail.present = true;
        rail.destroyed = false;
        rail.repairedBy = 'GERMAN';
    }
    if (action.engineerUnitId !== undefined)
        state.units[action.engineerUnitId].dedicatedRailRepair = true;
}
