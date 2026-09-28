# Production Full-Game Headless Closure — Task 002G-3

## Production inputs

This gate uses the real `defaultScenario`, `defaultRules`, `reference/strategic-reset-f-map.json`, `importLegacyMap(...)`, `createDeploymentGameState(...)`, `runHeadlessGame(...)`, and `replayHeadlessActions(...)`. The production turn limit remains 16.

## Passive provider policy

The smoke provider is deterministic and test-only. It:

1. mechanically places the 32 Soviet initial roster units inside the legal Soviet deployment zone;
2. Readies the Soviet side;
3. mechanically places the 26 German initial roster units inside the legal German deployment zone;
4. Readies the German side into Turn 1;
5. during each Soviet reinforcement phase, deploys the earliest currently available reinforcement to the first currently legal East Exit while capacity exists;
6. otherwise submits `READY_FOR_PHASE_END` for the active side.

It issues no MOVE, ATTACK, ENTRENCH, RECOVER, RAIL_REPAIR, HQ, Transfer Control, or tactical AI actions. Every transition still occurs through canonical Actions and `RulesEngine.apply(...)`.

## Closure result

The passive production run reaches Turn 16 and terminates through the existing victory lifecycle at `GAME_OVER`. Because Germany makes no operational advance, the expected result is Soviet victory with `SOVIET_CAPITAL_DEFENDED_TO_TURN_LIMIT`.

The smoke records and reports the actual number of Soviet reinforcement slots deployed versus delayed by legal East-Exit capacity. Their sum must equal the production schedule's 13 slots.

## Replay and determinism

The full canonical action sequence returned by the live run is replayed from an equivalent fresh production deployment state through `replayHeadlessActions(...)`. Final state, action log, identity counters, victory, and integrity must match. A second live run with the same seed/provider must reproduce the same canonical action sequence, reinforcement choices, final state, and victory.

## Freeze gate

If Leader review passes, the Digital Core has satisfied the MVP headless production closure gate and is eligible for MVP Digital Rules Freeze / UI-003 integration. This task does not itself declare the Core frozen.
