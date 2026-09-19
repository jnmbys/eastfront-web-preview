import { hexDistance, hexKey } from '../core/hex.js';
import { computeActiveGermanRailNetwork, computeActiveSovietRailNetwork, computeActiveSovietSupplyRailNetwork, getActiveSovietIndependentSupplySourceHexKeys } from './rail.js';
/**
 * Task 002B-2 — German normal railway supply projection.
 *
 * Supply is a pure geometric projection from every Active German Rail Hex. Roads, terrain,
 * rivers, bridges, ZOC, ordinary occupation, and movement costs do not alter the radius.
 * Soviet occupation affects this result only indirectly through DR-001 rail connectivity.
 * TEMPORARY_SUPPLY is deliberately excluded from this normal projection.
 */
export function computeGermanSupplyProjection(state, rules, scenario) {
    const network = computeActiveGermanRailNetwork(state, scenario);
    const sourceHexKeys = [...network.hexKeys].sort();
    const sourceCoords = sourceHexKeys
        .map((key) => state.hexes[key]?.coord)
        .filter((coord) => coord !== undefined);
    const suppliedHexKeys = Object.values(state.hexes)
        .filter((hex) => sourceCoords.some((source) => hexDistance(hex.coord, source) <= rules.supply.germanRadius))
        .map((hex) => hexKey(hex.coord))
        .sort();
    const suppliedSet = new Set(suppliedHexKeys);
    const unitSupply = {};
    const germanUnits = Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'GERMAN')
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of germanUnits) {
        unitSupply[unit.id] = suppliedSet.has(hexKey(unit.hex)) ? 'SUPPLIED' : 'OUT_OF_SUPPLY';
    }
    return { unitSupply, sourceHexKeys, suppliedHexKeys };
}
/**
 * Task 002B-5B — Soviet East-Rail normal supply projection only.
 *
 * Every hex in the currently derived Active Soviet East Rail Network is a source. Local
 * projection is pure hex distance using rules.supply.sovietRadius. Roads, terrain, rivers,
 * bridges, ZOC, movement cost, and ordinary occupation do not alter this radius. German
 * occupation matters only through the 002B-5A rail-network connectivity cut. Independent
 * Soviet city/capital sources and TEMPORARY_SUPPLY are deliberately excluded.
 */
export function computeSovietEastRailSupplyProjection(state, rules, scenario) {
    const network = computeActiveSovietRailNetwork(state, scenario);
    const sourceHexKeys = [...network.hexKeys].sort();
    const sourceCoords = sourceHexKeys
        .map((key) => state.hexes[key]?.coord)
        .filter((coord) => coord !== undefined);
    const suppliedHexKeys = Object.values(state.hexes)
        .filter((hex) => sourceCoords.some((source) => hexDistance(hex.coord, source) <= rules.supply.sovietRadius))
        .map((hex) => hexKey(hex.coord))
        .sort();
    const suppliedSet = new Set(suppliedHexKeys);
    const unitSupply = {};
    const sovietUnits = Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'SOVIET')
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of sovietUnits) {
        unitSupply[unit.id] = suppliedSet.has(hexKey(unit.hex)) ? 'SUPPLIED' : 'OUT_OF_SUPPLY';
    }
    return { unitSupply, sourceHexKeys, suppliedHexKeys };
}
/**
 * Task 002B-5C — full Soviet normal-supply projection.
 *
 * Sources are the union of all hexes in the full Soviet supply-rail network and all currently
 * active explicitly configured independent Soviet supply sources. Independent sources are
 * ScenarioConfig data; city/capital metadata does not imply supply. Projection remains pure
 * hex distance using rules.supply.sovietRadius and deliberately ignores TEMPORARY_SUPPLY.
 */
export function computeSovietSupplyProjection(state, rules, scenario) {
    const railNetwork = computeActiveSovietSupplyRailNetwork(state, scenario);
    const independentSources = getActiveSovietIndependentSupplySourceHexKeys(state, scenario);
    const sourceHexKeys = [...new Set([...railNetwork.hexKeys, ...independentSources])].sort();
    const sourceCoords = sourceHexKeys
        .map((key) => state.hexes[key]?.coord)
        .filter((coord) => coord !== undefined);
    const suppliedHexKeys = Object.values(state.hexes)
        .filter((hex) => sourceCoords.some((source) => hexDistance(hex.coord, source) <= rules.supply.sovietRadius))
        .map((hex) => hexKey(hex.coord))
        .sort();
    const suppliedSet = new Set(suppliedHexKeys);
    const unitSupply = {};
    const sovietUnits = Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'SOVIET')
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of sovietUnits) {
        unitSupply[unit.id] = suppliedSet.has(hexKey(unit.hex)) ? 'SUPPLIED' : 'OUT_OF_SUPPLY';
    }
    return { unitSupply, sourceHexKeys, suppliedHexKeys };
}
/**
 * Task 002B-3 — authoritative German normal-supply snapshot refresh.
 *
 * The projection remains a pure query; this helper is the lifecycle bridge that writes only
 * living German UnitState.supplyState from that projection. Temporary supply is deliberately
 * ignored and its boolean lifecycle is owned elsewhere.
 */
export function refreshGermanSupplyState(state, rules, scenario) {
    const computation = computeGermanSupplyProjection(state, rules, scenario);
    for (const [unitId, supplyState] of Object.entries(computation.unitSupply)) {
        const unit = state.units[unitId];
        if (!unit || !unit.alive || unit.side !== 'GERMAN')
            continue;
        unit.supplyState = supplyState;
    }
    return computation;
}
/**
 * Task 002B-5D — authoritative Soviet normal-supply snapshot refresh.
 *
 * Uses the full 002B-5C Soviet projection (East exits plus explicit independent sources) and writes
 * only living Soviet UnitState.supplyState. Temporary supply remains a separate transient lifecycle
 * concern and is neither consulted nor modified here.
 */
export function refreshSovietSupplyState(state, rules, scenario) {
    const computation = computeSovietSupplyProjection(state, rules, scenario);
    for (const [unitId, supplyState] of Object.entries(computation.unitSupply)) {
        const unit = state.units[unitId];
        if (!unit || !unit.alive || unit.side !== 'SOVIET')
            continue;
        unit.supplyState = supplyState;
    }
    return computation;
}
export function computeSupply(state, side, rules, scenario) {
    if (side === 'GERMAN')
        return computeGermanSupplyProjection(state, rules, scenario);
    return computeSovietSupplyProjection(state, rules, scenario);
}
