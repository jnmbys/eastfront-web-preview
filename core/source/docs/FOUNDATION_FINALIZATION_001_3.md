# Task 001.3 — Foundation Finalization

Scope is deliberately limited to the two remaining Foundation semantics identified by Leader review.

## PendingDecision owner authority

`decisionOwnerControllerId` is now the only controller allowed to submit the action that resolves the current decision.

`eligibleControllerIds` is **not** an execution-authority list. It records controllers that may become owner later through an explicit delegation/reassignment mechanism. No delegation action is implemented in this task.

Therefore, while a pending decision exists:

```text
action.controllerId !== pendingDecision.decisionOwnerControllerId
=> PENDING_DECISION_CONTROLLER_MISMATCH
```

The existing global transaction lock and battle-id matching remain unchanged.

## T1 CP lifecycle

Rule semantics are locked as:

```text
setup reserve: GER 1 / SOV 1
German Player Turn 1 starts: GER +1 => 2 / SOV 1
Soviet Player Turn 1 starts: SOV +1 => GER 2 / SOV 2
maximum: 3
```

`createGameState()` now constructs the reserve state and enters German Player Turn 1 through the same lifecycle hooks used later:

1. `beginGameTurn(state, rules)`
2. `beginPlayerTurn(state, rules, 'GERMAN')`
3. `beginPhase(state, 'GERMAN_SUPPLY_RAIL')`

No UI/action special case exists.

## Verification

Required commands:

```bash
npm run typecheck
npm run smoke
npm run smoke:hardening
npm run smoke:transaction
npm run smoke:foundation
```

Task 001.3 does not implement Combat Transaction, Supply Graph, Rail Repair, AI, UI, or networking.
