# Task 002B-2 — German Supply Projection

This task implements **normal German railway supply as a pure derived query**.

```text
Active German Rail Hexes (DR-001)
        ↓
hexDistance <= rules.supply.germanRadius
        ↓
Normal German Railway Supply Projection
```

`computeSupply(state, 'GERMAN', rules, scenario)` first derives the current Active German Rail Network with `computeActiveGermanRailNetwork`. Every active rail hex is a supply source. A real hex in `state.hexes` is normally supplied when its standard axial hex distance to at least one source is no greater than `rules.supply.germanRadius`.

## Locked semantics

- Roads do **not** extend supply radius.
- Terrain, rivers, bridges, movement costs, friendly/enemy ZOC, and ordinary unit occupation do not alter the local geometric projection.
- Live Soviet occupation affects German supply only through **DR-001 railway connectivity**: it may cut the Active German Rail Network, removing downstream rail sources.
- Normal projection returns only `SUPPLIED` or `OUT_OF_SUPPLY`; `TEMPORARY_SUPPLY` / HQ Extra Supplies are not part of Task 002B-2.
- Existing `UnitState.supplyState` and `UnitState.temporarySupply` are not trusted as inputs to the normal projection.
- The query does **not** mutate `GameState` or refresh `UnitState.supplyState`.
- `sourceHexKeys`, `suppliedHexKeys`, and German `unitSupply` output are deterministic.

## Deferred

Task 002B-2 does not implement Soviet supply, Rail Repair, authoritative supply-state refresh, HQ Extra Supplies, or OOS consequences.
