# AI-005 — fair-view multi-step routing

## Handoff / provenance

- Repository: jnmbys/eastfront-web-preview; task branch: ai-005-pathfinding.
- Base: a4d347f7f86affc53e53b86e236ae58c79e84a7b (ai-004r1-rejection).
- Management read: c7531c70fab4b7c7402cd2f7d927c2134adee228, PROJECT_STATE.md and WORKER_PROTOCOL.md. Runtime was NOT taken from management branch.
- Remote ai-005-pathfinding was absent on initial and prepublication checks. Fresh isolated checkout; no AGENTS.md found. No previous work overwritten.
- Source checkpoint: the commit containing this file; resolve with `git log -1 --format=%H -- evidence/ai005/REVIEW.md`.
- Only two runtime files changed: ai/fair/basicAgent.ts and new ai/fair/routing.ts. Other changes are necessary AI tests/evidence. Core, vendor, RNG, supply, authority projection/host, candidate admission, local Worker/takeover, UI/server and deployment configuration unchanged.
- No production change, deployment, PR, hook or force push. Authorized publication uses [CF-Pages-Skip]. Management files remain Leader-owned.

## Implementation

Decision-local, lazy per-unit reverse Dijkstra over public terrain and edges, authorized friendly occupancy, identified enemies and current CONTACT locations. Last Known is not treated as an occupied hex; hidden enemies are never added to the graph. Identified enemies produce safe adjacent goals; otherwise use the existing public objectives. Existing immediate adjacency risk thresholds and stop-at-contact behavior are preserved, as is the entire attack score/threshold.

R1's public movement cost is reused on every edge: terrain/Jager, river, roads/active bridges, OOS penalty and possible road bonus. Road bonus remains optimistic where ZOC is unknown. This is an estimated route, not certified legality or safety. No engine validation, full state, simulation, hidden support or future RNG enters fair policy.

Each graph step costs 10 + its public MP cost, favoring fewer future single-step Actions with terrain cost as a preference. A candidate must descend the settled route potential. It may initially increase geometric distance, permitting detours and avoiding cul-de-sacs. Search stops after settling the unit's current hex, with caps of 768 settled nodes/unit and 32,768/decision. Unsettled/unreachable starts do not get an invented route. Indexes and per-unit plans live only for the current decision; next view replans everything.

IMPORTANT: existing admission permits only one-hex MOVE, and Core sets hasMoved after that Action. AI-005 plans across future turns but still submits exactly one adjacent step, NOT a full-MP or multi-hex move. Candidate cap128, host rejection limit8, same-observation tactical limit3, forced decisions and manual takeover remain unchanged.

Bounded own rejected MOVE receipts since the latest accepted phase end temporarily suppress that same intent even if another unit changes observationKey. They are not converted into enemy knowledge. This deliberately may defer a newly freed edge until the next phase. History is still the existing 16 receipts; no persistent policy cache or new authority fields.

## Same-seed comparison

Full R1 reruns match its previously recorded MOVE/ATTACK/rejection counts. Policy seeds101/202, combat seeds17/18/19, full production deployment scenario and host contracts are unchanged. Baseline compiled snapshot was made before any edits from the exact base source. Comparison uses the same trusted evaluation harness for both policies.

| Seed | First contact / first attack turn R1→005 | MOVE | ATTACK | Immediate reversals | Rejections | Outcome |
|---|---|---|---|---|---|---|
|17|12→9 / 12→9|806→778|4→3|25→0|0→0|natural T16 GAME_OVER, Soviet win both|
|18|12→9 / 12→9|777→778|2→2|16→0|0→0|natural T16 GAME_OVER, Soviet win both|
|19|12→9 / 12→9|777→793|3→6|16→1|0→0|natural T16 GAME_OVER, Soviet win both|

All runs retain58 initial deployments,13 reinforcements and157 phase ends; no early stop, integrity failure, rejection-limit or action-limit exit. Contact is sampled only at actual own policy decisions after deployment using authorized CONTACT/identified units; this table uses the first such decision over both seats. All three first contacts are German T9 movement vs T12. Identified adjacency and first attack are likewise three turns earlier. Not elapsed-time or omniscient detection measurement.

Reversal = a unit's next accepted MOVE goes from the previous MOVE endpoint back to its origin; retreat/advance alone does not count. Revisit = a MOVE destination appeared earlier in that unit's recorded MOVE positions. Revisit counts equal reversal counts in these six runs. Zero R1 rejections was preserved, not evidence of universal legality. Total attacks9→11 across three seeds is a small mixed result (one down, one equal, one up), not a general strength/balance claim.

Seed19's remaining reversal: S-EL-02 moved21,3→21,2 at T10, then21,2→21,3 at T11. The objective and unit MP stayed fixed, but friendly occupancy changed. Saved FAIR packets and the focused counterfactual show reverse score -Infinity with prior occupancy, finite with new occupancy. Thus dynamic occupancy can still cause backtracking; do not claim zero oscillation generally. `reversal-19.log` encodes -Infinity as JSON null; raw fair packets are in `reversal-19-inputs.json.gz`.

## Validation

- `node ai/build.mjs`: PASS (build.log; empty means no diagnostics).
- `node --test ai/tests/pathfinding.test.mjs ai/tests/movement-cost.test.mjs ai/tests/strategy.test.mjs ai/tests/boundary.test.mjs ai/tests/flow.test.mjs ai/tests/local.test.mjs`: **58/58 PASS**, tests.log.
- Seven new routing tests: non-greedy detour/no revisits, dead end/unreachable goal, target/terrain/occupancy/CONTACT changes, visible-target appearance/disappearance, rejection memory across changed observation, paired hidden-ZOC actual acceptance/rejection/recovery and bounded search/immutability.
- R1 cost parity test still checks288 real Core combinations. Existing fair-input hidden-state/RNG pairs, deterministic full campaigns, forced battle flows, cancellation/single-flight, Worker bridge and explicit takeover pass.
- Hidden-ZOC rejection fixture explicitly enables the existing public road-bonus rule in test-only rules. Production default leaves that bonus disabled. Equal fair inputs produce the same route intent, but hidden ZOC makes one actual Core result reject while its paired state accepts. The policy gets no reason code; it safely ends after that sole route fails. This does NOT demonstrate a production default single-step hidden-occupancy rejection.
- Seed17 full steps + summary JSON exactly equal on an independent rerun; final state and trace hashes agree (comparison.json, ai005-17/replay-17 JSON.gz and summaries). Final RNG is identical within each replay. R1 vs005 RNG endpoints differ because the number of battles differs; RNG implementation/contracts did not change.
- `node ai/local/build.mjs` and `node ai/local/audit.mjs`: PASS. 72 reachable Worker modules,0 Node imports,0 sockets; experimental gate on, production gate off; unchanged empty multiplayer endpoint/same-origin connect policy. worker-audit.json/log.
- Scoped diff checks establish unchanged Core/vendor/authority/local runtime. Full Web/Core suites were not repeated; prior R1 evidence is reused only for unchanged areas. No browser or Huawei/iPad acceptance in this task.
- Offline policy time increased: recorded seed17 p95 ~25.8ms vs R1 ~7.1ms, under concurrent container load. These are diagnostic samples, NOT controlled device performance evidence. Search is bounded, but tablet responsiveness remains unverified.

## Failures retained / corrected

Initial compile used Array.findLastIndex unsupported by this project's TS target; replaced with an ordinary bounded loop (build-initial.log). The initial51-test run passed on compiler-emitted JS despite that typecheck failure, so it was not accepted as the final gate; the clean build and final58-test run supersede it (regression-initial.log retained).

Three initial new test fixtures were corrected, not production rules: a blocking friendly unit was itself eligible to move; ordinary Panzer sight at distance2 did not identify the enemy; production road bonus was disabled. Marked the blocking fixture hasMoved, used existing Recon sight, and explicitly enabled road bonus only for the hidden-ZOC test. Initial7/10 result is in pathfinding-initial.log; corrected10/10 and final58/58 results are saved. No attack/rejection threshold was changed to pass tests.

## Reproduction

From this task checkout:

```sh
npm ci --ignore-scripts
node ai/build.mjs
node --test ai/tests/pathfinding.test.mjs ai/tests/movement-cost.test.mjs ai/tests/strategy.test.mjs ai/tests/boundary.test.mjs ai/tests/flow.test.mjs ai/tests/local.test.mjs
node ai/local/build.mjs
node ai/local/audit.mjs
node ai/tests/pathfinding-comparison.mjs ai005 17
node ai/tests/pathfinding-comparison.mjs ai005 18
node ai/tests/pathfinding-comparison.mjs ai005 19
node ai/tests/pathfinding-comparison.mjs replay 17
node ai/tests/pathfinding-reversal.mjs
```

For baseline, make a separate checkout/worktree at a4d347f7f86affc53e53b86e236ae58c79e84a7b, install locked dependencies and run `node ai/build.mjs` there. From task checkout run `node ai/tests/pathfinding-comparison.mjs r1 17 /absolute/baseline/.ai-dist/ai/fair/index.js` (repeat18/19). This keeps the comparison harness identical and imports only baseline policy code. No script deploys. `.json.gz` traces are lossless; inspect with `gzip -dc`. Existing legacy tests write their historical evidence directories; preserve or restore those generated changes rather than overwriting old Git evidence. Final task results live only here.

## Limitations / Leader delta

AI-005 implements bounded fair routing and improves first contact in the three measured seeds. It is not coordinated attack, strategic defense, multi-hex-per-turn movement or a stronger-attack guarantee. Soviet fallback still follows the same public capital objectives when no enemy is identified. Routes assume current occupancy and per-unit MP; future occupancy, supply, enemy discovery and capped history can invalidate them. Fixed-map descending potential prevents static cycles; dynamic backtracking remains possible. Temporary failed-edge suppression can forget after16 receipts. Caps can defer a route on larger maps. No user-device performance or gameplay acceptance, no deployment.

Recommended next step: Leader review this immutable Git handoff, then separately authorize isolated browser/device acceptance if desired. Do not silently merge or publish. Shared-state delta: AI-005 isolated source+evidence complete; R1 production/preview records unchanged; Huawei/iPad acceptance remains open.
