# Foundation Amendment FA-001 — Deterministic replay identity counters

Status: **Implemented in v0.2.2 / Task 002A-2A**.

## Problem

The Foundation generated deterministic `A-000001` / `B-000001` identities correctly during live play, but replaying an already-canonical Action Log did not advance `GameState.idCounters`. Dice, transactions, and logs matched while the authoritative state did not.

## Amendment

`resolveActionIdentity()` now recognizes canonical IDs:

- `A-000123` guarantees `nextAction >= 124`
- `B-000045` guarantees `nextBattle >= 46`

This applies to unique explicit identities that will be logged, including accepted and rejected actions. A duplicate `actionId` remains a non-canonical retry and does not mutate the counters.

## Result

Given the same Initial State + Seed + canonical Action Log, replay now reproduces:

- RNG state
- Action Log
- CombatTransaction registry
- deterministic ID counters
- complete authoritative `GameState`

No ownership, PendingDecision, edge, turn-lifecycle, or RNG semantics were changed.
