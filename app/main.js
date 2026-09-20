import { combatAttackPanel } from './ui/combatAttackPanel.js';
import { deploymentFocus, deploymentRejection } from './ui/deploymentPolish.js';
import { createDeploymentTouch, chooseDeploymentTarget, confirmDeploymentTarget } from './ui/deploymentTouch.js';
import { commandHeader, deploymentLocations, deploymentConfirm, deploymentFeedback, unitDescription, unitLabel } from './ui/commandPresentation.js';
import { coreHexKey, isDeploymentPhase } from './core-adapter/core.js';
import { createLocalGameSession, loadProductionMapFromUrl } from './core-adapter/session.js';
import { advanceAfterCombat, appendLossDraft, cancelMoveDraft, cancelRailRepair, clearAttackDraft, clearLossDraft, commitBreakthrough, commitLosses, commitMoveDraft, commitRailRepair, commitRetreat, commitSchwerpunkt, confirmPrivacyGate, declareAttack, deploySelectedReinforcement, deploySelectedUnit, enterRailRepairMode, entrenchSelectedUnit, extendBreakthroughDraft, extendMoveDraft, extendRetreatDraft, passAdvance, passBreakthrough, passCombatReaction, passSchwerpunkt, readyForPhase, recoverSelectedUnit, routeCombatTarget, isCombatTargetSelection, combatTargetIssues, selectAttackerArtillery, selectBreakthroughUnit, selectCounter, selectDeploymentRosterUnit, selectRailEngineer, selectReinforcement, selectRetreater, selectSchwerpunktTarget, switchViewerForDevelopment, toggleAttackUnit, toggleRailRepairEdge, undoBreakthroughDraft, undoLossDraft, undoMoveDraft, undoRetreatStep, useDefenderArtillery, } from './interaction/intents.js';
import { deriveBrowserRenderModel } from './render/coreModel.js';
import { coreSvgDynamicMarkup, coreSvgMarkup, viewBoxForHexes } from './render/coreSvg.js';
import { selectTerrainLod } from './render/terrainAssets.js';
import { buildCachedTerrainSurface, formatTerrainSurfaceFailure, terrainSurfaceCapabilities } from './render/terrainSurface.js';
import { HEX_SIZE } from './geometry/hex.js';
import { createPresentationState } from './state/presentation.js';
import { createFreshProductionSession, defaultMapViewport, fatalMarkup, gameOverMarkup, homeMarkup, loadingMarkup, loadProductionRuntimeManifest, mobileAdvisoryMarkup, privacyHandoffMarkup, productionDeveloperUiAllowed, responsiveProfile, WEB_PREVIEW_VERSION } from './web/preview.js';
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
function sideLabel(side) { return side === 'GERMAN' ? 'German Side' : 'Soviet Side'; }
function phaseLabel(phase) { return phase.replaceAll('_', ' '); }
function issueHtml(issues) { return issues.length ? `<div class="issue-list">${issues.map((issue) => `<span>${esc(issue.code)} · ${esc(issue.message)}</span>`).join('')}</div>` : '<div class="issue-list"><span>Core preview: legal</span></div>'; }
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
        return '<div class="command-empty"><span class="command-reticle" aria-hidden="true">◇</span><p>Select a unit to inspect strength, supply and movement.</p></div>';
    return `<div class="unit-dossier">${rosterEmblem(unit.type)}<div><span class="eyebrow">${unitLabel(unit.type)}</span><strong>${esc(unit.id)}</strong><span>${unit.side}</span></div></div><dl class="unit-readings"><div><dt>Attack</dt><dd>${unit.stats.attack}</dd></div><div><dt>Defense</dt><dd>${unit.stats.defense}</dd></div><div><dt>Movement</dt><dd>${unit.stats.movement}</dd></div></dl><div class="unit-status"><span>Supply</span><strong>${esc(unit.supplyState.replaceAll('_', ' '))}</strong><span>Status</span><strong>Step ${unit.step}${unit.entrenched ? ' · Entrenched' : ''}</strong><span>Position</span><strong>${coreHexKey(unit.hex)}</strong></div>`;
}
// Decorative roster identity only; canonical unit types and actions are unchanged.
function rosterEmblem(type) {
    const infantry = '<path d="M5 6L23 22M23 6L5 22"/>';
    const armor = '<ellipse cx="14" cy="14" rx="10" ry="6"/>';
    const symbols = { INFANTRY: infantry, JAGER: infantry + '<text x="14" y="17" text-anchor="middle">J</text>', ELITE_INFANTRY: infantry + '<text x="14" y="17" text-anchor="middle">E</text>', PANZER: armor, TANK: armor, HEAVY_TANK: armor + '<path d="M5 23H23"/>', MOTORIZED: armor + infantry, ARTILLERY: '<circle cx="14" cy="14" r="4" fill="currentColor"/>', ENGINEER: '<text x="14" y="18" text-anchor="middle">E</text>', ANTI_TANK: '<text x="14" y="18" text-anchor="middle">AT</text>', RECON: '<path d="M5 23L23 5"/>', HQ: '<text x="14" y="18" text-anchor="middle">HQ</text>' };
    return `<span class="roster-emblem" aria-hidden="true"><svg viewBox="0 0 28 28">${symbols[type] ?? '<path d="M14 4L24 14L14 24L4 14Z"/>'}</svg></span>`;
}
function deploymentPanel(model) { const deployment = model.deployment; if (!deployment)
    return ''; const active = model.activeSide === model.viewerSide; const selected = presentation.selectedDeploymentUnitId; const rows = deployment.roster.map((row) => `<button type="button" class="roster-row ${row.placed ? 'placed' : 'unplaced'} ${selected === row.id ? 'selected' : ''}" data-deploy-unit-id="${esc(row.id)}" ${active ? '' : 'disabled'} aria-pressed="${selected === row.id}">${rosterEmblem(row.type)}<span>${unitLabel(row.type)}</span><small>${esc(row.id)} · ${unitDescription(row.type)}<br>A ${row.stats.attack} · D ${row.stats.defense} · M ${row.stats.movement}</small><b>${row.placed ? 'ON MAP' : 'RESERVE'}</b></button>`).join(''); return `<section class="panel-block deployment-panel"><span class="eyebrow">${sideLabel(model.viewerSide).toUpperCase()} DEPLOYMENT</span><div class="deployment-progress"><strong>${deployment.deployed}/${deployment.total}</strong><span>${deployment.complete ? 'Complete' : 'Place all units'}</span></div><ol class="deployment-steps"><li class="${selected ? 'done' : 'current'}">Select unit</li><li class="${selected ? 'current' : ''}">Choose position</li><li>Deploy</li></ol><p class="deployment-guidance" role="status">${selected ? `Selected: ${esc(selected)} — choose a terrain card or tap the map, then confirm deployment.` : 'Choose a reserve unit to begin deployment.'}</p><div class="roster-list">${rows}</div>${deploymentFeedback(deploymentTouch)}${deploymentLocations(model, selected, deploymentTouch)}<button id="ready-button" class="primary-action" type="button" ${active ? '' : 'disabled'}><span class="advance-label">Confirm deployment</span><span class="advance-arrow" aria-hidden="true">›</span></button>${!active ? '<p class="privacy-note">Viewer is not the active deployment side. Enemy setup remains hidden by the Core projection.</p>' : ''}</section>`; }
function modifierHtml(mods) { return ''; }
function combatContextHtml(context, label) {
    const m = context.modifiers;
    const rows = [['Terrain', m.terrainShift], ['River', m.riverShift], ['Engineer', m.engineerShift], ['Combined Arms', m.combinedArmsShift], ['Armor penalty', m.unsupportedArmorShift], ['AT', m.antiTankShift], ['Attacker Artillery', m.attackerArtilleryShift], ['Defender Artillery', m.defenderArtilleryShift], ['Flank', m.flankShift], ['Entrenchment', m.entrenchmentShift], ['HQ', m.hqShift], ['Second attack', m.secondAttackShift]].filter(([, v]) => v !== 0);
    return `<div class="combat-card"><h3>${label}</h3><div class="combat-grid"><span>Attack</span><strong>${context.attackStrength}</strong><span>Defense</span><strong>${context.defenseStrength}</strong><span>Base odds</span><strong>${esc(context.baseOdds)}</strong><span>Base column</span><strong>${context.baseCRTColumn}</strong><span>Final shift</span><strong>${context.finalShift}</strong><span>Final CRT</span><strong>${esc(context.finalCRTColumnLabel)}</strong></div>${rows.length ? `<div class="modifier-list">${rows.map(([k, v]) => `<span>${k}</span><strong>${Number(v) > 0 ? '+' : ''}${v}</strong>`).join('')}<span>Raw / capped</span><strong>${m.rawShift} / ${m.cappedShift}</strong></div>` : ''}</div>`;
}
function battleHistoryHtml(model) { const h = model.combat?.history ?? []; return h.length ? `<section class="panel-block battle-history"><span class="eyebrow">BATTLE HISTORY</span>${h.map((b) => `<div class="battle-history-row"><span>${esc(b.battleId)}${b.sourceBattleId ? ` ← ${esc(b.sourceBattleId)}` : ''}<br>${b.attackerSide}→${b.defenderSide} @ ${coreHexKey(b.target)}</span><strong>${b.crtResult ?? b.stage}</strong></div>`).join('')}</section>` : ''; }
function combatPanel(model) {
    const c = model.combat;
    if (!c)
        return '';
    const pending = c.pending, tx = c.battle;
    if (!pending)
        return combatAttackPanel(model, c.attackDraft.preview ? combatContextHtml(c.attackDraft.preview, 'COMBAT DETAILS') : '') + battleHistoryHtml(model);
    const header = `<section class="panel-block phase-actions pending-lock"><span class="eyebrow">COMBAT TRANSACTION · ${pending.kind}</span><div class="phase-metric"><span>Battle</span><strong>${esc(pending.battleId)}</strong></div><div class="phase-metric"><span>Decision owner</span><strong>${esc(pending.decisionOwnerControllerId)}</strong></div>`;
    let body = '';
    if (pending.kind === 'DEFENDER_REACTION') {
        body = `<p>Defender reaction window. Choose eligible defensive artillery or pass to resolve Core dice/CRT.</p><div class="combat-unit-list">${pending.eligibleArtilleryUnitIds.map((id) => `<button class="mini-button" data-defender-artillery="${esc(id)}">ART ${esc(id)}</button>`).join('') || '<span>No eligible defensive artillery.</span>'}</div><button id="pass-reaction" class="secondary-action">PASS REACTION / RESOLVE</button>`;
    }
    else if (pending.kind === 'LOSS_ALLOCATION' && c.loss) {
        body = `<p>Allocate ${c.loss.steps} loss step(s). Draft is presentation-only until commit.</p><div class="combat-unit-list">${c.loss.eligibleUnitIds.map((id) => `<button class="mini-button" data-loss-unit="${esc(id)}">${esc(id)} · cap ${c.loss.capacityByUnitId[id] ?? 0}</button>`).join('')}</div><div class="loss-draft">${c.loss.draft.join(' → ') || 'No drafted losses'}</div><div class="button-row"><button id="loss-undo" class="secondary-action">UNDO</button><button id="loss-clear" class="secondary-action">CLEAR</button></div><button id="loss-commit" class="secondary-action">COMMIT LOSSES</button>`;
    }
    else if (pending.kind === 'RETREAT' && c.retreat) {
        body = `<p>Required retreat: ${c.retreat.steps} step(s). Resolve units in an explicit order.</p><div class="combat-unit-list">${c.retreat.unitIds.map((id) => `<button class="mini-button ${c.retreat.activeUnitId === id ? 'active' : ''}" data-retreater="${esc(id)}">${esc(id)}</button>`).join('')}</div><p>Choose a retreat destination for <strong>${esc(c.retreat.activeUnitId ?? '—')}</strong>. Plan each listed unit, then commit all paths.</p><div class="button-row">${c.retreat.options.map(hex => `<button class="secondary-action" data-retreat-destination="${coreHexKey(hex)}">${esc(model.hexes.find(h => coreHexKey(h.coord) === coreHexKey(hex))?.terrain ?? 'Hex')} · ${coreHexKey(hex)}</button>`).join('') || '<span>No further legal step shown for this unit. Review the other units before committing.</span>'}</div><div class="loss-draft">${Object.entries(c.retreat.drafts).map(([id, path]) => `${id}: ${path.map(coreHexKey).join('→') || '—'}`).join('<br>')}</div><div class="button-row"><button id="retreat-undo" class="secondary-action">UNDO STEP</button><button id="retreat-commit" class="secondary-action">COMMIT RETREAT</button></div>`;
    }
    else if (pending.kind === 'ADVANCE_AFTER_COMBAT') {
        body = `<p>Advance into the vacated combat target, or pass.</p><div class="combat-unit-list">${pending.eligibleUnitIds.map((id) => `<button class="mini-button" data-advance-unit="${esc(id)}">ADVANCE ${esc(id)}</button>`).join('')}</div><button id="pass-advance" class="secondary-action">PASS ADVANCE</button>`;
    }
    else if (pending.kind === 'BREAKTHROUGH_OPTION' && c.breakthrough) {
        body = `<p>Breakthrough path contains only extra Hexes after the original target. Max for selected unit: ${c.breakthrough.maxHexes}.</p><div class="combat-unit-list">${c.breakthrough.eligibleUnitIds.map((id) => `<button class="mini-button ${c.breakthrough.selectedUnitId === id ? 'active' : ''}" data-breakthrough-unit="${esc(id)}">${esc(id)}</button>`).join('')}</div><div class="loss-draft">${c.breakthrough.path.map(coreHexKey).join(' → ') || 'No extra Hex drafted'}</div><div class="button-row"><button id="breakthrough-undo" class="secondary-action">UNDO</button><button id="breakthrough-commit" class="secondary-action">COMMIT</button></div><button id="pass-breakthrough" class="secondary-action">PASS ALL BREAKTHROUGH</button>`;
    }
    else if (pending.kind === 'SCHWERPUNKT_OPTION' && c.schwerpunkt) {
        body = `<p>Optional German Schwerpunkt second attack. Select adjacent highlighted Soviet target.</p><div class="phase-metric"><span>Target</span><strong>${c.schwerpunkt.target ? coreHexKey(c.schwerpunkt.target) : '—'}</strong></div><div class="combat-unit-list">${c.schwerpunkt.eligibleUnitIds.map((id) => `<button class="mini-button" data-schwerpunkt-unit="${esc(id)}">ATTACK WITH ${esc(id)}</button>`).join('')}</div><button id="pass-schwerpunkt" class="secondary-action">PASS SCHWERPUNKT</button>`;
    }
    const resolved = tx?.resolution ? `<div class="combat-card"><h3>RESOLVED CORE CRT</h3><div class="dice-box"><span class="die">${tx.resolution.dice.die1}</span><span class="die">${tx.resolution.dice.die2}</span><strong>= ${tx.resolution.dice.total}</strong></div><div class="combat-grid"><span>CRT</span><strong>${tx.resolution.crtResult}</strong><span>Attacker loss</span><strong>${tx.resolution.attackerLossSteps}</strong><span>Defender loss</span><strong>${tx.resolution.defenderLossSteps}</strong><span>Defender retreat</span><strong>${tx.resolution.defenderRetreatSteps}</strong></div></div>` : '';
    const context = tx?.context ? combatContextHtml(tx.context, 'RESOLVED COMBAT CONTEXT') : '';
    return header + body + resolved + context + '</section>' + battleHistoryHtml(model);
}
function phasePanel(model) {
    if (model.deployment)
        return '';
    const ready = `<button id="ready-button" class="primary-action" type="button"><span class="advance-label"><small>${phaseLabel(model.phase)}</small>Advance phase</span><span class="advance-arrow" aria-hidden="true">›</span></button>`;
    if (model.phase === 'GERMAN_SUPPLY_RAIL' && model.railRepair) {
        const r = model.railRepair;
        return `<section class="panel-block phase-actions"><span class="eyebrow">GERMAN SUPPLY / RAIL</span><p>Optional Rail Repair uses real Core railway edges. Ready skips repair.</p><div class="phase-metric"><span>Plan</span><strong>${r.selectedEdgeKeys.length} edges</strong></div><div class="phase-metric"><span>Repair used</span><strong>${r.alreadyUsed ? 'YES' : 'NO'}</strong></div><button id="rail-mode" class="secondary-action ${presentation.interactionMode === 'RAIL_REPAIR' ? 'active' : ''}">RAIL REPAIR MODE</button><div class="button-row"><button id="rail-no-engineer" class="mini-button ${!r.selectedEngineerUnitId ? 'active' : ''}">No Engineer</button>${r.engineers.map((eng) => `<button class="mini-button ${eng.selected ? 'active' : ''}" data-rail-engineer="${esc(eng.id)}">${esc(eng.id)}</button>`).join('')}</div>${issueHtml(r.issues)}<div class="button-row"><button id="rail-clear" class="secondary-action">CLEAR PLAN</button><button id="rail-commit" class="secondary-action">COMMIT REPAIR</button></div>${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_MOVEMENT' || model.phase === 'SOVIET_MOVEMENT')) {
        const m = model.movement;
        return `<section class="panel-block phase-actions"><span class="eyebrow">MOVEMENT</span><p>Select a controlled unit, then tap adjacent Hexes to draft a path. The Counter stays put until Core accepts Commit Move.</p>${m ? `<div class="phase-metric"><span>Path</span><strong>${m.path.length} steps</strong></div><div class="phase-metric"><span>MP</span><strong>${m.spentMP}/${m.maxMP}</strong></div>${issueHtml(m.issues)}<div class="button-row"><button id="move-undo" class="secondary-action">UNDO STEP</button><button id="move-cancel" class="secondary-action">CANCEL PATH</button></div><button id="move-commit" class="secondary-action">COMMIT MOVE</button>` : '<p>Select one of your units to begin.</p>'}${ready}</section>`;
    }
    if (model.phase === 'GERMAN_COMBAT' || model.phase === 'SOVIET_COMBAT')
        return combatPanel(model);
    if (model.phase === 'SOVIET_REINFORCEMENT_SUPPLY' && model.reinforcement) {
        const r = model.reinforcement;
        return `<section class="panel-block phase-actions"><span class="eyebrow">SOVIET REINFORCEMENT / SUPPLY</span><div class="phase-metric"><span>Available</span><strong>${r.available.length}</strong></div><div class="phase-metric"><span>Delayed</span><strong>${r.delayed.length}</strong></div>${r.deployable ? '<p class="warning-note">Deployable reinforcement remains. Core will reject Ready until it is handled.</p>' : ''}<div class="reinforcement-list">${r.available.map((row) => `<button class="reinforcement-row ${r.selectedId === row.id ? 'selected' : ''}" data-reinforcement-id="${esc(row.id)}"><span>${esc(row.id)} · ${row.type}</span><b>T${row.scheduledTurn}</b><small>${row.delayed ? 'DELAYED · ' : ''}${row.stats ? `${row.stats.attack}-${row.stats.defense}-${row.stats.movement}` : row.resolution}</small></button>`).join('') || '<p>No available reinforcements.</p>'}</div><p>${r.selectedId ? 'Tap a highlighted East Rail Exit to deploy the selected reinforcement.' : 'Select a reinforcement to deploy.'}</p>${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_RECOVERY' || model.phase === 'SOVIET_RECOVERY') && model.recovery) {
        const r = model.recovery;
        return `<section class="panel-block phase-actions"><span class="eyebrow">RECOVERY</span><div class="phase-metric"><span>Recovered</span><strong>${r.recoveredCount}/${r.limit}</strong></div><div class="phase-metric"><span>Side RP</span><strong>${model.rp[model.activeSide]}</strong></div>${model.selectedCounter ? `<div class="phase-metric"><span>Selected cost</span><strong>${r.selectedCost ?? '—'} RP</strong></div>${issueHtml(r.selectedIssues)}<button id="recover-unit" class="secondary-action">RECOVER 1 STEP</button>` : '<p>Select a damaged controlled unit. Recovery bases are softly outlined on the map.</p>'}${ready}</section>`;
    }
    if ((model.phase === 'GERMAN_ENTRENCHMENT' || model.phase === 'SOVIET_ENTRENCHMENT') && model.entrench) {
        const e = model.entrench;
        return `<section class="panel-block phase-actions"><span class="eyebrow">ENTRENCHMENT</span>${model.selectedCounter ? `${issueHtml(e.selectedIssues)}<button id="entrench-unit" class="secondary-action">ENTRENCH UNIT</button>` : '<p>Select a controlled unit to preview Entrench legality.</p>'}${ready}</section>`;
    }
    return `<section class="panel-block phase-actions"><span class="eyebrow">PHASE</span><p>${phaseLabel(model.phase)}</p>${ready}</section>`;
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
    fatalMessage = 'Production map surface is unavailable.';
    render();
    return;
} session = createFreshProductionSession(productionMap, 17); presentation = createPresentationState(developerUi && query.get('debug') === '1', window.matchMedia('(max-width: 1100px)').matches); presentation.rendererMode = 'production'; presentation.productionAssetSet = 'p5'; appStatus = 'PLAYING'; fatalMessage = ''; render(); }
function restartGame() { if (window.confirm('Start a new game?\nCurrent progress will be lost.'))
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
    return { debug: developerUi && presentation.debug, rendererMode, assetSet: 'p5', lod, scenarioSeed: session.state.random.seed, staticTerrainSurface: rendererMode === 'production' };
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
    return `<div class="command-panel-scroll"><section class="panel-block selection-block"><span class="eyebrow command-title">COMMAND PANEL</span>${selectedSummary(model)}</section>${presentation.message && (!model.deployment || developerUi || deploymentTouch.status === 'idle') ? `<section class="panel-block status-message"><span class="eyebrow">ORDER REPORT</span><p>${model.deployment && !developerUi ? esc(deploymentRejection(session.lastResult?.issues ?? [])) : esc(presentation.message)}</p></section>` : ''}${deploymentPanel(model)}${phasePanel(model)}${developerUi ? viewerSwitch(model) : ''}${developerUi ? lastActionPanel(session) : ''}</div>${deploymentConfirm(model, presentation.selectedDeploymentUnitId, deploymentTouch)}`;
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
        return;
    }
    if (appStatus === 'FATAL') {
        root.innerHTML = fatalMarkup(fatalMessage || 'Required production resources could not be initialized.');
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
        fatalMessage = 'No active production session.';
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
    root.innerHTML = `${mobileAdvisoryMarkup(profile)}<header class="topbar"><div class="brand"><span class="brand-mark">E</span><div><strong>EASTFRONT</strong><span>WEB PREVIEW · v${WEB_PREVIEW_VERSION}</span></div></div><div class="turn-strip command-hud">${commandHeader(model)}</div><div class="resource-strip"><span>CP <strong>${model.cp[model.activeSide]}</strong></span><span>RP <strong>${model.rp[model.activeSide]}</strong></span><button id="restart-button" class="menu-button" type="button" title="Start a fresh production game">NEW GAME</button><button id="panel-toggle" class="menu-button" aria-expanded="${!presentation.panelCollapsed}">PANEL</button></div></header><main class="workspace ${presentation.panelCollapsed ? 'panel-collapsed' : 'panel-open'} ${presentation.debug ? 'debug-active' : ''}" data-responsive-profile="${profile}"><section class="map-card"><div class="map-toolbar"><div><strong>Strategic Reset F · Operations map</strong><span>${sideLabel(model.viewerSide)} view · ${phaseLabel(model.phase)}</span></div><div class="map-controls"><div class="zoom-controls" aria-label="Map zoom controls"><button id="zoom-out" class="map-control-button" type="button" aria-label="Zoom out">−</button><span id="zoom-readout">${Math.round(mapViewport.zoom * 100)}%</span><button id="zoom-in" class="map-control-button" type="button" aria-label="Zoom in">+</button><button id="zoom-reset" class="map-control-button fit-button" type="button" aria-label="Fit map">FIT</button></div>${debugControls}</div></div><div id="map-wrap" class="map-wrap ${presentation.debug ? 'debug-on' : ''}" aria-label="EASTFRONT operational map">${coreSvgMarkup(model, mapRenderOptions(model))}</div></section><aside id="side-panel" class="side-panel" aria-hidden="${presentation.panelCollapsed}">${sidePanelMarkup(model)}</aside></main><footer><span>STRATEGIC RESET F</span><span>EASTFRONT · Operational Command</span></footer>`;
    mountCachedTerrainSurface();
    bind();
    paintDeploymentFocus();
}
function bind() {
    document.querySelector('#new-game-button')?.addEventListener('click', () => startNewGame());
    document.querySelector('#reload-button')?.addEventListener('click', () => location.reload());
    if (!session)
        return;
    document.querySelector('#privacy-confirm')?.addEventListener('click', () => { deploymentTouch = createDeploymentTouch(); confirmPrivacyGate(session, presentation); render(); });
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
        button.textContent = 'DEPLOYING…';
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
        return; selectCounter(session, presentation, id); refreshDynamicView(); }; element.addEventListener('click', (event) => { event.stopPropagation(); action(); }); bindKeyboardActivation(element, action); });
    document.querySelectorAll('[data-hit-unit-id]').forEach((element) => { const id = element.dataset.hitUnitId; if (!id)
        return; element.addEventListener('click', (event) => { event.stopPropagation(); if (chooseCounterTarget(id))
        return; selectCounter(session, presentation, id); refreshDynamicView(); }); });
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
    document.querySelector('#attack-declare')?.addEventListener('click', () => { const button = document.querySelector('#attack-declare'); if (button) {
        button.disabled = true;
        button.textContent = 'Submitting attack…';
    } declareAttack(session, presentation); render(); });
    document.querySelector('#attack-art-none')?.addEventListener('click', () => { selectAttackerArtillery(presentation, null); refreshDynamicView(); });
    document.querySelectorAll('[data-attack-artillery]').forEach((el) => el.addEventListener('click', () => { selectAttackerArtillery(presentation, el.dataset.attackArtillery ?? null); refreshDynamicView(); }));
    document.querySelectorAll('[data-role="attack-target"]').forEach((el) => { const action = () => { const key = el.dataset.hex; if (key) {
        routeCombatTarget(session, presentation, parseHex(key));
        refreshDynamicView();
    } }; el.addEventListener('click', action); bindKeyboardActivation(el, action); });
    document.querySelector('#pass-reaction')?.addEventListener('click', () => { passCombatReaction(session, presentation); render(); });
    document.querySelectorAll('[data-defender-artillery]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.defenderArtillery; if (id) {
        useDefenderArtillery(session, presentation, id);
        render();
    } }));
    document.querySelectorAll('[data-loss-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.lossUnit; if (id) {
        appendLossDraft(session, presentation, id);
        render();
    } }));
    document.querySelector('#loss-undo')?.addEventListener('click', () => { undoLossDraft(presentation); render(); });
    document.querySelector('#loss-clear')?.addEventListener('click', () => { clearLossDraft(presentation); render(); });
    document.querySelector('#loss-commit')?.addEventListener('click', () => { commitLosses(session, presentation); render(); });
    document.querySelectorAll('[data-retreater]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.retreater; if (id) {
        selectRetreater(presentation, id);
        render();
    } }));
    document.querySelectorAll('[data-role="retreat-option"], [data-retreat-destination]').forEach((el) => { const action = () => { const key = el.dataset.hex ?? el.dataset.retreatDestination; if (key) {
        extendRetreatDraft(session, presentation, parseHex(key));
        refreshDynamicView();
    } }; el.addEventListener('click', action); bindKeyboardActivation(el, action); });
    document.querySelector('#retreat-undo')?.addEventListener('click', () => { undoRetreatStep(presentation); render(); });
    document.querySelector('#retreat-commit')?.addEventListener('click', () => { commitRetreat(session, presentation); render(); });
    document.querySelectorAll('[data-advance-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.advanceUnit; if (id) {
        advanceAfterCombat(session, presentation, id);
        render();
    } }));
    document.querySelector('#pass-advance')?.addEventListener('click', () => { passAdvance(session, presentation); render(); });
    document.querySelectorAll('[data-breakthrough-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.breakthroughUnit; if (id) {
        selectBreakthroughUnit(presentation, id);
        render();
    } }));
    document.querySelectorAll('[data-role="breakthrough-option"]').forEach((el) => el.addEventListener('click', () => { const key = el.dataset.hex; if (key) {
        extendBreakthroughDraft(session, presentation, parseHex(key));
        render();
    } }));
    document.querySelector('#breakthrough-undo')?.addEventListener('click', () => { undoBreakthroughDraft(presentation); render(); });
    document.querySelector('#breakthrough-commit')?.addEventListener('click', () => { commitBreakthrough(session, presentation); render(); });
    document.querySelector('#pass-breakthrough')?.addEventListener('click', () => { passBreakthrough(session, presentation); render(); });
    document.querySelectorAll('[data-role="schwerpunkt-target"]').forEach((el) => el.addEventListener('click', () => { const key = el.dataset.hex; if (key) {
        selectSchwerpunktTarget(presentation, parseHex(key));
        render();
    } }));
    document.querySelectorAll('[data-schwerpunkt-unit]').forEach((el) => el.addEventListener('click', () => { const id = el.dataset.schwerpunktUnit; if (id) {
        commitSchwerpunkt(session, presentation, id);
        render();
    } }));
    document.querySelector('#pass-schwerpunkt')?.addEventListener('click', () => { passSchwerpunkt(session, presentation); render(); });
    document.querySelectorAll('[data-view-side]').forEach((element) => { const side = element.dataset.viewSide; if (!side)
        return; element.addEventListener('click', () => { switchViewerForDevelopment(session, presentation, side); render(); }); });
}
async function boot() { appStatus = 'LOADING'; render(); let phase = 'manifest/map'; try {
    const [map] = await Promise.all([loadProductionMapFromUrl(), loadProductionRuntimeManifest()]);
    productionMap = map;
    phase = 'static-terrain-surface';
    const terrainSession = createFreshProductionSession(map, 17), terrainPresentation = createPresentationState(false, false), terrainModel = deriveBrowserRenderModel(terrainSession, terrainPresentation);
    const vs2 = await loadVS2TerrainSurfaceHooks();
    for (const lod of ['far', 'medium', 'close']) {
        cachedTerrainSurface = await buildCachedTerrainSurface(terrainModel, terrainSession.state.random.seed, 'p5', lod, vs2.worldBase);
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
    fatalMessage = `Required production resources could not be loaded. ${detail}`;
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
