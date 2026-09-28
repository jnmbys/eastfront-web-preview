# Rule ambiguities / digitalization decisions requiring Leader confirmation

These are not balance changes. They are places where paper play or the Python oracle relies on convention/implicit behavior that a deterministic engine must make explicit.

## Highest priority

### 1. Authoritative unit stat notation/value source
Current V6 simulator and the Leader handoff use unified Attack-Defense-Movement values such as German infantry `5-5-3`.
Earlier paper iterations contained shorthand such as `5-3`, where the middle defense value was not always written.

**Milestone 1 uses the current V6 / Leader-handoff values. Leader should declare this table canonical before full combat parity.**

### 2. What exactly counts as a bridge?
Current generated map data stores roads/rails/rivers but does not store bridge objects. The Python simulator effectively makes every road-over-river crossing cost 1 because road cost returns before river surcharge.
The paper rule says a **road bridge** cancels river movement surcharge.

Digital importer currently infers a bridge whenever a road or railway edge overlaps a river edge. Future scenario files should store bridge state explicitly.

Need confirmation: can a road ever cross a river *without* a bridge on this scenario map?

### 3. Mixed-direction river attack
Python rule: river attack penalty applies only when **every attacking origin** crosses a river edge. If one attacking origin does not cross, the entire battle gets no river penalty. If all cross and river types differ, strongest river penalty wins.

This is plausible, but it must be explicitly approved.

### 4. Artillery usage frequency — RESOLVED for Digital Baseline
Digital baseline now uses: **each artillery may provide support at most once in each Player Turn**. Every new German or Soviet Player Turn resets `artillerySupportUsed` for both armies. This allows Soviet offensive support in the Soviet turn and a fresh defensive support opportunity in the following German turn.

### 5. Loss allocation interaction
Rule: before any participating unit receives a second loss step, each participating unit should receive one where possible.
If losses are fewer than participating units, **who chooses which units take them?**
Python AI automatically preserves high-value units; human play likely expects player choice.

Action protocol already reserves `ALLOCATE_LOSSES` for this decision.

## Command / timing

### 6. Last Stand reaction window
`LAST_STAND` is declared when attacked, before the die roll. In multiplayer this requires an interrupt/reaction state rather than a simple one-shot AttackAction.
`pendingDecision.DEFENDER_HQ_REACTION` is reserved.

### 7. Staff Office Plan lifecycle
Need exact answer on when target is declared, whether the CP/HQ is committed immediately, and what happens if no qualifying attack occurs.

### 8. Extra Supplies timing
Current interpretation: up to 3 HQ-range units count as supplied for movement/attack/breakthrough during that player turn, but never for RP recovery.
Need whether it can be declared after movement has started or only at turn start.

## Movement / control

### 9. Road whole-move +1MP remains experimental
Config flag exists. Current candidate interpretation matches Python V6:
- every traversed edge is road
- starting hex and entire path avoid enemy ZOC
- then +1 total MP

Need final confirmation before making it default.

### 10. Passing through friendly overstacked hexes
Paper rule only clearly limits **occupancy** to 2 units. It is not explicit whether a moving unit may pass through a friendly hex already containing 2 units if it does not stop there.
Milestone 1 only enforces stacking at destination.

### 11. Controller transfer timing
Website concept allows units to transfer between HUMAN/AI controllers. Rule does not say when this may happen.
Recommend turn/phase-boundary only, with same-side approval policy defined at multiplayer layer.

## Supply / rail

### 12. Rail repair and current-turn supply
Python/reference sequence computes supply first, then repairs railway; new repairs help planning but do **not** resupply units until next turn.
This matches current phase order but should be stated in the digital rulebook.

### 13. Soviet capital recovery shutdown
The current oracle stops capital recovery-base function if Germany controls any AC10/AC11/AD10. A later S1 experiment proposed changing this and was rejected/not locked.
Digital baseline therefore keeps old behavior until a new Soviet patch is accepted.

## Combat / victory

### 14. Engineer participation
Current combat oracle gives engineer cancellation only when an engineer is included among direct attackers. Confirm whether an engineer occupies an attacking slot/origin and becomes exposed to combat losses, or may support from an adjacent stack without being a direct attacker.

### 15. Final-turn victory timing
16/18/20 remains experimental. Current concept: before final turn Germany must survive through Soviet player turn; on the configured final German player turn, satisfying the capital condition at German-turn end wins immediately.
This timing should be represented in ScenarioConfig rather than hard-coded as T16/T18.

### 16. Live-supply requirement at victory check
At least one German unit occupying AC10/AC11 must be supplied. Supply must be recomputed from the live rail/city state at the exact victory check. `victory.ts` deliberately does not finalize this until supply engine lands.

## Core Hardening follow-ups before Combat Transaction

### 17. Initial CP gain timing
Lifecycle now has one canonical start-of-player-turn CP gain hook. Confirm whether `initial CP = 1` is the amount *before* the German T1 start-of-turn gain or already the post-start value. v0.1.1 preserves existing initialization and only gains CP when later player turns begin.

### 18. Multi-controller defender decision ownership
`PendingDecision` can represent one `decisionOwnerControllerId` plus multiple `eligibleControllerIds`, but the policy for selecting the initial owner when multiple controllers have units in the defending stack is not yet a game rule.

### 19. Unit commitment consumption
Battle-scoped cross-controller authorization exists. Current safety policy invalidates commitments on ownership transfer and at the granting side's player-turn end. The exact point at which a resolved combat consumes/closes a commitment belongs in the future Combat Transaction State Machine.

### 20. Phase-ready participants without units
v0.1.1 considers same-side controllers with live owned units to be required participants in the ready barrier; if a side has no live units, same-side controllers are used as a fallback. A future commander-only controller role may require an explicit scenario capability flag.


### 21. Retreat legality / OOS surrounded defense — 002A-2B dependency
Legacy V6 uses one conceptual legality set: destination must be on-board/non-lake, not enemy occupied, outside enemy ZOC, and have friendly stacking capacity. `_fully_surrounded()` uses those ingredients to decide the OOS defense-halving condition; `retreat_unit()` uses them step-by-step for actual retreat. Failed required retreat causes one extra loss step maximum for that side in the battle. Digital 002A-2B must centralize this as one shared helper before enabling the OOS surrounded-defense modifier.
