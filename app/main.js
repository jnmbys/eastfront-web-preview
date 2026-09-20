import { continueCombatFlow, chooseRetreatDestination, chooseRetreater, chooseAdvancer, chooseAdvanceDestination, routeCombatDecisionCounter, undoRetreatDestination } from './interaction/combatFlow.js';
import { languageControl, bindLanguageControl } from './localization/languageControl.js';
import { issueText } from './localization/issues.js';
import { t, msg, enumLabel, phaseName, formatMessage } from './localization/index.js';
import { combatAttackPanel } from './ui/combatAttackPanel.js';
import { deploymentFocus, deploymentRejection } from './ui/deploymentPolish.js';
import { createDeploymentTouch, chooseDeploymentTarget, confirmDeploymentTarget } from './ui/deploymentTouch.js';
import { commandHeader, deploymentLocations, deploymentConfirm, deploymentFeedback, unitDescription, unitLabel } from './ui/commandPresentation.js';
import { coreHexKey, isDeploymentPhase } from './core-adapter/core.js';
import { createLocalGameSession, loadProductionMapFromUrl, dispatchGameAction } from './core-adapter/session.js';
import { chooseLossAndContinue, cancelMoveDraft, cancelRailRepair, clearAttackDraft, clearLossDraft, commitBreakthrough, commitMoveDraft, commitRailRepair, commitSchwerpunkt, confirmPrivacyGate, attackAndContinue, deploySelectedReinforcement, deploySelectedUnit, enterRailRepairMode, entrenchSelectedUnit, extendBreakthroughDraft, extendMoveDraft, passAdvance, passBreakthrough, passCombatReaction, passSchwerpunkt, readyForPhase, recoverSelectedUnit, routeCombatTarget, isCombatTargetSelection, combatTargetIssues, selectAttackerArtillery, selectBreakthroughUnit, selectCounter, selectDeploymentRosterUnit, selectRailEngineer, selectReinforcement, selectSchwerpunktTarget, switchViewerForDevelopment, toggleAttackUnit, toggleRailRepairEdge, undoBreakthroughDraft, undoLossDraft, undoMoveDraft, useDefenderArtillery, } from './interaction/intents.js';
import { deriveBrowserRenderModel } from './render/coreModel.js';
import { coreSvgDynamicMarkup, coreSvgMarkup, viewBoxForHexes } from './render/coreSvg.js';
import { selectTerrainLod } from './render/terrainAssets.js';
import { buildCachedTerrainSurface, formatTerrainSurfaceFailure, terrainSurfaceCapabilities } from './render/terrainSurface.js';
import { HEX_SIZE } from './geometry/hex.js';
import { createPresentationState } from './state/presentation.js';
import { TERRAIN_VISUAL_SEED, createFreshProductionSession, defaultMapViewport, fatalMarkup, gameOverMarkup, homeMarkup, loadingMarkup, loadProductionRuntimeManifest, mobileAdvisoryMarkup, privacyHandoffMarkup, productionDeveloperUiAllowed, responsiveProfile, WEB_PREVIEW_VERSION } from './web/preview.js';
import { beginMapGesture, dragSuppressesTap, gesturePanViewport, updateMapGesture, zoomMapAt, pinchMapViewport } from './web/mapInteraction.js';
const rootElement = document.querySelector('#app');
if (!rootElement)
    throw new Error('#app missing');
const root = rootElement;
const query = new URLSearchParams(location.search);
const developerUi = productionDeveloperUiAllowed(location.hostname, location.search);
let presentation = createPresentationState(developerUi && query.get('debug') === '1', window.matchMedia('(max-width: 1100px)').matches);
let session = null;
let productionMap = null;
let appStatus = 'LOADING';
let fatalMessage = '';
let mapViewport = defaultMapViewport();
let cachedTerrainSurface = null;
const cachedTerrainSurfaces = new Map();
function esc(value) { return value.replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;' }[char] ?? char)); }
let deploymentTouch = createDeploymentTouch();
function paintDeploymentFocus() {
    const svg = document.querySelector('#eastfront-map');
    if (!svg || !session)
        return;
    svg.querySelector('#deployment-focus')?.remove();
    svg.insertAdjacentHTML('beforeend', deploymentFocus(deriveBrowserRenderModel(session, presentation), deploymentTouch, presentation.selectedDeploymentUnitId));
}
function chooseTouchTarget(key) {
    if (!session)
        return;
    if (chooseDeploymentTarget(deploymentTouch, deriveBrowserRenderModel(session, presentation), presentation.selectedDeploymentUnitId, key)) {
        if (presentation.panelCollapsed) {
            presentation.panelCollapsed = false;
            render();
        }
        else
            refreshDynamicView();
    }
}
function chooseCounterTarget(id) {
    if (!session)
        return false;
    const model = deriveBrowserRenderModel(session, presentation), counter = model.counters.find(c => c.id === id);
    if (!counter)
        return false;
    const chosen = chooseDeploymentTarget(deploymentTouch, model, presentation.selectedDeploymentUnitId, coreHexKey(counter.hex));
    if (chosen) {
        if (presentation.panelCollapsed) {
            presentation.panelCollapsed = false;
            render();
        }
        else
            refreshDynamicView();
    }
    return chosen;
}
function parseHex(value) { const [q, r] = value.split(',').map(Number); return { q: q, r: r }; }
function sideLabel(side) { return t('faction.side', { side: enumLabel(side) }); }
function phaseLabel(phase) { return phaseName(phase); }
function issueHtml(issues) { return issues.length ? `<div class="issue-list">${issues.map((issue) => `<span>${esc(issueText(issue))}</span>`).join('')}</div>` : `<div class="issue-list"><span>${t('common.legal')}</span></div>`; }
function bindKeyboardActivation(element, action) { element.addEventListener('keydown', (event) => { const e = event; if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    action();
} }); }
function lastActionPanel(current) {
    const result = current.lastResult;
    const validation = result?.issues.map((issue) => issue.code).join(', ') || '—';
    const events = result?.events.map((event) => event.type).join(', ') || '—';
    const integrity = current.integrityIssues.length === 0 ? 'PASS' : current.integrityIssues.map((issue) => issue.code).join(', ');
    return `<section class="panel-block integration-debug"><span class="eyebrow">CORE ACTION DEBUG</span><div><span>Last action</span><strong>${result ? esc(result.action.type) : '—'}</strong></div><div><span>Accepted</span><strong>${result ? String(result.accepted) : '—'}</strong></div><div><span>Action ID</span><strong>${result ? esc(result.actionId) : '—'}</strong></div><div><span>Validation</span><strong>${esc(validation)}</strong></div><div><span>Events</span><strong>${esc(events)}</strong></div><div><span>Integrity</span><strong class="${current.integrityIssues.length === 0 ? 'ok' : 'bad'}">${esc(integrity)}</strong></div></section>`;
}
function selectedSummary(model) {
    const unit = model.selectedCounter;
    if (!unit)
        return `<div class="command-empty"><span class="command-reticle" aria-hidden="true">◇</span><p>${t('unit.inspect')}</p></div>`;
    return `<div class="unit-dossier">${rosterEmblem(unit.type)}<div><span class="eyebrow">${unitLabel(unit.type)}</span><strong>${esc(unit.id)}</strong><span>${enumLabel(unit.side)}</span></div></div><dl class="unit-readings"><div><dt>${t('common.attack')}</dt><dd>${unit.stats.attack}</dd></div><div><dt>${t('common.defense')}</dt><dd>${unit.stats.defense}</dd></div><div><dt>${t('common.movement')}</dt><dd>${unit.stats.movement}</dd></div></dl><div class="unit-status"><span>${t('common.supply')}</span><strong>${enumLabel(unit.supplyState)}</strong><span>${t('common.status')}</span><strong>${t('unit.step', { step: unit.step })}${unit.entrenched ? t('unit.entrenchedSuffix') : ''}</strong><span>${t('common.position')}</span><strong>${coreHexKey(unit.hex)}</strong></div>`;
}
// Decorative roster identity only; canonical unit types and actions are unchanged.
function rosterEmblem(type) {
    const infantry = '<path d="M5 6L23 22M23 6L5 22"/>';
    const armor = '<ellipse cx="14" cy="14" rx="10" ry="6"/>';
    const symbols = { INFANTRY: infantry, JAGER: infantry + '<text x="14" y="17" text-anchor="middle">J</text>', ELITE_INFANTRY: infantry + '<text x="14" y="17" text-anchor="middle">E</text>', PANZER: armor, TANK: armor, HEAVY_TANK: armor + '<path d="M5 23H23"/>', MOTORIZED: armor + infantry, ARTILLERY: '<circle cx="14" cy="14" r="4" fill="currentColor"/>', ENGINEER: '<text x="14" y="18" text-anchor="middle">E</text>', ANTI_TANK: '<text x="14" y="18" text-anchor="middle">AT</text>', RECON: '<path d="M5 23L23 5"/>', HQ: '<text x="14" y="18" text-anchor="middle">HQ</text>' };
    return `<span class="roster-emblem" aria-hidden="true"><svg viewBox="0 0 28 28">${symbols[type] ?? '<path d="M14 4L24 14L14 24L4 14Z"/>'}</svg></span>`;
}
function deploymentPanel(model) { const deployment = model.deployment; if (!deployment)
    return ''; const active = model.activeSide === model.viewerSide; const selected = presentation.selectedDeploymentUnitId; const rows = deployment.roster.map((row) => `<button type="button" class="roster-row ${row.placed ? 'placed' : 'unplaced'} ${selected === row.id ? 'selected' : ''}" data-deploy-unit-id="${esc(row.id)}" ${active ? '' : 'disabled'} aria-pressed="${selected === row.id}">${rosterEmblem(row.type)}<span>${unitLabel(row.type)}</span><small>${esc(row.id)} · ${unitDescription(row.type)}<br>${t('unit.readings', { ...row.stats })}</small><b>${row.placed ? t('deployment.onMap') : t('deployment.reserve')}</b></button>`).join(''); return `<section class="panel-block deployment-panel"><span class="eyebrow">${t('deployment.title', { side: sideLabel(model.viewerSide).toUpperCase() })}</span><div class="deployment-progress"><strong>${deployment.deployed}/${deployment.total}</strong><span>${deployment.complete ? t('deployment.complete') : t('deployment.placeAll')}</span></div><ol class="deployment-steps"><li class="${selected ? 'done' : 'current'}">${t('deployment.selectUnit')}</li><li class="${selected ? 'current' : ''}">${t('deployment.choosePosition')}</li><li>${t('deployment.deploy')}</li></ol><p class="deployment-guidance" role="status">${selected ? t('deployment.selectedHelp', { id: esc(selected) }) : t('deployment.begin')}</p><div class="roster-list">${rows}</div>${deploymentFeedback(deploymentTouch)}${deploymentLocations(model, selected, deploymentTouch)}<button id="ready-button" class="primary-action" type="button" ${active ? '' : 'disabled'}><span class="advance-label">${t('deployment.confirmPhase')}</span><span class="advance-arrow" aria-hidden="true">›</span></button>${!active ? `<p class="privacy-note">${t('deployment.hidden')}</p>` : ''}</section>`; }
function modifierHtml(mods) { return ''; }
function combatContextHtml(context, label) {
    const m = context.modifiers;
    const rows = [[t('common.terrain'), m.terrainShift], [t('combat.river'), m.riverShift], [t('combat.engineer'), m.engineerShift], [t('combat.combinedArms'), m.combinedArmsShift], [t('combat.armorPenalty'), m.unsupportedArmorShift], [t('combat.antiTank'), m.antiTankShift], [t('combat.attackerArtillery'), m.attackerArtilleryShift], [t('combat.defenderArtillery'), m.defenderArtilleryShift], [t('combat.flank'), m.flankShift], [t('combat.entrenchment'), m.entrenchmentShift], [t('combat.hq'), m.hqShift], [t('combat.secondAttack'), m.secondAttackShift]].filter(([, v]) => v !== 0);
    return `<div class="combat-card"><h3>${label}</h3><div class="combat-grid"><span>${t('common.attack')}</span><strong>${context.attackStrength}</strong><span>${t('common.defense')}</span><strong>${context.defenseStrength}</strong><span>${t('combat.baseOdds')}</span><strong>${esc(context.baseOdds)}</strong><span>${t('combat.baseColumn')}</span><strong>${context.baseCRTColumn}</strong><span>${t('combat.finalShift')}</span><strong>${context.finalShift}</strong><span>${t('combat.finalCRT')}</span><strong>${esc(context.finalCRTColumnLabel)}</strong></div>${rows.length ? `<div class="modifier-list">${rows.map(([k, v]) => `<span>${k}</span><strong>${Number(v) > 0 ? '+' : ''}${v}</strong>`).join('')}<span>${t('combat.rawCapped')}</span><strong>${m.rawShift} / ${m.cappedShift}</strong></div>` : ''}</div>`;
}
function battleHistoryHtml(model) { const h = model.combat?.history ?? []; return h.length ? `<section class="panel-block battle-history"><span class="eyebrow">${t('combat.history')}</span>${h.map((b) => `<div class="battle-history-row"><span>${esc(b.battleId)}${b.sourceBattleId ? ` ← ${esc(b.sourceBattleId)}` : ''}<br>${enumLabel(b.attackerSide)}→${enumLabel(b.defenderSide)} @ ${coreHexKey(b.target)}</span><strong>${b.crtResult ?? enumLabel(b.stage)}</strong></div>`).join('')}</section>` : ''; }
function combatPanel(model) {
    const c = model.combat;
    if (!c)
        return '';
    const pending = c.pending, tx = c.battle;
    if (!pending)
        return combatAttackPanel(model, c.attackDraft.preview ? combatContextHtml(c.attackDraft.preview, t('combat.details')) : '') + battleHistoryHtml(model);
    const header = `<section class="panel-block phase-actions pending-lock"><span class="eyebrow">${t('combat.transaction', { kind: enumLabel(pending.kind) })}</span><div class="phase-metric"><span>${t('combat.battle')}</span><strong>${esc(pending.battleId)}</strong></div><div class="phase-metric"><span>${t('combat.decisionOwner')}</span><strong>${enumLabel(session?.state.controllers[pending.decisionOwnerControllerId]?.side ?? pending.decisionOwnerControllerId)}</strong></div>`;
    let body = '';
    if (pending.kind === 'DEFENDER_REACTION') {
        body = `<p>${t('combat.flow.defender')}</p><div class="combat-unit-list">${c.reaction.artillery.map(id => `<button class="mini-button" data-defender-artillery="${esc(id)}">${t('combat.artilleryUnit', { id: esc(id) })}</button>`).join('')}${c.reaction.hq.map(id => `<button class="mini-button" data-defender-hq="${esc(id)}">${t('combat.flow.lastStand', { id: esc(id) })}</button>`).join('')}</div><button id="pass-reaction" class="secondary-action">${t('combat.flow.declineSupport')}</button>`;
    }
    else if (pending.kind === 'LOSS_ALLOCATION' && c.loss) {
        body = `<p>${t('combat.flow.allocateHelp', { steps: c.loss.steps })}</p><div class="combat-unit-list">${c.loss.eligibleUnitIds.map((id) => `<button class="mini-button" data-loss-unit="${esc(id)}">${t('combat.capacity', { id: esc(id), count: c.loss.capacityByUnitId[id] ?? 0 })}</button>`).join('')}</div><div class="loss-draft">${c.loss.draft.join(' → ') || t('combat.noLossDraft')}</div><div class="button-row"><button id="loss-undo" class="secondary-action">${t('common.undo')}</button><button id="loss-clear" class="secondary-action">${t('common.clear')}</button></div>`;
    }
    else if (pending.kind === 'RETREAT' && c.retreat) {
        body = `<h3>${t('combat.flow.retreat')}</h3><p>${t('combat.flow.retreatHelp', { id: esc(c.retreat.activeUnitId ?? '—') })}</p>${c.retreat.unitIds.length > 1 ? `<p>${t('combat.flow.retreatOrder')}</p><div class="combat-unit-list">${c.retreat.unitIds.map(id => `<button class="mini-button ${c.retreat.activeUnitId === id ? 'active' : ''}" data-retreater="${esc(id)}" ${c.retreat.completeUnitIds.includes(id) ? 'disabled' : ''}>${esc(id)}</button>`).join('')}</div>` : ''}<div class="loss-draft">${Object.entries(c.retreat.drafts).map(([id, path]) => `${esc(id)}: ${path.map(coreHexKey).join(' → ') || '—'}`).join('<br>')}</div>${Object.values(c.retreat.drafts).some(path => path.length) ? `<button id="retreat-undo" class="secondary-action">${t('common.undoStep')}</button>` : ''}`;
    }
    else if (pending.kind === 'ADVANCE_AFTER_COMBAT' && c.advance) {
        body = `<h3>${t('combat.flow.advance')}</h3><p>${c.advance.selectedUnitId ? t('combat.flow.advanceHelp', { id: esc(c.advance.selectedUnitId) }) : t('combat.flow.chooseAdvancer')}</p>${c.advance.unitIds.length > 1 ? `<div class="combat-unit-list">${c.advance.unitIds.map(id => `<button class="mini-button ${c.advance.selectedUnitId === id ? 'active' : ''}" aria-pressed="${c.advance.selectedUnitId === id}" data-advance-unit="${esc(id)}">${t('combat.flow.advancer', { id: esc(id) })}</button>`).join('')}</div>` : ''}<button id="pass-advance" class="secondary-action">${t('combat.passAdvance')}</button>`;
    }
    else if (pending.kind === 'BREAKTHROUGH_OPTION' && c.breakthrough) {
        body = `<p>${t('combat.flow.breakthrough', { max: c.breakthrough.maxHexes })}</p><div class="combat-unit-list">${c.breakthrough.eligibleUnitIds.map((id) => `<button class="mini-button ${c.breakthrough.selectedUnitId === id ? 'active' : ''}" data-breakthrough-unit="${esc(id)}">${esc(id)}</button>`).join('')}</div><div class="loss-draft">${c.breakthrough.path.map(coreHexKey).join(' → ') || t('combat.noBreakthroughDraft')}</div><div class="button-row"><button id="breakthrough-undo" class="secondary-action">${t('common.undo')}</button><button id="breakthrough-commit" class="secondary-action">${t('common.commit')}</button></div><button id="pass-breakthrough" class="secondary-action">${t('combat.passBreakthrough')}</button>`;
    }
    else if (pending.kind === 'SCHWERPUNKT_OPTION' && c.schwerpunkt) {
        body = `<p>${t('combat.flow.schwerpunkt')}</p><div class="phase-metric"><span>${t('common.target')}</span><strong>${c.schwerpunkt.target ? coreHexKey(c.schwerpunkt.target) : '—'}</strong></div><div class="combat-unit-list">${c.schwerpunkt.eligibleUnitIds.map((id) => `<button class="mini-button" data-schwerpunkt-unit="${esc(id)}" ${c.schwerpunkt.choices.some(choice => choice.unitId === id && c.schwerpunkt.target && coreHexKey(choice.target) === coreHexKey(c.schwerpunkt.target)) ? '' : 'disabled'}>${t('combat.attackWith', { id: esc(id) })}</button>`).join('')}</div><button id="pass-schwerpunkt" class="secondary-action">${t('combat.passSchwerpunkt')}</button>`;
    }
    const resolved = tx?.resolution ? `<div class="combat-card"><h3>${t('combat.resolvedCRT')}</h3><div class="dice-box"><span class="die">${tx.resolution.dice.die1}</span><span class="die">${tx.resolution.dice.die2}</span><strong>= ${tx.resolution.dice.total}</strong></div><div class="combat-grid"><span>${t('combat.crt')}</span><strong>${tx.resolution.crtResult}</strong><span>${t('combat.attackerLoss')}</span><strong>${tx.resolution.attackerLossSteps}</strong><span>${t('combat.defenderLoss')}</span><strong>${tx.resolution.defenderLossSteps}</strong><span>${t('combat.defenderRetreat')}</span><strong>${tx.resolution.defenderRetreatSteps}</strong></div></div>` : '';
    const context = tx?.context ? combatContextHtml(tx.context, t('combat.resolvedContext')) : '';
    return header + body + (tx?.resolution ? `<p class="combat-result-summary" role="status">${t('combat.lastResult', { result: tx.resolution.crtResult })} · ${t('combat.dice', { ...tx.resolution.dice })}</p>` : '') + `<details class="combat-advanced"><summary>${t('combat.flow.resultDetails')}</summary>${resolved}${context}</details></section>`;
}
function phasePanel(model) {
    if (model.deployment)
        return '';
    const ready = `<button id="ready-button" class="primary-action" type="button"><span class="advance-label"><small>${phaseLabel(model.phase)}</small>${t('common.advancePhase')}</span><span class="advance-arrow" aria-hidden="true">›</span></button>`;
    if (model.phase === 'GERMAN_SUPPLY_RAIL' && model.railRepair) {
        const r = model.railRepair;
        return `<section class="panel-block phase-actions"><span class="eyebrow">${t('rail.title')}</span><p>${t('rail.help')}</p><div class="phase-metric"><span>${t('rail.plan')}</span><strong>${t('rail.edges', { count: r.selectedEdgeKeys.length })}</strong></div><div class="phase-metric"><span>${t('rail.used')}</span><strong>${r.alreadyUsed ? t('common.yes') : t('common.no')}</strong></div><button id="rail-mode" class="secondary-action ${presentation.interactionMode === 'RAIL_REPAIR' ? 'active' : ''}">${t('rail.mode')}</button><div class="button-row"><button id="rail-no-engineer" class="mini-button ${!r.selectedEngineerUnitId ? 'active' : ''}">${t('rail.noEngineer')}</button>${r.engineers.map((eng) => `<button class="mini-button ${eng.selected ? 'active' : ''}" data-rail-engineer="${esc(eng.id)}">${esc(eng.id)}</button>`).join('')}</div>${issueHtml(r.issues)}<div class="button-row"><button id="rail-clear" class="secondary-action">${t('rail.clear')}</button><button id="rail-commit" class="secondary-action">${t('rail.commit')}</button></div>${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_MOVEMENT' || model.phase === 'SOVIET_MOVEMENT')) {
        const m = model.movement;
        return `<section class="panel-block phase-actions"><span class="eyebrow">${t('movement.title')}</span><p>${t('movement.help')}</p>${m ? `<div class="phase-metric"><span>${t('movement.path')}</span><strong>${t('movement.steps', { count: m.path.length })}</strong></div><div class="phase-metric"><span>${t('movement.mp')}</span><strong>${m.spentMP}/${m.maxMP}</strong></div>${issueHtml(m.issues)}<div class="button-row"><button id="move-undo" class="secondary-action">${t('common.undoStep')}</button><button id="move-cancel" class="secondary-action">${t('movement.cancel')}</button></div><button id="move-commit" class="secondary-action">${t('movement.commit')}</button>` : `<p>${t('common.selectUnit')}</p>`}${ready}</section>`;
    }
    if (model.phase === 'GERMAN_COMBAT' || model.phase === 'SOVIET_COMBAT')
        return combatPanel(model);
    if (model.phase === 'SOVIET_REINFORCEMENT_SUPPLY' && model.reinforcement) {
        const r = model.reinforcement;
        return `<section class="panel-block phase-actions"><span class="eyebrow">${t('reinforcement.title')}</span><div class="phase-metric"><span>${t('common.available')}</span><strong>${r.available.length}</strong></div><div class="phase-metric"><span>${t('common.delayed')}</span><strong>${r.delayed.length}</strong></div>${r.deployable ? `<p class="warning-note">${t('reinforcement.required')}</p>` : ''}<div class="reinforcement-list">${r.available.map((row) => `<button class="reinforcement-row ${r.selectedId === row.id ? 'selected' : ''}" data-reinforcement-id="${esc(row.id)}"><span>${esc(row.id)} · ${unitLabel(row.type)}</span><b>${t('game.turn', { turn: row.scheduledTurn })}</b><small>${row.delayed ? t('reinforcement.delayedPrefix') : ''}${row.stats ? `${row.stats.attack}-${row.stats.defense}-${row.stats.movement}` : enumLabel(row.resolution)}</small></button>`).join('') || `<p>${t('reinforcement.none')}</p>`}</div><p>${r.selectedId ? t('reinforcement.entryHelp') : t('reinforcement.selectHelp')}</p>${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_RECOVERY' || model.phase === 'SOVIET_RECOVERY') && model.recovery) {
        const r = model.recovery;
        return `<section class="panel-block phase-actions"><span class="eyebrow">${t('recovery.title')}</span><div class="phase-metric"><span>${t('recovery.recovered')}</span><strong>${r.recoveredCount}/${r.limit}</strong></div><div class="phase-metric"><span>${t('recovery.rp')}</span><strong>${model.rp[model.activeSide]}</strong></div>${model.selectedCounter ? `<div class="phase-metric"><span>${t('recovery.cost')}</span><strong>${r.selectedCost ?? '—'} ${t('resource.rp')}</strong></div>${issueHtml(r.selectedIssues)}<button id="recover-unit" class="secondary-action">${t('recovery.commit')}</button>` : `<p>${t('recovery.help')}</p>`}${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_ENTRENCHMENT' || model.phase === 'SOVIET_ENTRENCHMENT') && model.entrench) {
        const e = model.entrench;
        return `<section class="panel-block phase-actions"><span class="eyebrow">${t('entrenchment.title')}</span>${model.selectedCounter ? `${issueHtml(e.selectedIssues)}<button id="entrench-unit" class="secondary-action">${t('entrenchment.commit')}</button>` : `<p>${t('entrenchment.help')}</p>`}${ready}</section>`;
    }
    return `<section class="panel-block phase-actions"><span class="eyebrow">${t('common.phase')}</span><p>${phaseLabel(model.phase)}</p>${ready}</section>`;
}
function viewerSwitch(model) { if (!isDeploymentPhase(session.state) || !presentation.debug)
    return ''; return `<section class="panel-block"><span class="eyebrow">HIDDEN-VIEW REGRESSION</span><p>Development-only viewer switch.</p><div class="viewer-buttons"><button data-view-side="SOVIET" class="mini-button ${model.viewerSide === 'SOVIET' ? 'active' : ''}">Soviet</button><button data-view-side="GERMAN" class="mini-button ${model.viewerSide === 'GERMAN' ? 'active' : ''}">German</button></div></section>`; }
function privacyGate() { const gate = presentation.privacyGate; if (!gate)
    return ''; if (gate === 'COMBAT_DECISION') {
    const owner = session?.state.pendingDecision?.decisionOwnerControllerId ?? '';
    const side = owner && session?.state.controllers[owner]?.side === 'SOVIET' ? 'Soviet' : 'German';
    return privacyHandoffMarkup(gate, side);
} return privacyHandoffMarkup(gate); }
function gameOver(model) { return gameOverMarkup(model.victory.winner, model.victory.reason, model.turn); }
function startNewGame() { deploymentTouch = createDeploymentTouch(); if (!productionMap || !cachedTerrainSurface) {
    appStatus = 'FATAL';
    fatalMessage = msg('game.noMap');
    render();
    return;
} session = createFreshProductionSession(productionMap); presentation = createPresentationState(developerUi && query.get('debug') === '1', window.matchMedia('(max-width: 1100px)').matches); presentation.rendererMode = 'production'; presentation.productionAssetSet = 'p5'; appStatus = 'PLAYING'; fatalMessage = ''; render(); }
function restartGame() { if (window.confirm(t('game.restartPrompt')))
    startNewGame(); }
function applyMapViewport() {
    const wrap = document.querySelector('#map-wrap'), svg = document.querySelector('#eastfront-map');
    if (!wrap || !svg)
        return;
    const transform = `translate(${mapViewport.panX}px, ${mapViewport.panY}px) scale(${mapViewport.zoom})`;
    svg.style.transform = transform;
    svg.style.transformOrigin = '50% 50%';
    const terrain = document.querySelector('#terrain-surface');
    if (terrain) {
        terrain.style.transform = transform;
        terrain.style.transformOrigin = '50% 50%';
    }
    wrap.dataset.zoom = mapViewport.zoom.toFixed(2);
    const readout = document.querySelector('#zoom-readout');
    if (readout)
        readout.textContent = `${Math.round(mapViewport.zoom * 100)}%`;
}
function bindMapViewport() {
    const wrap = document.querySelector('#map-wrap');
    if (!wrap)
        return;
    applyMapViewport();
    const points = new Map();
    let gesture = null;
    let pinch = null;
    let suppressNextClick = false;
    let panFrame = null;
    let latest = null;
    const local = (e) => { const r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 }; };
    const capture = (id) => { try {
        wrap.setPointerCapture?.(id);
    }
    catch { /* Capture may end during cancellation. */ } };
    const cancelFrame = () => { if (panFrame !== null)
        cancelAnimationFrame(panFrame); panFrame = null; };
    const flushPan = () => { panFrame = null; if (!gesture?.dragging || !latest)
        return; mapViewport = gesturePanViewport(gesture, latest.x, latest.y, mapViewport.zoom); applyMapViewport(); };
    const queuePan = (x, y) => { latest = { x, y }; if (panFrame === null)
        panFrame = requestAnimationFrame(flushPan); };
    const rebase = () => {
        const entries = [...points.entries()];
        pinch = null;
        gesture = null;
        latest = null;
        if (entries.length >= 2)
            pinch = { view: { ...mapViewport }, a: { ...entries[0][1] }, b: { ...entries[1][1] } };
        else if (entries.length === 1) {
            const [id, p] = entries[0];
            gesture = beginMapGesture(id, p.x, p.y, mapViewport);
            gesture.dragging = suppressNextClick;
        }
    };
    wrap.addEventListener('pointerdown', (event) => {
        const e = event;
        if (e.button !== 0)
            return;
        if (points.size === 0)
            suppressNextClick = false;
        cancelFrame();
        flushPan();
        points.set(e.pointerId, local(e));
        rebase();
        if (points.size >= 2) {
            suppressNextClick = true;
            for (const id of points.keys())
                capture(id);
            e.preventDefault();
        }
    });
    wrap.addEventListener('pointermove', (event) => {
        const e = event;
        if (!points.has(e.pointerId))
            return;
        const p = local(e);
        points.set(e.pointerId, p);
        if (pinch) {
            const [a, b] = [...points.values()];
            mapViewport = pinchMapViewport(pinch.view, pinch.a, pinch.b, a, b);
            applyMapViewport();
            e.preventDefault();
            return;
        }
        if (!gesture)
            return;
        gesture = updateMapGesture(gesture, p.x, p.y);
        if (!gesture.dragging)
            return;
        capture(e.pointerId);
        queuePan(p.x, p.y);
        e.preventDefault();
    });
    const finish = (event, cancelled = false) => {
        if (!points.has(event.pointerId))
            return;
        cancelFrame();
        if (!pinch && gesture) {
            if (!cancelled)
                latest = local(event);
            flushPan();
            suppressNextClick = suppressNextClick || dragSuppressesTap(gesture, cancelled);
        }
        points.delete(event.pointerId);
        rebase();
        if (wrap.hasPointerCapture?.(event.pointerId)) {
            try {
                wrap.releasePointerCapture?.(event.pointerId);
            }
            catch { }
        }
    };
    wrap.addEventListener('pointerup', (e) => finish(e));
    wrap.addEventListener('pointercancel', (e) => finish(e, true));
    wrap.addEventListener('lostpointercapture', (e) => finish(e, true));
    wrap.addEventListener('pointerleave', (e) => { const p = e; if (!wrap.hasPointerCapture?.(p.pointerId))
        finish(p, true); });
    wrap.addEventListener('click', (event) => { if (!suppressNextClick)
        return; event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }, true);
    wrap.addEventListener('wheel', (event) => { const e = event; e.preventDefault(); cancelFrame(); flushPan(); mapViewport = zoomMapAt(mapViewport, mapViewport.zoom + (e.deltaY < 0 ? .15 : -.15), local(e)); applyMapViewport(); rebase(); }, { passive: false });
}
function mapRenderOptions(model, lodOverride) {
    const vb = viewBoxForHexes(model.hexes), usableWidth = Math.max(560, window.innerWidth - (presentation.panelCollapsed ? 24 : 280));
    const screenHexWidth = usableWidth * ((Math.sqrt(3) * HEX_SIZE) / vb.width) * mapViewport.zoom;
    const lod = lodOverride ?? selectTerrainLod(screenHexWidth);
    const rendererMode = developerUi ? presentation.rendererMode : 'production';
    return { debug: developerUi && presentation.debug, rendererMode, assetSet: 'p5', lod, scenarioSeed: TERRAIN_VISUAL_SEED, staticTerrainSurface: rendererMode === 'production' };
}
function mountCachedTerrainSurface() {
    if (!cachedTerrainSurface)
        return;
    const wrap = document.querySelector('#map-wrap'), svg = document.querySelector('#eastfront-map');
    if (!wrap || !svg)
        return;
    cachedTerrainSurface = cachedTerrainSurfaces.get(svg.dataset.lod) ?? cachedTerrainSurface;
    const canvas = cachedTerrainSurface.canvas;
    const previous = document.querySelector('#terrain-surface');
    if (previous && previous !== canvas)
        previous.remove();
    if (canvas.parentElement !== wrap)
        wrap.insertBefore(canvas, svg);
    canvas.dataset.imageDraws = String(cachedTerrainSurface.stats.imageDraws);
    canvas.dataset.uniqueAssets = String(cachedTerrainSurface.stats.uniqueAssets);
}
function sidePanelMarkup(model) {
    return `<div class="command-panel-scroll">${model.combat ? phasePanel(model) : ''}${model.combat ? `<details class="combat-advanced"><summary>${t('combat.flow.unitDetails')}</summary>` : ''}<section class="panel-block selection-block"><span class="eyebrow command-title">${t('panel.title')}</span>${selectedSummary(model)}</section>${model.combat ? '</details>' : ''}${presentation.message && (!model.deployment || developerUi || deploymentTouch.status === 'idle') ? `<section class="panel-block status-message"><span class="eyebrow">${t('panel.report')}</span><p>${model.deployment && !developerUi ? esc(deploymentRejection(session.lastResult?.issues ?? [])) : esc(formatMessage(presentation.message))}</p></section>` : ''}${deploymentPanel(model)}${model.combat ? '' : phasePanel(model)}${developerUi ? viewerSwitch(model) : ''}${developerUi ? lastActionPanel(session) : ''}</div>${deploymentConfirm(model, presentation.selectedDeploymentUnitId, deploymentTouch)}`;
}
function refreshDynamicView() {
    if (!session || presentation.privacyGate) {
        render();
        return;
    }
    const model = deriveBrowserRenderModel(session, presentation);
    if (model.phase === 'GAME_OVER' || model.victory.winner) {
        render();
        return;
    }
    const svg = document.querySelector('#eastfront-map'), dynamic = document.querySelector('#map-dynamic-layer'), panel = document.querySelector('#side-panel');
    if (!svg || !dynamic || !panel) {
        render();
        return;
    }
    const lod = svg.dataset.lod ?? mapRenderOptions(model).lod;
    dynamic.innerHTML = coreSvgDynamicMarkup(model, mapRenderOptions(model, lod));
    const openDetails = Array.from(panel.querySelectorAll('details')).map(el => el.open);
    const panelScroll = panel.querySelector('.command-panel-scroll')?.scrollTop ?? 0;
    const rosterScroll = panel.querySelector('.roster-list')?.scrollTop ?? 0;
    const locationScroll = panel.querySelector('.location-grid')?.scrollTop ?? 0;
    panel.innerHTML = sidePanelMarkup(model);
    panel.querySelectorAll('details').forEach((el, i) => { el.open = openDetails[i] ?? false; });
    const scroll = panel.querySelector('.command-panel-scroll');
    if (scroll)
        scroll.scrollTop = panelScroll;
    const roster = panel.querySelector('.roster-list'), locations = panel.querySelector('.location-grid');
    if (roster)
        roster.scrollTop = rosterScroll;
    if (locations)
        locations.scrollTop = locationScroll;
    bindDynamic();
    paintDeploymentFocus();
    applyMapViewport();
}
function render() {
    const profile = responsiveProfile(window.innerWidth, window.innerHeight);
    if (appStatus === 'LOADING') {
        root.innerHTML = loadingMarkup();
        bind();
        return;
    }
    if (appStatus === 'FATAL') {
        root.innerHTML = fatalMarkup(fatalMessage || t('game.noResources'));
        bind();
        return;
    }
    if (appStatus === 'HOME') {
        root.innerHTML = homeMarkup(profile);
        bind();
        return;
    }
    if (!session) {
        appStatus = 'FATAL';
        fatalMessage = msg('game.noSession');
        root.innerHTML = fatalMarkup(fatalMessage);
        bind();
        return;
    }
    if (presentation.privacyGate) {
        root.innerHTML = mobileAdvisoryMarkup(profile) + privacyGate();
        bind();
        return;
    }
    const model = deriveBrowserRenderModel(session, presentation);
    if (model.phase === 'GAME_OVER' || model.victory.winner) {
        root.innerHTML = mobileAdvisoryMarkup(profile) + gameOver(model);
        bind();
        return;
    }
    const debugControls = developerUi ? `<div class="developer-controls"><button id="renderer-toggle" class="debug-toggle production-toggle ${presentation.rendererMode === 'production' ? 'on' : ''}">${presentation.rendererMode === 'production' ? 'Production' : 'Prototype'}</button><button id="debug-toggle" class="debug-toggle ${presentation.debug ? 'on' : ''}" aria-pressed="${presentation.debug}">Debug Geometry <strong>${presentation.debug ? 'ON' : 'OFF'}</strong></button></div>` : '';
    root.innerHTML = `${mobileAdvisoryMarkup(profile)}<header class="topbar"><div class="brand"><span class="brand-mark">E</span><div><strong>EASTFRONT</strong><span>${t('game.preview')} · v${WEB_PREVIEW_VERSION}</span></div></div><div class="turn-strip command-hud">${commandHeader(model)}</div><div class="resource-strip">${languageControl()}<span>${t('resource.cp')} <strong>${model.cp[model.activeSide]}</strong></span><span>${t('resource.rp')} <strong>${model.rp[model.activeSide]}</strong></span><button id="restart-button" class="menu-button" type="button" title="${t('game.restartTitle')}">${t('game.newGame')}</button><button id="panel-toggle" class="menu-button" aria-expanded="${!presentation.panelCollapsed}">${t('game.panel')}</button></div></header><main class="workspace ${presentation.panelCollapsed ? 'panel-collapsed' : 'panel-open'} ${presentation.debug ? 'debug-active' : ''}" data-responsive-profile="${profile}"><section class="map-card"><div class="map-toolbar"><div><strong>${t('map.title')}</strong><span>${t('map.viewer', { side: sideLabel(model.viewerSide), phase: phaseLabel(model.phase) })}</span></div><div class="map-controls"><div class="zoom-controls" aria-label="${t('map.zoomControls')}"><button id="zoom-out" class="map-control-button" type="button" aria-label="${t('map.zoomOut')}">−</button><span id="zoom-readout">${Math.round(mapViewport.zoom * 100)}%</span><button id="zoom-in" class="map-control-button" type="button" aria-label="${t('map.zoomIn')}">+</button><button id="zoom-reset" class="map-control-button fit-button" type="button" aria-label="${t('map.fitLabel')}">${t('map.fit')}</button></div>${debugControls}</div></div><div id="map-wrap" class="map-wrap ${presentation.debug ? 'debug-on' : ''}" aria-label="${t('map.eastfront')}">${coreSvgMarkup(model, mapRenderOptions(model))}</div></section><aside id="side-panel" data-viewer-controller-id="${model.viewerControllerId}" class="side-panel" aria-hidden="${presentation.panelCollapsed}">${sidePanelMarkup(model)}</aside></main><footer><span>${t('campaign.name')}</span><span>${t('game.command')}</span></footer>`;
    mountCachedTerrainSurface();
    bind();
    paintDeploymentFocus();
}
function bind() {
    bindLanguageControl(root, render);
    document.querySelector('#new-game-button')?.addEventListener('click', () => startNewGame());
    document.querySelector('#reload-button')?.addEventListener('click', () => location.reload());
    if (!session)
        return;
    document.querySelector('#privacy-confirm')?.addEventListener('click', () => { deploymentTouch = createDeploymentTouch(); confirmPrivacyGate(session, presentation); if (session.state.pendingDecision)
        continueCombatFlow(session, presentation); render(); });
    document.querySelector('#restart-button')?.addEventListener('click', () => restartGame());
    document.querySelector('#renderer-toggle')?.addEventListener('click', () => { presentation.rendererMode = presentation.rendererMode === 'production' ? 'prototype' : 'production'; render(); });
    document.querySelector('#debug-toggle')?.addEventListener('click', () => { presentation.debug = !presentation.debug; render(); });
    document.querySelector('#panel-toggle')?.addEventListener('click', () => { presentation.panelCollapsed = !presentation.panelCollapsed; render(); });
    document.querySelector('#zoom-out')?.addEventListener('click', () => { mapViewport = zoomMapAt(mapViewport, mapViewport.zoom - .2, { x: 0, y: 0 }); applyMapViewport(); });
    document.querySelector('#zoom-in')?.addEventListener('click', () => { mapViewport = zoomMapAt(mapViewport, mapViewport.zoom + .2, { x: 0, y: 0 }); applyMapViewport(); });
    document.querySelector('#zoom-reset')?.addEventListener('click', () => { mapViewport = defaultMapViewport(); applyMapViewport(); });
    bindMapViewport();
    bindDynamic();
}
function showCombatView() {
    const panel = document.querySelector('#side-panel');
    if (panel && panel.dataset.viewerControllerId !== session?.activeViewerControllerId) {
        render();
        return;
    }
    if (presentation.panelCollapsed && (presentation.attackTarget || session?.state.pendingDecision)) {
        presentation.panelCollapsed = false;
        render();
    }
    else
        refreshDynamicView();
    const scroll = document.querySelector('.command-panel-scroll');
    if (scroll)
        scroll.scrollTop = 0;
}
function runCombatAction(action) {
    action();
    if (session?.lastResult?.accepted)
        continueCombatFlow(session, presentation);
    showCombatView();
}
let combatSubmitting = false;
async function submitCombatAttack() {
    if (combatSubmitting || !session)
        return;
    const button = document.querySelector('#attack-declare');
    if (!button || button.disabled)
        return;
    combatSubmitting = true;
    button.disabled = true;
    button.textContent = t('combat.submitting');
    button.setAttribute('aria-busy', 'true');
    const current = session, currentPresentation = presentation;
    try {
        // Let the busy feedback paint before Core applies the complete transaction chain.
        await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
        if (session !== current || presentation !== currentPresentation)
            return;
        attackAndContinue(current, presentation);
        showCombatView();
    }
    finally {
        combatSubmitting = false;
    }
}
function paintCombatTargets() {
    if (!session)
        return;
    const enabled = isCombatTargetSelection(session, presentation);
    const legal = new Set();
    if (enabled)
        for (const unit of Object.values(session.state.units)) {
            if (unit.alive && unit.side !== session.state.activeSide) {
                const key = coreHexKey(unit.hex);
                if (!legal.has(key) && combatTargetIssues(session, presentation, unit.hex).length === 0)
                    legal.add(key);
            }
        }
    document.querySelectorAll('[data-unit-id], [data-role="attack-target"]').forEach(el => {
        const key = el.dataset.hex ?? '', attackable = enabled && legal.has(key);
        const enemy = enabled && Object.values(session.state.units).some(unit => unit.alive && unit.side !== session.state.activeSide && coreHexKey(unit.hex) === key);
        el.classList.toggle('unavailable-combat-target', enemy && !attackable);
        const selected = attackable && !!presentation.attackTarget && coreHexKey(presentation.attackTarget) === key;
        el.classList.toggle('attackable-enemy', attackable);
        el.classList.toggle('selected-combat-target', selected);
        if (el.dataset.role === 'attack-target') {
            el.classList.toggle('unavailable-combat-target', !attackable);
            el.setAttribute('aria-disabled', String(!attackable));
            el.setAttribute('aria-pressed', String(selected));
        }
    });
}
function bindDynamic() {
    paintCombatTargets();
    document.querySelectorAll('[data-attack-unit]').forEach(el => el.addEventListener('click', () => {
        const id = el.dataset.attackUnit;
        if (!id || !session)
            return;
        toggleAttackUnit(session, presentation, id);
        refreshDynamicView();
    }));
    if (!session)
        return;
    document.querySelector('#confirm-deployment')?.addEventListener('click', event => {
        const button = event.currentTarget;
        button.disabled = true;
        button.textContent = t('deployment.submitting');
        confirmDeploymentTarget(deploymentTouch, session, presentation);
        refreshDynamicView();
    });
    document.querySelector('#ready-button')?.addEventListener('click', () => { deploymentTouch = createDeploymentTouch(); readyForPhase(session, presentation); render(); });
    document.querySelector('#rail-mode')?.addEventListener('click', () => { enterRailRepairMode(presentation); render(); });
    document.querySelector('#rail-clear')?.addEventListener('click', () => { cancelRailRepair(presentation); render(); });
    document.querySelector('#rail-commit')?.addEventListener('click', () => { commitRailRepair(session, presentation); render(); });
    document.querySelector('#rail-no-engineer')?.addEventListener('click', () => { selectRailEngineer(presentation, null); render(); });
    document.querySelectorAll('[data-rail-engineer]').forEach((el) => el.addEventListener('click', () => { selectRailEngineer(presentation, el.dataset.railEngineer ?? null); render(); }));
    document.querySelector('#move-undo')?.addEventListener('click', () => { undoMoveDraft(presentation); render(); });
    document.querySelector('#move-cancel')?.addEventListener('click', () => { cancelMoveDraft(presentation); render(); });
    document.querySelector('#move-commit')?.addEventListener('click', () => { commitMoveDraft(session, presentation); render(); });
    document.querySelector('#recover-unit')?.addEventListener('click', () => { recoverSelectedUnit(session, presentation); render(); });
    document.querySelector('#entrench-unit')?.addEventListener('click', () => { entrenchSelectedUnit(session, presentation); render(); });
    document.querySelectorAll('[data-deploy-destination]').forEach(element => element.addEventListener('click', () => { const key = element.dataset.deployDestination; if (!key)
        return; chooseTouchTarget(key); }));
    document.querySelectorAll('[data-deploy-unit-id]').forEach((element) => { const id = element.dataset.deployUnitId; if (!id)
        return; const action = () => { deploymentTouch = createDeploymentTouch(); selectDeploymentRosterUnit(presentation, id); refreshDynamicView(); }; element.addEventListener('click', action); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-unit-id]').forEach((element) => { const id = element.dataset.unitId; if (!id)
        return; const action = () => { if (chooseCounterTarget(id))
        return; if (!routeCombatDecisionCounter(session, presentation, id))
        selectCounter(session, presentation, id); showCombatView(); }; element.addEventListener('click', (event) => { event.stopPropagation(); action(); }); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-hit-unit-id]').forEach((element) => { const id = element.dataset.hitUnitId; if (!id)
        return; element.addEventListener('click', (event) => { event.stopPropagation(); if (chooseCounterTarget(id))
        return; if (!routeCombatDecisionCounter(session, presentation, id))
        selectCounter(session, presentation, id); showCombatView(); }); });
    document.querySelectorAll('[data-role="deployment-hex"]').forEach((element) => { const key = element.dataset.hex; if (!key)
        return; const action = () => { chooseTouchTarget(key); }; element.addEventListener('click', action); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-role="move-option"]').forEach((element) => { const key = element.dataset.hex; if (!key)
        return; const action = () => { extendMoveDraft(session, presentation, parseHex(key)); render(); }; element.addEventListener('click', action); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-role="rail-repair-edge"]').forEach((element) => { const key = element.dataset.edgeKey; if (!key)
        return; const action = () => { if (presentation.interactionMode !== 'RAIL_REPAIR')
        enterRailRepairMode(presentation); toggleRailRepairEdge(session, presentation, key); render(); }; element.addEventListener('click', action); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-reinforcement-id]').forEach((element) => { const id = element.dataset.reinforcementId; if (!id)
        return; element.addEventListener('click', () => { selectReinforcement(presentation, id); render(); }); });
    document.querySelectorAll('[data-role="reinforcement-entry"]').forEach((element) => { const key = element.dataset.hex; if (!key)
        return; const action = () => { deploySelectedReinforcement(session, presentation, parseHex(key)); render(); }; element.addEventListener('click', action); bindKeyboardActivation(element, action); });
    document.querySelector('#attack-toggle-selected')?.addEventListener('click', () => { if (presentation.selectedUnitId)
        toggleAttackUnit(session, presentation, presentation.selectedUnitId); render(); });
    document.querySelector('#attack-clear')?.addEventListener('click', () => { clearAttackDraft(presentation); render(); });
    document.querySelector('#attack-declare')?.addEventListener('click', () => { void submitCombatAttack(); });
    document.querySelector('#attack-art-none')?.addEventListener('click', () => { selectAttackerArtillery(presentation, null); refreshDynamicView(); });
    document.querySelectorAll('[data-attack-artillery]').forEach((el) => el.addEventListener('click', () => { selectAttackerArtillery(presentation, el.dataset.attackArtillery ?? null); refreshDynamicView(); }));
    document.querySelectorAll('[data-role="attack-target"]').forEach((el) => { const action = () => { const key = el.dataset.hex; if (key) {
        routeCombatTarget(session, presentation, parseHex(key));
        showCombatView();
    } }; el.addEventListener('click', action); bindKeyboardActivation(el, action); });
    document.querySelector('#pass-reaction')?.addEventListener('click', () => { runCombatAction(() => passCombatReaction(session, presentation)); });
    document.querySelectorAll('[data-defender-artillery]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.defenderArtillery; if (id) {
        runCombatAction(() => useDefenderArtillery(session, presentation, id));
    } }));
    document.querySelectorAll('[data-defender-hq]').forEach(el => el.addEventListener('click', () => { const pending = session.state.pendingDecision, hqUnitId = el.dataset.defenderHq; if (pending?.kind === 'DEFENDER_REACTION' && hqUnitId)
        runCombatAction(() => { dispatchGameAction(session, { type: 'COMBAT_REACTION', controllerId: session.activeViewerControllerId, battleId: pending.battleId, reaction: { kind: 'DEFENDER_HQ_COMMAND', hqUnitId, command: 'LAST_STAND' } }); }); }));
    document.querySelectorAll('[data-role="advance-option"]').forEach(el => { const action = () => { if (el.dataset.hex) {
        chooseAdvanceDestination(session, presentation, parseHex(el.dataset.hex));
        showCombatView();
    } }; el.addEventListener('click', action); bindKeyboardActivation(el, action); });
    document.querySelectorAll('[data-loss-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.lossUnit; if (id) {
        chooseLossAndContinue(session, presentation, id);
        showCombatView();
    } }));
    document.querySelector('#loss-undo')?.addEventListener('click', () => { undoLossDraft(presentation); render(); });
    document.querySelector('#loss-clear')?.addEventListener('click', () => { clearLossDraft(presentation); render(); });
    document.querySelectorAll('[data-retreater]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.retreater; if (id) {
        chooseRetreater(session, presentation, id);
        refreshDynamicView();
    } }));
    document.querySelectorAll('[data-role="retreat-option"], [data-retreat-destination]').forEach((el) => { const action = () => { const key = el.dataset.hex ?? el.dataset.retreatDestination; if (key) {
        chooseRetreatDestination(session, presentation, parseHex(key));
        showCombatView();
    } }; el.addEventListener('click', action); bindKeyboardActivation(el, action); });
    document.querySelector('#retreat-undo')?.addEventListener('click', () => { undoRetreatDestination(presentation); refreshDynamicView(); });
    document.querySelectorAll('[data-advance-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.advanceUnit; if (id) {
        chooseAdvancer(session, presentation, id);
        refreshDynamicView();
    } }));
    document.querySelector('#pass-advance')?.addEventListener('click', () => { runCombatAction(() => passAdvance(session, presentation)); });
    document.querySelectorAll('[data-breakthrough-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.breakthroughUnit; if (id) {
        selectBreakthroughUnit(presentation, id);
        render();
    } }));
    document.querySelectorAll('[data-role="breakthrough-option"]').forEach((el) => el.addEventListener('click', () => { const key = el.dataset.hex; if (key) {
        extendBreakthroughDraft(session, presentation, parseHex(key));
        render();
    } }));
    document.querySelector('#breakthrough-undo')?.addEventListener('click', () => { undoBreakthroughDraft(presentation); render(); });
    document.querySelector('#breakthrough-commit')?.addEventListener('click', () => { runCombatAction(() => commitBreakthrough(session, presentation)); });
    document.querySelector('#pass-breakthrough')?.addEventListener('click', () => { runCombatAction(() => passBreakthrough(session, presentation)); });
    document.querySelectorAll('[data-role="schwerpunkt-target"]').forEach((el) => el.addEventListener('click', () => { const key = el.dataset.hex; if (key) {
        selectSchwerpunktTarget(presentation, parseHex(key));
        render();
    } }));
    document.querySelectorAll('[data-schwerpunkt-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.schwerpunktUnit; if (id) {
        runCombatAction(() => commitSchwerpunkt(session, presentation, id));
    } }));
    document.querySelector('#pass-schwerpunkt')?.addEventListener('click', () => { runCombatAction(() => passSchwerpunkt(session, presentation)); });
    document.querySelectorAll('[data-view-side]').forEach((element) => { const side = element.dataset.viewSide; if (!side)
        return; element.addEventListener('click', () => { switchViewerForDevelopment(session, presentation, side); render(); }); });
}
async function boot() { appStatus = 'LOADING'; render(); let phase = 'manifest/map'; try {
    const [map] = await Promise.all([loadProductionMapFromUrl(), loadProductionRuntimeManifest()]);
    productionMap = map;
    phase = 'static-terrain-surface';
    const terrainSession = createFreshProductionSession(map, TERRAIN_VISUAL_SEED), terrainPresentation = createPresentationState(false, false), terrainModel = deriveBrowserRenderModel(terrainSession, terrainPresentation);
    const vs2 = await loadVS2TerrainSurfaceHooks();
    for (const lod of ['far', 'medium', 'close']) {
        cachedTerrainSurface = await buildCachedTerrainSurface(terrainModel, TERRAIN_VISUAL_SEED, 'p5', lod, vs2.worldBase);
        cachedTerrainSurfaces.set(lod, cachedTerrainSurface);
    }
    cachedTerrainSurface = cachedTerrainSurfaces.get('medium');
    console.info('EASTFRONT cached terrain surface ready', cachedTerrainSurface.stats);
    appStatus = 'HOME';
    session = null;
    render();
}
catch (error) {
    const detail = phase === 'static-terrain-surface' ? formatTerrainSurfaceFailure(error) : (error instanceof Error ? `${error.name}: ${error.message}` : String(error));
    const diagnostic = { phase, detail, capabilities: terrainSurfaceCapabilities() };
    console.error('EASTFRONT startup failed', diagnostic, error);
    appStatus = 'FATAL';
    fatalMessage = msg('game.resourceFailure', { detail });
    render();
} }
window.addEventListener('resize', () => { if (appStatus === 'HOME' || appStatus === 'PLAYING')
    render(); });
void boot();
// Lazy world-surface hook; the existing boot-time cache and image loader remain in use.
export async function loadVS2TerrainSurfaceHooks() {
    const { createVS2TerrainSurfaceHooks } = await import('./render/vs2TerrainSurface.js');
    return createVS2TerrainSurfaceHooks();
}
