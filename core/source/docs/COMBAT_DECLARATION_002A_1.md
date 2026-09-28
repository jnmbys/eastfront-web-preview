# Task 002A-1 — Combat Declaration → Defender Reaction → CRT

Status: COMPLETE CHECKPOINT / STOP BEFORE 002A-2

Foundation base: v0.1.3 Foundation Lock
Current package: v0.2.1

## Scope implemented

### CombatTransaction registry

`GameState.combatTransactions` is the canonical registry for live and closed combat transactions.

A transaction records, among other fields:

- `battleId`, optional `sourceBattleId`, `stage`
- declaration action/controller
- attacker/defender side and locked unit ids
- target hex and battle-scoped commitment ids
- attacker/defender artillery selection
- validated HQ effects (defender Last Stand in this slice)
- structured `CombatContext`
- deterministic dice and parsed CRT resolution
- deferred loss/retreat requirements
- future advance/breakthrough/Schwerpunkt state

### Implemented stages

```text
ATTACK
  -> DEFENDER_REACTION
       -> COMBAT_REACTION: DEFENDER_ARTILLERY (optional)
       -> COMBAT_REACTION: LAST_STAND (optional)
       -> PASS_REACTION
  -> deterministic 2D6 + CRT
       -> CLOSED (NE)
       -> LOSS_ALLOCATION pending (damage results)
       -> RETREAT pending (retreat-only results)
```

Loss/retreat execution is intentionally not implemented in this checkpoint.

## Attack declaration

An accepted ATTACK:

- passes existing controller, commitment, phase, adjacency, defender, attack-state, and support validation
- creates one canonical `CombatTransaction`
- marks direct attackers `hasAttacked=true`
- consumes selected attacker artillery's support use immediately
- locks participants/support into the transaction
- creates `PendingDecision.DEFENDER_REACTION`
- emits `CombatDeclared`

Because declaration is irreversible in this vertical slice, attacker participant/support-use flags are consumed when declaration succeeds.

## Defender decision owner

`resolveCombatDecisionOwner()` centralizes defender decision routing.

For 002A-1:

- one defender controller -> that controller is the decision owner
- multiple defender controllers -> explicit `RULE_NOT_IMPLEMENTED`

This is deliberate. No arbitrary controller may use another controller's artillery/HQ. Delegation/teammate authorization for defender decisions is deferred.

## Defender artillery reaction

Validated properties include:

- existing/alive artillery
- correct side and controller
- supplied
- full or first-damaged support capability
- legal range
- support-use flag not already consumed

On success:

- `artillerySupportUsed=true`
- transaction stores `defenderArtilleryUnitId`
- event: `CombatReactionUsed`

Only one defensive artillery CRT effect is accepted per battle.

## Last Stand reaction

Validated through the reaction action, not attacker payload:

- selected unit is the correct defending HQ
- controller owns HQ
- HQ supplied and in range
- HQ unused this game turn
- side has at least 2 CP

On success:

- deduct 2 CP immediately
- set `lastHQCommandTurn`
- store validated `defenderHQEffect`
- event: `CombatReactionUsed`

At resolution, Last Stand provides the existing -1 attack CRT shift. If the CRT result would require defender retreat, retreat is converted into +1 defender loss step and no normal defender retreat is queued.

## Attacker HQ security boundary

`AttackSupportSelection` still contains compatibility/schema fields for future HQ integration, but 002A-1 does **not** trust them.

A normal ATTACK attempting to self-declare:

- attacker HQ id/command
- second Schwerpunkt attack

is rejected with `RULE_NOT_IMPLEMENTED` rather than gaining an unvalidated CRT modifier.

Future attacker HQ effects must originate from a Rules-Engine-validated activation/effect state.

## Dice and CRT

After `PASS_REACTION`:

- dice are generated through `SeededRNG`
- RNG snapshot is persisted back to `GameState.random`
- `buildCombatContext()` calculates the structured modifier breakdown
- `resolveCRTResult()` selects the current unmodified CRT table result
- `parseCRTResult()` records loss/retreat requirements
- transaction stores context + resolution
- events: `CombatReactionPassed`, `DiceRolled`, `CRTResolved`

Same initial state + seed + same action sequence is regression-tested for deterministic transaction/events.

## Post-CRT transition in this slice

- `NE`: transaction becomes `CLOSED`, commitment authorizations for that battle are deactivated, `CombatCompleted` emitted.
- any result with losses: first `LOSS_ALLOCATION` pending is created; loss application remains deferred.
- retreat-only result: `RETREAT` pending is created; retreat movement remains deferred.
- loss + retreat: both requirements are persisted; loss allocation is the first pending stage.

## Breakthrough schema correction

The partial checkpoint's single `selectedUnitId` model was removed because it silently imposed a new one-armor-only rule.

`CombatBreakthroughState` now supports:

- `eligibleUnitIds[]`
- `completedUnitIds[]`
- `maxHexesByUnitId{}`
- `resolved`

No breakthrough transition is implemented in 002A-1.

## Integrity checks added

`validateGameStateIntegrity()` now checks at least:

- combat registry key equals transaction `battleId`
- attacker/defender ids are unique
- all participant unit references exist
- `sourceBattleId` references an existing transaction
- pending battle references an existing transaction
- pending kind matches transaction stage
- closed transaction cannot still own a PendingDecision

## Known deferred issues / handoff notes

1. Multi-controller defenders in one target hex require an explicit delegation/authorization policy later.
2. For cross-controller attackers, attacker-side future loss allocation owner is provisionally the declaring controller. 002A-2 must define/validate the real team loss-decision policy before applying losses.
3. RESOLVED in 002A-2A: `artillerySupportUsed` is a per-current-Player-Turn support window and resets for both armies whenever either side begins a new Player Turn.
4. Attacker HQ effects remain blocked until a validated activation mechanism exists.
5. Advance, Breakthrough and Schwerpunkt protocol/schema may exist, but their transitions explicitly return `RULE_NOT_IMPLEMENTED`.
6. Last Stand conversion is recorded in the combat resolution/loss requirement; actual step loss is deferred to 002A-2.

No Supply, Rail, AI, UI, multiplayer server, balance, CRT, map, or unit-value changes were made.
