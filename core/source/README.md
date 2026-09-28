# 东线突击 Digital Branch — Core v0.2.3

UI-independent deterministic rules core for **《东线突击》**.

The **v0.1.3 Foundation is LOCKED**. Task 002A is delivered as small green checkpoints. This snapshot is **Task 002A-2B-1: Shared Retreat Legality + Encirclement**.

Core contract:

```text
GameState + Action
        ↓
    Validation
        ↓
 State Transition
        ↓
ActionResult { state, typed GameEvent[], issues[] }
```

Human and AI controllers submit the same `Action` protocol.

## Foundation Lock

Stable infrastructure includes axial hexes, canonical HexEdge rail state, canonical unit ownership, controller-bound PendingDecision locking, multiplayer Ready Barrier, Unit Commitments, seeded RNG, typed GameEvents, centralized turn lifecycle, deterministic action/battle identity, and `validateGameStateIntegrity()`.

### Foundation Amendment FA-001

v0.2.2 adds one explicit Foundation Amendment: replaying canonical `A-000001` / `B-000001` identities now advances deterministic ID counters just as live-generated identities do. Same Initial State + Seed + Action Log now reproduces the complete authoritative GameState, including `idCounters`.

See `docs/FOUNDATION_AMENDMENT_FA_001.md`.

## Combat progress

Implemented through this checkpoint:

```text
ATTACK declaration
  ↓
DEFENDER_REACTION
  ↓
Seeded 2D6 + CRT
  ↓
LOSS requirements
  ↓
unique allocation? ─ yes → auto apply
        │
        no
        ↓
LOSS_ALLOCATION PendingDecision
        ↓
ALLOCATE_LOSSES
        ↓
next loss requirement / RETREAT pending / ADVANCE pending / CLOSED
```

Loss application now supports:

- full → step1 → step2 → destroyed
- `UnitTemplate.maxDamageSteps` (HQ dies on first loss)
- round-based fair multi-unit allocation
- automatic resolution when the final allocation distribution is unique
- ordered EX attacker-loss then defender-loss handling
- committed teammate attacker loss allocation by the declaring battle controller
- deterministic `UnitStepLost`, `UnitDestroyed`, and `LossesAllocated` events

Preflight corrections in this version:

- both armies' `artillerySupportUsed` resets at every Player Turn boundary
- Last Stand CRT shift comes from `GameRules`
- unrelated/foreign commitment references are rejected
- exact Action Log replay restores identity counters (FA-001)

See `docs/COMBAT_DECLARATION_002A_1.md` and `docs/COMBAT_LOSS_002A_2A.md`.


## Task 002A-2B-1 — Shared Retreat Legality + Encirclement

This green checkpoint adds one canonical retreat-step legality source in `src/rules/retreat.ts`. The same helper now powers pre-CRT encirclement detection, so there is no second `_fullySurrounded()` rule path.

A retreat step is legal only when the destination is adjacent, on-map, non-LAKE, free of enemy units, outside enemy ZOC, and within stacking limit. Retreat legality does not consume MP or apply road/rail/river movement costs, and has no east/west direction rule.

`buildCombatContext()` now applies the locked rule:

```text
all defenders OUT_OF_SUPPLY
+ no legal first-step retreat exit
→ ceil(total defense / 2)
```

`TEMPORARY_SUPPLY` is not OOS. Explainability fields are `rawDefenseStrength`, `finalDefenseStrength`, `defenseStrength` (compatibility alias), and `oosSurroundedDefenseHalved`.

Actual RetreatAction execution remains deliberately deferred to Task 002A-2B-2.

## Deliberately deferred

Task 002A-2B-1 **does not execute**:

- retreat
- advance after combat
- breakthrough
- Schwerpunkt
- Supply Graph
- full Rail Repair
- RP / reinforcement / victory
- UI / multiplayer server / strategic AI

The next combat checkpoint must centralize retreat legality. Current OOS + fully surrounded + no legal retreat → defense-halved logic is deliberately not enabled until the same helper can be shared by pre-CRT encirclement and post-CRT retreat.

## Run

```bash
npm run typecheck
npm run smoke
npm run smoke:hardening
npm run smoke:transaction
npm run smoke:foundation
npm run smoke:combat-declare
npm run smoke:combat-loss
npm run smoke:retreat-legality
```

`npm test` requires Vitest to be installed. In the current sandbox `vitest` is unavailable; dependency-free smoke suites are the runtime verification, while `tests/*.ts` are statically compiled with a declaration-only Vitest shim.
