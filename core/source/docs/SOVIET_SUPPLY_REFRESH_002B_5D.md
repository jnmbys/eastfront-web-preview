# Task 002B-5D — Soviet Supply Snapshot Lifecycle

Task 002B-5D connects the pure full Soviet normal-supply projection from 002B-5C to the authoritative `UnitState.supplyState` snapshot consumed by movement and combat rules.

```text
Game setup
  -> initialize German normal supply snapshot
  -> initialize Soviet normal supply snapshot

Later Soviet Player Turn
  -> enter SOVIET_REINFORCEMENT_SUPPLY
  -> reinforcement window (future task)
  -> ready barrier completes / phase ends
  -> refreshSovietSupplyState()
  -> enter SOVIET_MOVEMENT
```

`refreshSovietSupplyState(state, rules, scenario)` calls the full `computeSovietSupplyProjection(...)` from 002B-5C and writes only living Soviet units' `supplyState` to `SUPPLIED` or `OUT_OF_SUPPLY`. It does not consult or modify `temporarySupply`, and it does not change German units, dead Soviet units, rail state, actions, phases, or any other authoritative state.

## Snapshot timing

Soviet normal supply is a turn snapshot, not continuous live derivation.

- `createGameState()` initializes both German and Soviet normal supply snapshots on Turn 1. Soviet units therefore have authoritative supply before they can defend during the opening German turn.
- Later Soviet supply is **not** refreshed when the Soviet Player Turn begins or when entering `SOVIET_REINFORCEMENT_SUPPLY`.
- The refresh occurs only after the reinforcement/supply phase finishes and immediately before `SOVIET_MOVEMENT` begins. This lets future reinforcements inserted during that phase participate in the same authoritative supply refresh.
- The multiplayer Ready barrier does not refresh on intermediate Ready actions; only the actual phase transition refreshes.
- German rail/source cuts during the German turn can change the pure `computeSupply(..., 'SOVIET', ...)` result immediately, but Soviet `UnitState.supplyState` remains the old authoritative snapshot until the Soviet reinforcement/supply phase ends.
- Reconnection follows the same timing: the pure projection may become supplied earlier, while the authoritative snapshot waits for the phase-exit refresh.
- Soviet movement and combat do not trigger supply refresh. A unit can move outside the current normal-supply radius and retain the snapshot established before movement for that Soviet Player Turn.

## Pure projection versus authoritative snapshot

`computeSupply(state, 'SOVIET', rules, scenario)` remains a pure query: it answers what full Soviet normal supply would be under the current map facts, including 002B-5C independent sources. It never mutates the state.

`UnitState.supplyState` is the authoritative normal-supply snapshot consumed by existing rules until the next scheduled Soviet refresh.

The low-level `endPhase(state, rules)` primitive remains supply-agnostic and keeps its Foundation signature. Lifecycle integration exists only in `createGameState()` and the authoritative `RulesEngine` phase transition.

## Deferred systems

This task does not implement Reinforcement, RP/Recovery, Victory, Soviet Rail Repair, or HQ Extra Supplies. Temporary-supply assignment remains deferred; existing player-turn transient reset behavior is unchanged.
