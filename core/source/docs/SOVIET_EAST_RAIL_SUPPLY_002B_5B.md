# Task 002B-5B — Soviet East-Rail Supply Projection

This task adds the **east-rail-only normal Soviet supply projection**. It is deliberately not the complete Soviet supply system.

```text
scenario.sovietEastRailExits
        ↓
Active Soviet East Rail Network (002B-5A)
        ↓
all active railway hexes are projection sources
        ↓
hexDistance <= rules.supply.sovietRadius
        ↓
Soviet East-Rail normal supply projection
```

`computeSovietEastRailSupplyProjection(state, rules, scenario)` is a **pure query**. `sourceHexKeys` exactly equals the current `computeActiveSovietRailNetwork(...).hexKeys`. `suppliedHexKeys` contains only real `state.hexes` within the configured Soviet radius of at least one source. `unitSupply` contains only living Soviet units and derives `SUPPLIED` / `OUT_OF_SUPPLY` from current map facts, ignoring stale `UnitState.supplyState` and temporary supply.

Local projection is geometric only. Roads do not extend supply; terrain, rivers, bridges, movement cost, German or Soviet ZOC do not alter the radius. Live German occupation matters only indirectly because 002B-5A can cut the east-rail network and remove forward source hexes. Railway `repairedBy` does not restrict Soviet east-rail connectivity when track is present and undestroyed.

This task does **not** mutate `UnitState` and does not integrate Soviet supply refresh into `SOVIET_REINFORCEMENT_SUPPLY`. Generic `computeSupply(state, 'SOVIET', ...)` remains deferred because complete Soviet supply has unresolved independent source rules.

Independent city and capital supply sources remain deferred. `capitalCoreHexes` and `capitalOuterHexes` are not added as sources by this task. Soviet Rail Repair is also deferred/not supported; 002B-5B only consumes the derived 002B-5A network.
