import { hexKey } from '../core/hex.js';
import { computeSupply } from './supply.js';
/** Maps only Player Turn final phases to their pure victory checkpoints. */
export function victoryCheckpointForPhase(phase) {
    if (phase === 'GERMAN_ENTRENCHMENT')
        return 'GERMAN_PLAYER_TURN_END';
    if (phase === 'SOVIET_ENTRENCHMENT')
        return 'SOVIET_PLAYER_TURN_END';
    return null;
}
function sortedUnique(values) {
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
function noWinner(state) {
    return { winner: null, reason: null, turn: null, checkedAtPhase: state.phase };
}
/**
 * Task 002E-1 — pure German capital-condition evaluation.
 *
 * Victory occupancy is derived from configured capital-core hexes and living units only.
 * Final supply confirmation deliberately recomputes live normal German supply rather than
 * consuming the per-player-turn UnitState.supplyState snapshot.
 */
export function evaluateGermanCapitalVictoryCondition(state, rules, scenario) {
    const coreHexKeys = sortedUnique(scenario.capitalCoreHexes.map(hexKey));
    const coreSet = new Set(coreHexKeys);
    const regularGermanUnitIdsByCore = {};
    const sovietUnitIdsByCore = {};
    const germanUnitIdsByCore = {};
    for (const coreKey of coreHexKeys) {
        regularGermanUnitIdsByCore[coreKey] = [];
        sovietUnitIdsByCore[coreKey] = [];
        germanUnitIdsByCore[coreKey] = [];
    }
    const livingUnits = Object.values(state.units)
        .filter((unit) => unit.alive)
        .sort((a, b) => a.id.localeCompare(b.id));
    for (const unit of livingUnits) {
        const key = hexKey(unit.hex);
        if (!coreSet.has(key))
            continue;
        if (unit.side === 'SOVIET') {
            sovietUnitIdsByCore[key].push(unit.id);
            continue;
        }
        germanUnitIdsByCore[key].push(unit.id);
        const template = rules.unitTemplates[unit.templateId];
        if (template &&
            template.side === 'GERMAN' &&
            template.isSupport === false &&
            unit.type !== 'RECON') {
            regularGermanUnitIdsByCore[key].push(unit.id);
        }
    }
    for (const key of coreHexKeys) {
        regularGermanUnitIdsByCore[key] = sortedUnique(regularGermanUnitIdsByCore[key]);
        sovietUnitIdsByCore[key] = sortedUnique(sovietUnitIdsByCore[key]);
        germanUnitIdsByCore[key] = sortedUnique(germanUnitIdsByCore[key]);
    }
    const allCoresExist = coreHexKeys.length > 0 && coreHexKeys.every((key) => Boolean(state.hexes[key]));
    const allCoresHaveRegularGermanOccupier = allCoresExist && coreHexKeys.every((key) => regularGermanUnitIdsByCore[key].length > 0);
    const noLivingSovietOnAnyCore = coreHexKeys.length > 0 && coreHexKeys.every((key) => sovietUnitIdsByCore[key].length === 0);
    const liveGermanSupply = computeSupply(state, 'GERMAN', rules, scenario);
    const liveSuppliedGermanCapitalUnitIds = sortedUnique(coreHexKeys.flatMap((key) => germanUnitIdsByCore[key])
        .filter((unitId) => liveGermanSupply.unitSupply[unitId] === 'SUPPLIED'));
    const atLeastOneLiveSuppliedGermanCapitalUnit = liveSuppliedGermanCapitalUnitIds.length > 0;
    return {
        satisfied: coreHexKeys.length > 0 &&
            allCoresExist &&
            allCoresHaveRegularGermanOccupier &&
            noLivingSovietOnAnyCore &&
            atLeastOneLiveSuppliedGermanCapitalUnit,
        coreHexKeys,
        allCoresHaveRegularGermanOccupier,
        noLivingSovietOnAnyCore,
        atLeastOneLiveSuppliedGermanCapitalUnit,
        regularGermanUnitIdsByCore,
        sovietUnitIdsByCore,
        germanUnitIdsByCore,
        liveSuppliedGermanCapitalUnitIds
    };
}
/** Pure checkpoint evaluation. Lifecycle/GAME_OVER integration is intentionally deferred to 002E-2. */
export function evaluateVictoryAtCheckpoint(state, rules, scenario, checkpoint) {
    const condition = evaluateGermanCapitalVictoryCondition(state, rules, scenario);
    const turnLimit = scenario.turnLimit;
    if (checkpoint === 'GERMAN_PLAYER_TURN_END') {
        if (state.turn < turnLimit)
            return noWinner(state);
        if (state.turn === turnLimit && condition.satisfied) {
            return { winner: 'GERMAN', reason: 'GERMAN_CAPITAL_CAPTURE_FINAL_TURN', turn: state.turn, checkedAtPhase: state.phase };
        }
        return { winner: 'SOVIET', reason: 'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT', turn: state.turn, checkedAtPhase: state.phase };
    }
    if (state.turn < turnLimit) {
        if (condition.satisfied) {
            return { winner: 'GERMAN', reason: 'GERMAN_CAPITAL_HELD_THROUGH_SOVIET_TURN', turn: state.turn, checkedAtPhase: state.phase };
        }
        return noWinner(state);
    }
    return { winner: 'SOVIET', reason: 'SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT', turn: state.turn, checkedAtPhase: state.phase };
}
