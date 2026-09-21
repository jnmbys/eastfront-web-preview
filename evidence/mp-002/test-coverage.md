# MP-002 acceptance coverage

| Requested coverage | Automated evidence |
|---|---|
| 1–3 Soviet deployment, wrong controller, hidden deployment | mp002-gameplay; full production two-WebSocket E2E |
| 4–7 Move, wrong controller, stale revision, idempotency | mp002-gameplay; every accepted E2E action is resent with its original requestId |
| 8, 29 exact local/server state and RNG | Every accepted action in both real WebSocket E2Es compares full private GameState, knowledge and RNG |
| 9–12 combat, multi-attacker, defender reaction, loss ownership | mp002-gameplay; production E2E; actual two-browser multi-attacker battle and loss selection |
| 13–16 retreat, advance, breakthrough, Schwerpunkt | Real WebSocket combat branch fixture via unchanged Core, seed 8246 |
| 17–18 phase progression and formal victory | Production Scenario reaches Turn 16 GAME_OVER / FINISHED after 224 accepted actions |
| 19–22 distinct views, hidden move/artillery, CONTACT/Last Known | mp002-gameplay; privacy assertions for each E2E snapshot; browser screenshots |
| 23–25 normal/decision reconnect, invalid token | Both WebSocket E2Es; mp002-gameplay; retained mp001-authority; two-browser offline/reconnect |
| 26–28 sequence gaps, authorized resync, no disconnected decisions | mp002-client gap/reorder/revision cases; mp002-gameplay grace/decision freezes |
| 30 room/token entropy leaves RNG alone | mp002-gameplay and retained MP-001 tests |
| 31 independent local Scenario | Existing full local turn loop/Combat/Startup suite; browser leaves network match then starts local mode with backend stopped |
| 32–34 Camera, VS2, unchanged Fog | Browser identity/transform/mask-build checks; mp002-client DynamicMap/Fog tests; retained Performance Pass 1 suite |

Additional boundaries: exact nested schemas; observer/state/dice/seed injection rejected; query key coalescing; no client GameState/engine; no optimistic position changes; trusted server debug view overrides cannot affect remote projection; original room race/lifecycle/origin tests retained.

Frozen file exceptions are recorded separately. Changes to older test harnesses import the new session adapter and locate the parameterized boot function; the original behavioral assertions remain.
