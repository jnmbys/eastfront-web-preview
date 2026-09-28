# Task 001.2 — Transaction Integrity Patch

Scope: three P0 transaction/invariant fixes only. No Combat State Machine, Supply Graph, full rail repair, UI, networking, AI changes, or balance changes.

## 1. Canonical action identity

`actionId` is the deterministic identity of an action in rules/replay history. It is **not** a network retry/request identity.
A future transport layer may add `clientRequestId` independently.

If a submitted `actionId` already exists in canonical `GameState.actionLog`, the request is rejected with `ACTION_ID_DUPLICATE` and is **not appended** to the canonical action log. The returned authoritative state therefore remains integrity-clean.

## 2. Minimal battle id lifecycle

Task 001.2 adds a derived `BattleIdLifecycle`:

- `UNUSED`
- `REJECTED_PROPOSAL`
- `RESERVED`
- `ESTABLISHED`
- `CLOSED` (reserved for Task 002A explicit CombatTransaction state)

A rejected Attack proposal does not establish/burn the battle id. A battle-scoped unit commitment reserves the id. Only an accepted Attack or PendingDecision currently proves that the combat transaction is established.

This allows:

`ATTACK B-JOINT (rejected: missing commitment)` → `AUTHORIZE_UNIT_COMMITMENT B-JOINT` → `retry ATTACK B-JOINT`

without `BATTLE_ID_DUPLICATE`.

## 3. PendingDecision global transaction guard

`validatePendingDecisionAction()` is a centralized engine guard. While `GameState.pendingDecision` is non-null, ordinary game-state actions are blocked with `PENDING_DECISION_BLOCKS_ACTION`.

Allowed resolution action types are mapped by decision kind:

- `DEFENDER_REACTION` → `COMBAT_REACTION` / `PASS_REACTION`
- `LOSS_ALLOCATION` → `ALLOCATE_LOSSES`
- `RETREAT` → `RETREAT`
- `BREAKTHROUGH_OPTION` → `BREAKTHROUGH`

The resolving controller must be in `eligibleControllerIds`, and the action `battleId` must match the pending battle. Matching actions proceed to their normal validator/transition; the still-unimplemented combat transitions continue to return `RULE_NOT_IMPLEMENTED` rather than being incorrectly blocked by the global guard.

## 4. Additional integrity invariants

`validateGameStateIntegrity()` now also checks:

- `Unit.templateId` exists in `GameRules.unitTemplates`
- `Unit.side` matches template side
- `Unit.type` matches template type
- `activeSide` matches the current non-`GAME_OVER` phase

Rejected Attack proposals alone no longer count as canonical battle declarations for reference-integrity checks.

## Verification

Executed in this environment:

- `npm run typecheck` — PASS
- `npm run smoke` — PASS
- `npm run smoke:hardening` — PASS
- `npm run smoke:transaction` — PASS
- `npm test` — NOT RUN: `vitest` executable unavailable in the sandbox (`vitest: not found`)

Task 001.2 stops here. Task 002A is intentionally not started.
