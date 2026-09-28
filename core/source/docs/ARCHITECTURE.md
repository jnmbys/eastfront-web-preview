# Digital Branch architecture — v0.1.1

## Repository shape

```text
src/
├─ core/
│  ├─ types.ts
│  ├─ config.ts
│  ├─ hex.ts
│  ├─ edge.ts
│  ├─ collections.ts
│  └─ ownership.ts
├─ random/SeededRNG.ts
├─ rules/
│  ├─ movement.ts
│  ├─ zoc.ts
│  ├─ stacking.ts
│  ├─ supply.ts
│  ├─ rail.ts
│  ├─ combat.ts
│  ├─ crt.ts
│  ├─ retreat.ts
│  ├─ breakthrough.ts
│  ├─ hq.ts
│  ├─ recovery.ts
│  ├─ entrenchment.ts
│  ├─ turn.ts
│  ├─ victory.ts
│  ├─ commitment.ts
│  └─ actions.ts
├─ scenario/
├─ engine/
│  ├─ state.ts
│  ├─ identity.ts
│  ├─ integrity.ts
│  └─ RulesEngine.ts
└─ index.ts
```

## Dependency direction

```text
core types/config
      ↑
hex / edge / ownership / RNG
      ↑
rules pure functions
      ↑
RulesEngine orchestration
      ↑
AI / server / browser UI (future)
```

Rules never depend on React/Pixi/networking/specific AI.

## Canonical state decisions

- Unit control: `UnitState.controllerId` only; controller unit lists are derived.
- Edge features: one canonical unordered `HexEdge`.
- Railway repair: `HexEdge.railway.repairedBy` only; derived indexes are functions, not persisted truth.
- Randomness: `GameState.random` + `SeededRNG`, never `Math.random()`.
- Action identity: deterministic monotonic `GameState.idCounters`.

## Multiplayer-ready action flow

```text
Controller intent (Action)
  → deterministic actionId / battleId
  → validation
  → immutable transition
  → typed GameEvent facts
  → action log
```

A side phase has a ready barrier. Controllers owning live units independently submit `READY_FOR_PHASE_END`; only the completed barrier advances the shared side phase.

## Joint Human + AI combat

Permanent ownership is not transferred just to cooperate in one battle.

Owner submits `AUTHORIZE_UNIT_COMMITMENT` scoped to:
- one `battleId`
- one allied initiating controller
- explicit `unitIds`

The initiating controller cites the commitment in `AttackAction.commitmentIds`.

## Combat protocol boundary

`AttackAction` now contains attacker-owned decisions only.

Defender artillery, Last Stand, pass, loss allocation, retreat and breakthrough are future transaction reactions bound to a `PendingDecision` with explicit controller ownership.

No full combat transaction was implemented in Task 001.1.

## Lifecycle ownership

`rules/turn.ts` is the only home for turn/phase reset responsibility:
- `beginPhase`
- `beginPlayerTurn`
- `beginGameTurn`
- `endPlayerTurn`
- `endPhase`

This prevents per-turn flags from being reset ad hoc inside unrelated actions.

## Debug invariants

`validateGameStateIntegrity(state, rules)` audits ownership, stacking, edge canonicality, pending decision routing, action/battle references, commitments, rail truth-source invariants, railheads and deterministic counters.
