# Initial Deployment Foundation — Task 002G-1 / FA-003

FA-003 adds a pre-game deployment lifecycle without changing the normal gameplay `PHASE_ORDER`:

```text
createDeploymentGameState
  ↓
SOVIET_DEPLOYMENT
  hidden from Germany
  ↓ all Soviet controllers Ready after the Soviet roster is complete
GERMAN_DEPLOYMENT
  hidden from Soviet
  ↓ all German controllers Ready after the German roster is complete
Turn 1 initialization
  ↓
GERMAN_SUPPLY_RAIL
```

## Scenario rule data

`ScenarioConfig.deployment?` contains the free-deployment roster (`id + templateId + side`), sequence, concealment flag, and side zone selectors. Legacy/fixed scenarios omit it and continue to use `createGameState()` unchanged.

The default Digital deployment rule supported by the foundation is:
- German: `WESTERNMOST_COLUMNS`, normally `columnCount=3`, derived from distinct q-values of real map hexes.
- Soviet: complement of the German zone across real, deployable, non-`LAKE` map hexes.
- `EXPLICIT_HEXES` is also supported for future scenarios.

No 20×32 or A/B/C assumption is used.

## Placement and ownership

`DEPLOY_INITIAL_UNIT` is the canonical Action. The first controller that places a roster unit becomes its permanent `UnitState.controllerId`. The same controller may reposition it before becoming Ready; a teammate may not steal/reposition it. Placement is setup, so it never sets `hasMoved` and spends no CP/RP.

Initial UnitState is full-strength/alive, unentrenched, and `OUT_OF_SUPPLY` as a placeholder. Supply is not refreshed during placement.

Deployment stacking uses `rules.stackingLimit`; `LAKE`, enemy overlap, and out-of-zone placement are illegal.

## Ready lifecycle

During either deployment phase every controller on the active side is required by the Ready barrier, even if that controller currently owns zero units. Ready is rejected until every roster unit for the active side is present and legally placed. A controller that has become Ready is frozen by the existing controller-ready guard.

Soviet completion only switches to `GERMAN_DEPLOYMENT`; it does not start a Player Turn or supply lifecycle.

German completion starts Turn 1 exactly once:
`beginGameTurn → beginPlayerTurn(GERMAN) → beginPhase(GERMAN_SUPPLY_RAIL) → German supply refresh → Soviet supply refresh`, and emits `PhaseEnded`, `GameTurnStarted`, then `PlayerTurnStarted` after the final controller Ready event.

## Hidden deployment view

`projectDeploymentView()` is a whitelist DTO valid only during deployment phases. A viewer sees all deployed units of the viewer's **side**, not merely units owned by that controller; enemy units are absent. The DTO intentionally excludes raw `actionLog`, combat state, pending decisions, and identity counters so `DEPLOY_INITIAL_UNIT.hex` cannot leak enemy placement.

This is only initial-deployment concealment, not a general fog-of-war architecture.

## Headless / replay

No headless bypass exists. `runHeadlessGame()` can receive deployment states and advance them only through canonical `DEPLOY_INITIAL_UNIT` and Ready Actions. Exact replay naturally includes the same placement Actions and identity history.

## Deferred

Task 002G-1 does not provide the full production 26 German / 32 Soviet roster, AI deployment policy, UI deployment screen, WebSocket secrecy transport, general Fog of War, map editor, or balance simulation. Production roster/scenario-start content remains for 002G-2.
