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
export function dispatchGameAction(session, action) {
    const previousState = session.state;
    const result = session.engine.apply(session.state, action);
    session.lastResult = result;
    if (!result.accepted) {
        return { result, stateReplaced: false, integrityIssues: session.integrityIssues };
    }
    session.state = result.state;
    session.integrityIssues = validateGameStateIntegrity(session.state, session.rules, session.scenario);
    publishPresentationTransition(session, previousState, result);
    return { result, stateReplaced: true, integrityIssues: session.integrityIssues };
}
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
