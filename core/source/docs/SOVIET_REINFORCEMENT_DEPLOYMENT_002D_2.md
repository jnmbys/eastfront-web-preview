# Soviet Reinforcement Deployment — Task 002D-2

## Authoritative flow

```text
Scenario reinforcement schedule
        ↓
available canonical slot
        ↓
Soviet controller chooses reinforcementId + East Exit
        ↓
DEPLOY_REINFORCEMENT
        ↓
validation against current board facts
        ↓
create one Soviet UnitState at the entry
        ↓
permanent controllerId = acting controller
        ↓
accepted actionLog entry consumes the slot
```

There is no reinforcement queue or other mutable reinforcement runtime state. Availability remains derived from the Scenario schedule minus accepted `DEPLOY_REINFORCEMENT` actions.

## Deployment legality

Deployment is legal only during `SOVIET_REINFORCEMENT_SUPPLY` and only for an active-side Soviet controller that has not already declared Ready. The `reinforcementId` must be a real Scenario slot, must have reached its scheduled turn, must not already have an accepted deployment, and must not collide with an existing unit id. The scheduled `UnitType` must resolve to exactly one Soviet `UnitTemplate`.

The entry must be a real `scenario.sovietEastRailExits` hex and must currently appear in the East-only `computeActiveSovietRailNetwork(...).exitHexKeys`. Live German physical occupation blocks deployment. Canonical German ZOC blocks deployment, while adjacent non-ZOC support units do not. Current living stack size must remain below `rules.stackingLimit`.

Independent Soviet supply sources are not reinforcement entries unless a Scenario separately lists the same hex as an East Rail Exit.

## Unit initialization and ownership

A successful action creates a normal Soviet unit with:

```text
id = canonical reinforcement slot id
step = 0
alive = true
hex = selected East Exit
supplyState = OUT_OF_SUPPLY
entrenched = false
hasMoved = false
hasAttacked = false
controllerId = acting controller
temporarySupply = false
dedicatedRailRepair = false
reconZocIgnoreUsed = false
artillerySupportUsed = false
lastHQCommandTurn = null
```

The acting controller becomes the permanent canonical owner immediately. The pool is side-wide before deployment but ownership is not shared after deployment.

Deployment spends no CP, RP, movement allowance, or RNG and creates no reinforcement-specific `GameEvent`.

## Supply timing

Deployment itself never refreshes Soviet supply. A newly deployed unit remains `OUT_OF_SUPPLY` for the rest of the reinforcement window. When the final required Soviet controller completes the Ready barrier and the phase transitions:

```text
SOVIET_REINFORCEMENT_SUPPLY
        ↓
refreshSovietSupplyState(...)
        ↓
SOVIET_MOVEMENT
```

The new unit is automatically included in the existing full Soviet normal-supply snapshot. Ownership is unchanged by that refresh.

## Ready barrier

During `SOVIET_REINFORCEMENT_SUPPLY`, **all Soviet controllers** are required participants, including controllers with zero live units.

```text
available reinforcement + legal East Exit
→ hasDeployableSovietReinforcement = true
→ Ready / END_PHASE rejected
```

If available or delayed reinforcements remain but there is currently no legal entry, Ready is allowed and the undeployed slots naturally remain available for a later Soviet turn. The game does not require every available reinforcement to deploy; it requires all currently deployable reinforcement choices to be resolved before Ready.

Other phases retain the pre-FA-002 Ready behavior: controllers with live units participate, with the existing all-allied fallback only if the side has no live units at all.

## Deferred systems

Task 002D-2 does not implement AI entry scoring, automatic deployment, sector-based ownership, a reinforcement runtime queue, Victory, HQ Extra Supplies, or new reinforcement GameEvents.
