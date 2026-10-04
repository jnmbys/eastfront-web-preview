import { validateGameStateIntegrity } from './integrity.js';
import { RulesEngine } from './RulesEngine.js';
const DEFAULT_MAX_ACTIONS = 10000;
function validateMaxActions(maxActions) {
    if (!Number.isInteger(maxActions) || maxActions <= 0) {
        throw new Error('Headless maxActions must be a positive integer.');
    }
}
function isGameOver(state) {
    return state.phase === 'GAME_OVER' || state.victory.winner !== null;
}
function finishRun(state, actionResults, canonicalActions, events, terminationReason, acceptedActions, rejectedActions, integrityIssues) {
    return {
        finalState: structuredClone(state),
        actionResults,
        canonicalActions,
        events,
        terminationReason,
        actionsProcessed: actionResults.length,
        acceptedActions,
        rejectedActions,
        integrityIssues: structuredClone(integrityIssues)
    };
}
/**
 * Deterministic orchestration loop. This layer never advances phases or evaluates rules directly;
 * every state transition is produced by RulesEngine.apply().
 */
export function runHeadlessGame(initialState, rules, scenario, provider, options = {}) {
    const maxActions = options.maxActions ?? DEFAULT_MAX_ACTIONS;
    const stopOnRejectedAction = options.stopOnRejectedAction ?? false;
    const validateIntegrity = options.validateIntegrityAfterEachAction ?? true;
    validateMaxActions(maxActions);
    let currentState = structuredClone(initialState);
    const actionResults = [];
    const canonicalActions = [];
    const events = [];
    let acceptedActions = 0;
    let rejectedActions = 0;
    let previousResult = null;
    // A terminal initial state is already a completed session. Do not ask the provider for work.
    if (isGameOver(currentState)) {
        return finishRun(currentState, actionResults, canonicalActions, events, 'GAME_OVER', acceptedActions, rejectedActions, []);
    }
    if (validateIntegrity) {
        const issues = validateGameStateIntegrity(currentState, rules, scenario);
        if (issues.length > 0) {
            return finishRun(currentState, actionResults, canonicalActions, events, 'INTEGRITY_FAILURE', acceptedActions, rejectedActions, issues);
        }
    }
    const engine = new RulesEngine(rules, scenario);
    while (actionResults.length < maxActions) {
        const context = {
            state: structuredClone(currentState),
            actionIndex: actionResults.length,
            previousResult: previousResult ? structuredClone(previousResult) : null
        };
        const providedAction = provider(context);
        if (providedAction === null) {
            return finishRun(currentState, actionResults, canonicalActions, events, 'NO_ACTION', acceptedActions, rejectedActions, []);
        }
        const result = engine.apply(currentState, structuredClone(providedAction));
        actionResults.push(result);
        canonicalActions.push(structuredClone(result.action));
        events.push(...result.events.map((event) => structuredClone(event)));
        currentState = result.state;
        previousResult = result;
        if (result.accepted)
            acceptedActions += 1;
        else
            rejectedActions += 1;
        if (validateIntegrity) {
            const issues = validateGameStateIntegrity(currentState, rules, scenario);
            if (issues.length > 0) {
                return finishRun(currentState, actionResults, canonicalActions, events, 'INTEGRITY_FAILURE', acceptedActions, rejectedActions, issues);
            }
        }
        // A winning action has priority over the action-limit boundary reached by that same action.
        if (isGameOver(currentState)) {
            return finishRun(currentState, actionResults, canonicalActions, events, 'GAME_OVER', acceptedActions, rejectedActions, []);
        }
        if (!result.accepted && stopOnRejectedAction) {
            return finishRun(currentState, actionResults, canonicalActions, events, 'REJECTED_ACTION', acceptedActions, rejectedActions, []);
        }
    }
    return finishRun(currentState, actionResults, canonicalActions, events, 'ACTION_LIMIT', acceptedActions, rejectedActions, []);
}
/**
 * Exact canonical Action replay. Unlike a live session, GAME_OVER does not truncate the supplied
 * list: post-game canonical actions are resubmitted so RulesEngine can deterministically reject them.
 */
export function replayHeadlessActions(initialState, rules, scenario, canonicalActions, options = {}) {
    const validateIntegrity = options.validateIntegrityAfterEachAction ?? true;
    let currentState = structuredClone(initialState);
    const actionResults = [];
    const events = [];
    if (validateIntegrity) {
        const initialIssues = validateGameStateIntegrity(currentState, rules, scenario);
        if (initialIssues.length > 0) {
            return {
                finalState: structuredClone(currentState),
                actionResults,
                events,
                integrityIssues: structuredClone(initialIssues)
            };
        }
    }
    const engine = new RulesEngine(rules, scenario);
    for (const canonicalAction of canonicalActions) {
        const result = engine.apply(currentState, structuredClone(canonicalAction));
        actionResults.push(result);
        events.push(...result.events.map((event) => structuredClone(event)));
        currentState = result.state;
        if (validateIntegrity) {
            const issues = validateGameStateIntegrity(currentState, rules, scenario);
            if (issues.length > 0) {
                return {
                    finalState: structuredClone(currentState),
                    actionResults,
                    events,
                    integrityIssues: structuredClone(issues)
                };
            }
        }
    }
    return {
        finalState: structuredClone(currentState),
        actionResults,
        events,
        integrityIssues: []
    };
}
