import { advanceChoices, reactionChoices, retreatPlan, schwerpunktChoices } from '../interaction/combatFlow.js';
import { eligibleAdditionalAttackerIds, isCombatTargetSelection, primaryAttackerId } from '../interaction/attackGroup.js';
import { analyzeLossRequirement, buildCombatContext, computeActiveGermanRailNetwork, computeLegalSovietReinforcementEntryHexKeys, computeRecoveryBaseHexKeys, deploymentHexKeysForSide, evaluateDeploymentSideStatus, getAvailableSovietReinforcements, getCurrentTurnSovietReinforcements, getDelayedSovietReinforcements, getNeighbors, getRecoveryUnitLimit, getUnitStats, hasDeployableSovietReinforcement, hasGermanRailRepairActionThisTurn, validArtillerySupport, validateAttackAction, validateBreakthroughAction, isDeploymentPhase, resolveSovietReinforcementTemplate, validateEntrenchAction, validateMoveAction, validateRailRepairAction, validateRecoveryAction, } from '../core-adapter/core.js';
import { deploymentProjection } from '../core-adapter/session.js';
function counterFromUnit(session, unit, selectedUnitId) {
    return { id: unit.id, side: unit.side, type: unit.type, step: unit.step, stats: getUnitStats(unit, session.rules), supplyState: unit.supplyState, controllerId: unit.controllerId, hex: { ...unit.hex }, selected: unit.id === selectedUnitId, entrenched: unit.entrenched };
}
function renderUnits(session) { if (isDeploymentPhase(session.state)) {
    const projection = deploymentProjection(session);
    return projection ? Object.values(projection.units) : [];
} return Object.values(session.state.units); }
function sideForPhase(phase) { return phase.startsWith('GERMAN_') ? 'GERMAN' : phase.startsWith('SOVIET_') ? 'SOVIET' : null; }
function reinforcementRow(session, slot, delayed, current) {
    const resolution = resolveSovietReinforcementTemplate(session.rules, slot);
    return { id: slot.id, scheduledTurn: slot.scheduledTurn, type: slot.type, delayed, currentTurn: current, stats: resolution.template?.steps[0] ?? null, resolution: resolution.status };
}
export function deriveBrowserRenderModel(session, presentation) {
    const viewer = session.state.controllers[session.activeViewerControllerId];
    if (!viewer)
        throw new Error(`Unknown active viewer ${session.activeViewerControllerId}`);
    const visibleUnits = renderUnits(session).filter((unit) => unit.alive);
    const counters = visibleUnits.map((unit) => counterFromUnit(session, unit, presentation.selectedUnitId));
    const selectedCounter = counters.find((counter) => counter.id === presentation.selectedUnitId) ?? null;
    let deployment = null;
    if (isDeploymentPhase(session.state)) {
        const roster = session.scenario.deployment?.units.filter((unit) => unit.side === viewer.side) ?? [];
        const status = evaluateDeploymentSideStatus(session.state, session.rules, session.scenario, viewer.side);
        const zoneKeys = deploymentHexKeysForSide(session.state, session.scenario, viewer.side);
        const visibleIds = new Set(visibleUnits.map((unit) => unit.id));
        deployment = { side: viewer.side, zoneKeys, roster: roster.map((row) => { const template = session.rules.unitTemplates[row.templateId]; if (!template)
                throw new Error(`Missing unit template ${row.templateId}`); return { ...row, placed: visibleIds.has(row.id), stats: template.steps[0], type: template.type }; }), deployed: roster.filter((row) => session.state.units[row.id]).length, total: roster.length, complete: status.complete, invalidUnitIds: status.invalidUnitIds };
    }
    let movement = null;
    const moveOptions = [];
    if (selectedCounter && (session.state.phase === 'GERMAN_MOVEMENT' || session.state.phase === 'SOVIET_MOVEMENT')) {
        const unit = session.state.units[selectedCounter.id];
        if (unit && unit.controllerId === session.activeViewerControllerId) {
            const currentPath = presentation.pathDraft.map((hex) => ({ ...hex }));
            const tail = currentPath.at(-1) ?? unit.hex;
            let currentIssues = [];
            let spentMP = 0;
            let maxMP = getUnitStats(unit, session.rules).movement;
            if (currentPath.length) {
                const v = validateMoveAction(session.state, session.rules, { type: 'MOVE', controllerId: unit.controllerId, unitId: unit.id, path: currentPath });
                currentIssues = v.issues;
                spentMP = v.spentMP;
                maxMP = v.maxMP;
            }
            for (const hex of getNeighbors(tail)) {
                const key = `${hex.q},${hex.r}`;
                if (!session.state.hexes[key])
                    continue;
                const path = [...currentPath, { ...hex }];
                const validation = validateMoveAction(session.state, session.rules, { type: 'MOVE', controllerId: unit.controllerId, unitId: unit.id, path });
                const option = { hex: { ...hex }, legal: validation.issues.length === 0, issues: validation.issues, spentMP: validation.spentMP, maxMP: validation.maxMP };
                moveOptions.push(option);
            }
            movement = { path: currentPath, options: moveOptions, issues: currentIssues, spentMP, maxMP };
        }
    }
    let railRepair = null;
    if (session.state.phase === 'GERMAN_SUPPLY_RAIL') {
        const active = computeActiveGermanRailNetwork(session.state, session.scenario);
        const railwayEdgeKeys = Object.values(session.state.edges).filter((edge) => edge.railway?.present).map((edge) => edge.key).sort();
        const engineers = Object.values(session.state.units).filter((unit) => unit.alive && unit.side === 'GERMAN' && unit.type === 'ENGINEER' && unit.controllerId === session.activeViewerControllerId).map((unit) => ({ id: unit.id, selected: unit.id === presentation.selectedEngineerUnitId })).sort((a, b) => a.id.localeCompare(b.id));
        const issues = presentation.railRepairEdgeKeys.length ? validateRailRepairAction(session.state, session.rules, session.scenario, { type: 'RAIL_REPAIR', controllerId: session.activeViewerControllerId, edgeKeys: [...presentation.railRepairEdgeKeys], ...(presentation.selectedEngineerUnitId ? { engineerUnitId: presentation.selectedEngineerUnitId } : {}) }) : [];
        railRepair = { selectedEdgeKeys: [...presentation.railRepairEdgeKeys], activeEdgeKeys: active.edgeKeys, railwayEdgeKeys, engineers, selectedEngineerUnitId: presentation.selectedEngineerUnitId, issues, alreadyUsed: hasGermanRailRepairActionThisTurn(session.state) };
    }
    let reinforcement = null;
    if (session.state.phase === 'SOVIET_REINFORCEMENT_SUPPLY') {
        const available = getAvailableSovietReinforcements(session.state, session.scenario), delayed = getDelayedSovietReinforcements(session.state, session.scenario), current = getCurrentTurnSovietReinforcements(session.state, session.scenario);
        const delayedIds = new Set(delayed.map((slot) => slot.id)), currentIds = new Set(current.map((slot) => slot.id));
        reinforcement = { available: available.map((slot) => reinforcementRow(session, slot, delayedIds.has(slot.id), currentIds.has(slot.id))), delayed: delayed.map((slot) => reinforcementRow(session, slot, true, currentIds.has(slot.id))), current: current.map((slot) => reinforcementRow(session, slot, delayedIds.has(slot.id), true)), legalEntryKeys: computeLegalSovietReinforcementEntryHexKeys(session.state, session.rules, session.scenario), selectedId: presentation.selectedReinforcementId, deployable: hasDeployableSovietReinforcement(session.state, session.rules, session.scenario) };
    }
    let recovery = null;
    if (session.state.phase === 'GERMAN_RECOVERY' || session.state.phase === 'SOVIET_RECOVERY') {
        const side = sideForPhase(session.state.phase);
        const selected = selectedCounter ? session.state.units[selectedCounter.id] : null;
        const selectedIssues = selected ? validateRecoveryAction(session.state, session.rules, session.scenario, { type: 'REPAIR_UNIT', controllerId: session.activeViewerControllerId, unitId: selected.id }) : [];
        const template = selected ? session.rules.unitTemplates[selected.templateId] : null;
        const recoveredCount = session.state.actionLog.filter((entry) => entry.accepted && entry.turn === session.state.turn && entry.phase === session.state.phase && entry.action.type === 'REPAIR_UNIT').length;
        recovery = { baseKeys: computeRecoveryBaseHexKeys(session.state, side, session.scenario), limit: getRecoveryUnitLimit(session.rules, side, session.state.turn), recoveredCount, selectedCost: template?.recoveryCostPerStep ?? null, selectedIssues };
    }
    let entrench = null;
    if (session.state.phase === 'GERMAN_ENTRENCHMENT' || session.state.phase === 'SOVIET_ENTRENCHMENT') {
        const selected = selectedCounter ? session.state.units[selectedCounter.id] : null;
        entrench = { selectedIssues: selected ? validateEntrenchAction(session.state, session.rules, session.scenario, { type: 'ENTRENCH', controllerId: session.activeViewerControllerId, unitId: selected.id }) : [] };
    }
    let combat = null;
    if (session.state.phase === 'GERMAN_COMBAT' || session.state.phase === 'SOVIET_COMBAT') {
        const pending = session.state.pendingDecision;
        const battleId = pending?.battleId ?? presentation.selectedBattleId;
        const battle = battleId ? session.state.combatTransactions[battleId] ?? null : null;
        const attackTarget = presentation.attackTarget;
        const attackerUnitIds = presentation.attackUnitIds.filter((id) => session.state.units[id]?.alive);
        const primary = primaryAttackerId(presentation);
        const eligibleAttackerIds = eligibleAdditionalAttackerIds(session, presentation);
        if (isCombatTargetSelection(session, presentation) && attackTarget) {
            for (const counter of counters) {
                if (counter.id === primary) {
                    counter.combatRole = 'primary';
                    counter.selected = true;
                }
                else if (attackerUnitIds.includes(counter.id))
                    counter.combatRole = 'selected';
                else if (eligibleAttackerIds.includes(counter.id))
                    counter.combatRole = 'eligible';
            }
        }
        const targetKeys = new Set();
        for (const id of attackerUnitIds) {
            const u = session.state.units[id];
            if (!u)
                continue;
            for (const h of getNeighbors(u.hex)) {
                const defenders = Object.values(session.state.units).filter((d) => d.alive && d.side !== u.side && d.hex.q === h.q && d.hex.r === h.r);
                if (defenders.length)
                    targetKeys.add(`${h.q},${h.r}`);
            }
        }
        const targetHexes = [...targetKeys].map((key) => { const [q, r] = key.split(',').map(Number); return { q: q, r: r }; });
        let attackIssues = [];
        let preview = null;
        let artilleryUnitIds = [];
        if (attackTarget && attackerUnitIds.length) {
            const action = { type: 'ATTACK', controllerId: session.activeViewerControllerId, attackerUnitIds, target: { ...attackTarget }, ...(presentation.attackerArtilleryUnitId ? { support: { attackerArtilleryUnitId: presentation.attackerArtilleryUnitId } } : {}) };
            attackIssues = validateAttackAction(session.state, session.rules, action);
            if (attackIssues.length === 0) {
                try {
                    preview = buildCombatContext(session.state, session.rules, action);
                }
                catch {
                    preview = null;
                }
            }
            const side = session.state.controllers[session.activeViewerControllerId]?.side;
            if (side)
                artilleryUnitIds = Object.values(session.state.units).filter((u) => u.alive && u.controllerId === session.activeViewerControllerId && Boolean(validArtillerySupport(session.state, u.id, side, attackTarget, true))).map((u) => u.id).sort();
        }
        let loss = null;
        if (pending?.kind === 'LOSS_ALLOCATION' && battle) {
            const req = battle.unresolvedLosses.find((r) => r.side === pending.side && r.steps === pending.lossSteps) ?? { side: pending.side, steps: pending.lossSteps, eligibleUnitIds: [...pending.eligibleUnitIds], reason: 'CRT' };
            const analysis = analyzeLossRequirement(session.state, session.rules, req);
            loss = { steps: pending.lossSteps, eligibleUnitIds: [...pending.eligibleUnitIds], draft: [...presentation.lossDraft], issues: [], capacityByUnitId: { ...analysis.capacityByUnitId } };
        }
        let retreat = null;
        if (pending?.kind === 'RETREAT') {
            const plan = retreatPlan(session, presentation);
            retreat = { steps: pending.retreatSteps, unitIds: [...pending.unitIds], activeUnitId: plan.activeUnitId, drafts: structuredClone(presentation.retreatDrafts), options: plan.options, completeUnitIds: plan.completeUnitIds };
        }
        const advanceIds = advanceChoices(session);
        const advance = pending?.kind === 'ADVANCE_AFTER_COMBAT' && battle ? { unitIds: advanceIds, selectedUnitId: advanceIds.includes(presentation.advanceUnitId ?? '') ? presentation.advanceUnitId : advanceIds.length === 1 ? advanceIds[0] : null, target: { ...battle.targetHex } } : null;
        let breakthrough = null;
        if (pending?.kind === 'BREAKTHROUGH_OPTION' && battle) {
            const selected = presentation.breakthroughUnitId ?? pending.eligibleUnitIds[0] ?? null;
            let maxHexes = 0;
            let options = [];
            if (selected) {
                maxHexes = battle.breakthrough?.maxHexesByUnitId[selected] ?? 0;
                const from = presentation.breakthroughPath.at(-1) ?? battle.targetHex;
                options = getNeighbors(from).filter((h) => session.state.hexes[`${h.q},${h.r}`]).map((hex) => { const issues = validateBreakthroughAction(session.state, session.rules, { type: 'BREAKTHROUGH', controllerId: session.activeViewerControllerId, battleId: pending.battleId, unitId: selected, path: [...presentation.breakthroughPath, { ...hex }] }); return { hex: { ...hex }, legal: issues.length === 0, issues }; });
            }
            breakthrough = { eligibleUnitIds: [...pending.eligibleUnitIds], selectedUnitId: selected, maxHexes, path: presentation.breakthroughPath.map((h) => ({ ...h })), options };
        }
        let schwerpunkt = null;
        if (pending?.kind === 'SCHWERPUNKT_OPTION') {
            const choices = schwerpunktChoices(session);
            const targets = new Map(choices.map(c => [`${c.target.q},${c.target.r}`, c.target]));
            schwerpunkt = { eligibleUnitIds: [...new Set(choices.map(c => c.unitId))], target: presentation.schwerpunktTarget ? { ...presentation.schwerpunktTarget } : null, targetOptions: [...targets.values()], choices };
        }
        const history = Object.values(session.state.combatTransactions).map((tx) => ({ battleId: tx.battleId, sourceBattleId: tx.sourceBattleId, attackerSide: tx.attackerSide, defenderSide: tx.defenderSide, target: { ...tx.targetHex }, stage: tx.stage, crtResult: tx.resolution?.crtResult ?? null })).sort((a, b) => a.battleId.localeCompare(b.battleId));
        combat = { attackDraft: { attackerUnitIds, primaryAttackerId: primary, eligibleAttackerIds, target: attackTarget ? { ...attackTarget } : null, targetHexes, artilleryUnitIds, selectedArtilleryId: presentation.attackerArtilleryUnitId, issues: attackIssues, preview }, battle, pending, reaction: reactionChoices(session), advance, crt: { columns: session.rules.crt.columns, table: session.rules.crt.table }, loss, retreat, breakthrough, schwerpunkt, history };
    }
    return { phase: session.state.phase, turn: session.state.turn, activeSide: session.state.activeSide, rp: { ...session.state.rp }, cp: { ...session.state.cp }, viewerControllerId: session.activeViewerControllerId, viewerSide: viewer.side, hexes: Object.values(session.state.hexes), edges: Object.values(session.state.edges), counters, deployment, movement, moveOptions, selectedCounter, railRepair, reinforcement, recovery, entrench, combat, victory: { ...session.state.victory } };
}
