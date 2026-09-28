# Digital Rules Amendment DR-002 — German Network-Based Rail Repair

Task 002B-4 replaces the legacy lane/railhead repair experiment with one German side-wide repair plan per German Player Turn.

## Repair plan

`RAIL_REPAIR.edgeKeys` is the complete repair plan for the turn. A successful action consumes the German side's one repair opportunity for that turn, even when fewer than the available edges are selected. Rejected attempts do not consume it. The used/not-used fact is derived from the existing accepted `RAIL_REPAIR` entry in `GameState.actionLog`; no rail-repair runtime state is added.

Without an engineer the total allowance is `rules.rail.baseRepairPerTurn`. With one valid dedicated German engineer it is `rules.rail.engineerRepairPerTurn`. A valid engineer must be alive, German, owned by the acting controller, type `ENGINEER`, normally `SUPPLIED`, and not already dedicated. `TEMPORARY_SUPPLY` does not qualify. A successfully used engineer sets `dedicatedRailRepair = true` and cannot MOVE, ATTACK, or ENTRENCH for the remainder of that German Player Turn. `beginPlayerTurn(GERMAN)` resets the flag on the next German Player Turn. Future Recovery rules must also respect this dedication.

`branchCap` and `engineerBranchCap` are deprecated legacy allocation parameters. Under DR-002 they have no Digital Edition rules meaning and production rail-repair logic does not read them.

## Connectivity

Selected railway edges are repaired as a set, not in submitted order. Validation creates a preview state, applies every selected repair in that preview, and then calls the canonical DR-001 `computeActiveGermanRailNetwork(...)` traversal. Every selected edge must belong to the resulting Active German Rail Network. This allows first-turn construction from a west entry, multiple branches, cycles, and reconnecting previously repaired but isolated segments without duplicating railway graph rules.

A live Soviet unit occupying either endpoint of a selected railway edge blocks repair. Soviet ZOC alone does not block rail repair.

Successful repair leaves the canonical railway edge as `present = true`, `destroyed = false`, `repairedBy = 'GERMAN'`. No railhead or repaired-edge cache is introduced.

## Supply snapshot timing

Rail Repair happens after the German Player Turn's normal supply snapshot has already been refreshed on entry to `GERMAN_SUPPLY_RAIL`. `RAIL_REPAIR` never calls `refreshGermanSupplyState(...)`. The pure `computeSupply(...)` projection may therefore see newly repaired rail immediately, while authoritative `UnitState.supplyState` remains the current-turn snapshot until the next German Player Turn enters `GERMAN_SUPPLY_RAIL`.

Soviet supply, Soviet rail repair, rail destruction actions, HQ Extra Supplies, RP, reinforcement, and victory remain deferred.
