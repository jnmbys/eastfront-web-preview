# Task 002A-2A — Combat Loss Engine + Preflight Corrections

This checkpoint extends the green 002A-1 combat slice through **loss application only**.

## Implemented preflight corrections

1. `artillerySupportUsed` starts a fresh window at **every Player Turn boundary for both armies**. Movement/attack/recon/temp-supply resets remain side-specific.
2. Foundation Amendment **FA-001** restores exact replay equality for `idCounters`.
3. Last Stand CRT shift is read from `rules.hqCommands.LAST_STAND.crtShift`.
4. `ATTACK.commitmentIds` must reference active commitments for the same battle, authorized to the declaring controller, and relevant to at least one participating attacker or attacker artillery unit.

## Loss state machine

After CRT resolution, `unresolvedLosses[]` remains ordered:

1. attacker requirement
2. defender requirement

The engine repeatedly:

- computes currently actionable loss steps from participant damage capacity;
- auto-applies the allocation if its final distribution is unique;
- otherwise creates `PendingDecision.LOSS_ALLOCATION`;
- after a player allocation, continues automatically into the next requirement.

`ALLOCATE_LOSSES` is now a real transition.

## Round-based fairness

Losses are distributed in rounds.

While enough losses remain to hit every currently-capable participant, every such unit must take exactly one loss before any takes another.

Examples:

- 3 units / 1 loss → choose any one
- 3 / 2 → choose two different units
- 3 / 3 → all three take one
- 3 / 4 → all three take one, then choose one to take the fourth
- 2 / 3 → 2+1

Units with no remaining damage capacity drop out of later rounds.

The Action wire format remains the ordered `unitIdsByStep[]`. Repetition is therefore legal only when it occurs in a later fairness round.

## Damage capacity

Actual capacity comes from `UnitTemplate.maxDamageSteps`:

- ordinary 3-step unit: full → step1 → step2 → destroyed
- HQ (`maxDamageSteps=1`): first loss destroys it

If a CRT result demands more losses than all surviving eligible units can absorb, the actionable requirement is capped at remaining capacity, matching the legacy reference behavior where loss application stops after all participants are destroyed.

## Cross-controller attacker authority

A battle-scoped Unit Commitment grants the declaring controller tactical authority over the committed attacker for that battle's **loss allocation**. Permanent `UnitState.controllerId` does not change.

Mixed-controller defender authority remains deliberately unsupported and is not guessed here.

## Post-loss boundary

This task does not execute retreat or advance.

After all losses:

- surviving required retreaters → `RETREAT` PendingDecision;
- no living defender in target and living attackers → `ADVANCE_AFTER_COMBAT` PendingDecision;
- otherwise → combat closes.

The actual retreat/advance transitions belong to 002A-2B.

## Combat correctness dependency for 002A-2B

Current `buildCombatContext()` does **not yet** halve defense for:

> OOS + fully surrounded + no legal retreat direction.

The legacy Python reference uses the same legality ingredients for encirclement/retreat:

- adjacent board hex;
- not enemy occupied;
- not in enemy ZOC;
- stacking capacity available;
- lake/invalid board hex illegal.

Legacy source locations:

- `_can_stack()` around lines 224–230
- `_fully_surrounded()` around lines 638–646
- OOS surrounded defense halving around lines 650–657
- `retreat_unit()` around lines 893–908
- failed retreat → one extra loss per side/battle around lines 972–983

002A-2B must build **one shared retreat-legality helper** and reuse it both before CRT (OOS surrounded defense) and after CRT (actual retreat), avoiding divergent definitions.
