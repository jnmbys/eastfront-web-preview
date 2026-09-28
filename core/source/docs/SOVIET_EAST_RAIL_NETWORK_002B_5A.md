# Task 002B-5A — Soviet East Rail Network

This task adds a **pure derived** Soviet east-rail connectivity graph. It does not implement full Soviet supply.

```text
scenario.sovietEastRailExits
        ↓
present + undestroyed railway edges
        ↓
live German occupation blocks traversal
        ↓
Active Soviet East Rail Network
```

## Derived API

`computeActiveSovietRailNetwork(state, scenario)` returns deterministic, sorted `edgeKeys`, `hexKeys`, and `exitHexKeys`. `exitHexKeys` contains only unblocked Soviet east exits that actually seed at least one active railway edge.

The result is never stored in `GameState`; every call derives it from canonical `HexEdge.railway`, current living German unit occupation, and `ScenarioConfig.sovietEastRailExits`.

## Railway traversability

For Soviet east-rail connectivity an edge is traversable when railway track is present, not destroyed, has valid adjacent endpoints on the current map, and is continuously connected to a valid unblocked Soviet east exit.

`railway.repairedBy` **does not restrict Soviet connectivity**. `null`, `SOVIET`, and `GERMAN` repaired ownership are all traversable when the track is present and undestroyed. This intentionally differs from the German DR-001 network, which still requires `repairedBy === 'GERMAN'`.

A living German unit occupying a railway hex blocks traversal through that hex. German ZOC alone does not cut the network. `HexState.control` is not used as a railway blocking truth.

Branches, cycles, reconnections, and multiple east exits are supported through visited graph traversal without railhead state or cached authoritative network state.

## Deferred

Task 002B-5A does **not** implement:

- Soviet unit supply radius or `computeSupply(..., 'SOVIET', ...)`;
- Soviet `UnitState.supplyState` lifecycle refresh;
- Soviet supply cities or the capital as independent supply sources;
- Soviet railway repair;
- reinforcement entry, recovery bases, RP, or victory effects.

Those require separate rules tasks and are not implied by this connectivity graph.
