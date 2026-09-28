# Task 002B-3 — German Supply State Refresh & Lifecycle Integration

German normal railway supply now has two deliberately different layers:

```text
Active German Rail Network (DR-001)
        ↓
computeSupply / computeGermanSupplyProjection
pure projection from current map facts
        ↓
German Player Turn start
entry to GERMAN_SUPPLY_RAIL
        ↓
refreshGermanSupplyState
        ↓
UnitState.supplyState authoritative turn snapshot
        ↓
Movement / Combat / Breakthrough / Schwerpunkt consume that snapshot
```

`computeSupply(..., 'GERMAN', ...)` remains a pure query: it answers what normal German railway
supply would be under the current map, railway, occupation, scenario, and rules facts. It never
mutates `GameState`.

`UnitState.supplyState` is **not** a continuously live derivation. It is the normal-supply snapshot
formally established at the start of the German Player Turn and consumed by rule systems during
that turn.

## Refresh timing

- `createGameState(...)` performs the initial Turn 1 German refresh after the normal Player Turn / phase-start hooks.
- On later turns, `RulesEngine` refreshes once when authoritative phase transition enters `GERMAN_SUPPLY_RAIL`.
- Leaving `GERMAN_SUPPLY_RAIL` does **not** refresh again.
- Movement, combat, enemy occupation changes, and railway connectivity changes do not automatically refresh the snapshot.
- Therefore future Rail Repair performed during a German supply/rail phase can affect normal supply no earlier than the next German Player Turn.

`refreshGermanSupplyState(...)` writes only living German units' `supplyState`, and only as
`SUPPLIED` or `OUT_OF_SUPPLY`. It does not modify `temporarySupply` or any other unit/game field.
Dead German units and Soviet units are untouched.

Soviet supply remains deferred. Rail Repair remains deferred. HQ Extra Supplies / `TEMPORARY_SUPPLY`
assignment remain deferred.
