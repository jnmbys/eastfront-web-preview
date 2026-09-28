import type { GameRules, ScenarioConfig } from '../core/config.js';
import type { Action, ActionResult, GameEvent, GameState, IntegrityIssue } from '../core/types.js';
import { validateGameStateIntegrity } from './integrity.js';
import { RulesEngine } from './RulesEngine.js';

export interface HeadlessActionContext {
  state: GameState;
  actionIndex: number;
  previousResult: ActionResult | null;
}

export type HeadlessActionProvider = (context: HeadlessActionContext) => Action | null;

export type HeadlessTerminationReason =
  | 'GAME_OVER'
  | 'NO_ACTION'
  | 'ACTION_LIMIT'
  | 'REJECTED_ACTION'
  | 'INTEGRITY_FAILURE';

export interface HeadlessRunOptions {
  maxActions?: number;
  stopOnRejectedAction?: boolean;
  validateIntegrityAfterEachAction?: boolean;
}

export interface HeadlessRunResult {
  finalState: GameState;
  actionResults: ActionResult[];
  canonicalActions: Action[];
  events: GameEvent[];
  terminationReason: HeadlessTerminationReason;
  actionsProcessed: number;
  acceptedActions: number;
  rejectedActions: number;
  integrityIssues: IntegrityIssue[];
}

export interface HeadlessReplayResult {
  finalState: GameState;
  actionResults: ActionResult[];
  events: GameEvent[];
  integrityIssues: IntegrityIssue[];
}

export interface HeadlessReplayOptions {
  validateIntegrityAfterEachAction?: boolean;
}

const DEFAULT_MAX_ACTIONS=10000;

function validateMaxActions(maxActions:number):void {
  if (!Number.isInteger(maxActions)||maxActions<=0) {
    throw new Error('Headless maxActions must be a positive integer.');
  }
}

function isGameOver(state:GameState):boolean {
  return state.phase==='GAME_OVER'||state.victory.winner!==null;
}

function finishRun(
  state:GameState,
  actionResults:ActionResult[],
  canonicalActions:Action[],
  events:GameEvent[],
  terminationReason:HeadlessTerminationReason,
  acceptedActions:number,
  rejectedActions:number,
  integrityIssues:IntegrityIssue[]
):HeadlessRunResult {
  return {
    finalState:structuredClone(state),
    actionResults,
    canonicalActions,
    events,
    terminationReason,
    actionsProcessed:actionResults.length,
    acceptedActions,
    rejectedActions,
    integrityIssues:structuredClone(integrityIssues)
  };
}

/**
 * Deterministic orchestration loop. This layer never advances phases or evaluates rules directly;
 * every state transition is produced by RulesEngine.apply().
 */
export function runHeadlessGame(
  initialState:GameState,
  rules:GameRules,
  scenario:ScenarioConfig,
  provider:HeadlessActionProvider,
  options:HeadlessRunOptions={}
):HeadlessRunResult {
  const maxActions=options.maxActions??DEFAULT_MAX_ACTIONS;
  const stopOnRejectedAction=options.stopOnRejectedAction??false;
  const validateIntegrity=options.validateIntegrityAfterEachAction??true;
  validateMaxActions(maxActions);

  let currentState=structuredClone(initialState);
  const actionResults:ActionResult[]=[];
  const canonicalActions:Action[]=[];
  const events:GameEvent[]=[];
  let acceptedActions=0;
  let rejectedActions=0;
  let previousResult:ActionResult|null=null;

  // A terminal initial state is already a completed session. Do not ask the provider for work.
  if (isGameOver(currentState)) {
    return finishRun(currentState,actionResults,canonicalActions,events,'GAME_OVER',acceptedActions,rejectedActions,[]);
  }

  if (validateIntegrity) {
    const issues=validateGameStateIntegrity(currentState,rules,scenario);
    if (issues.length>0) {
      return finishRun(currentState,actionResults,canonicalActions,events,'INTEGRITY_FAILURE',acceptedActions,rejectedActions,issues);
    }
  }

  const engine=new RulesEngine(rules,scenario);

  while (actionResults.length<maxActions) {
    const context:HeadlessActionContext={
      state:structuredClone(currentState),
      actionIndex:actionResults.length,
      previousResult:previousResult?structuredClone(previousResult):null
    };
    const providedAction=provider(context);
    if (providedAction===null) {
      return finishRun(currentState,actionResults,canonicalActions,events,'NO_ACTION',acceptedActions,rejectedActions,[]);
    }

    const result=engine.apply(currentState,structuredClone(providedAction));
    actionResults.push(result);
    canonicalActions.push(structuredClone(result.action));
    events.push(...result.events.map((event)=>structuredClone(event)));
    currentState=result.state;
    previousResult=result;
    if (result.accepted) acceptedActions+=1;
    else rejectedActions+=1;

    if (validateIntegrity) {
      const issues=validateGameStateIntegrity(currentState,rules,scenario);
      if (issues.length>0) {
        return finishRun(currentState,actionResults,canonicalActions,events,'INTEGRITY_FAILURE',acceptedActions,rejectedActions,issues);
      }
    }

    // A winning action has priority over the action-limit boundary reached by that same action.
    if (isGameOver(currentState)) {
      return finishRun(currentState,actionResults,canonicalActions,events,'GAME_OVER',acceptedActions,rejectedActions,[]);
    }

    if (!result.accepted&&stopOnRejectedAction) {
      return finishRun(currentState,actionResults,canonicalActions,events,'REJECTED_ACTION',acceptedActions,rejectedActions,[]);
    }
  }

  return finishRun(currentState,actionResults,canonicalActions,events,'ACTION_LIMIT',acceptedActions,rejectedActions,[]);
}

/**
 * Exact canonical Action replay. Unlike a live session, GAME_OVER does not truncate the supplied
 * list: post-game canonical actions are resubmitted so RulesEngine can deterministically reject them.
 */
export function replayHeadlessActions(
  initialState:GameState,
  rules:GameRules,
  scenario:ScenarioConfig,
  canonicalActions:readonly Action[],
  options:HeadlessReplayOptions={}
):HeadlessReplayResult {
  const validateIntegrity=options.validateIntegrityAfterEachAction??true;
  let currentState=structuredClone(initialState);
  const actionResults:ActionResult[]=[];
  const events:GameEvent[]=[];

  if (validateIntegrity) {
    const initialIssues=validateGameStateIntegrity(currentState,rules,scenario);
    if (initialIssues.length>0) {
      return {
        finalState:structuredClone(currentState),
        actionResults,
        events,
        integrityIssues:structuredClone(initialIssues)
      };
    }
  }

  const engine=new RulesEngine(rules,scenario);
  for (const canonicalAction of canonicalActions) {
    const result=engine.apply(currentState,structuredClone(canonicalAction));
    actionResults.push(result);
    events.push(...result.events.map((event)=>structuredClone(event)));
    currentState=result.state;

    if (validateIntegrity) {
      const issues=validateGameStateIntegrity(currentState,rules,scenario);
      if (issues.length>0) {
        return {
          finalState:structuredClone(currentState),
          actionResults,
          events,
          integrityIssues:structuredClone(issues)
        };
      }
    }
  }

  return {
    finalState:structuredClone(currentState),
    actionResults,
    events,
    integrityIssues:[]
  };
}
