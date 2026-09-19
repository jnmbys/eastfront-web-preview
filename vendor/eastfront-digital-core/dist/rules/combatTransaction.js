import { hexDistance, hexKey } from '../core/hex.js';
import { SeededRNG } from '../random/SeededRNG.js';
import { buildCombatContext, validArtillerySupport, validateAttackAction } from './combat.js';
import { analyzeLossRequirement, applyLossSequence, validateLossAllocationSequence } from './combatLoss.js';
import { parseCRTResult, resolveCRTResult } from './crt.js';
import { enemyOf } from './zoc.js';
import { getMaxLegalRetreatDistance, validateRetreatStep } from './retreat.js';
import { stackingIssueForDestination } from './stacking.js';
import { analyzeBreakthroughAction } from './breakthrough.js';
/**
 * Explicit routing helper for combat decisions. Multi-controller defender delegation remains
 * intentionally unsupported until a dedicated collaboration protocol is approved.
 */
export function resolveCombatDecisionOwner(state, side, unitIds) {
    const ids = [...new Set(unitIds.map(id => state.units[id]).filter((u) => Boolean(u && u.alive && u.side === side)).map(u => u.controllerId))].sort();
    if (ids.length === 0)
        return { ownerControllerId: null, eligibleControllerIds: [], issues: [{ code: 'INVALID_CONTROLLER', message: 'Combat decision has no valid unit controller.' }] };
    if (ids.length > 1)
        return { ownerControllerId: null, eligibleControllerIds: ids, issues: [{ code: 'RULE_NOT_IMPLEMENTED', message: 'Multi-controller defender decision delegation is not implemented yet.', details: { eligibleControllerIds: ids } }] };
    return { ownerControllerId: ids[0], eligibleControllerIds: ids, issues: [] };
}
function eligibleDefenderArtillery(state, rules, side, owner, target) {
    return Object.values(state.units).filter(u => u.controllerId === owner && Boolean(validArtillerySupport(state, u.id, side, target, true))).map(u => u.id).sort();
}
function eligibleDefenderHQ(state, rules, side, owner, target) {
    const command = rules.hqCommands.LAST_STAND;
    if (state.cp[side] < command.cost)
        return [];
    return Object.values(state.units).filter(u => u.alive && u.side === side && u.controllerId === owner && u.type === 'HQ' && u.supplyState !== 'OUT_OF_SUPPLY' && u.lastHQCommandTurn !== state.turn && hexDistance(u.hex, target) <= (command.range ?? 0)).map(u => u.id).sort();
}
function deactivateBattleCommitments(state, battleId) {
    for (const c of Object.values(state.unitCommitments))
        if (c.battleId === battleId)
            c.active = false;
}
function closeCombat(state, tx, actionId, events) {
    tx.stage = 'CLOSED';
    tx.completedByActionId = actionId;
    state.pendingDecision = null;
    deactivateBattleCommitments(state, tx.battleId);
    events.push({ type: 'CombatCompleted', actionId, battleId: tx.battleId });
}
export function declareCombat(state, rules, action, actionId, battleId) {
    const issues = validateAttackAction(state, rules, action);
    if (issues.length)
        return { issues, events: [] };
    const attacker = state.controllers[action.controllerId];
    const defenderSide = enemyOf(attacker.side);
    const defenders = Object.values(state.units).filter(u => u.alive && u.side === defenderSide && hexKey(u.hex) === hexKey(action.target));
    const owner = resolveCombatDecisionOwner(state, defenderSide, defenders.map(u => u.id));
    issues.push(...owner.issues);
    if (issues.length || !owner.ownerControllerId)
        return { issues, events: [] };
    const tx = {
        battleId, sourceBattleId: null, stage: 'DEFENDER_REACTION', declaredByActionId: actionId, declaringControllerId: action.controllerId,
        attackerSide: attacker.side, defenderSide, attackerUnitIds: [...action.attackerUnitIds], defenderUnitIds: defenders.map(u => u.id), targetHex: { ...action.target }, commitmentIds: [...(action.commitmentIds ?? [])],
        attackerArtilleryUnitId: action.support?.attackerArtilleryUnitId ?? null, defenderArtilleryUnitId: null, attackerHQEffect: null, defenderHQEffect: null,
        defenderReactionPassed: false, context: null, resolution: null, unresolvedLosses: [], lossesApplied: { GERMAN: {}, SOVIET: {} }, retreat: null, retreatImpossibleExtraLossApplied: false,
        advance: null, breakthrough: null, schwerpunkt: null, isSchwerpunktSecondAttack: false, completedByActionId: null
    };
    state.combatTransactions[battleId] = tx;
    for (const id of tx.attackerUnitIds)
        state.units[id].hasAttacked = true;
    if (tx.attackerArtilleryUnitId)
        state.units[tx.attackerArtilleryUnitId].artillerySupportUsed = true;
    const ownerId = owner.ownerControllerId;
    state.pendingDecision = {
        kind: 'DEFENDER_REACTION', battleId, side: defenderSide, decisionOwnerControllerId: ownerId, eligibleControllerIds: owner.eligibleControllerIds,
        eligibleHQUnitIds: eligibleDefenderHQ(state, rules, defenderSide, ownerId, tx.targetHex), eligibleArtilleryUnitIds: eligibleDefenderArtillery(state, rules, defenderSide, ownerId, tx.targetHex)
    };
    return { issues: [], events: [{ type: 'CombatDeclared', actionId, battleId, attackerUnitIds: [...tx.attackerUnitIds], defenderUnitIds: [...tx.defenderUnitIds], target: { ...tx.targetHex }, sourceBattleId: null }] };
}
function sourceCommitmentForSchwerpunkt(state, source, unit) {
    if (unit.controllerId === source.declaringControllerId)
        return null;
    for (const id of source.commitmentIds) {
        const c = state.unitCommitments[id];
        if (!c || !c.active)
            continue;
        if (c.battleId !== source.battleId || c.grantorControllerId !== unit.controllerId || c.authorizedControllerId !== source.declaringControllerId)
            continue;
        if (c.unitIds.includes(unit.id))
            return c;
    }
    return null;
}
export function declareSchwerpunktCombat(state, rules, action, actionId, battleId) {
    const issues = [];
    const source = state.combatTransactions[action.sourceBattleId];
    if (!source)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown source combat transaction ${action.sourceBattleId}.` }], events: [] };
    if (source.stage !== 'SCHWERPUNKT_OPTION')
        issues.push({ code: 'COMBAT_STAGE_MISMATCH', message: 'Source combat is not awaiting Schwerpunkt.', details: { stage: source.stage } });
    if (!source.schwerpunkt || source.schwerpunkt.resolved)
        issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Source combat has no unresolved Schwerpunkt option.' });
    if (source.attackerSide !== 'GERMAN' || (source.resolution?.crtResult !== 'D2R' && source.resolution?.crtResult !== 'D3R'))
        issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Schwerpunkt requires a German D2R/D3R source combat.' });
    if (action.controllerId !== source.declaringControllerId)
        issues.push({ code: 'PENDING_DECISION_CONTROLLER_MISMATCH', message: 'Schwerpunkt remains controlled by the source battle declaring controller.', details: { controllerId: action.controllerId, decisionOwnerControllerId: source.declaringControllerId } });
    if (state.phase !== 'GERMAN_COMBAT' || state.activeSide !== 'GERMAN')
        issues.push({ code: 'WRONG_PHASE', message: 'Schwerpunkt second attack is only legal during the German Combat phase.' });
    if (state.schwerpunktUsedOnTurn === state.turn)
        issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Schwerpunkt has already been used this German Player Turn.' });
    const rawSupport = action.support;
    if (rawSupport && ('attackerHQUnitId' in rawSupport || 'attackerHQCommand' in rawSupport || 'secondSchwerpunktAttack' in rawSupport))
        issues.push({ code: 'RULE_NOT_IMPLEMENTED', message: 'Schwerpunkt HQ/second-attack effects cannot be declared by client payload.' });
    const unit = state.units[action.unitId];
    if (!unit)
        issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown Schwerpunkt armor.', unitId: action.unitId });
    else {
        const template = rules.unitTemplates[unit.templateId];
        if (!source.schwerpunkt?.eligibleUnitIds.includes(unit.id))
            issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Selected unit is not eligible for Schwerpunkt in the source battle.', unitId: unit.id });
        if (!unit.alive)
            issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed armor cannot make a Schwerpunkt second attack.', unitId: unit.id });
        if (unit.side !== 'GERMAN' || !template?.isArmor || unit.step > 1)
            issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Schwerpunkt requires a surviving full/one-step German armor unit.', unitId: unit.id });
        if (unit.supplyState === 'OUT_OF_SUPPLY')
            issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Out-of-supply armor cannot make a Schwerpunkt second attack.', unitId: unit.id });
        if (!unit.hasAttacked)
            issues.push({ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Schwerpunkt armor must already have participated in its source attack.', unitId: unit.id });
        if (hexDistance(unit.hex, action.target) !== 1)
            issues.push({ code: 'NOT_ADJACENT_TO_TARGET', message: 'Schwerpunkt armor must be adjacent to the new target.', unitId: unit.id, hex: { ...action.target } });
        if (unit.controllerId !== source.declaringControllerId && !sourceCommitmentForSchwerpunkt(state, source, unit))
            issues.push({ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Committed teammate armor lacks active source-battle authority for inherited Schwerpunkt control.', unitId: unit.id, details: { sourceBattleId: source.battleId } });
    }
    const defenders = Object.values(state.units).filter(u => u.alive && u.side === 'SOVIET' && hexKey(u.hex) === hexKey(action.target));
    if (defenders.length === 0)
        issues.push({ code: 'NO_DEFENDER', message: 'Schwerpunkt target hex contains no Soviet defender.', hex: { ...action.target } });
    const owner = defenders.length ? resolveCombatDecisionOwner(state, 'SOVIET', defenders.map(u => u.id)) : null;
    if (owner)
        issues.push(...owner.issues);
    const artId = action.support?.attackerArtilleryUnitId;
    if (artId) {
        const art = state.units[artId];
        if (!art)
            issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown Schwerpunkt attacker artillery.', unitId: artId });
        else {
            if (art.controllerId !== action.controllerId)
                issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Schwerpunkt attacker artillery must be permanently controlled by the declaring controller.', unitId: art.id });
            if (art.side !== 'GERMAN')
                issues.push({ code: 'WRONG_SIDE', message: 'Schwerpunkt attacker artillery must be German.', unitId: art.id });
            if (art.artillerySupportUsed)
                issues.push({ code: 'ARTILLERY_ALREADY_USED', message: 'Artillery has already supported combat in this Player Turn.', unitId: art.id });
            if (!validArtillerySupport(state, art.id, 'GERMAN', action.target, false))
                issues.push({ code: 'INVALID_SUPPORT', message: 'Selected Schwerpunkt artillery is not alive/supplied/eligible/in range.', unitId: art.id });
        }
    }
    if (issues.length || !unit || !owner?.ownerControllerId)
        return { issues, events: [] };
    const inherited = sourceCommitmentForSchwerpunkt(state, source, unit);
    const childCommitmentIds = [];
    if (unit.controllerId !== source.declaringControllerId) {
        if (!inherited)
            return { issues: [{ code: 'UNAUTHORIZED_UNIT_COMMITMENT', message: 'Missing inherited Schwerpunkt authority.', unitId: unit.id }], events: [] };
        const id = `C-SP-${actionId}`;
        state.unitCommitments[id] = { id, grantActionId: actionId, battleId, grantorControllerId: unit.controllerId, authorizedControllerId: source.declaringControllerId, unitIds: [unit.id], createdTurn: state.turn, createdPhase: state.phase, active: true };
        childCommitmentIds.push(id);
    }
    const child = {
        battleId, sourceBattleId: source.battleId, stage: 'DEFENDER_REACTION', declaredByActionId: actionId, declaringControllerId: source.declaringControllerId,
        attackerSide: 'GERMAN', defenderSide: 'SOVIET', attackerUnitIds: [unit.id], defenderUnitIds: defenders.map(u => u.id), targetHex: { ...action.target }, commitmentIds: childCommitmentIds,
        attackerArtilleryUnitId: artId ?? null, defenderArtilleryUnitId: null, attackerHQEffect: null, defenderHQEffect: null,
        defenderReactionPassed: false, context: null, resolution: null, unresolvedLosses: [], lossesApplied: { GERMAN: {}, SOVIET: {} }, retreat: null, retreatImpossibleExtraLossApplied: false,
        advance: null, breakthrough: null, schwerpunkt: null, isSchwerpunktSecondAttack: true, completedByActionId: null
    };
    state.combatTransactions[battleId] = child;
    if (artId)
        state.units[artId].artillerySupportUsed = true;
    source.schwerpunkt.selectedUnitId = unit.id;
    source.schwerpunkt.childBattleId = battleId;
    source.schwerpunkt.resolved = true;
    state.schwerpunktUsedOnTurn = state.turn;
    state.pendingDecision = null;
    const events = [
        { type: 'SchwerpunktDeclared', actionId, sourceBattleId: source.battleId, battleId, unitId: unit.id },
        { type: 'CombatDeclared', actionId, battleId, attackerUnitIds: [unit.id], defenderUnitIds: [...child.defenderUnitIds], target: { ...child.targetHex }, sourceBattleId: source.battleId }
    ];
    closeCombat(state, source, actionId, events);
    state.pendingDecision = {
        kind: 'DEFENDER_REACTION', battleId, side: 'SOVIET', decisionOwnerControllerId: owner.ownerControllerId, eligibleControllerIds: owner.eligibleControllerIds,
        eligibleHQUnitIds: eligibleDefenderHQ(state, rules, 'SOVIET', owner.ownerControllerId, child.targetHex), eligibleArtilleryUnitIds: eligibleDefenderArtillery(state, rules, 'SOVIET', owner.ownerControllerId, child.targetHex)
    };
    return { issues: [], events };
}
export function applyPassSchwerpunkt(state, action, actionId) {
    const source = state.combatTransactions[action.battleId];
    if (!source)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${action.battleId}.` }], events: [] };
    if (source.stage !== 'SCHWERPUNKT_OPTION')
        return { issues: [{ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting Schwerpunkt.', details: { stage: source.stage } }], events: [] };
    if (!source.schwerpunkt || source.schwerpunkt.resolved)
        return { issues: [{ code: 'SCHWERPUNKT_UNAVAILABLE', message: 'Combat has no unresolved Schwerpunkt option.' }], events: [] };
    source.schwerpunkt.selectedUnitId = null;
    source.schwerpunkt.childBattleId = null;
    source.schwerpunkt.resolved = true;
    state.pendingDecision = null;
    const events = [{ type: 'SchwerpunktPassed', actionId, sourceBattleId: source.battleId, controllerId: action.controllerId }];
    closeCombat(state, source, actionId, events);
    return { issues: [], events };
}
function reactionBaseChecks(state, battleId) {
    const tx = state.combatTransactions[battleId];
    if (!tx)
        return { tx: null, issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${battleId}.` }] };
    if (tx.stage !== 'DEFENDER_REACTION')
        return { tx, issues: [{ code: 'COMBAT_STAGE_MISMATCH', message: `Combat ${battleId} is not in defender reaction stage.`, details: { stage: tx.stage } }] };
    return { tx, issues: [] };
}
export function applyCombatReaction(state, rules, action, actionId) {
    const base = reactionBaseChecks(state, action.battleId);
    if (base.issues.length || !base.tx)
        return { issues: base.issues, events: [] };
    const tx = base.tx;
    const issues = [];
    if (action.reaction.kind === 'DEFENDER_ARTILLERY') {
        if (tx.defenderArtilleryUnitId)
            issues.push({ code: 'INVALID_REACTION', message: 'Defensive artillery has already been selected for this battle.' });
        const u = state.units[action.reaction.artilleryUnitId];
        if (!u)
            issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown defensive artillery unit.', unitId: action.reaction.artilleryUnitId });
        else {
            if (u.controllerId !== action.controllerId)
                issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Reaction controller does not own this artillery.', unitId: u.id });
            if (u.side !== tx.defenderSide)
                issues.push({ code: 'WRONG_SIDE', message: 'Defensive artillery is on wrong side.', unitId: u.id });
            if (u.artillerySupportUsed)
                issues.push({ code: 'ARTILLERY_ALREADY_USED', message: 'Artillery has already supported combat in this support window.', unitId: u.id });
            if (!validArtillerySupport(state, u.id, tx.defenderSide, tx.targetHex, false))
                issues.push({ code: 'INVALID_SUPPORT', message: 'Defensive artillery is not alive/supplied/eligible/in range.', unitId: u.id });
        }
        if (issues.length)
            return { issues, events: [] };
        u.artillerySupportUsed = true;
        tx.defenderArtilleryUnitId = u.id;
        return { issues: [], events: [{ type: 'CombatReactionUsed', actionId, battleId: tx.battleId, controllerId: action.controllerId, reaction: 'DEFENDER_ARTILLERY', unitId: u.id }] };
    }
    if (action.reaction.command !== 'LAST_STAND')
        return { issues: [{ code: 'INVALID_REACTION', message: 'Only LAST_STAND is legal in defender HQ reaction window.' }], events: [] };
    if (tx.defenderHQEffect)
        issues.push({ code: 'INVALID_REACTION', message: 'A defensive HQ reaction has already been selected for this battle.' });
    const hq = state.units[action.reaction.hqUnitId];
    const rule = rules.hqCommands.LAST_STAND;
    if (!hq)
        issues.push({ code: 'UNIT_NOT_FOUND', message: 'Unknown defending HQ.', unitId: action.reaction.hqUnitId });
    else {
        if (hq.controllerId !== action.controllerId)
            issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Reaction controller does not own this HQ.', unitId: hq.id });
        if (!hq.alive || hq.type !== 'HQ' || hq.side !== tx.defenderSide)
            issues.push({ code: 'INVALID_REACTION', message: 'Selected unit is not an eligible defending HQ.', unitId: hq.id });
        if (hq.supplyState === 'OUT_OF_SUPPLY')
            issues.push({ code: 'INVALID_REACTION', message: 'Out-of-supply HQ cannot issue Last Stand.', unitId: hq.id });
        if (hexDistance(hq.hex, tx.targetHex) > (rule.range ?? 0))
            issues.push({ code: 'HQ_OUT_OF_RANGE', message: 'HQ is out of command range.', unitId: hq.id });
        if (hq.lastHQCommandTurn === state.turn)
            issues.push({ code: 'HQ_ALREADY_USED', message: 'HQ has already issued a command this game turn.', unitId: hq.id });
    }
    if (state.cp[tx.defenderSide] < rule.cost)
        issues.push({ code: 'INSUFFICIENT_CP', message: 'Not enough CP for Last Stand.', details: { required: rule.cost, available: state.cp[tx.defenderSide] } });
    if (issues.length)
        return { issues, events: [] };
    state.cp[tx.defenderSide] -= rule.cost;
    hq.lastHQCommandTurn = state.turn;
    tx.defenderHQEffect = { hqUnitId: hq.id, command: 'LAST_STAND' };
    return { issues: [], events: [{ type: 'CombatReactionUsed', actionId, battleId: tx.battleId, controllerId: action.controllerId, reaction: 'LAST_STAND', unitId: hq.id }] };
}
function pendingForLoss(state, tx, side, steps, eligibleUnitIds) {
    const controllers = [...new Set(eligibleUnitIds.map(id => state.units[id]?.controllerId).filter((x) => Boolean(x)))].sort();
    if (side === tx.attackerSide) {
        // Battle-scoped attacker commitment delegates tactical loss allocation to the declaring controller.
        const eligible = [...new Set([tx.declaringControllerId, ...controllers])].sort();
        return { kind: 'LOSS_ALLOCATION', battleId: tx.battleId, side, decisionOwnerControllerId: tx.declaringControllerId, eligibleControllerIds: eligible, lossSteps: steps, eligibleUnitIds: [...eligibleUnitIds] };
    }
    const owner = controllers[0] ?? tx.declaringControllerId;
    return { kind: 'LOSS_ALLOCATION', battleId: tx.battleId, side, decisionOwnerControllerId: owner, eligibleControllerIds: controllers.length ? controllers : [owner], lossSteps: steps, eligibleUnitIds: [...eligibleUnitIds] };
}
function pendingForRetreat(state, tx, side, steps, unitIds) {
    const controllers = [...new Set(unitIds.map(id => state.units[id]?.controllerId).filter((x) => Boolean(x)))].sort();
    if (side === tx.attackerSide) {
        // Unit Commitment grants the declaring controller tactical authority for this battle until CLOSED,
        // even if only committed teammate units remain alive. Permanent controllerId is unchanged.
        const eligible = [...new Set([tx.declaringControllerId, ...controllers])].sort();
        return { kind: 'RETREAT', battleId: tx.battleId, side, decisionOwnerControllerId: tx.declaringControllerId, eligibleControllerIds: eligible, retreatSteps: steps, unitIds: [...unitIds] };
    }
    const owner = controllers[0] ?? tx.declaringControllerId;
    return { kind: 'RETREAT', battleId: tx.battleId, side, decisionOwnerControllerId: owner, eligibleControllerIds: controllers.length ? controllers : [owner], retreatSteps: steps, unitIds: [...unitIds] };
}
function pendingForAdvance(state, tx, eligibleUnitIds) {
    const controllers = [...new Set(eligibleUnitIds.map(id => state.units[id]?.controllerId).filter((x) => Boolean(x)))].sort();
    const eligible = [...new Set([tx.declaringControllerId, ...controllers])].sort();
    return { kind: 'ADVANCE_AFTER_COMBAT', battleId: tx.battleId, side: tx.attackerSide, decisionOwnerControllerId: tx.declaringControllerId, eligibleControllerIds: eligible, eligibleUnitIds: [...eligibleUnitIds] };
}
function pendingForBreakthrough(state, tx, eligibleUnitIds) {
    const controllers = [...new Set(eligibleUnitIds.map(id => state.units[id]?.controllerId).filter((x) => Boolean(x)))].sort();
    const eligible = [...new Set([tx.declaringControllerId, ...controllers])].sort();
    return { kind: 'BREAKTHROUGH_OPTION', battleId: tx.battleId, side: tx.attackerSide, decisionOwnerControllerId: tx.declaringControllerId, eligibleControllerIds: eligible, eligibleUnitIds: [...eligibleUnitIds] };
}
function pendingForSchwerpunkt(state, tx, eligibleUnitIds) {
    const controllers = [...new Set(eligibleUnitIds.map(id => state.units[id]?.controllerId).filter((x) => Boolean(x)))].sort();
    const eligible = [...new Set([tx.declaringControllerId, ...controllers])].sort();
    return { kind: 'SCHWERPUNKT_OPTION', battleId: tx.battleId, side: tx.attackerSide, decisionOwnerControllerId: tx.declaringControllerId, eligibleControllerIds: eligible, eligibleUnitIds: [...eligibleUnitIds] };
}
function loggedBreakthroughMovers(state, tx) {
    const out = new Set();
    for (const entry of state.actionLog) {
        if (!entry.accepted || entry.action.type !== 'BREAKTHROUGH' || entry.action.battleId !== tx.battleId || entry.action.path.length === 0)
            continue;
        out.add(entry.action.unitId);
    }
    return out;
}
function prepareSchwerpunktOrClose(state, rules, tx, actionId, events, currentMovedUnitId = null) {
    state.pendingDecision = null;
    const result = tx.resolution?.crtResult;
    const canOffer = tx.attackerSide === 'GERMAN' && (result === 'D2R' || result === 'D3R') && state.schwerpunktUsedOnTurn !== state.turn;
    if (canOffer) {
        const movers = loggedBreakthroughMovers(state, tx);
        if (currentMovedUnitId)
            movers.add(currentMovedUnitId);
        const eligibleUnitIds = [...movers].filter(id => {
            const unit = state.units[id];
            const template = unit ? rules.unitTemplates[unit.templateId] : undefined;
            return Boolean(unit?.alive && tx.attackerUnitIds.includes(id) && tx.breakthrough?.completedUnitIds.includes(id) && template?.isArmor && unit.side === 'GERMAN' && unit.step <= 1 && unit.supplyState !== 'OUT_OF_SUPPLY');
        });
        if (eligibleUnitIds.length > 0) {
            tx.schwerpunkt = { eligibleUnitIds: [...eligibleUnitIds], selectedUnitId: null, childBattleId: null, resolved: false };
            tx.stage = 'SCHWERPUNKT_OPTION';
            state.pendingDecision = pendingForSchwerpunkt(state, tx, eligibleUnitIds);
            events.push({ type: 'SchwerpunktAvailable', actionId, battleId: tx.battleId, eligibleUnitIds: [...eligibleUnitIds] });
            return;
        }
    }
    tx.schwerpunkt = null;
    closeCombat(state, tx, actionId, events);
}
function recordLosses(tx, side, allocations) {
    for (const [unitId, count] of Object.entries(allocations))
        tx.lossesApplied[side][unitId] = (tx.lossesApplied[side][unitId] ?? 0) + count;
}
function prepareBreakthroughOrClose(state, rules, tx, actionId, events) {
    state.pendingDecision = null;
    const result = tx.resolution?.crtResult;
    const breakthroughResult = result === 'D1R' || result === 'D2R' || result === 'D3R';
    const targetTerrain = state.hexes[hexKey(tx.targetHex)]?.terrain;
    if (breakthroughResult && !tx.isSchwerpunktSecondAttack && targetTerrain !== 'MARSH') {
        const eligibleUnitIds = tx.attackerUnitIds.filter(id => {
            const unit = state.units[id];
            const template = unit ? rules.unitTemplates[unit.templateId] : undefined;
            return Boolean(unit?.alive && template?.isArmor && unit.supplyState !== 'OUT_OF_SUPPLY');
        });
        if (eligibleUnitIds.length > 0) {
            const maxHexesByUnitId = {};
            for (const id of eligibleUnitIds) {
                const unit = state.units[id];
                maxHexesByUnitId[id] = unit.step === 2 ? 1 : 2;
            }
            tx.breakthrough = { eligibleUnitIds: [...eligibleUnitIds], completedUnitIds: [], maxHexesByUnitId, resolved: false };
            tx.stage = 'BREAKTHROUGH_OPTION';
            state.pendingDecision = pendingForBreakthrough(state, tx, eligibleUnitIds);
            events.push({ type: 'BreakthroughAvailable', actionId, battleId: tx.battleId, eligibleUnitIds: [...eligibleUnitIds], maxHexesByUnitId: { ...maxHexesByUnitId } });
            return;
        }
    }
    tx.breakthrough = null;
    closeCombat(state, tx, actionId, events);
}
/**
 * Resolve all deterministic/unique loss allocations, then stop at the first player choice.
 * Once losses are exhausted, this only prepares RETREAT / ADVANCE for the next milestone.
 */
export function continueCombatAfterLosses(state, rules, tx, actionId, events) {
    state.pendingDecision = null;
    while (tx.unresolvedLosses.length > 0) {
        const req = tx.unresolvedLosses[0];
        const analysis = analyzeLossRequirement(state, rules, req);
        if (analysis.effectiveSteps === 0) {
            tx.unresolvedLosses.shift();
            continue;
        }
        if (!analysis.unique) {
            tx.stage = 'LOSS_ALLOCATION';
            state.pendingDecision = pendingForLoss(state, tx, req.side, analysis.effectiveSteps, analysis.eligibleUnitIds);
            return;
        }
        const applied = applyLossSequence(state, rules, tx.battleId, req.side, analysis.uniqueSequence ?? [], actionId, true);
        recordLosses(tx, req.side, applied.allocations);
        events.push(...applied.events);
        tx.unresolvedLosses.shift();
    }
    if (tx.retreat && !tx.retreat.resolved) {
        const liveRetreaters = tx.retreat.unitIds.filter(id => state.units[id]?.alive);
        tx.retreat.unitIds = liveRetreaters;
        if (liveRetreaters.length > 0) {
            tx.stage = 'RETREAT';
            state.pendingDecision = pendingForRetreat(state, tx, tx.retreat.side, tx.retreat.steps, liveRetreaters);
            return;
        }
        tx.retreat.resolved = true;
    }
    const targetStillDefended = Object.values(state.units).some(u => u.alive && u.side === tx.defenderSide && hexKey(u.hex) === hexKey(tx.targetHex));
    if (!targetStillDefended) {
        const eligibleAttackers = tx.attackerUnitIds.filter(id => state.units[id]?.alive);
        if (eligibleAttackers.length > 0) {
            tx.stage = 'ADVANCE_AFTER_COMBAT';
            tx.advance = { eligibleUnitIds: [...eligibleAttackers], advancedUnitIds: [], resolved: false };
            state.pendingDecision = pendingForAdvance(state, tx, eligibleAttackers);
            events.push({ type: 'AdvanceAvailable', actionId, battleId: tx.battleId, eligibleUnitIds: [...eligibleAttackers] });
            return;
        }
    }
    closeCombat(state, tx, actionId, events);
}
function originalParticipantsForSide(tx, side) {
    return side === tx.attackerSide ? tx.attackerUnitIds : tx.defenderUnitIds;
}
function validateOrderedRetreat(state, rules, tx, action) {
    const retreat = tx.retreat;
    if (!retreat)
        return { issues: [{ code: 'INVALID_RETREAT', message: 'Combat has no retreat requirement.' }], outcomes: [], failed: false };
    if (retreat.resolved)
        return { issues: [{ code: 'INVALID_RETREAT', message: 'Combat retreat has already been resolved.' }], outcomes: [], failed: false };
    const requiredIds = [...retreat.unitIds];
    const providedIds = action.retreats.map(x => x.unitId);
    const issues = [];
    const duplicateIds = providedIds.filter((id, i) => providedIds.indexOf(id) !== i);
    if (duplicateIds.length)
        issues.push({ code: 'INVALID_RETREAT', message: 'Each required retreater must appear exactly once.', details: { duplicateUnitIds: [...new Set(duplicateIds)] } });
    const missing = requiredIds.filter(id => !providedIds.includes(id));
    const extras = providedIds.filter(id => !requiredIds.includes(id));
    if (missing.length || extras.length)
        issues.push({ code: 'INVALID_RETREAT', message: 'Retreat action must contain exactly the current required retreaters.', details: { requiredUnitIds: requiredIds, missingUnitIds: missing, unexpectedUnitIds: extras } });
    const participants = new Set(originalParticipantsForSide(tx, retreat.side));
    const nonParticipants = providedIds.filter(id => !participants.has(id));
    if (nonParticipants.length)
        issues.push({ code: 'INVALID_RETREAT', message: 'Retreat may contain only original combat participants for the retreating side.', details: { unitIds: [...new Set(nonParticipants)] } });
    if (issues.length)
        return { issues, outcomes: [], failed: false };
    // Ordered simulation is isolated from authoritative state so rejected actions are mutation-free.
    const sim = structuredClone(state);
    const outcomes = [];
    let failed = false;
    for (const ordered of action.retreats) {
        const unit = sim.units[ordered.unitId];
        if (!unit || !unit.alive || unit.side !== retreat.side) {
            issues.push({ code: 'INVALID_RETREAT', message: 'Required retreater must still be a living unit on the retreating side.', unitId: ordered.unitId });
            break;
        }
        const maximum = getMaxLegalRetreatDistance(sim, rules, unit, retreat.steps);
        if (ordered.path.length !== maximum) {
            issues.push({ code: 'INVALID_RETREAT', message: 'Retreat path must execute the maximum legal distance available in the submitted unit order.', unitId: unit.id, details: { requiredSteps: retreat.steps, maximumLegalSteps: maximum, providedSteps: ordered.path.length } });
            break;
        }
        if (ordered.path.length > retreat.steps) {
            issues.push({ code: 'INVALID_RETREAT', message: 'Retreat path exceeds the required retreat distance.', unitId: unit.id, details: { requiredSteps: retreat.steps, providedSteps: ordered.path.length } });
            break;
        }
        const from = { ...unit.hex };
        let cursor = { ...unit.hex };
        for (const destination of ordered.path) {
            const step = validateRetreatStep(sim, rules, unit, cursor, destination);
            if (!step.legal) {
                issues.push({ code: 'INVALID_RETREAT', message: 'Submitted retreat path contains an illegal step.', unitId: unit.id, hex: { ...destination }, details: { stepIssues: step.issues.map(x => x.code) } });
                break;
            }
            unit.hex = { ...destination };
            cursor = { ...destination };
        }
        if (issues.length)
            break;
        if (ordered.path.length > 0) {
            unit.entrenched = false;
            unit.hasMoved = true;
        }
        const completedSteps = ordered.path.length;
        if (completedSteps < retreat.steps)
            failed = true;
        outcomes.push({ unitId: unit.id, from, to: { ...unit.hex }, path: ordered.path.map(h => ({ ...h })), completedSteps, requiredSteps: retreat.steps });
    }
    return { issues, outcomes: issues.length ? [] : outcomes, failed: issues.length ? false : failed };
}
export function applyOrderedRetreat(state, rules, action, actionId) {
    const tx = state.combatTransactions[action.battleId];
    if (!tx)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${action.battleId}.` }], events: [] };
    if (tx.stage !== 'RETREAT')
        return { issues: [{ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting retreat.', details: { stage: tx.stage } }], events: [] };
    const checked = validateOrderedRetreat(state, rules, tx, action);
    if (checked.issues.length)
        return { issues: checked.issues, events: [] };
    const retreat = tx.retreat;
    const events = [];
    for (const outcome of checked.outcomes) {
        const unit = state.units[outcome.unitId];
        unit.hex = { ...outcome.to };
        if (outcome.completedSteps > 0) {
            unit.entrenched = false;
            unit.hasMoved = true;
            events.push({ type: 'UnitRetreated', actionId, battleId: tx.battleId, unitId: unit.id, from: { ...outcome.from }, to: { ...outcome.to }, path: outcome.path.map(h => ({ ...h })), requiredSteps: outcome.requiredSteps, completedSteps: outcome.completedSteps });
        }
    }
    retreat.resolved = true;
    retreat.impossible = checked.failed;
    state.pendingDecision = null;
    if (checked.failed && !tx.retreatImpossibleExtraLossApplied) {
        tx.retreatImpossibleExtraLossApplied = true;
        const eligibleUnitIds = originalParticipantsForSide(tx, retreat.side).filter(id => state.units[id]?.alive);
        tx.unresolvedLosses.push({ side: retreat.side, steps: 1, eligibleUnitIds, reason: 'RETREAT_IMPOSSIBLE' });
        events.push({ type: 'RetreatImpossible', actionId, battleId: tx.battleId, side: retreat.side, extraLossSteps: 1 });
    }
    continueCombatAfterLosses(state, rules, tx, actionId, events);
    return { issues: [], events };
}
function advanceBaseChecks(state, tx) {
    if (!tx)
        return [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: 'Unknown combat transaction.' }];
    if (tx.stage !== 'ADVANCE_AFTER_COMBAT')
        return [{ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting Advance After Combat.', details: { stage: tx.stage } }];
    if (!tx.advance || tx.advance.resolved)
        return [{ code: 'INVALID_ADVANCE', message: 'Combat has no unresolved Advance After Combat option.' }];
    const targetStillDefended = Object.values(state.units).some(u => u.alive && u.side === tx.defenderSide && hexKey(u.hex) === hexKey(tx.targetHex));
    if (targetStillDefended)
        return [{ code: 'INVALID_ADVANCE', message: 'Advance After Combat requires the original target hex to contain no surviving defender.', hex: { ...tx.targetHex } }];
    return [];
}
export function applyAdvanceAfterCombat(state, rules, action, actionId) {
    const tx = state.combatTransactions[action.battleId];
    const issues = advanceBaseChecks(state, tx);
    if (issues.length || !tx)
        return { issues, events: [] };
    const advance = tx.advance;
    const unit = state.units[action.unitId];
    if (!unit)
        return { issues: [{ code: 'UNIT_NOT_FOUND', message: 'Unknown advancing unit.', unitId: action.unitId }], events: [] };
    if (!unit.alive)
        return { issues: [{ code: 'UNIT_DESTROYED', message: 'Destroyed unit cannot advance after combat.', unitId: unit.id }], events: [] };
    if (!tx.attackerUnitIds.includes(unit.id) || !advance.eligibleUnitIds.includes(unit.id))
        return { issues: [{ code: 'INVALID_ADVANCE', message: 'Selected unit is not an eligible original direct attacker for this battle.', unitId: unit.id }], events: [] };
    if (unit.type === 'ARTILLERY')
        return { issues: [{ code: 'INVALID_ADVANCE', message: 'Artillery support cannot Advance After Combat.', unitId: unit.id }], events: [] };
    if (hexDistance(unit.hex, tx.targetHex) !== 1)
        return { issues: [{ code: 'NOT_ADJACENT_TO_TARGET', message: 'Advancing unit must still be adjacent to the original target hex.', unitId: unit.id, hex: { ...tx.targetHex } }], events: [] };
    const stacking = stackingIssueForDestination(state, rules, unit, tx.targetHex);
    if (stacking)
        return { issues: [stacking], events: [] };
    const from = { ...unit.hex };
    unit.hex = { ...tx.targetHex };
    unit.hasMoved = true;
    unit.entrenched = false;
    advance.advancedUnitIds = [unit.id];
    advance.resolved = true;
    state.pendingDecision = null;
    const events = [{ type: 'UnitAdvanced', actionId, battleId: tx.battleId, unitId: unit.id, from, to: { ...tx.targetHex } }];
    prepareBreakthroughOrClose(state, rules, tx, actionId, events);
    return { issues: [], events };
}
export function applyPassAdvance(state, rules, action, actionId) {
    const tx = state.combatTransactions[action.battleId];
    const issues = advanceBaseChecks(state, tx);
    if (issues.length || !tx)
        return { issues, events: [] };
    tx.advance.advancedUnitIds = [];
    tx.advance.resolved = true;
    state.pendingDecision = null;
    const events = [];
    prepareBreakthroughOrClose(state, rules, tx, actionId, events);
    return { issues: [], events };
}
export function applyBreakthrough(state, rules, action, actionId) {
    const checked = analyzeBreakthroughAction(state, rules, action);
    if (checked.issues.length)
        return { issues: checked.issues, events: [] };
    const tx = state.combatTransactions[action.battleId];
    const bt = tx.breakthrough;
    const unit = state.units[action.unitId];
    const events = [];
    const moved = action.path.length > 0;
    if (moved) {
        const from = { ...unit.hex };
        unit.hex = { ...checked.destination };
        unit.hasMoved = true;
        unit.entrenched = false;
        events.push({ type: 'UnitBrokeThrough', actionId, battleId: tx.battleId, unitId: unit.id, from, to: { ...unit.hex }, path: action.path.map(h => ({ ...h })) });
    }
    if (!bt.completedUnitIds.includes(unit.id))
        bt.completedUnitIds.push(unit.id);
    const remaining = bt.eligibleUnitIds.filter(id => !bt.completedUnitIds.includes(id));
    if (remaining.length > 0) {
        tx.stage = 'BREAKTHROUGH_OPTION';
        state.pendingDecision = pendingForBreakthrough(state, tx, remaining);
        return { issues: [], events };
    }
    bt.resolved = true;
    prepareSchwerpunktOrClose(state, rules, tx, actionId, events, moved ? unit.id : null);
    return { issues: [], events };
}
export function applyPassBreakthrough(state, rules, action, actionId) {
    const tx = state.combatTransactions[action.battleId];
    if (!tx)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${action.battleId}.` }], events: [] };
    if (tx.stage !== 'BREAKTHROUGH_OPTION')
        return { issues: [{ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting Breakthrough.', details: { stage: tx.stage } }], events: [] };
    if (!tx.breakthrough || tx.breakthrough.resolved)
        return { issues: [{ code: 'INVALID_BREAKTHROUGH', message: 'Combat has no unresolved Breakthrough option.' }], events: [] };
    tx.breakthrough.resolved = true;
    state.pendingDecision = null;
    const events = [];
    prepareSchwerpunktOrClose(state, rules, tx, actionId, events);
    return { issues: [], events };
}
export function applyLossAllocation(state, rules, action, actionId) {
    const tx = state.combatTransactions[action.battleId];
    if (!tx)
        return { issues: [{ code: 'COMBAT_TRANSACTION_NOT_FOUND', message: `Unknown combat transaction ${action.battleId}.` }], events: [] };
    if (tx.stage !== 'LOSS_ALLOCATION')
        return { issues: [{ code: 'COMBAT_STAGE_MISMATCH', message: 'Combat is not awaiting loss allocation.', details: { stage: tx.stage } }], events: [] };
    const req = tx.unresolvedLosses[0];
    if (!req)
        return { issues: [{ code: 'INVALID_LOSS_ALLOCATION', message: 'Combat has no unresolved loss requirement.' }], events: [] };
    const issues = validateLossAllocationSequence(state, rules, req, action.unitIdsByStep);
    if (issues.length)
        return { issues, events: [] };
    const events = [];
    const applied = applyLossSequence(state, rules, tx.battleId, req.side, action.unitIdsByStep, actionId, false);
    recordLosses(tx, req.side, applied.allocations);
    events.push(...applied.events);
    tx.unresolvedLosses.shift();
    continueCombatAfterLosses(state, rules, tx, actionId, events);
    return { issues: [], events };
}
export function passDefenderReactionAndResolve(state, rules, action, actionId) {
    const base = reactionBaseChecks(state, action.battleId);
    if (base.issues.length || !base.tx)
        return { issues: base.issues, events: [] };
    const tx = base.tx;
    if (tx.defenderReactionPassed)
        return { issues: [{ code: 'INVALID_REACTION', message: 'Defender reaction window has already been passed.' }], events: [] };
    tx.defenderReactionPassed = true;
    const events = [{ type: 'CombatReactionPassed', actionId, battleId: tx.battleId, controllerId: action.controllerId }];
    const synthetic = { type: 'ATTACK', actionId: tx.declaredByActionId, controllerId: tx.declaringControllerId, battleId: tx.battleId, attackerUnitIds: [...tx.attackerUnitIds], target: { ...tx.targetHex }, commitmentIds: [...tx.commitmentIds], ...(tx.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: tx.attackerArtilleryUnitId } } : {}) };
    const reaction = { ...(tx.defenderArtilleryUnitId ? { defenderArtilleryUnitId: tx.defenderArtilleryUnitId } : {}), ...(tx.defenderHQEffect?.command === 'LAST_STAND' ? { defenderHQCommand: 'LAST_STAND' } : {}) };
    const context = buildCombatContext(state, rules, synthetic, reaction);
    tx.context = context;
    const rng = new SeededRNG(state.random);
    const die1 = rng.rollDie(6), die2 = rng.rollDie(6), total = die1 + die2;
    state.random = rng.snapshot();
    const crtResult = resolveCRTResult(total, context.finalCRTColumn, rules);
    const parsed = parseCRTResult(crtResult);
    let attackerLossSteps = parsed.attackerLossSteps, defenderLossSteps = parsed.defenderLossSteps, attackerRetreatSteps = parsed.attackerRetreatSteps, defenderRetreatSteps = parsed.defenderRetreatSteps, retreatConvertedToLoss = false;
    if (tx.defenderHQEffect?.command === 'LAST_STAND' && defenderRetreatSteps > 0) {
        defenderRetreatSteps = 0;
        defenderLossSteps += 1;
        retreatConvertedToLoss = true;
    }
    tx.resolution = { dice: { die1, die2, total }, crtResult, attackerLossSteps, defenderLossSteps, attackerRetreatSteps, defenderRetreatSteps, retreatConvertedToLoss };
    events.push({ type: 'DiceRolled', actionId, battleId: tx.battleId, die1, die2, total }, { type: 'CRTResolved', actionId, battleId: tx.battleId, result: crtResult, finalCRTColumn: context.finalCRTColumn, finalCRTColumnLabel: context.finalCRTColumnLabel });
    tx.unresolvedLosses = [];
    if (attackerLossSteps > 0)
        tx.unresolvedLosses.push({ side: tx.attackerSide, steps: attackerLossSteps, eligibleUnitIds: [...tx.attackerUnitIds], reason: 'CRT' });
    if (defenderLossSteps > 0)
        tx.unresolvedLosses.push({ side: tx.defenderSide, steps: defenderLossSteps, eligibleUnitIds: [...tx.defenderUnitIds], reason: retreatConvertedToLoss && parsed.defenderLossSteps === 0 ? 'RETREAT_CONVERSION' : 'CRT' });
    tx.retreat = attackerRetreatSteps > 0 ? { side: tx.attackerSide, steps: attackerRetreatSteps, unitIds: [...tx.attackerUnitIds], resolved: false, impossible: false } : defenderRetreatSteps > 0 ? { side: tx.defenderSide, steps: defenderRetreatSteps, unitIds: [...tx.defenderUnitIds], resolved: false, impossible: false } : null;
    continueCombatAfterLosses(state, rules, tx, actionId, events);
    return { issues: [], events };
}
