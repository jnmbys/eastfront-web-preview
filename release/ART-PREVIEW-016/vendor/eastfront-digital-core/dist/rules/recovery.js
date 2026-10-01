import { hexDistance, hexKey } from '../core/hex.js';
import { computeActiveGermanRailNetwork, computeActiveSovietSupplyRailNetwork, getActiveSovietIndependentSupplySourceHexKeys } from './rail.js';
const RAILWAY_CITY_TERRAINS = new Set(['CITY', 'MAIN_CITY', 'OUTER_CITY']);
function recoveryIssue(reason, message, details = {}) {
    return { code: 'INVALID_SUPPORT', message, details: { reason, ...details } };
}
function expectedRecoveryPhase(side) {
    return side === 'GERMAN' ? 'GERMAN_RECOVERY' : 'SOVIET_RECOVERY';
}
function germanDerivedRailheadsFromNetwork(state, scenario, edgeKeys) {
    const degree = new Map();
    for (const edgeKey of edgeKeys) {
        const edge = state.edges[edgeKey];
        if (!edge)
            continue;
        const a = hexKey(edge.a), b = hexKey(edge.b);
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    const westEntries = new Set(scenario.germanWestRailEntries.map(hexKey));
    return [...degree.entries()]
        .filter(([key, value]) => value === 1 && !westEntries.has(key))
        .map(([key]) => key)
        .sort();
}
/**
 * Derived German railheads are terminal nodes (active-edge degree 1) in the current Active
 * German Rail Network, excluding configured German west entries. They are never stored in state.
 */
export function computeGermanDerivedRailheadHexKeys(state, scenario) {
    const network = computeActiveGermanRailNetwork(state, scenario);
    return germanDerivedRailheadsFromNetwork(state, scenario, network.edgeKeys);
}
/** German Recovery Bases = derived active railheads + cities on the Active German Rail Network. */
export function computeGermanRecoveryBaseHexKeys(state, scenario) {
    const network = computeActiveGermanRailNetwork(state, scenario);
    const bases = new Set(germanDerivedRailheadsFromNetwork(state, scenario, network.edgeKeys));
    for (const key of network.hexKeys) {
        const hex = state.hexes[key];
        if (hex && RAILWAY_CITY_TERRAINS.has(hex.terrain))
            bases.add(key);
    }
    return [...bases].sort();
}
/**
 * Soviet Recovery Bases = active independent Soviet supply sources + cities on the full Soviet
 * supply-rail network. A disconnected ordinary city is not a Recovery Base.
 */
export function computeSovietRecoveryBaseHexKeys(state, scenario) {
    const bases = new Set(getActiveSovietIndependentSupplySourceHexKeys(state, scenario));
    const network = computeActiveSovietSupplyRailNetwork(state, scenario);
    for (const key of network.hexKeys) {
        const hex = state.hexes[key];
        if (hex && RAILWAY_CITY_TERRAINS.has(hex.terrain))
            bases.add(key);
    }
    return [...bases].sort();
}
/** Unified pure Recovery Base query. */
export function computeRecoveryBaseHexKeys(state, side, scenario) {
    return side === 'GERMAN'
        ? computeGermanRecoveryBaseHexKeys(state, scenario)
        : computeSovietRecoveryBaseHexKeys(state, scenario);
}
/** Resolve the side-wide number of units that may recover during the current full-game turn. */
export function getRecoveryUnitLimit(rules, side, turn) {
    if (side === 'GERMAN')
        return rules.recovery.maxUnitsPerTurn.GERMAN;
    let bestFrom = -Infinity;
    let limit = 0;
    for (const band of rules.recovery.maxUnitsPerTurn.SOVIET) {
        if (band.fromTurn > turn)
            continue;
        if (band.fromTurn > bestFrom || (band.fromTurn === bestFrom && band.maxUnits > limit)) {
            bestFrom = band.fromTurn;
            limit = band.maxUnits;
        }
    }
    return limit;
}
/** Physical adjacency only; ZOC capability, terrain, and control do not matter. */
export function isAdjacentToLivingEnemy(state, unit) {
    return Object.values(state.units).some((enemy) => enemy.alive && enemy.side !== unit.side && hexDistance(unit.hex, enemy.hex) === 1);
}
function acceptedRecoveryActionsThisPhase(state, side) {
    const phase = expectedRecoveryPhase(side);
    return state.actionLog.filter((entry) => entry.turn === state.turn && entry.phase === phase && entry.accepted && entry.action.type === 'REPAIR_UNIT');
}
/** Validate one one-step Recovery action. Recovery consumes the authoritative supply snapshot. */
export function validateRecoveryAction(state, rules, scenario, action) {
    const issues = [];
    const controller = state.controllers[action.controllerId];
    if (!controller) {
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
    }
    else if (controller.side !== state.activeSide) {
        issues.push({ code: 'WRONG_SIDE', message: 'Only an active-side controller may recover a unit.' });
    }
    const unit = state.units[action.unitId];
    if (!unit) {
        issues.push({ code: 'UNIT_NOT_FOUND', message: 'Recovery target unit does not exist.', unitId: action.unitId });
        return issues;
    }
    const phase = expectedRecoveryPhase(unit.side);
    if (state.phase !== phase) {
        issues.push({ code: 'WRONG_PHASE', message: `${unit.side} units may recover only during ${phase}.`, unitId: unit.id });
    }
    if (!unit.alive)
        issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed units cannot recover.', unitId: unit.id });
    if (unit.controllerId !== action.controllerId) {
        issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Recovery requires the unit permanent controller.', unitId: unit.id });
    }
    if (unit.step === 0) {
        issues.push(recoveryIssue('UNIT_NOT_DAMAGED', 'Full-strength units cannot recover.', { unitId: unit.id }));
    }
    if (unit.supplyState !== 'SUPPLIED') {
        issues.push(recoveryIssue('NORMAL_SUPPLY_REQUIRED', 'Recovery requires normal SUPPLIED status.', { unitId: unit.id, supplyState: unit.supplyState }));
    }
    if (unit.hasMoved)
        issues.push({ code: 'MOVED_THIS_TURN', message: 'A unit that moved this player turn cannot recover.', unitId: unit.id });
    if (unit.hasAttacked)
        issues.push({ code: 'UNIT_ALREADY_ATTACKED', message: 'A unit that attacked this player turn cannot recover.', unitId: unit.id });
    if (unit.artillerySupportUsed) {
        issues.push(recoveryIssue('ARTILLERY_USED_THIS_TURN', 'A unit that provided artillery support this player turn cannot recover.', { unitId: unit.id }));
    }
    if (unit.side === 'GERMAN' && unit.type === 'ENGINEER' && unit.dedicatedRailRepair) {
        issues.push(recoveryIssue('DEDICATED_RAIL_REPAIR', 'A German engineer dedicated to rail repair cannot recover this player turn.', { unitId: unit.id }));
    }
    if (isAdjacentToLivingEnemy(state, unit)) {
        issues.push(recoveryIssue('ENEMY_ADJACENT', 'A unit adjacent to any living enemy unit cannot recover.', { unitId: unit.id }));
    }
    const baseHexKeys = computeRecoveryBaseHexKeys(state, unit.side, scenario);
    const minimumDistance = baseHexKeys.length === 0
        ? null
        : Math.min(...baseHexKeys.map((key) => hexDistance(unit.hex, state.hexes[key].coord)));
    if (minimumDistance === null || minimumDistance > rules.recovery.maxDistanceFromBase) {
        issues.push(recoveryIssue('RECOVERY_BASE_TOO_FAR', 'Unit is outside Recovery Base range.', {
            unitId: unit.id,
            maxDistance: rules.recovery.maxDistanceFromBase,
            minimumDistance,
            recoveryBaseHexKeys: baseHexKeys
        }));
    }
    const template = rules.unitTemplates[unit.templateId];
    if (!template) {
        issues.push(recoveryIssue('UNIT_TEMPLATE_NOT_FOUND', 'Recovery target unit template is missing from GameRules.', { unitId: unit.id, templateId: unit.templateId }));
    }
    else if (state.rp[unit.side] < template.recoveryCostPerStep) {
        issues.push(recoveryIssue('INSUFFICIENT_RP', 'Side-wide RP pool cannot pay this unit recovery cost.', {
            unitId: unit.id,
            availableRP: state.rp[unit.side],
            requiredRP: template.recoveryCostPerStep
        }));
    }
    const accepted = acceptedRecoveryActionsThisPhase(state, unit.side);
    if (accepted.some((entry) => entry.action.type === 'REPAIR_UNIT' && entry.action.unitId === unit.id)) {
        issues.push(recoveryIssue('UNIT_ALREADY_RECOVERED_THIS_TURN', 'A unit may recover only once in its Recovery phase.', { unitId: unit.id }));
    }
    const limit = getRecoveryUnitLimit(rules, unit.side, state.turn);
    if (accepted.length >= limit) {
        issues.push(recoveryIssue('RECOVERY_UNIT_LIMIT_REACHED', 'Side-wide Recovery unit limit has been reached for this turn.', {
            side: unit.side, turn: state.turn, recoveredUnits: accepted.length, limit
        }));
    }
    return issues;
}
/** Apply one previously validated Recovery action: exactly one damage step and its RP cost. */
export function applyRecoveryAction(state, rules, action) {
    const unit = state.units[action.unitId];
    const template = rules.unitTemplates[unit.templateId];
    unit.step = (unit.step - 1);
    state.rp[unit.side] -= template.recoveryCostPerStep;
}
