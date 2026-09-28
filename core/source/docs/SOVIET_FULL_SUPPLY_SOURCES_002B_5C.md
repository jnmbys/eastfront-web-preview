# Task 002B-5C — Soviet Independent Supply Sources + Full Soviet Supply Projection

Task 002B-5C defines the complete **normal Soviet supply projection query** while keeping authoritative Soviet `UnitState.supplyState` refresh deferred.

```text
Soviet East Rail Exits
        +
ScenarioConfig.sovietSupplySources
        ↓
full Soviet intact-rail connectivity
        ↓
active rail hex sources
        +
active independent source hexes themselves
        ↓
hexDistance <= rules.supply.sovietRadius
        ↓
Full Soviet Normal Supply Projection
```

## Explicit independent sources

`ScenarioConfig.sovietSupplySources?: HexCoord[]` is the only canonical scenario rule data for independent Soviet normal-supply sources. The current default scenario explicitly lists **AC10** and **AC11**. **AD10 is not an independent source**, and ordinary cities are not automatically supply sources. Future scenarios opt in by listing exact hexes.

An independent source is active when its hex exists and is not physically occupied by a living German unit. German ZOC, `HexState.control`, nearby units, terrain, roads, and rivers do not disable it. A source does not need railway adjacency to project supply directly.

## Full Soviet rail connectivity

`computeActiveSovietSupplyRailNetwork()` seeds intact Soviet-usable railway from the union of:

- `scenario.sovietEastRailExits`
- currently active `scenario.sovietSupplySources`

Railway traversal continues to require only `railway.present === true` and `railway.destroyed === false`; `repairedBy` is irrelevant to Soviet use. Living German occupation blocks traversal. An independent source with no usable adjacent railway remains a direct source but does not appear in the rail network's `seedHexKeys`.

The existing `computeActiveSovietRailNetwork()` remains unchanged in meaning: it is **East-exit-only**. Likewise, `computeSovietEastRailSupplyProjection()` remains the 002B-5B East-rail-only query.

## Full normal projection

`computeSovietSupplyProjection()` uses the union of full Soviet supply-rail `hexKeys` and active independent source hexes as `sourceHexKeys`, then projects by pure `hexDistance <= rules.supply.sovietRadius` across real `state.hexes`. Roads, terrain, rivers, bridges, ZOC, and movement cost do not change the radius. Only living Soviet units appear in `unitSupply`; stale `supplyState` and `TEMPORARY_SUPPLY` are ignored.

`computeSupply(state, 'SOVIET', rules, scenario)` now delegates to this full projection. All projection APIs remain pure and do not mutate `GameState`.

## Deferred

Task 002B-5C does **not** implement authoritative Soviet supply snapshot lifecycle (002B-5D), Soviet Rail Repair, HQ Extra Supplies, RP/Recovery, Reinforcement, or Victory.
