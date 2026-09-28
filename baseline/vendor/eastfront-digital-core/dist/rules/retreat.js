import { getNeighbors, hexDistance, hexKey } from '../core/hex.js';
import { livingUnitsAt, stackingIssueForDestination } from './stacking.js';
import { isInEnemyZoc } from './zoc.js';
/**
 * Canonical one-step retreat legality. This helper is intentionally shared by
 * pre-CRT encirclement checks and the future post-CRT retreat transition.
 * Retreat direction preferences belong to AI, not the Rules Engine.
 */
export function validateRetreatStep(state, rules, unit, from, destination) {
    const issues = [];
    if (!unit.alive) {
        issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed unit cannot retreat.', unitId: unit.id });
        return { legal: false, issues };
    }
    if (hexDistance(from, destination) !== 1) {
        issues.push({ code: 'NON_ADJACENT_HEX', message: 'A retreat step must enter an adjacent hex.', unitId: unit.id, hex: destination });
    }
    const hex = state.hexes[hexKey(destination)];
    if (!hex) {
        issues.push({ code: 'HEX_OUT_OF_BOUNDS', message: 'Retreat destination is outside the scenario map.', unitId: unit.id, hex: destination });
        return { legal: false, issues };
    }
    if (hex.terrain === 'LAKE') {
        issues.push({ code: 'IMPASSABLE_TERRAIN', message: 'Retreat cannot enter a lake hex.', unitId: unit.id, hex: destination });
    }
    const enemy = livingUnitsAt(state, destination).filter(u => u.side !== unit.side);
    if (enemy.length) {
        issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'Retreat cannot enter an enemy-occupied hex.', unitId: unit.id, hex: destination, details: { enemyUnitIds: enemy.map(u => u.id) } });
    }
    const stacking = stackingIssueForDestination(state, rules, unit, destination);
    if (stacking?.code === 'STACKING_LIMIT')
        issues.push(stacking);
    if (isInEnemyZoc(state, rules, unit.side, destination)) {
        issues.push({ code: 'ENEMY_ZOC_STOP', message: 'Retreat cannot enter an enemy ZOC.', unitId: unit.id, hex: destination });
    }
    return { legal: issues.length === 0, issues };
}
export function getLegalRetreatStepOptions(state, rules, unit, from = unit.hex) {
    return getNeighbors(from)
        .filter(h => Boolean(state.hexes[hexKey(h)]))
        .filter(h => validateRetreatStep(state, rules, unit, from, h).legal)
        .map(h => ({ ...h }));
}
export function hasLegalRetreatExit(state, rules, unit, from = unit.hex) {
    return getLegalRetreatStepOptions(state, rules, unit, from).length > 0;
}
export function legalRetreatOptions(state, rules, unit) {
    return getLegalRetreatStepOptions(state, rules, unit).map(hex => ({ hex, score: 0 }));
}
/**
 * Maximum legal retreat distance reachable from the unit's current hex, capped at
 * requiredSteps. The search intentionally delegates every candidate step to the
 * canonical shared retreat legality helper. Current CRT retreat distances are at
 * most two, so exhaustive search is small and deterministic.
 */
export function getMaxLegalRetreatDistance(state, rules, unit, requiredSteps) {
    if (requiredSteps <= 0 || !unit.alive)
        return 0;
    const start = { ...unit.hex };
    const search = (from, remaining) => {
        if (remaining <= 0)
            return 0;
        let best = 0;
        const before = { ...unit.hex };
        for (const destination of getLegalRetreatStepOptions(state, rules, unit, from)) {
            unit.hex = { ...destination };
            best = Math.max(best, 1 + search(destination, remaining - 1));
            unit.hex = { ...before };
            if (best === remaining)
                break;
        }
        unit.hex = { ...before };
        return best;
    };
    const result = search(start, requiredSteps);
    unit.hex = start;
    return result;
}
