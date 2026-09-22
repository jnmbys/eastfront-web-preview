import {perf4} from '../perf004Trace.js';
import { derivePlayerView, rememberPlayerView } from '../player-view/playerView.js';
import { filterPresentationEvents } from '../player-view/presentationVisibility.js';
import { publishPresentationTransition } from '../presentation/transitionBus.js';
import { RulesEngine, createDeploymentGameState, defaultRules, defaultScenario, importLegacyMap, isDeploymentPhase, projectDeploymentView, validateGameStateIntegrity, } from './core.js';
export function controllerIdForSide(session, side) {
    const controller = Object.values(session.state.controllers).find((candidate) => candidate.side === side);
    if (!controller)
        throw new Error(`No configured ${side} controller.`);
    return controller.id;
}
export function createLocalGameSession(rawMap, seed = 17) {
    const imported = importLegacyMap(rawMap);
    const state = createDeploymentGameState({
        scenario: defaultScenario,
        rules: defaultRules,
        hexes: imported.hexes,
        edges: imported.edges,
        seed,
    });
    const sovietController = Object.values(state.controllers).find((controller) => controller.side === 'SOVIET');
    if (!sovietController)
        throw new Error('Frozen production scenario has no Soviet controller.');
    const integrityIssues = validateGameStateIntegrity(state, defaultRules, defaultScenario);
    return {
        state,
        scenario: defaultScenario,
        rules: defaultRules,
        engine: new RulesEngine(defaultRules, defaultScenario),
        activeViewerControllerId: sovietController.id,
        lastResult: null,
        integrityIssues,
    };
}
/** Presentation-only viewer switch; never mutates GameState. */
export function setActiveViewer(session, controllerId) {
    if (!session.state.controllers[controllerId])
        throw new Error(`Unknown viewer controller: ${controllerId}`);
    session.activeViewerControllerId = controllerId;
}
/**
 * Single UI mutation boundary. Accepted Core results replace authoritative state.
 * Rejected actions are surfaced but do not replace the browser session's canonical state.
 */
export function dispatchGameAction(session, action) {const __p4end=perf4.begin("core-adapter/session.js:dispatchGameAction");try{
    const previousState = session.state;
    const beforeView = sessionPlayerView(session);
    const result = session.engine.apply(session.state, action);
    session.lastResult = result;
    if (!result.accepted) {
        return { result, stateReplaced: false, integrityIssues: session.integrityIssues };
    }
    session.state = result.state;
    session.stateRevision = (session.stateRevision ?? 0) + 1;
    session.integrityIssues = validateGameStateIntegrity(session.state, session.rules, session.scenario);
    session.knowledge ??= {};
    for (const side of ['GERMAN', 'SOVIET']) {
        const observedBefore = derivePlayerView(previousState, side, session.rules, session.knowledge[side]);
        const memory = rememberPlayerView(observedBefore);
        session.knowledge[side] = rememberPlayerView(derivePlayerView(session.state, side, session.rules, memory));
    }
    const afterView = sessionPlayerView(session);
    const afterIds = new Set(afterView.units.map(u => u.id));
    if (beforeView.units.some(u => session.state.units[u.id]?.alive && !afterIds.has(u.id)))
        session.visibilityRevision = (session.visibilityRevision ?? 0) + 1;
    publishPresentationTransition(session, previousState, result, events => filterPresentationEvents(events, beforeView, afterView));
    return { result, stateReplaced: true, integrityIssues: session.integrityIssues };
}finally{__p4end();}}
export function deploymentProjection(session) {
    if (!isDeploymentPhase(session.state))
        return null;
    return projectDeploymentView(session.state, session.scenario, session.activeViewerControllerId);
}
export function loadProductionMapFromUrl(url = './vendor/eastfront-digital-core/reference/strategic-reset-f-map.json') {
    return fetch(url).then(async (response) => {
        if (!response.ok)
            throw new Error(`Failed to load production map: HTTP ${response.status}`);
        return await response.json();
    });
}
/** One immutable detached projection per live session. Identity + explicit revisions
 * invalidate accepted actions, replay/import and knowledge changes; UI state is not a key. */
const playerViews = new WeakMap();
function freezeProjection(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value))
            freezeProjection(child);
        Object.freeze(value);
    }
    return value;
}
/** Trusted local host projection boundary; renderer receives only this detached DTO. */
export function sessionPlayerView(session) {const __p4end=perf4.begin("core-adapter/session.js:sessionPlayerView");try{
    const viewer = session.viewOverride ?? session.state.controllers[session.activeViewerControllerId]?.side;
    if (!viewer)
        throw new Error('Unknown viewer');
    const knowledge = viewer === 'OBSERVER' ? undefined : session.knowledge?.[viewer], revision = session.stateRevision ?? 0, knowledgeRevision = session.knowledgeRevision ?? 0;
    const cached = playerViews.get(session);
    if (cached && cached.state === session.state && cached.revision === revision && cached.viewer === viewer && cached.rules === session.rules && cached.knowledge === knowledge && cached.knowledgeRevision === knowledgeRevision)
        return cached.view;
    const view = freezeProjection(derivePlayerView(session.state, viewer, session.rules, knowledge));
    playerViews.set(session, { state: session.state, revision, viewer, rules: session.rules, knowledge, knowledgeRevision, view });
    return view;
}finally{__p4end();}}
/** Host/debug capability. Never expose unrestricted observer selection in production hotseat. */
export function setInspectionViewer(session, viewer) { session.viewOverride = viewer; }
