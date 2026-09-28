# Foundation Amendment FA-002 — Deploy Reinforcement Action

## Amendment

The canonical `Action` protocol now includes:

```ts
interface DeployReinforcementAction extends ActionIdentity {
  type: 'DEPLOY_REINFORCEMENT';
  controllerId: EntityId;
  reinforcementId: EntityId;
  entryHex: HexCoord;
}
```

## Reason

Digital multiplayer and Human+AI reinforcement placement must follow the same authority path as every other player decision:

`Controller -> Action -> RulesEngine`.

UI code, AI policy, and turn hooks must not directly spawn units or mutate authoritative state.

## Identity and replay

`reinforcementId` is a deterministic identity derived from Scenario reinforcement schedule data. It is not an action id and is never random. `DEPLOY_REINFORCEMENT` uses the existing deterministic `actionId` lifecycle; rejected retries keep the same reinforcement slot id while receiving a new action id unless replaying an explicit canonical action id.

## Impact

FA-002 changes the canonical `Action` union, logged-action compatibility, and the RulesEngine recognized action set. It does **not** change `GameState` schema, `ValidationCode`, `GameEvent`, action/battle identity counters, battle identity, or turn order.

Task 002D-1 intentionally leaves the deployment transition unimplemented. RulesEngine recognizes the action and returns `RULE_NOT_IMPLEMENTED`; Task 002D-2 owns deployment state changes and Ready-barrier integration.

## Task 002D-2 integration extension

FA-002 is now fully integrated into the authoritative reinforcement lifecycle.

In addition to the canonical `DeployReinforcementAction` protocol introduced by 002D-1, 002D-2 establishes two reinforcement-phase barrier rules:

1. During `SOVIET_REINFORCEMENT_SUPPLY`, every Soviet controller participates in the Ready barrier, including controllers that currently own zero live units. This preserves their opportunity to take ownership of a side-wide reinforcement.
2. If at least one currently available Soviet reinforcement has at least one legal East Rail Exit, `READY_FOR_PHASE_END` and `END_PHASE` are rejected with existing `INVALID_SUPPORT` and `details.reason = DEPLOYABLE_REINFORCEMENT_REMAINS`. Controllers therefore cannot Ready themselves out of a still-resolvable reinforcement choice.

A successful `DEPLOY_REINFORCEMENT` action creates exactly one ordinary Soviet `UnitState` whose permanent `controllerId` is the acting controller. Its unit id is the deterministic Scenario reinforcement slot id. Consumption is proven only by the accepted deployment action in `actionLog`; no reinforcement runtime queue or consumed-state container exists.

The new unit starts with `supplyState = OUT_OF_SUPPLY`. Deployment does not refresh supply. The existing 002B-5D lifecycle refreshes all Soviet units only when `SOVIET_REINFORCEMENT_SUPPLY` actually ends and `SOVIET_MOVEMENT` begins.

FA-002 still does **not** change the `GameState` schema, `ValidationCode` union, `GameEvent` union, identity counters, battle identity, turn phase order, or `endPhase(state, rules)` signature. Reinforcement deployment consumes the normal deterministic action identity only.
