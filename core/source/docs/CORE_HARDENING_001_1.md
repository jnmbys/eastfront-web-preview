# Worker → Leader Handoff — Task 001.1 Core Hardening

Status: **COMPLETE / STOPPED BEFORE TASK 002A**

Milestone 1 architecture remains accepted. This patch only hardens protocol/state invariants required by future multiplayer, Human+AI cooperation, replay and combat transactions.

## 1. Problems fixed

1. Empty `MOVE path: []` is rejected with `EMPTY_MOVE_PATH`; state hex cannot be overwritten by `undefined`.
2. Turn lifecycle is centralized in `beginPhase`, `beginPlayerTurn`, `beginGameTurn`, `endPlayerTurn`, `endPhase`.
3. Duplicate participant IDs are rejected for `AttackAction.attackerUnitIds`, `UseHQCommandAction.unitIds`, `RailRepairAction.edgeKeys`, commitment ids/unit ids. `AllocateLossesAction.unitIdsByStep` intentionally still permits duplicates.
4. Joint attacks no longer assume all units are permanently controlled by the initiating controller. Battle-scoped unit commitments are supported.
5. `PendingDecision` now binds to `decisionOwnerControllerId` and `eligibleControllerIds`.
6. Side phases use a multiplayer ready barrier. `READY_FOR_PHASE_END` marks one controller ready; phase advances only after every participating active-side controller is ready. Legacy `END_PHASE` is retained as the same ready semantic.
7. Defender artillery/HQ choices were removed from `AttackAction`. Defender decisions now have protocol-level `COMBAT_REACTION` / `PASS_REACTION` and `PendingDecision.DEFENDER_REACTION` support.
8. Deterministic action/battle ids added. Engine-generated ids use monotonic state counters (`A-000001`, `B-000001`) and no random UUID.
9. Railway repair canonical source is now only `HexEdge.railway.repairedBy`; `GameState.rail.repairedHexKeys` was removed. `getRepairedRailEdgeKeys()` is derived.
10. Added `validateGameStateIntegrity(state, rules)` for debug/tests.
11. Ownership canonical source is now only `UnitState.controllerId`; controller unit lists are derived using `getControlledUnitIds()` / `getControlledUnits()`.
12. `GameEvent` is now a typed serializable union. `Action` is intent; `GameEvent` records engine facts.

## 2. Modified / new files

### New
- `src/core/collections.ts`
- `src/core/ownership.ts`
- `src/engine/identity.ts`
- `src/engine/integrity.ts`
- `src/rules/commitment.ts`
- `tests/hardening.test.ts`
- `scripts/hardening-smoke.mjs`
- `docs/CORE_HARDENING_001_1.md`

### Major modifications
- `src/core/types.ts`
- `src/engine/state.ts`
- `src/engine/RulesEngine.ts`
- `src/rules/turn.ts`
- `src/rules/movement.ts`
- `src/rules/combat.ts`
- `src/rules/hq.ts`
- `src/rules/rail.ts`
- `src/rules/actions.ts`
- `src/index.ts`
- `tests/helpers.ts`
- `tests/combat.test.ts`
- `package.json`
- `README.md`
- architecture/verification docs

## 3. Canonical Controller ownership design

Chosen design: **A — `UnitState.controllerId` is canonical.**

`PlayerController.controlledUnitIds[]` has been removed from persisted state.

Derived helpers:

```ts
getControlledUnits(state, controllerId)
getControlledUnitIds(state, controllerId)
```

`TransferControlAction` changes only `UnitState.controllerId`. Any stale battle commitment containing the transferred unit is invalidated.

This eliminates two independently mutable ownership registries.

## 4. Multi-controller joint battle authorization

New protocol action:

```ts
AUTHORIZE_UNIT_COMMITMENT
```

The current unit owner grants specified `unitIds` to an allied `authorizedControllerId` for one explicit `battleId`.

The authorization:
- does not transfer ownership;
- is battle-scoped;
- is serializable;
- is validated by the Rules Engine;
- can cover direct attackers or attacker artillery;
- works identically for HUMAN and AI controllers.

`AttackAction.commitmentIds[]` explicitly names the authorizations being used.

Commitments currently expire at owning side player-turn end and are invalidated by control transfer. Final consumption/closure on combat resolution is deferred to Combat Transaction work.

## 5. PendingDecision structure

All pending decisions now include:

```ts
decisionOwnerControllerId
eligibleControllerIds[]
battleId
side
```

Defined decision kinds:
- `DEFENDER_REACTION`
- `LOSS_ALLOCATION`
- `RETREAT`
- `BREAKTHROUGH_OPTION`

This is enough for future server/AI routing without assuming one controller per side.

## 6. Phase ready / end-phase mechanism

New action:

```ts
READY_FOR_PHASE_END
```

A controller is added to `GameState.phaseReadyControllerIds`.

Phase advances only when all active-side controllers that currently own live units are ready. If the side has no live units in a test/scenario, all same-side controllers form the barrier fallback.

Once a controller is ready, further normal phase actions from that controller are rejected with `CONTROLLER_ALREADY_READY`.

`pendingDecision !== null` blocks phase completion.

`END_PHASE` remains as a compatibility alias with the same mark-ready behavior; it no longer lets one controller force the whole side forward.

## 7. actionId / battleId

GameState owns deterministic counters:

```ts
idCounters: {
  nextAction: number;
  nextBattle: number;
}
```

If caller omits ids:
- action → `A-000001`, `A-000002`, ...
- attack battle → `B-000001`, `B-000002`, ...

Ids are assigned without RNG/UUID. Rejected actions are also logged and consume deterministic action sequencing, which makes replay of the full intent log stable.

Explicit ids are allowed for replay/network input but duplicate action ids and duplicate Attack battle ids are rejected.

`battleId` is now the transaction reference intended to tie future Attack → Reaction → Dice → Loss → Retreat → Breakthrough → Schwerpunkt.

## 8. Rail canonical state

Canonical repair/control state:

```ts
HexEdge.railway.repairedBy
HexEdge.railway.destroyed
```

Removed:

```ts
GameState.rail.repairedHexKeys
```

`GameState.rail` now contains runtime railhead metadata only.

Derived helper:

```ts
getRepairedRailEdgeKeys(state, side?)
```

Integrity validator explicitly flags a runtime-injected legacy `repairedHexKeys` field as duplicate truth.

## 9. Typed GameEvent

Current event union includes:
- `UnitMoved`
- `EnteredEnemyZOC`
- `UnitEntrenched`
- `UnitControlTransferred`
- `UnitCommitmentAuthorized`
- `ControllerReadyForPhaseEnd`
- `PhaseEnded`
- `PlayerTurnStarted`
- `GameTurnStarted`
- `ActionRejected`

Events are JSON-serializable and contain no UI objects.

Current `applyAction` equivalent remains:

```ts
RulesEngine.apply(state, action)
=> ActionResult { state, events, issues, actionId, battleId? }
```

## 10. Tests / verification

New requested regression coverage exists for:
- empty move rejected;
- duplicate attackers rejected;
- next player turn resets temporary flags;
- canonical ownership integrity;
- transfer control integrity;
- unauthorized cross-controller attack rejected;
- authorized unit commitment accepted;
- one controller cannot prematurely end allied phase;
- PendingDecision owner validation;
- deterministic actionId/battleId;
- rail canonical consistency;
- integrity validator deliberate corruption;
- duplicate `unitIds` / `edgeKeys` validation.

Actual local verification:

```text
npm run typecheck
PASS

npm run smoke
PASS — Digital Branch smoke checks passed.

npm run smoke:hardening
PASS — Digital Branch Core Hardening 001.1 regression checks passed.

TypeScript static check of tests with local Vitest declaration shim
PASS
```

`npm install --ignore-scripts --no-audit --no-fund` timed out in this sandbox. `vitest` was therefore not installed and the Vitest runtime was **not** executed. The dependency-free hardening regression is the actual runtime verification for this delivery.

## 11. Breaking changes

Yes.

- `PlayerController.controlledUnitIds` removed.
- `GameState.rail.repairedHexKeys` removed.
- `UnitState.artillerySupportUsed` added.
- `GameState.phaseReadyControllerIds`, `unitCommitments`, `idCounters` added.
- Defender choices removed from `AttackAction.support`.
- `BreakthroughAction` now references `battleId` rather than `sourceBattleActionId`.
- `END_PHASE` semantics changed from immediate side-wide phase advance to controller-ready declaration.
- `ActionResult` now carries deterministic `actionId`, optional `battleId`, and typed `GameEvent[]`.
- PendingDecision schema changed to controller-bound ownership.

These changes are intentional before Combat Transaction begins.

## 12. Remaining ambiguities / deferred decisions

No new game rules were invented, but the following still need Leader/Combat-Transaction decisions:

1. Exact T1 CP timing: does starting CP=1 already represent the start-of-own-turn gain, or should German T1 receive another +1?
2. Exact commitment consumption point after a battle completes; current temporary policy expires at side player-turn end.
3. If multiple defending controllers share one stack, which controller initially owns LOSS/RETREAT/REACTION decision? Schema supports owner + eligible controllers; assignment policy is deferred.
4. Attacker HQ command identity is still abstract in the old combat preview (`attackerHQCommand`) rather than tied to a concrete HQ action/transaction. Combat State Machine should resolve this through `USE_HQ_COMMAND`/battle state rather than expand AttackAction further.
5. `artillerySupportUsed` lifecycle now exists/reset correctly, but actual once-per-turn support enforcement waits for combat transaction implementation.
6. Active phase-ready participants are currently controllers with live owned units; future server/lobby may need a scenario/controller `participatesInPhase` capability for commander-only roles.
7. Existing rule ambiguities in `RULE_AMBIGUITIES.md` remain unchanged unless explicitly resolved by Leader.

## 13. Next step after Leader acceptance

Do **not** start automatically.

Recommended next task remains a narrow Combat Transaction / vertical-slice design only after Leader reviews this patch ZIP and source.
