# Victory Lifecycle — Task 002E-2

Task 002E-2 integrates the pure 002E-1 victory evaluator into the authoritative RulesEngine lifecycle. It does not redesign the capital condition or checkpoint timing.

## Lifecycle

```text
Final phase side-wide Ready barrier
↓
evaluate Victory checkpoint before normal endPhase()
↓
winner?
  yes:
    endPlayerTurn()
    write state.victory
    beginPhase(GAME_OVER)
    emit PhaseEnded(previousPhase -> GAME_OVER)
    stop
  no:
    normal endPhase()
```

The German checkpoint is evaluated when the side-wide Ready barrier completes in `GERMAN_ENTRENCHMENT`. The Soviet checkpoint is evaluated when the side-wide Ready barrier completes in `SOVIET_ENTRENCHMENT`.

Victory timing remains exactly the pure 002E-1 timing: before the final turn, Germany must hold the capital condition through the end of the Soviet Player Turn; on the final turn, the German Player Turn end immediately decides German victory or Soviet defense-to-turn-limit victory.

## GAME_OVER short-circuit

A winning checkpoint short-circuits normal `endPhase()`. The current Player Turn is closed with existing `endPlayerTurn()` cleanup, `state.victory` receives the pure checkpoint result, and `beginPhase('GAME_OVER')` clears the Ready barrier. No next Player Turn or Game Turn begins, and normal phase-entry supply hooks do not run.

`activeSide` remains the side whose Player Turn just ended because `GAME_OVER` has no side semantics. `victory.checkedAtPhase` remains the final checkpoint phase (`GERMAN_ENTRENCHMENT` or `SOVIET_ENTRENCHMENT`) rather than being overwritten with `GAME_OVER`.

The winning Ready action retains existing event language: `ControllerReadyForPhaseEnd` followed by `PhaseEnded(previousPhase -> GAME_OVER)`. No `GameEnded`, `VictoryAchieved`, or other new GameEvent is introduced.

## Terminal action guard

After `state.phase === 'GAME_OVER'` or `state.victory.winner !== null`, all later gameplay actions are rejected with existing `WRONG_PHASE` and `details.reason = 'GAME_OVER'`. Deterministic action identity is still resolved first, so rejected post-game actions are logged deterministically while duplicate canonical action IDs retain existing `ACTION_ID_DUPLICATE` semantics.

## Foundation boundary

`endPhase(state, rules)` remains victory-agnostic and unchanged. Task 002E-2 changes only RulesEngine orchestration around the final side-wide Ready barrier and uses the existing `GAME_OVER` phase and `state.victory` fields. No GameState schema, ValidationCode, GameEvent, PendingDecision, replay identity, turn order, or controller-ownership amendment is introduced.
