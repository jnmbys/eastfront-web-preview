import { canonicalEdgeKey } from '../core/edge.js';
import { hexDistance, hexKey } from '../core/hex.js';
import { clampCRTShift, selectCRTColumn, shiftedCRTColumn } from './crt.js';
import { getUnitStats } from './unit.js';
import { enemyOf } from './zoc.js';
import { hasLegalRetreatExit } from './retreat.js';
function duplicateValues(values) { const seen = new Set(), dupes = new Set(); for (const v of values) {
    if (seen.has(v))
        dupes.add(v);
    seen.add(v);
} return [...dupes]; }
function effectiveAttack(unit, rules) { const a = getUnitStats(unit, rules).attack; return unit.supplyState === 'OUT_OF_SUPPLY' ? Math.ceil(a * rules.supply.oosAttackMultiplier) : a; }
export function validArtillerySupport(state, unitId, side, target, requireUnused = true) {
    if (!unitId)
        return null;
    const u = state.units[unitId];
    if (!u || !u.alive || u.side !== side || u.type !== 'ARTILLERY' || u.supplyState === 'OUT_OF_SUPPLY' || u.step >= 2)
        return null;
    if (requireUnused && u.artillerySupportUsed)
        return null;
    const range = u.step === 0 ? 2 : 1;
    return hexDistance(u.hex, target) <= range ? u : null;
}
export function isUnitAuthorizedForAttack(state, action, unitId) { const u = state.units[unitId]; if (!u)
    return false; if (u.controllerId === action.controllerId)
    return true; if (!action.battleId)
    return false; for (const id of action.commitmentIds ?? []) {
    const c = state.unitCommitments[id];
    if (!c || !c.active)
        continue;
    if (c.battleId !== action.battleId || c.authorizedControllerId !== action.controllerId || c.grantorControllerId !== u.controllerId)
        continue;
    if (c.unitIds.includes(unitId))
        return true;
} return false; }
export function validateAttackAction(state, rules, action) {
    const issues = [];
    const controller = state.controllers[action.controllerId];
    if (!controller)
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
    const attackerSide = controller?.side;
    if (!attackerSide)
        return issues;
    const da = duplicateValues(action.attackerUnitIds);
    if (da.length)
        issues.push({ code: 'DUPLICATE_ID', message: 'attackerUnitIds must contain unique unit ids.', details: { field: 'attackerUnitIds', duplicates: da } });
    const dc = duplicateValues(action.commitmentIds ?? []);
    if (dc.length)
        issues.push({ code: 'DUPLICATE_ID', message: 'commitmentIds must contain unique ids.', details: { field: 'commitmentIds', duplicates: dc } });
    if (action.attackerUnitIds.length === 0)
        issues.push({ code: 'INVALID_SUPPORT', message: 'Attack requires at least one direct attacker.' });
    if (action.support?.attackerHQUnitId || action.support?.attackerHQCommand || action.support?.secondSchwerpunktAttack)
        issues.push({ code: 'RULE_NOT_IMPLEMENTED', message: 'Attacker HQ/Schwerpunkt effects must come from validated engine state, not ATTACK payload fields.' });
    const expected = attackerSide === 'GERMAN' ? 'GERMAN_COMBAT' : 'SOVIET_COMBAT';
    if (state.phase !== expected || state.activeSide !== attackerSide)
        issues.push({ code: 'WRONG_PHASE', message: 'Attack is not legal in the current phase.' });
    const defenders = Object.values(state.units).filter(u => u.alive && u.side !== attackerSide && hexKey(u.hex) === hexKey(action.target));
    if (!defenders.length)
        issues.push({ code: 'NO_DEFENDER', message: 'Target hex contains no enemy defender.', hex: action.target });
    const participantIds = new Set([...action.attackerUnitIds, ...(action.support?.attackerArtilleryUnitId ? [action.support.attackerArtilleryUnitId] : [])]);
    for (const cid of action.commitmentIds ?? []) {
        const commitment = state.unitCommitments[cid];
        if (!commitment) {
            issues.push({ code: 'COMMITMENT_NOT_FOUND', message: `Unknown unit commitment ${cid}.`, details: { commitmentId: cid } });
            continue;
        }
        if (!commitment.active || commitment.battleId !== action.battleId) {
            issues.push({ code: 'INVALID_BATTLE_REFERENCE', message: 'Commitment does not belong to this active battle draft.', details: { commitmentId: cid, expectedBattleId: action.battleId ?? null, actualBattleId: commitment.battleId, active: commitment.active } });
            continue;
        }
        if (commitment.authorizedControllerId !== action.controllerId) {
            issues.push({ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Commitment is not authorized to the declaring controller.', details: { commitmentId: cid, authorizedControllerId: commitment.authorizedControllerId, controllerId: action.controllerId } });
            continue;
        }
        if (!commitment.unitIds.some(id => participantIds.has(id)))
            issues.push({ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Commitment does not authorize any unit participating in this attack.', details: { commitmentId: cid, participantUnitIds: [...participantIds] } });
    }
    for (const id of action.attackerUnitIds) {
        const u = state.units[id];
        if (!u) {
            issues.push({ code: 'UNIT_NOT_FOUND', message: `Unknown attacker ${id}.`, unitId: id });
            continue;
        }
        if (u.side !== attackerSide)
            issues.push({ code: 'WRONG_SIDE', message: 'All attackers must be on the initiating controller side.', unitId: id });
        if (!isUnitAuthorizedForAttack(state, action, id))
            issues.push({ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Controller neither owns this attacker nor has a valid battle-scoped unit commitment.', unitId: id, details: { battleId: action.battleId ?? null } });
        if (!u.alive)
            issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed unit cannot attack.', unitId: id });
        if (u.hasAttacked)
            issues.push({ code: 'UNIT_ALREADY_ATTACKED', message: 'Unit has already attacked.', unitId: id });
        if (u.dedicatedRailRepair)
            issues.push({ code: 'INVALID_SUPPORT', message: 'A rail-dedicated engineer cannot attack during the remainder of this German Player Turn.', unitId: id, details: { reason: 'DEDICATED_RAIL_REPAIR' } });
        if (hexDistance(u.hex, action.target) !== 1)
            issues.push({ code: 'NOT_ADJACENT_TO_TARGET', message: 'Combat attacker must be adjacent to target.', unitId: id, hex: action.target });
        if (getUnitStats(u, rules).attack <= 0)
            issues.push({ code: 'INVALID_SUPPORT', message: 'Support-only unit cannot be a direct attacker.', unitId: id });
    }
    const artId = action.support?.attackerArtilleryUnitId;
    if (artId) {
        const art = state.units[artId];
        if (!art)
            issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown attacker artillery unit.', unitId: artId });
        else {
            if (art.side !== attackerSide)
                issues.push({ code: 'WRONG_SIDE', message: 'Attacker artillery must be on attacker side.', unitId: art.id });
            if (!isUnitAuthorizedForAttack(state, action, art.id))
                issues.push({ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Controller neither owns attacker artillery nor has a valid battle-scoped commitment.', unitId: art.id, details: { battleId: action.battleId ?? null } });
            if (art.artillerySupportUsed)
                issues.push({ code: 'ARTILLERY_ALREADY_USED', message: 'Artillery has already supported combat in its current support window.', unitId: art.id });
            if (!validArtillerySupport(state, artId, attackerSide, action.target, false))
                issues.push({ code: 'INVALID_SUPPORT', message: 'Selected attacker artillery is not eligible/ranged/supplied for this target.', unitId: artId });
        }
    }
    return issues;
}
export function buildCombatContext(state, rules, action, defenderReaction = {}) {
    const controller = state.controllers[action.controllerId];
    if (!controller)
        throw new Error('Combat context requires a valid controller.');
    const side = controller.side, enemy = enemyOf(side);
    const attackers = [...new Set(action.attackerUnitIds)].map(id => state.units[id]).filter((u) => Boolean(u));
    const defenders = Object.values(state.units).filter(u => u.alive && u.side === enemy && hexKey(u.hex) === hexKey(action.target));
    const attackStrength = attackers.reduce((s, u) => s + effectiveAttack(u, rules), 0);
    const rawDefenseStrength = defenders.reduce((s, u) => s + getUnitStats(u, rules).defense, 0);
    const allDefendersOOS = defenders.length > 0 && defenders.every(u => u.supplyState === 'OUT_OF_SUPPLY');
    const hasRetreatExit = defenders.some(u => hasLegalRetreatExit(state, rules, u, action.target));
    const oosSurroundedDefenseHalved = allDefendersOOS && !hasRetreatExit;
    const finalDefenseStrength = oosSurroundedDefenseHalved ? Math.ceil(rawDefenseStrength / 2) : rawDefenseStrength;
    const defenseStrength = finalDefenseStrength;
    const base = selectCRTColumn(attackStrength, defenseStrength, rules);
    const terrain = state.hexes[hexKey(action.target)]?.terrain ?? 'PLAIN';
    let terrainShift = rules.terrain[terrain].attackShift;
    if (terrain === 'FOREST' && attackers.some(u => u.type === 'JAGER'))
        terrainShift = 0;
    const crossing = attackers.map(u => state.edges[canonicalEdgeKey(u.hex, action.target)]?.river ?? null);
    let riverShift = 0;
    if (crossing.length && crossing.every(Boolean))
        riverShift = crossing.includes('MAJOR') ? rules.river.MAJOR.attackShift : rules.river.MINOR.attackShift;
    let engineerShift = 0;
    let engineerAppliedTo = null;
    if (attackers.some(u => u.type === 'ENGINEER')) {
        if (riverShift < 0) {
            engineerShift = 1;
            engineerAppliedTo = 'RIVER';
        }
        else if (terrainShift < 0 && ['CITY', 'MAIN_CITY', 'OUTER_CITY'].includes(terrain)) {
            engineerShift = 1;
            engineerAppliedTo = 'CITY';
        }
    }
    let combinedArmsShift = 0;
    if (side === 'GERMAN') {
        const armor = attackers.some(u => u.type === 'PANZER' && u.step <= 1 && u.supplyState !== 'OUT_OF_SUPPLY');
        const coord = attackers.some(u => rules.combat.germanCombinedArmsCoordinationTypes.includes(u.type) && u.supplyState !== 'OUT_OF_SUPPLY');
        if (armor && coord)
            combinedArmsShift = rules.combat.combinedArmsShift;
    }
    const hasArmor = attackers.some(u => rules.unitTemplates[u.templateId]?.isArmor), hasCoord = attackers.some(u => rules.unitTemplates[u.templateId]?.infantryCoordination);
    const unsupportedArmorShift = hasArmor && !hasCoord && rules.combat.complexTerrainForArmor.includes(terrain) ? rules.combat.unsupportedArmorComplexTerrainShift : 0;
    const antiTankShift = hasArmor && defenders.some(u => u.type === 'ANTI_TANK' && u.step <= 1) ? rules.combat.antiTankShift : 0;
    const attackerArt = validArtillerySupport(state, action.support?.attackerArtilleryUnitId, side, action.target, false);
    const defenderArt = validArtillerySupport(state, defenderReaction.defenderArtilleryUnitId, enemy, action.target, false);
    const attackerArtilleryShift = attackerArt ? rules.combat.artilleryShift : 0, defenderArtilleryShift = defenderArt ? -rules.combat.artilleryShift : 0;
    const origins = new Set(attackers.map(u => hexKey(u.hex)));
    const flankShift = origins.size >= 3 ? rules.combat.flankShift : 0;
    const entrenchmentShift = defenders.some(u => u.entrenched) ? rules.combat.entrenchmentShift : 0;
    let hqShift = 0;
    if (defenderReaction.defenderHQCommand === 'LAST_STAND')
        hqShift += (rules.hqCommands.LAST_STAND.crtShift ?? 0);
    const secondAttackShift = action.battleId && state.combatTransactions[action.battleId]?.isSchwerpunktSecondAttack ? rules.combat.schwerpunktSecondAttackShift : 0;
    const rawShift = terrainShift + riverShift + engineerShift + combinedArmsShift + unsupportedArmorShift + antiTankShift + attackerArtilleryShift + defenderArtilleryShift + flankShift + entrenchmentShift + hqShift + secondAttackShift;
    const cappedShift = clampCRTShift(rawShift, rules), final = shiftedCRTColumn(base, rawShift, rules);
    return { ...(action.battleId ? { battleId: action.battleId } : {}), attackerSide: side, target: action.target, attackerUnitIds: attackers.map(u => u.id), defenderUnitIds: defenders.map(u => u.id), attackStrength, rawDefenseStrength, finalDefenseStrength, defenseStrength, oosSurroundedDefenseHalved, baseOdds: rules.crt.columns[base], baseCRTColumn: base, modifiers: { terrainShift, riverShift, engineerShift, combinedArmsShift, unsupportedArmorShift, antiTankShift, attackerArtilleryShift, defenderArtilleryShift, flankShift, entrenchmentShift, hqShift, secondAttackShift, rawShift, cappedShift }, finalShift: cappedShift, finalCRTColumn: final, finalCRTColumnLabel: rules.crt.columns[final], attackerArtilleryUnitId: attackerArt?.id ?? null, defenderArtilleryUnitId: defenderArt?.id ?? null };
}
