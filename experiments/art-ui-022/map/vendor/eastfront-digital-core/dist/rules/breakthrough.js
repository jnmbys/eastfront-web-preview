import { hexDistance, hexKey, sameHex } from '../core/hex.js';
import { isInEnemyZoc } from './zoc.js';
import { livingUnitsAt, stackingIssueForDestination } from './stacking.js';
export function validateBreakthroughAction(state, rules, action) {
    return analyzeBreakthroughAction(state, rules, action).issues;
}
/**
 * BREAKTHROUGH path contains only the extra hexes after the original battle target.
 * A direct attacker still in its attack hex conceptually transits the target first; that
 * transit costs no breakthrough hex and intentionally ignores target transient stacking.
 */
export function analyzeBreakthroughAction(state, rules, action) {
    const tx = state.combatTransactions[action.battleId];
    const issues = [];
    if (!tx)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${action.battleId}.` }], from: null, destination: null };
    if (tx.stage !== 'BREAKTHROUGH_OPTION')
        issues.push({ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting Breakthrough.', details: { stage: tx.stage } });
    const bt = tx.breakthrough;
    if (!bt || bt.resolved)
        issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Combat has no unresolved Breakthrough option.' });
    if (issues.length || !bt)
        return { issues, from: null, destination: null };
    const unit = state.units[action.unitId];
    if (!unit)
        issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown breakthrough unit.', unitId: action.unitId });
    else {
        const template = rules.unitTemplates[unit.templateId];
        if (!unit.alive)
            issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed unit cannot break through.', unitId: unit.id });
        if (!tx.attackerUnitIds.includes(unit.id) || !bt.eligibleUnitIds.includes(unit.id))
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Selected unit is not an eligible original direct attacker for this battle.', unitId: unit.id });
        if (bt.completedUnitIds.includes(unit.id))
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'This unit has already completed its Breakthrough decision.', unitId: unit.id });
        if (!template?.isArmor)
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Only armor may execute Breakthrough.', unitId: unit.id });
        if (unit.supplyState === 'OUT_OF_SUPPLY')
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Out-of-supply armor cannot execute Breakthrough.', unitId: unit.id });
        const targetTerrain = state.hexes[hexKey(tx.targetHex)]?.terrain;
        if (targetTerrain === 'MARSH')
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Breakthrough is prohibited when the original battle target is MARSH.', unitId: unit.id, hex: { ...tx.targetHex } });
        const max = bt.maxHexesByUnitId[unit.id];
        if (max === undefined)
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Breakthrough maximum distance is missing for this unit.', unitId: unit.id });
        else if (action.path.length > max)
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: `Breakthrough path exceeds this unit's ${max}-hex allowance.`, unitId: unit.id, details: { maxHexes: max, submittedHexes: action.path.length } });
        if (!sameHex(unit.hex, tx.targetHex) && hexDistance(unit.hex, tx.targetHex) !== 1)
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'A breakthrough unit not already in the target must still occupy its original adjacent attack position.', unitId: unit.id, hex: { ...tx.targetHex } });
        const targetEnemies = livingUnitsAt(state, tx.targetHex).filter(u => u.side !== unit.side);
        if (action.path.length > 0 && targetEnemies.length > 0)
            issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'Breakthrough transit cannot pass through an enemy-occupied original target.', unitId: unit.id, hex: { ...tx.targetHex } });
    }
    if (issues.length || !unit)
        return { issues, from: unit ? { ...unit.hex } : null, destination: null };
    // path=[] means this eligible armor declines movement but completes its individual decision.
    if (action.path.length === 0)
        return { issues: [], from: { ...unit.hex }, destination: { ...unit.hex } };
    const startedAtTarget = sameHex(unit.hex, tx.targetHex);
    let current = { ...tx.targetHex };
    let currentInEnemyZoc = isInEnemyZoc(state, rules, unit.side, current);
    for (let i = 0; i < action.path.length; i++) {
        const next = action.path[i];
        if (hexDistance(current, next) !== 1) {
            issues.push({ code: 'NON_ADJACENT_HEX', message: 'Each extra Breakthrough hex must be adjacent, beginning from the original battle target.', unitId: unit.id, hex: { ...next } });
            break;
        }
        const hex = state.hexes[hexKey(next)];
        if (!hex) {
            issues.push({ code: 'HEX_OUT_OF_BOUNDS', message: 'Breakthrough path leaves the map.', unitId: unit.id, hex: { ...next } });
            break;
        }
        if (hex.terrain === 'LAKE') {
            issues.push({ code: 'IMPASSABLE_TERRAIN', message: 'Breakthrough cannot enter LAKE.', unitId: unit.id, hex: { ...next } });
            break;
        }
        if (hex.terrain === 'MARSH') {
            issues.push({ code: 'INVALID_BREAKTHROUGH', message: 'Breakthrough cannot enter MARSH.', unitId: unit.id, hex: { ...next } });
            break;
        }
        const enemy = livingUnitsAt(state, next).some(u => u.side !== unit.side);
        if (enemy) {
            issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'Breakthrough cannot enter an enemy-occupied hex.', unitId: unit.id, hex: { ...next } });
            break;
        }
        if (i === 0 && !startedAtTarget && currentInEnemyZoc) {
            issues.push({ code: 'ENEMY_ZOC_STOP', message: 'Entering the original battle target as Breakthrough transit enters enemy ZOC and ends Breakthrough movement.', unitId: unit.id, hex: { ...tx.targetHex } });
            break;
        }
        const nextInEnemyZoc = isInEnemyZoc(state, rules, unit.side, next);
        if (currentInEnemyZoc && nextInEnemyZoc) {
            issues.push({ code: 'ENEMY_ZOC_TO_ZOC', message: 'Breakthrough may not move directly from enemy ZOC to enemy ZOC.', unitId: unit.id, hex: { ...next } });
            break;
        }
        if (nextInEnemyZoc && i < action.path.length - 1) {
            issues.push({ code: 'ENEMY_ZOC_STOP', message: 'Entering enemy ZOC ends Breakthrough movement.', unitId: unit.id, hex: { ...next } });
            break;
        }
        current = { ...next };
        currentInEnemyZoc = nextInEnemyZoc;
    }
    if (issues.length)
        return { issues, from: { ...unit.hex }, destination: null };
    // Only the final stopping hex is a stacking destination. The original target is transit-only
    // for armor that did not make the single normal Advance After Combat.
    const stacking = stackingIssueForDestination(state, rules, unit, current);
    if (stacking)
        issues.push(stacking);
    return { issues, from: { ...unit.hex }, destination: issues.length ? null : { ...current } };
}
