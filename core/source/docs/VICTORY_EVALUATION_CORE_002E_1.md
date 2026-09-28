# Task 002E-1 — Capital Victory Evaluation Core

This task completes the pure victory-rule layer only. It does not transition the game to `GAME_OVER`; lifecycle integration is deferred to 002E-2.

## Capital Condition

German Capital Condition is satisfied when:

```text
Every configured scenario.capitalCoreHex:
  no living Soviet unit
  +
  at least one living German regular occupier

AND

at least one living German unit on any capital core
is SUPPLIED in the live normal German supply projection.
```

A German regular occupier is resolved from its `UnitTemplate`: the unit must be living, German, on the core, have a valid German template with `isSupport === false`, and must not be `RECON`. Recon is excluded explicitly because it cannot satisfy capital occupation even though the default Recon template is not a support template.

The supply condition is separate from regular occupation. A living German support unit on a capital core may satisfy the supply half of the condition, but cannot satisfy the regular-occupier half.

Victory supply is recomputed with `computeSupply(state, 'GERMAN', rules, scenario)`. It does **not** consume `UnitState.supplyState`, `temporarySupply`, or `TEMPORARY_SUPPLY`; the gameplay snapshot and victory-time live projection intentionally may differ.

`HexState.control` is not victory truth. Physical living-unit occupation, configured capital cores, and live German supply are authoritative. `capitalOuterHexes` and ordinary city terrain are not victory targets.

## Timing

`evaluateVictoryAtCheckpoint()` is a pure checkpoint evaluator and reads `scenario.turnLimit` without hardcoding 16/18/20.

```text
Before final turn:
  German Player Turn end condition alone is not enough.
  Germany must still satisfy it at Soviet Player Turn end.

Final turn:
  German Player Turn end immediately decides:
    condition true  -> German win
    condition false -> Soviet win
```

At a pre-final Soviet Player Turn end, a still-satisfied condition produces `GERMAN_CAPITAL_HELD_THROUGH_SOVIET_TURN`. On the final German Player Turn end, success produces `GERMAN_CAPITAL_CAPTURE_FINAL_TURN`; failure produces `SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT`. Defensive over-limit states also resolve to the Soviet turn-limit win.

## Purity and integrity

The evaluation APIs are deterministic pure queries. They do not mutate `state.victory`, phase, units, supply snapshots, ready barriers, or action history.

Scenario integrity additionally requires:

- at least one `capitalCoreHexes` entry (`CAPITAL_CORE_HEXES_EMPTY`),
- every configured capital core to exist on the real map (`CAPITAL_CORE_HEX_INVALID`), and
- `turnLimit` to be a positive integer (`TURN_LIMIT_INVALID`).

Duplicate capital-core configuration is harmless: evaluation deduplicates and canonical-sorts core keys.

`GAME_OVER` transition, RulesEngine victory hooks, end-game events, and automatic lifecycle integration are deferred to Task 002E-2.
