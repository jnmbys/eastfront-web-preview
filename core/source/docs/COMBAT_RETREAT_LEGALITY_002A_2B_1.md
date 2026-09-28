# Task 002A-2B-1 — Shared Retreat Legality + Encirclement

This checkpoint deliberately implements **retreat legality only**, not the RETREAT action transition.

## Canonical helper

`src/rules/retreat.ts` is now the single Rules Engine source for one-step retreat legality:

- destination exists on the scenario map;
- destination is adjacent to the current hex;
- destination is not LAKE;
- destination contains no enemy unit;
- destination is not in enemy ZOC;
- destination respects the two-unit stacking limit.

Retreat legality does not spend MP, read road/rail movement discounts, charge river movement surcharges, or impose a German-west/Soviet-east direction. Direction preference is AI policy.

Exports:

- `validateRetreatStep(...)`
- `getLegalRetreatStepOptions(...)`
- `hasLegalRetreatExit(...)`

The older `legalRetreatOptions(...)` name remains as a neutral-score compatibility wrapper over the canonical helper.

## OOS encirclement

`buildCombatContext()` now uses the same `hasLegalRetreatExit(...)` helper before CRT odds selection.

If every defending combat participant is `OUT_OF_SUPPLY` and the defended hex has no legal first-step retreat exit, total defense is halved with `Math.ceil`.

`TEMPORARY_SUPPLY` is not OOS.

`CombatContext` now records:

- `rawDefenseStrength`
- `finalDefenseStrength`
- `defenseStrength` (compatibility alias for final defense)
- `oosSurroundedDefenseHalved`

This preserves UI/replay explainability without creating a second `_fullySurrounded()` implementation.

## Deferred

Not implemented here: RetreatAction protocol changes, actual 1/2-step retreat, retreat-impossible loss, advance, breakthrough, Schwerpunkt.
