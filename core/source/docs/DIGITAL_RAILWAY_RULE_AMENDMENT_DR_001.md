# Digital Rules Amendment DR-001 — Whole Connected Rail Network Supply

Status: **implemented in Task 002B-1**.

## Rule amendment

The digital rules no longer use a mutable set of at most three German railheads as the authoritative railway supply source.

Instead, the **Active German Rail Network** is derived from the canonical railway edge graph every time it is queried. A railway edge can participate only when:

- `HexEdge.railway.present === true`
- `HexEdge.railway.destroyed === false`
- `HexEdge.railway.repairedBy === 'GERMAN'`
- it is continuously connected through edges satisfying the same conditions to at least one `ScenarioConfig.germanWestRailEntries` source.

Every endpoint of an active railway edge is an **Active German Rail Hex**. Future German supply projection may use all such active rail hexes; there is no three-railhead cap.

## Enemy occupation

A hex occupied by a **living Soviet unit** cannot be entered or traversed by the German active-rail graph. This cuts propagation to railway beyond that occupied hex. Enemy ZOC by itself does **not** cut the railway network in DR-001.

An occupied German west rail entry cannot seed the network. Other valid west entries continue to seed normally.

## Canonical state

Railway data remains edge-owned. `HexEdge.railway` is the only authoritative railway repair/destruction source.

Task 002B-1 removes:

- `RailRules.maxActiveRailheads`
- `RailRuntimeState.railheadHexKeys`
- `GameState.rail`

Railhead markers, if shown by a future UI, must be derived visualization rather than mutable rules state.

`branchCap` and `engineerBranchCap` are intentionally retained without new semantics. **REVIEW IN 002B Rail Repair**; they do not limit which already-repaired connected branches belong to the Active German Rail Network.

## Derived API

`computeActiveGermanRailNetwork(state, scenario)` returns deterministic sorted arrays:

```ts
interface ActiveRailNetwork {
  edgeKeys: string[];
  hexKeys: string[];
  entryHexKeys: string[];
}
```

Internally the implementation performs graph traversal with a visited set, so branches, cycles, and reconnects do not duplicate nodes or loop indefinitely.

`isGermanRailEdgeActive(...)` and `isGermanRailHexActive(...)` query a previously derived `ActiveRailNetwork`; they do not maintain or traverse a second rail graph.

## Explicitly deferred

DR-001 / Task 002B-1 does **not** implement:

- rail repair transitions or per-turn repair allowances
- German five-hex supply projection
- Soviet supply
- OOS recalculation or OOS penalties
- recovery, reinforcements, victory, AI, UI, or multiplayer railway behavior
