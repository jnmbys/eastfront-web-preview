# Headless Full Game — Task 002F-1

## Purpose

The headless layer is deterministic orchestration, not AI:

```text
External ActionProvider
        ↓
runHeadlessGame
        ↓
RulesEngine.apply
        ↓
ActionResult + authoritative returned state
        ↓
repeat
        ↓
GAME_OVER / NO_ACTION / ACTION_LIMIT / REJECTED_ACTION / INTEGRITY_FAILURE
```

The runner never calls phase, combat, supply, reinforcement, recovery, or victory internals to advance a game. Every rules transition remains an ordinary canonical `Action -> RulesEngine.apply()` transition.

## ActionProvider contract

`HeadlessActionProvider` receives a defensive clone of the current `GameState`, the zero-based action index, and a defensive clone of the previous result. Provider mutation therefore cannot alter authoritative session state. Returning `null` ends the live session with `NO_ACTION`.

The runner starts from a defensive clone of caller-owned `initialState` and does not implement Initial Deployment.

## Run policy

Defaults:

- `maxActions = 10000`
- `stopOnRejectedAction = false`
- `validateIntegrityAfterEachAction = true`

`maxActions` must be a positive integer.

Rejected Actions are retained as canonical intent history. By default the runner continues; with `stopOnRejectedAction=true`, the first rejection terminates the session as `REJECTED_ACTION`.

Integrity uses the existing `validateGameStateIntegrity(state, rules, scenario)` checker. It is checked on the initial state and after each Action when enabled. The runner never repairs invalid state.

A state already in `GAME_OVER` (or with a non-null winner) terminates without calling the provider. If the Action at the action-limit boundary itself produces GAME_OVER, `GAME_OVER` has priority over `ACTION_LIMIT`.

## Canonical actions and exact replay

`canonicalActions` stores `ActionResult.action`, not the provider's input object. This preserves deterministic `actionId` / `battleId` assignment made by the Foundation identity layer.

`replayHeadlessActions()` clones the same initial state and submits every supplied canonical Action back through `RulesEngine.apply()`. It does not mutate caller inputs, does not restore snapshots directly, and does not bypass RNG or identity logic.

Replay intentionally does **not** stop at GAME_OVER if additional canonical Actions remain. Post-game Actions are submitted so the RulesEngine can deterministically reject them, preserving exact action history.

## Non-goals

Task 002F-1 adds no GameState runtime fields, Actions, or GameEvents. It does not implement AI policy, UI integration, WebSocket multiplayer, Initial Deployment, the production 20×32 setup, or balance simulation.
