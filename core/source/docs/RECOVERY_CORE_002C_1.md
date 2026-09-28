# Task 002C-1 — Recovery Core

Recovery is an explicit `REPAIR_UNIT` tactical choice. It never runs automatically when a
Recovery phase begins.

```text
Derived Recovery Bases
        ↓
normal SUPPLIED snapshot
        ↓
eligibility checks
        ↓
REPAIR_UNIT
        ↓
spend side-wide RP
        ↓
restore exactly one damage step
```

## Recovery Bases

German Recovery Bases are derived from the current Active German Rail Network:

- derived railheads: active-edge degree-1 terminal hexes, excluding configured German West Rail Entries;
- active railway cities: active German rail hexes whose terrain is `CITY`, `MAIN_CITY`, or `OUTER_CITY`.

Derived railheads are pure query results and have no quantity cap. They are never authoritative
GameState. A pure railway cycle therefore creates no railhead, although a city on that active cycle
can still be a Recovery Base. Not every active rail hex is a Recovery Base.

Soviet Recovery Bases are:

- currently active explicit independent Soviet supply sources;
- cities on the full Soviet supply-rail network (East exits plus independent-source rail seeds).

An active independent Soviet source is a Recovery Base even without railway adjacency. Ordinary
disconnected cities are not Recovery Bases. `HexState.control` is not used for either side.

Recovery range uses standard `hexDistance` and `rules.recovery.maxDistanceFromBase`. Roads, terrain,
rivers and ZOC do not change the range.

## Unit eligibility

A living damaged unit may recover only during its own side Recovery phase, under its permanent
controller, when all of the following hold:

- `unit.supplyState === 'SUPPLIED'` (normal snapshot only; `TEMPORARY_SUPPLY` is insufficient);
- it has not moved or attacked during its current Player Turn;
- it has not provided artillery support during that Player Turn;
- a German engineer was not dedicated to rail repair that turn;
- it is not physically adjacent to any living enemy unit, including enemy units that exert no ZOC;
- it is within Recovery Base range;
- its side-wide RP pool can pay `rules.unitTemplates[unit.templateId].recoveryCostPerStep`;
- it has not already recovered during this Recovery phase;
- the side-wide recovered-unit limit for the full-game turn has not been reached.

Destroyed units cannot return. Entrenchment is retained by Recovery.

## Limits and RP

One accepted `REPAIR_UNIT` restores exactly one damage step (`step -= 1`) and deducts exactly the
selected template's `recoveryCostPerStep` from `state.rp[side]`. RP is side-wide, not per controller.

No Recovery runtime state is stored. Accepted `REPAIR_UNIT` entries in `state.actionLog`, filtered by
current full-game turn and the side's Recovery phase, derive both:

- how many units that side has already recovered this turn;
- whether the selected unit has already recovered in the current Recovery phase.

German recovered-unit limit comes from `rules.recovery.maxUnitsPerTurn.GERMAN`. Soviet limits use the
entry with the highest `fromTurn <= state.turn` from `rules.recovery.maxUnitsPerTurn.SOVIET`, independent
of schedule array order.

Recovery consumes the already authoritative `UnitState.supplyState` snapshot established by the 002B
supply lifecycle. It does not recompute or refresh supply.

RP replenishment/rebalance, Reinforcement, Victory, HQ Extra Supplies, and destroyed-unit revival remain
outside Task 002C-1.
