import { canonicalEdgeKey } from '../core/edge.js';
import { hexDistance, hexKey } from '../core/hex.js';
import { findDuplicates } from '../core/collections.js';
import { phaseSide } from '../rules/turn.js';
import { deriveSovietReinforcementSlots } from '../rules/reinforcement.js';
import { deploymentHexKeysForSide, isDeploymentPhase } from '../rules/deployment.js';
function issue(code, message, details) {
    return details ? { code, message, details } : { code, message };
}
/** Debug/test invariant audit. It never mutates state. */
export function validateGameStateIntegrity(state, rules, scenario) {
    const issues = [];
    const unitIds = Object.values(state.units).map((u) => u.id);
    for (const duplicate of findDuplicates(unitIds))
        issues.push(issue('DUPLICATE_UNIT_ID', 'Two unit records expose the same UnitState.id.', { unitId: duplicate }));
    for (const [key, unit] of Object.entries(state.units)) {
        if (key !== unit.id)
            issues.push(issue('UNIT_KEY_ID_MISMATCH', 'Unit record key differs from UnitState.id.', { key, unitId: unit.id }));
        if (!state.hexes[hexKey(unit.hex)])
            issues.push(issue('UNIT_HEX_INVALID', 'Unit points to a hex not present on the board.', { unitId: unit.id, hex: unit.hex }));
        const template = rules.unitTemplates[unit.templateId];
        if (!template)
            issues.push(issue('UNIT_TEMPLATE_INVALID', 'Unit templateId does not exist in GameRules.', { unitId: unit.id, templateId: unit.templateId }));
        else {
            if (template.side !== unit.side)
                issues.push(issue('UNIT_TEMPLATE_SIDE_MISMATCH', 'Unit side differs from its template side.', { unitId: unit.id, unitSide: unit.side, templateSide: template.side, templateId: unit.templateId }));
            if (template.type !== unit.type)
                issues.push(issue('UNIT_TEMPLATE_TYPE_MISMATCH', 'Unit type differs from its template type.', { unitId: unit.id, unitType: unit.type, templateType: template.type, templateId: unit.templateId }));
        }
        const controller = state.controllers[unit.controllerId];
        if (!controller)
            issues.push(issue('UNIT_CONTROLLER_INVALID', 'Unit points to a missing controller.', { unitId: unit.id, controllerId: unit.controllerId }));
        else if (controller.side !== unit.side)
            issues.push(issue('UNIT_CONTROLLER_SIDE_MISMATCH', 'Unit and canonical controller are on different sides.', { unitId: unit.id, controllerId: controller.id }));
    }
    const controllerIds = Object.values(state.controllers).map((c) => c.id);
    for (const duplicate of findDuplicates(controllerIds))
        issues.push(issue('DUPLICATE_CONTROLLER_ID', 'Two controller records expose the same id.', { controllerId: duplicate }));
    for (const [key, controller] of Object.entries(state.controllers)) {
        if (key !== controller.id)
            issues.push(issue('CONTROLLER_KEY_ID_MISMATCH', 'Controller record key differs from controller.id.', { key, controllerId: controller.id }));
    }
    const stacks = new Map();
    for (const unit of Object.values(state.units)) {
        if (!unit.alive)
            continue;
        const key = hexKey(unit.hex);
        const list = stacks.get(key) ?? [];
        list.push(unit.id);
        stacks.set(key, list);
    }
    for (const [hex, unitIdsAtHex] of stacks) {
        if (unitIdsAtHex.length > rules.stackingLimit)
            issues.push(issue('STACKING_LIMIT', 'Internal state exceeds stacking limit.', { hex, unitIds: unitIdsAtHex, limit: rules.stackingLimit }));
    }
    const canonicalEdges = new Map();
    for (const [recordKey, edge] of Object.entries(state.edges)) {
        const aKey = hexKey(edge.a), bKey = hexKey(edge.b);
        if (!state.hexes[aKey] || !state.hexes[bKey])
            issues.push(issue('EDGE_ENDPOINT_INVALID', 'HexEdge endpoint does not exist on board.', { edgeKey: recordKey, a: aKey, b: bKey }));
        if (hexDistance(edge.a, edge.b) !== 1)
            issues.push(issue('EDGE_NOT_ADJACENT', 'HexEdge endpoints must be adjacent.', { edgeKey: recordKey, a: aKey, b: bKey }));
        const canonical = canonicalEdgeKey(edge.a, edge.b);
        if (edge.key !== canonical || recordKey !== canonical)
            issues.push(issue('EDGE_KEY_NONCANONICAL', 'HexEdge key/record key is not canonical.', { recordKey, edgeKey: edge.key, canonical }));
        const prior = canonicalEdges.get(canonical);
        if (prior && prior !== recordKey)
            issues.push(issue('DUPLICATE_CANONICAL_EDGE', 'Same canonical edge is stored more than once.', { canonical, recordKeys: [prior, recordKey] }));
        canonicalEdges.set(canonical, recordKey);
        if (edge.railway && edge.railway.repairedBy !== null && edge.railway.present !== true) {
            issues.push(issue('RAILWAY_REPAIR_WITHOUT_TRACK', 'A railway edge cannot be repaired by a side when railway.present is false.', { edgeKey: recordKey, repairedBy: edge.railway.repairedBy }));
        }
    }
    const readyDuplicates = findDuplicates(state.phaseReadyControllerIds);
    for (const duplicate of readyDuplicates)
        issues.push(issue('DUPLICATE_PHASE_READY_CONTROLLER', 'Controller appears more than once in ready barrier.', { controllerId: duplicate }));
    for (const controllerId of state.phaseReadyControllerIds) {
        const controller = state.controllers[controllerId];
        if (!controller)
            issues.push(issue('PHASE_READY_CONTROLLER_INVALID', 'Ready barrier references a missing controller.', { controllerId }));
        else if (controller.side !== state.activeSide)
            issues.push(issue('PHASE_READY_WRONG_SIDE', 'Ready barrier contains non-active-side controller.', { controllerId, side: controller.side, activeSide: state.activeSide }));
    }
    if (state.pendingDecision) {
        const d = state.pendingDecision;
        const owner = state.controllers[d.decisionOwnerControllerId];
        if (!owner)
            issues.push(issue('PENDING_OWNER_INVALID', 'PendingDecision owner controller does not exist.', { controllerId: d.decisionOwnerControllerId }));
        else if (owner.side !== d.side)
            issues.push(issue('PENDING_OWNER_SIDE_MISMATCH', 'PendingDecision owner controller is on the wrong side.', { controllerId: owner.id, decisionSide: d.side }));
        const eligibleDuplicates = findDuplicates(d.eligibleControllerIds);
        for (const duplicate of eligibleDuplicates)
            issues.push(issue('PENDING_ELIGIBLE_DUPLICATE', 'PendingDecision eligible controller ids must be unique.', { controllerId: duplicate }));
        for (const controllerId of d.eligibleControllerIds) {
            const controller = state.controllers[controllerId];
            if (!controller)
                issues.push(issue('PENDING_ELIGIBLE_INVALID', 'PendingDecision eligible controller does not exist.', { controllerId }));
            else if (controller.side !== d.side)
                issues.push(issue('PENDING_ELIGIBLE_SIDE_MISMATCH', 'PendingDecision eligible controller is on wrong side.', { controllerId }));
        }
        if (!d.eligibleControllerIds.includes(d.decisionOwnerControllerId))
            issues.push(issue('PENDING_OWNER_NOT_ELIGIBLE', 'PendingDecision owner should be included in eligibleControllerIds.', { controllerId: d.decisionOwnerControllerId }));
    }
    for (const [commitmentId, commitment] of Object.entries(state.unitCommitments)) {
        if (commitmentId !== commitment.id)
            issues.push(issue('COMMITMENT_KEY_ID_MISMATCH', 'Commitment record key differs from commitment.id.', { commitmentId, recordId: commitment.id }));
        const grantor = state.controllers[commitment.grantorControllerId];
        const authorized = state.controllers[commitment.authorizedControllerId];
        if (!grantor || !authorized)
            issues.push(issue('COMMITMENT_CONTROLLER_INVALID', 'Commitment references a missing controller.', { commitmentId }));
        else if (grantor.side !== authorized.side)
            issues.push(issue('COMMITMENT_SIDE_MISMATCH', 'Commitment crosses sides.', { commitmentId }));
        for (const duplicate of findDuplicates(commitment.unitIds))
            issues.push(issue('COMMITMENT_DUPLICATE_UNIT', 'Commitment unitIds must be unique.', { commitmentId, unitId: duplicate }));
        for (const unitId of commitment.unitIds) {
            const unit = state.units[unitId];
            if (!unit)
                issues.push(issue('COMMITMENT_UNIT_INVALID', 'Commitment references missing unit.', { commitmentId, unitId }));
            else if (unit.controllerId !== commitment.grantorControllerId)
                issues.push(issue('COMMITMENT_OWNER_MISMATCH', 'Commitment grantor is no longer canonical unit owner.', { commitmentId, unitId, unitControllerId: unit.controllerId }));
        }
    }
    const expectedStageByPending = {
        DEFENDER_REACTION: 'DEFENDER_REACTION', LOSS_ALLOCATION: 'LOSS_ALLOCATION', RETREAT: 'RETREAT',
        ADVANCE_AFTER_COMBAT: 'ADVANCE_AFTER_COMBAT', BREAKTHROUGH_OPTION: 'BREAKTHROUGH_OPTION', SCHWERPUNKT_OPTION: 'SCHWERPUNKT_OPTION'
    };
    for (const [recordBattleId, tx] of Object.entries(state.combatTransactions)) {
        if (recordBattleId !== tx.battleId)
            issues.push(issue('COMBAT_KEY_ID_MISMATCH', 'CombatTransaction record key differs from transaction battleId.', { recordBattleId, battleId: tx.battleId }));
        for (const duplicate of findDuplicates(tx.attackerUnitIds))
            issues.push(issue('COMBAT_DUPLICATE_ATTACKER', 'CombatTransaction attackerUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
        for (const duplicate of findDuplicates(tx.defenderUnitIds))
            issues.push(issue('COMBAT_DUPLICATE_DEFENDER', 'CombatTransaction defenderUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
        for (const unitId of [...tx.attackerUnitIds, ...tx.defenderUnitIds])
            if (!state.units[unitId])
                issues.push(issue('COMBAT_UNIT_INVALID', 'CombatTransaction references a missing unit.', { battleId: tx.battleId, unitId }));
        if (tx.sourceBattleId && !state.combatTransactions[tx.sourceBattleId])
            issues.push(issue('COMBAT_SOURCE_BATTLE_INVALID', 'CombatTransaction sourceBattleId does not exist.', { battleId: tx.battleId, sourceBattleId: tx.sourceBattleId }));
        if (tx.isSchwerpunktSecondAttack) {
            const source = tx.sourceBattleId ? state.combatTransactions[tx.sourceBattleId] : undefined;
            if (!tx.sourceBattleId)
                issues.push(issue('SCHWERPUNKT_CHILD_SOURCE_MISSING', 'Schwerpunkt child must reference its source battle.', { battleId: tx.battleId }));
            if (tx.attackerUnitIds.length !== 1)
                issues.push(issue('SCHWERPUNKT_CHILD_ATTACKER_COUNT', 'Schwerpunkt child must contain exactly one direct attacker.', { battleId: tx.battleId, attackerUnitIds: [...tx.attackerUnitIds] }));
            if (tx.breakthrough)
                issues.push(issue('SCHWERPUNKT_CHILD_BREAKTHROUGH_FORBIDDEN', 'Schwerpunkt child must never contain Breakthrough state.', { battleId: tx.battleId }));
            if (tx.schwerpunkt || tx.stage === 'SCHWERPUNKT_OPTION' || tx.stage === 'BREAKTHROUGH_OPTION')
                issues.push(issue('SCHWERPUNKT_CHILD_RECURSION_FORBIDDEN', 'Schwerpunkt child may not enter Breakthrough or another Schwerpunkt option.', { battleId: tx.battleId, stage: tx.stage }));
            if (source) {
                const sp = source.schwerpunkt;
                if (!sp || !sp.resolved || sp.childBattleId !== tx.battleId)
                    issues.push(issue('SCHWERPUNKT_SOURCE_CHILD_MISMATCH', 'Source Schwerpunkt state must resolve to this child battle.', { battleId: tx.battleId, sourceBattleId: source.battleId }));
                else {
                    if (!sp.selectedUnitId || !sp.eligibleUnitIds.includes(sp.selectedUnitId))
                        issues.push(issue('SCHWERPUNKT_SOURCE_SELECTED_INVALID', 'Source selected Schwerpunkt unit must come from eligibleUnitIds.', { sourceBattleId: source.battleId, selectedUnitId: sp.selectedUnitId }));
                    if (sp.selectedUnitId && (tx.attackerUnitIds.length !== 1 || tx.attackerUnitIds[0] !== sp.selectedUnitId))
                        issues.push(issue('SCHWERPUNKT_CHILD_ATTACKER_MISMATCH', 'Child direct attacker must equal source selected Schwerpunkt unit.', { battleId: tx.battleId, selectedUnitId: sp.selectedUnitId, attackerUnitIds: [...tx.attackerUnitIds] }));
                    const selected = sp.selectedUnitId ? state.units[sp.selectedUnitId] : undefined;
                    if (selected && selected.controllerId !== source.declaringControllerId) {
                        const inherited = tx.commitmentIds.map(id => state.unitCommitments[id]).find(c => c && c.battleId === tx.battleId && c.grantorControllerId === selected.controllerId && c.authorizedControllerId === source.declaringControllerId && c.unitIds.includes(selected.id));
                        if (!inherited)
                            issues.push(issue('SCHWERPUNKT_CHILD_AUTHORITY_MISSING', 'Committed teammate Schwerpunkt armor requires inherited child commitment authority.', { battleId: tx.battleId, unitId: selected.id, ownerControllerId: selected.controllerId, authorizedControllerId: source.declaringControllerId }));
                    }
                }
            }
            const declaration = state.actionLog.find(entry => entry.accepted && entry.action.type === 'SCHWERPUNKT_ATTACK' && entry.battleId === tx.battleId);
            if (declaration?.turn === state.turn && state.schwerpunktUsedOnTurn !== state.turn)
                issues.push(issue('SCHWERPUNKT_USED_TURN_MISMATCH', 'Successful Schwerpunkt declaration this turn must mark schwerpunktUsedOnTurn.', { battleId: tx.battleId, turn: state.turn, schwerpunktUsedOnTurn: state.schwerpunktUsedOnTurn }));
        }
        if (tx.stage === 'CLOSED' && state.pendingDecision?.battleId === tx.battleId)
            issues.push(issue('CLOSED_COMBAT_HAS_PENDING', 'Closed combat transaction may not own a PendingDecision.', { battleId: tx.battleId }));
        for (const commitmentId of tx.commitmentIds) {
            const commitment = state.unitCommitments[commitmentId];
            if (!commitment)
                issues.push(issue('COMBAT_COMMITMENT_INVALID', 'CombatTransaction references a missing commitment.', { battleId: tx.battleId, commitmentId }));
            else if (commitment.battleId !== tx.battleId)
                issues.push(issue('COMBAT_COMMITMENT_BATTLE_MISMATCH', 'CombatTransaction commitment belongs to another battle.', { battleId: tx.battleId, commitmentId, commitmentBattleId: commitment.battleId }));
            else if (tx.stage !== 'CLOSED' && !commitment.active)
                issues.push(issue('ACTIVE_COMBAT_COMMITMENT_INACTIVE', 'Battle-scoped commitment must remain active until CombatTransaction is CLOSED.', { battleId: tx.battleId, commitmentId, stage: tx.stage }));
            else if (tx.stage === 'CLOSED' && commitment.active)
                issues.push(issue('CLOSED_COMBAT_COMMITMENT_ACTIVE', 'Battle-scoped commitment must be deactivated when CombatTransaction closes.', { battleId: tx.battleId, commitmentId }));
        }
        if (tx.stage === 'RETREAT' && !tx.retreat)
            issues.push(issue('COMBAT_RETREAT_STATE_MISSING', 'RETREAT stage requires a CombatRetreatRequirement.', { battleId: tx.battleId }));
        if (tx.retreat) {
            const participants = new Set(tx.retreat.side === tx.attackerSide ? tx.attackerUnitIds : tx.defenderUnitIds);
            for (const duplicate of findDuplicates(tx.retreat.unitIds))
                issues.push(issue('COMBAT_RETREAT_DUPLICATE_UNIT', 'CombatRetreatRequirement unitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            for (const unitId of tx.retreat.unitIds) {
                const unit = state.units[unitId];
                if (!participants.has(unitId))
                    issues.push(issue('COMBAT_RETREAT_NONPARTICIPANT', 'Retreat requirement references a unit outside the original battle participants.', { battleId: tx.battleId, unitId, side: tx.retreat.side }));
                if (unit && unit.side !== tx.retreat.side)
                    issues.push(issue('COMBAT_RETREAT_SIDE_MISMATCH', 'Retreat requirement unit is on the wrong side.', { battleId: tx.battleId, unitId, unitSide: unit.side, retreatSide: tx.retreat.side }));
            }
            const ownsRetreatPending = state.pendingDecision?.battleId === tx.battleId && state.pendingDecision.kind === 'RETREAT';
            if (tx.stage === 'RETREAT' && (tx.retreat.resolved || !ownsRetreatPending))
                issues.push(issue('COMBAT_RETREAT_PENDING_MISMATCH', 'RETREAT stage requires an unresolved retreat and matching RETREAT PendingDecision.', { battleId: tx.battleId, resolved: tx.retreat.resolved, hasMatchingPending: ownsRetreatPending }));
            if (tx.retreat.resolved && ownsRetreatPending)
                issues.push(issue('RESOLVED_RETREAT_HAS_PENDING', 'Resolved retreat may not retain a RETREAT PendingDecision.', { battleId: tx.battleId }));
            if (tx.retreatImpossibleExtraLossApplied && (!tx.retreat.resolved || !tx.retreat.impossible))
                issues.push(issue('RETREAT_IMPOSSIBLE_FLAG_INVALID', 'Retreat Impossible extra loss flag requires a resolved impossible retreat.', { battleId: tx.battleId, resolved: tx.retreat.resolved, impossible: tx.retreat.impossible }));
        }
        else if (tx.retreatImpossibleExtraLossApplied) {
            issues.push(issue('RETREAT_IMPOSSIBLE_WITHOUT_RETREAT', 'Retreat Impossible extra loss cannot exist without a retreat requirement.', { battleId: tx.battleId }));
        }
        const retreatImpossibleLosses = tx.unresolvedLosses.filter(req => req.reason === 'RETREAT_IMPOSSIBLE');
        if (retreatImpossibleLosses.length > 1)
            issues.push(issue('RETREAT_IMPOSSIBLE_LOSS_DUPLICATE', 'A combat side may have at most one unresolved Retreat Impossible extra loss.', { battleId: tx.battleId, count: retreatImpossibleLosses.length }));
        if (retreatImpossibleLosses.length > 0 && !tx.retreatImpossibleExtraLossApplied)
            issues.push(issue('RETREAT_IMPOSSIBLE_LOSS_FLAG_MISSING', 'Retreat Impossible loss requirement must be guarded by retreatImpossibleExtraLossApplied.', { battleId: tx.battleId }));
        if (tx.stage === 'ADVANCE_AFTER_COMBAT' && !tx.advance)
            issues.push(issue('COMBAT_ADVANCE_STATE_MISSING', 'ADVANCE_AFTER_COMBAT stage requires CombatAdvanceState.', { battleId: tx.battleId }));
        if (tx.advance) {
            for (const duplicate of findDuplicates(tx.advance.eligibleUnitIds))
                issues.push(issue('COMBAT_ADVANCE_DUPLICATE_ELIGIBLE', 'Advance eligibleUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            for (const duplicate of findDuplicates(tx.advance.advancedUnitIds))
                issues.push(issue('COMBAT_ADVANCE_DUPLICATE_ADVANCED', 'Advance advancedUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            if (tx.advance.advancedUnitIds.length > 1)
                issues.push(issue('COMBAT_ADVANCE_TOO_MANY_UNITS', 'Normal Advance After Combat may advance at most one unit.', { battleId: tx.battleId, advancedUnitIds: [...tx.advance.advancedUnitIds] }));
            for (const unitId of tx.advance.eligibleUnitIds)
                if (!tx.attackerUnitIds.includes(unitId))
                    issues.push(issue('COMBAT_ADVANCE_ELIGIBLE_NONATTACKER', 'Advance eligibility must contain only original direct attackers.', { battleId: tx.battleId, unitId }));
            for (const unitId of tx.advance.advancedUnitIds) {
                const unit = state.units[unitId];
                if (!tx.attackerUnitIds.includes(unitId))
                    issues.push(issue('COMBAT_ADVANCE_NONATTACKER', 'Advanced unit must be an original direct attacker.', { battleId: tx.battleId, unitId }));
                if (!tx.advance.eligibleUnitIds.includes(unitId))
                    issues.push(issue('COMBAT_ADVANCE_NOT_ELIGIBLE', 'Advanced unit must come from CombatAdvanceState.eligibleUnitIds.', { battleId: tx.battleId, unitId }));
                if (unit && hexKey(unit.hex) !== hexKey(tx.targetHex))
                    issues.push(issue('COMBAT_ADVANCE_POSITION_INVALID', 'Advanced unit must occupy the original target hex after normal advance.', { battleId: tx.battleId, unitId, unitHex: unit.hex, targetHex: tx.targetHex }));
            }
            const ownsAdvancePending = state.pendingDecision?.battleId === tx.battleId && state.pendingDecision.kind === 'ADVANCE_AFTER_COMBAT';
            if (tx.stage === 'ADVANCE_AFTER_COMBAT' && (tx.advance.resolved || !ownsAdvancePending))
                issues.push(issue('COMBAT_ADVANCE_PENDING_MISMATCH', 'ADVANCE_AFTER_COMBAT stage requires unresolved advance state and matching PendingDecision.', { battleId: tx.battleId, resolved: tx.advance.resolved, hasMatchingPending: ownsAdvancePending }));
            if (tx.advance.resolved && ownsAdvancePending)
                issues.push(issue('RESOLVED_ADVANCE_HAS_PENDING', 'Resolved Advance After Combat may not retain an ADVANCE_AFTER_COMBAT PendingDecision.', { battleId: tx.battleId }));
        }
        if (tx.stage === 'BREAKTHROUGH_OPTION' && !tx.breakthrough)
            issues.push(issue('COMBAT_BREAKTHROUGH_STATE_MISSING', 'BREAKTHROUGH_OPTION stage requires CombatBreakthroughState.', { battleId: tx.battleId }));
        if (tx.breakthrough) {
            for (const duplicate of findDuplicates(tx.breakthrough.eligibleUnitIds))
                issues.push(issue('COMBAT_BREAKTHROUGH_DUPLICATE_ELIGIBLE', 'Breakthrough eligibleUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            for (const duplicate of findDuplicates(tx.breakthrough.completedUnitIds))
                issues.push(issue('COMBAT_BREAKTHROUGH_DUPLICATE_COMPLETED', 'Breakthrough completedUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            const eligible = new Set(tx.breakthrough.eligibleUnitIds);
            for (const unitId of tx.breakthrough.eligibleUnitIds)
                if (!tx.attackerUnitIds.includes(unitId))
                    issues.push(issue('COMBAT_BREAKTHROUGH_ELIGIBLE_NONATTACKER', 'Breakthrough eligibility must contain only original direct attackers.', { battleId: tx.battleId, unitId }));
            for (const unitId of tx.breakthrough.completedUnitIds)
                if (!eligible.has(unitId))
                    issues.push(issue('COMBAT_BREAKTHROUGH_COMPLETED_NONELIGIBLE', 'Breakthrough completedUnitIds must be a subset of eligibleUnitIds.', { battleId: tx.battleId, unitId }));
            for (const unitId of Object.keys(tx.breakthrough.maxHexesByUnitId))
                if (!eligible.has(unitId))
                    issues.push(issue('COMBAT_BREAKTHROUGH_MAX_NONELIGIBLE', 'maxHexesByUnitId may contain only breakthrough-eligible units.', { battleId: tx.battleId, unitId }));
            for (const unitId of tx.breakthrough.eligibleUnitIds)
                if (!(unitId in tx.breakthrough.maxHexesByUnitId))
                    issues.push(issue('COMBAT_BREAKTHROUGH_MAX_MISSING', 'Every breakthrough-eligible unit requires a maxHexesByUnitId entry.', { battleId: tx.battleId, unitId }));
            const ownsBreakthroughPending = state.pendingDecision?.battleId === tx.battleId && state.pendingDecision.kind === 'BREAKTHROUGH_OPTION';
            if (tx.stage === 'BREAKTHROUGH_OPTION' && (tx.breakthrough.resolved || !ownsBreakthroughPending))
                issues.push(issue('COMBAT_BREAKTHROUGH_PENDING_MISMATCH', 'BREAKTHROUGH_OPTION stage requires unresolved breakthrough state and matching PendingDecision.', { battleId: tx.battleId, resolved: tx.breakthrough.resolved, hasMatchingPending: ownsBreakthroughPending }));
            if (tx.breakthrough.resolved && ownsBreakthroughPending)
                issues.push(issue('RESOLVED_BREAKTHROUGH_HAS_PENDING', 'Resolved Breakthrough may not retain a BREAKTHROUGH_OPTION PendingDecision.', { battleId: tx.battleId }));
        }
        if (tx.stage === 'SCHWERPUNKT_OPTION' && !tx.schwerpunkt)
            issues.push(issue('COMBAT_SCHWERPUNKT_STATE_MISSING', 'SCHWERPUNKT_OPTION stage requires CombatSchwerpunktState.', { battleId: tx.battleId }));
        if (tx.schwerpunkt) {
            for (const duplicate of findDuplicates(tx.schwerpunkt.eligibleUnitIds))
                issues.push(issue('COMBAT_SCHWERPUNKT_DUPLICATE_ELIGIBLE', 'Schwerpunkt eligibleUnitIds must be unique.', { battleId: tx.battleId, unitId: duplicate }));
            const movedBreakthroughIds = new Set(state.actionLog.filter(entry => entry.accepted && entry.action.type === 'BREAKTHROUGH' && entry.action.battleId === tx.battleId && entry.action.path.length > 0).map(entry => entry.action.type === 'BREAKTHROUGH' ? entry.action.unitId : ''));
            for (const unitId of tx.schwerpunkt.eligibleUnitIds)
                if (!movedBreakthroughIds.has(unitId))
                    issues.push(issue('COMBAT_SCHWERPUNKT_NONBREAKER', 'Schwerpunkt candidate must have actually completed breakthrough movement in this battle.', { battleId: tx.battleId, unitId }));
            if (tx.schwerpunkt.selectedUnitId && !tx.schwerpunkt.eligibleUnitIds.includes(tx.schwerpunkt.selectedUnitId))
                issues.push(issue('COMBAT_SCHWERPUNKT_SELECTED_NONELIGIBLE', 'Selected Schwerpunkt unit must be one of the source eligible units.', { battleId: tx.battleId, unitId: tx.schwerpunkt.selectedUnitId }));
            if (tx.schwerpunkt.resolved && tx.schwerpunkt.childBattleId) {
                const child = state.combatTransactions[tx.schwerpunkt.childBattleId];
                if (!child)
                    issues.push(issue('COMBAT_SCHWERPUNKT_CHILD_MISSING', 'Resolved Schwerpunkt childBattleId must reference an existing child transaction.', { battleId: tx.battleId, childBattleId: tx.schwerpunkt.childBattleId }));
                else if (child.sourceBattleId !== tx.battleId || !child.isSchwerpunktSecondAttack)
                    issues.push(issue('COMBAT_SCHWERPUNKT_CHILD_INVALID', 'Resolved Schwerpunkt child must point back to source and be marked second attack.', { battleId: tx.battleId, childBattleId: child.battleId, childSourceBattleId: child.sourceBattleId, isSecondAttack: child.isSchwerpunktSecondAttack }));
            }
            if (tx.schwerpunkt.resolved && Boolean(tx.schwerpunkt.selectedUnitId) !== Boolean(tx.schwerpunkt.childBattleId))
                issues.push(issue('COMBAT_SCHWERPUNKT_RESOLUTION_PAIR_INVALID', 'Resolved Schwerpunkt selection and child battle id must either both exist or both be null.', { battleId: tx.battleId, selectedUnitId: tx.schwerpunkt.selectedUnitId, childBattleId: tx.schwerpunkt.childBattleId }));
            const ownsSchwerpunktPending = state.pendingDecision?.battleId === tx.battleId && state.pendingDecision.kind === 'SCHWERPUNKT_OPTION';
            if (tx.stage === 'SCHWERPUNKT_OPTION' && (tx.schwerpunkt.resolved || !ownsSchwerpunktPending))
                issues.push(issue('COMBAT_SCHWERPUNKT_PENDING_MISMATCH', 'SCHWERPUNKT_OPTION stage requires unresolved Schwerpunkt state and matching PendingDecision.', { battleId: tx.battleId, resolved: tx.schwerpunkt.resolved, hasMatchingPending: ownsSchwerpunktPending }));
        }
    }
    if (state.pendingDecision) {
        const tx = state.combatTransactions[state.pendingDecision.battleId];
        if (!tx)
            issues.push(issue('PENDING_COMBAT_TRANSACTION_INVALID', 'PendingDecision battleId does not reference an existing CombatTransaction.', { battleId: state.pendingDecision.battleId }));
        else {
            const expected = expectedStageByPending[state.pendingDecision.kind];
            if (expected !== tx.stage)
                issues.push(issue('PENDING_COMBAT_STAGE_MISMATCH', 'PendingDecision kind does not match CombatTransaction stage.', { battleId: tx.battleId, pendingKind: state.pendingDecision.kind, combatStage: tx.stage, expectedStage: expected }));
            if (state.pendingDecision.kind === 'RETREAT') {
                const retreat = tx.retreat;
                if (!retreat || retreat.resolved)
                    issues.push(issue('PENDING_RETREAT_STATE_INVALID', 'RETREAT PendingDecision requires an unresolved CombatRetreatRequirement.', { battleId: tx.battleId }));
                else {
                    const pendingIds = [...state.pendingDecision.unitIds].sort(), retreatIds = [...retreat.unitIds].sort();
                    if (state.pendingDecision.side !== retreat.side || state.pendingDecision.retreatSteps !== retreat.steps || pendingIds.join('\0') !== retreatIds.join('\0'))
                        issues.push(issue('PENDING_RETREAT_REQUIREMENT_MISMATCH', 'RETREAT PendingDecision must mirror the CombatRetreatRequirement.', { battleId: tx.battleId, pendingSide: state.pendingDecision.side, retreatSide: retreat.side, pendingSteps: state.pendingDecision.retreatSteps, retreatSteps: retreat.steps, pendingUnitIds: pendingIds, retreatUnitIds: retreatIds }));
                }
            }
            if (state.pendingDecision.side === tx.attackerSide && ['LOSS_ALLOCATION', 'RETREAT', 'ADVANCE_AFTER_COMBAT', 'BREAKTHROUGH_OPTION', 'SCHWERPUNKT_OPTION'].includes(state.pendingDecision.kind) && state.pendingDecision.decisionOwnerControllerId !== tx.declaringControllerId)
                issues.push(issue('ATTACKER_BATTLE_AUTHORITY_MISMATCH', 'Attacker-side battle decisions remain owned by the declaring controller until combat closes.', { battleId: tx.battleId, pendingKind: state.pendingDecision.kind, decisionOwnerControllerId: state.pendingDecision.decisionOwnerControllerId, declaringControllerId: tx.declaringControllerId }));
            if (state.pendingDecision.kind === 'ADVANCE_AFTER_COMBAT') {
                const advance = tx.advance;
                if (!advance || advance.resolved)
                    issues.push(issue('PENDING_ADVANCE_STATE_INVALID', 'ADVANCE_AFTER_COMBAT PendingDecision requires unresolved CombatAdvanceState.', { battleId: tx.battleId }));
                else {
                    const pendingIds = [...state.pendingDecision.eligibleUnitIds].sort(), advanceIds = [...advance.eligibleUnitIds].sort();
                    if (pendingIds.join('\0') !== advanceIds.join('\0'))
                        issues.push(issue('PENDING_ADVANCE_ELIGIBILITY_MISMATCH', 'Advance PendingDecision eligible ids must mirror CombatAdvanceState.', { battleId: tx.battleId, pendingUnitIds: pendingIds, advanceUnitIds: advanceIds }));
                }
            }
            if (state.pendingDecision.kind === 'BREAKTHROUGH_OPTION') {
                const breakthrough = tx.breakthrough;
                if (!breakthrough || breakthrough.resolved)
                    issues.push(issue('PENDING_BREAKTHROUGH_STATE_INVALID', 'BREAKTHROUGH_OPTION PendingDecision requires unresolved CombatBreakthroughState.', { battleId: tx.battleId }));
                else {
                    const pendingIds = [...state.pendingDecision.eligibleUnitIds].sort(), remainingIds = breakthrough.eligibleUnitIds.filter(id => !breakthrough.completedUnitIds.includes(id)).sort();
                    if (pendingIds.join('\0') !== remainingIds.join('\0'))
                        issues.push(issue('PENDING_BREAKTHROUGH_ELIGIBILITY_MISMATCH', 'Breakthrough PendingDecision eligible ids must mirror the uncompleted breakthrough units.', { battleId: tx.battleId, pendingUnitIds: pendingIds, remainingUnitIds: remainingIds }));
                }
            }
            if (state.pendingDecision.kind === 'SCHWERPUNKT_OPTION') {
                const schwerpunkt = tx.schwerpunkt;
                if (!schwerpunkt || schwerpunkt.resolved)
                    issues.push(issue('PENDING_SCHWERPUNKT_STATE_INVALID', 'SCHWERPUNKT_OPTION PendingDecision requires unresolved CombatSchwerpunktState.', { battleId: tx.battleId }));
                else {
                    const pendingIds = [...state.pendingDecision.eligibleUnitIds].sort(), candidateIds = [...schwerpunkt.eligibleUnitIds].sort();
                    if (pendingIds.join('\0') !== candidateIds.join('\0'))
                        issues.push(issue('PENDING_SCHWERPUNKT_ELIGIBILITY_MISMATCH', 'Schwerpunkt PendingDecision eligible ids must mirror CombatSchwerpunktState.', { battleId: tx.battleId, pendingUnitIds: pendingIds, candidateIds }));
                }
            }
        }
    }
    const actionIds = state.actionLog.map((entry) => entry.actionId);
    for (const duplicate of findDuplicates(actionIds))
        issues.push(issue('DUPLICATE_ACTION_ID', 'Action log contains duplicate action id.', { actionId: duplicate }));
    // A battle reference becomes canonical only when a commitment reserves the draft or an
    // AttackAction is actually accepted/established. Rejected proposals alone do not establish it.
    const declaredBattleIds = new Set();
    for (const entry of state.actionLog) {
        if (entry.accepted && entry.action.type === 'ATTACK' && entry.battleId)
            declaredBattleIds.add(entry.battleId);
        if (entry.accepted && entry.action.type === 'AUTHORIZE_UNIT_COMMITMENT' && entry.battleId)
            declaredBattleIds.add(entry.battleId);
    }
    for (const commitment of Object.values(state.unitCommitments))
        declaredBattleIds.add(commitment.battleId);
    for (const battleId of Object.keys(state.combatTransactions))
        declaredBattleIds.add(battleId);
    for (const entry of state.actionLog) {
        if (entry.action.actionId !== entry.actionId)
            issues.push(issue('ACTION_LOG_ID_MISMATCH', 'Logged action payload id differs from log envelope id.', { actionId: entry.actionId, payloadActionId: entry.action.actionId ?? null }));
        if ('battleId' in entry.action && typeof entry.action.battleId === 'string' && entry.action.type !== 'ATTACK' && entry.action.type !== 'SCHWERPUNKT_ATTACK' && entry.action.type !== 'AUTHORIZE_UNIT_COMMITMENT' && !declaredBattleIds.has(entry.action.battleId)) {
            issues.push(issue('ACTION_BATTLE_REFERENCE_INVALID', 'Action log contains unresolved battle reference.', { actionId: entry.actionId, battleId: entry.action.battleId }));
        }
    }
    if (state.pendingDecision && !declaredBattleIds.has(state.pendingDecision.battleId))
        issues.push(issue('PENDING_BATTLE_REFERENCE_INVALID', 'PendingDecision battle id is not declared by an attack/commitment/transaction.', { battleId: state.pendingDecision.battleId }));
    // DR-001 removed the mutable RailRuntimeState/railhead registry entirely. Railway repair
    // truth remains only on HexEdge.railway; any runtime `rail` container is legacy corruption.
    if ('rail' in state) {
        issues.push(issue('LEGACY_RAIL_RUNTIME_STATE', 'GameState must not contain authoritative railhead/runtime rail state under DR-001.'));
    }
    if (scenario) {
        if (scenario.deployment) {
            const deployment = scenario.deployment;
            const ids = deployment.units.map((unit) => unit.id);
            for (const duplicate of findDuplicates(ids))
                issues.push(issue('DEPLOYMENT_UNIT_ID_DUPLICATE', 'Scenario deployment roster unit ids must be unique.', { unitId: duplicate }));
            for (const roster of deployment.units) {
                const template = rules.unitTemplates[roster.templateId];
                if (!template)
                    issues.push(issue('DEPLOYMENT_TEMPLATE_INVALID', 'Deployment roster references missing UnitTemplate.', { unitId: roster.id, templateId: roster.templateId }));
                else if (template.side !== roster.side)
                    issues.push(issue('DEPLOYMENT_TEMPLATE_SIDE_MISMATCH', 'Deployment roster side must match UnitTemplate side.', { unitId: roster.id, templateId: roster.templateId, rosterSide: roster.side, templateSide: template.side }));
            }
            for (const side of ['GERMAN', 'SOVIET']) {
                const zone = deployment.zones[side];
                if (zone.kind === 'WESTERNMOST_COLUMNS' && (!Number.isInteger(zone.columnCount) || zone.columnCount <= 0))
                    issues.push(issue('DEPLOYMENT_ZONE_INVALID', 'WESTERNMOST_COLUMNS columnCount must be a positive integer.', { side, columnCount: zone.columnCount }));
                if (zone.kind === 'EXPLICIT_HEXES')
                    for (const key of [...new Set(zone.hexes.map(hexKey))].sort())
                        if (!state.hexes[key])
                            issues.push(issue('DEPLOYMENT_ZONE_HEX_INVALID', 'Explicit deployment zone references missing map hex.', { side, hexKey: key }));
            }
            const rosterById = new Map(deployment.units.map((unit) => [unit.id, unit]));
            if (isDeploymentPhase(state)) {
                for (const unit of Object.values(state.units)) {
                    const roster = rosterById.get(unit.id);
                    if (!roster) {
                        issues.push(issue('DEPLOYMENT_STATE_UNIT_UNREGISTERED', 'Unit present during deployment is not in the scenario deployment roster.', { unitId: unit.id }));
                        continue;
                    }
                    if (roster.id !== unit.id || roster.side !== unit.side || roster.templateId !== unit.templateId)
                        issues.push(issue('DEPLOYMENT_STATE_UNIT_MISMATCH', 'Deployed unit does not match canonical deployment roster data.', { unitId: unit.id }));
                    if (!deploymentHexKeysForSide(state, scenario, unit.side).includes(hexKey(unit.hex)))
                        issues.push(issue('DEPLOYMENT_STATE_HEX_INVALID', 'Deployed unit is outside its current legal deployment zone.', { unitId: unit.id, hexKey: hexKey(unit.hex) }));
                }
            }
            else {
                // Once setup is complete, roster identity remains authoritative for the rest of the game,
                // but deployment-zone position and alive status no longer do: normal gameplay may move or
                // destroy these units, and reinforcements/non-roster units are also valid thereafter.
                for (const roster of deployment.units) {
                    const unit = state.units[roster.id];
                    if (!unit)
                        continue;
                    if (roster.id !== unit.id || roster.side !== unit.side || roster.templateId !== unit.templateId)
                        issues.push(issue('DEPLOYMENT_STATE_UNIT_MISMATCH', 'Initial deployment roster unit no longer matches canonical deployment roster identity.', { unitId: roster.id }));
                }
            }
            const completedSides = state.phase === 'SOVIET_DEPLOYMENT'
                ? []
                : state.phase === 'GERMAN_DEPLOYMENT'
                    ? ['SOVIET']
                    : ['GERMAN', 'SOVIET'];
            for (const roster of deployment.units) {
                if (!completedSides.includes(roster.side))
                    continue;
                if (!state.units[roster.id])
                    issues.push(issue('DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING', 'Completed initial deployment roster unit is missing from GameState.', { unitId: roster.id, side: roster.side, phase: state.phase }));
            }
        }
        if (scenario.capitalCoreHexes.length === 0) {
            issues.push(issue('CAPITAL_CORE_HEXES_EMPTY', 'Scenario must configure at least one capital core hex for victory evaluation.'));
        }
        for (const coreKey of [...new Set(scenario.capitalCoreHexes.map(hexKey))].sort()) {
            if (!state.hexes[coreKey])
                issues.push(issue('CAPITAL_CORE_HEX_INVALID', 'Scenario capital core hex does not exist on this map.', { coreHexKey: coreKey }));
        }
        if (!Number.isInteger(scenario.turnLimit) || scenario.turnLimit < 1) {
            issues.push(issue('TURN_LIMIT_INVALID', 'Scenario turnLimit must be a positive integer.', { turnLimit: scenario.turnLimit }));
        }
        for (const entry of scenario.germanWestRailEntries) {
            const entryKey = hexKey(entry);
            if (!state.hexes[entryKey])
                issues.push(issue('GERMAN_WEST_RAIL_ENTRY_INVALID', 'Scenario German west rail entry does not exist on this map.', { entryHexKey: entryKey }));
        }
        for (const exit of scenario.sovietEastRailExits) {
            const exitKey = hexKey(exit);
            if (!state.hexes[exitKey])
                issues.push(issue('SOVIET_EAST_RAIL_EXIT_INVALID', 'Scenario Soviet east rail exit does not exist on this map.', { exitHexKey: exitKey }));
        }
        for (const source of scenario.sovietSupplySources ?? []) {
            const sourceKey = hexKey(source);
            if (!state.hexes[sourceKey])
                issues.push(issue('SOVIET_SUPPLY_SOURCE_INVALID', 'Scenario Soviet independent supply source does not exist on this map.', { sourceHexKey: sourceKey }));
        }
        scenario.reinforcements.forEach((group, groupIndex) => {
            if (!Number.isInteger(group.turn) || group.turn < 1) {
                issues.push(issue('SOVIET_REINFORCEMENT_TURN_INVALID', 'Scenario Soviet reinforcement turn must be a positive integer.', { groupOrdinal: groupIndex + 1, turn: group.turn }));
            }
        });
        for (const slot of deriveSovietReinforcementSlots(scenario)) {
            const matches = Object.values(rules.unitTemplates).filter((template) => template.side === 'SOVIET' && template.type === slot.type);
            if (matches.length === 0) {
                issues.push(issue('SOVIET_REINFORCEMENT_TEMPLATE_UNRESOLVED', 'Scheduled Soviet reinforcement type has no unique Soviet UnitTemplate.', { reinforcementId: slot.id, unitType: slot.type, scheduledTurn: slot.scheduledTurn }));
            }
            else if (matches.length > 1) {
                issues.push(issue('SOVIET_REINFORCEMENT_TEMPLATE_AMBIGUOUS', 'Scheduled Soviet reinforcement type matches multiple Soviet UnitTemplates.', { reinforcementId: slot.id, unitType: slot.type, scheduledTurn: slot.scheduledTurn, templateIds: matches.map((template) => template.id).sort() }));
            }
        }
    }
    if (state.phase !== 'GAME_OVER') {
        const expectedSide = phaseSide(state.phase);
        if (expectedSide !== state.activeSide)
            issues.push(issue('ACTIVE_SIDE_PHASE_MISMATCH', 'activeSide does not match the current phase.', { phase: state.phase, activeSide: state.activeSide, expectedSide }));
    }
    if (state.idCounters.nextAction < 1 || state.idCounters.nextBattle < 1)
        issues.push(issue('ID_COUNTER_INVALID', 'Deterministic id counters must remain positive.', { ...state.idCounters }));
    return issues;
}
