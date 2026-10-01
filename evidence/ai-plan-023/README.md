# AI-PLAN-023 — bounded shared intermediate region (development experiment)

Base: AI-PLAN-022 `3553c3f982583ed32ddc83b5cd7ec2cefed2b007`. Historical comparison: 014 experiment `a655892a1eed5f8a136b6c73b9d9000560df8d91`, using its two existing journals, never rerunning it. This is one candidate and two reused development seeds; no production adoption, general strength, or independent holdout claim.

## Frozen candidate

Only `ai/fair/mainAttackPlan.ts` implements strategy. `FairHost` opts in for the German seat in this experimental runner; normal registrations and opponent are unchanged.

- Provider reads only copied/frozen authorized `FairInput` and the previous seat-local plan; it has no mutable retained state, RNG, host, Core, external callback, or hidden revision.
- Eligible units are alive, owned, not yet moved, nonartillery, not dedicated to rail repair, effective movement at least 3, without an identified enemy within one hex, and without a recorded rejected MOVE.
- Before any own MOVE attempt in the movement phase, pick the eligible unit nearest any public capital (higher movement, then unit ID break ties). Pick at most four eligible units within two hexes, ordered by anchor distance, higher movement, then ID. At least two are required initially. IDs and coordinates are selected from the observation, not hardcoded.
- Enumerate the 37 geometrical cells within three hexes of the anchor. A center must be two or three hexes away, on the public board, safe for every member under the existing routing guard, and strictly closer to a public capital than every member's current position. Sort by capital distance, summed member distance, then coordinate key. The first center plus its six neighbors, filtered by the same tests, is the shared intermediate region (at most seven cells).
- Existing plans keep the same region within the movement phase, except cells unsafe for a remaining member are removed. Remove each member independently when it reaches the region, has moved, becomes ineligible/engaged, or has a rejected movement receipt. Empty membership/region releases the plan. No replacements after an attempted move; friendly `hasMoved` also prevents reconstruction after bounded history eviction. Before any moves, a previous null result can be reconsidered if the observation changes; it is not a persistent “attempted formation” marker.
- No member waits for another to arrive. A safe-looking but unreachable target can still cause READY under the original policy; the real Host phase boundary clears the plan. This is deliberately a maximum-one-movement-phase commitment, not a reachability oracle. Tests exercise this exact blocked case.
- Planner calls existing `createMoveScorer(...).safeDestination` only. It adds **zero Dijkstra searches**. Public index construction is linear in DTO map/edges/units; group sorting uses the observed units, and at most 37 × 4 center and 7 × 4 region risk checks follow. The unmodified route scorer does actual public-cost pathfinding, 768/unit, 32768/decision, path 16, base candidates 128/combined 255. Rejection limit 8 remains unchanged.

Attack scoring, 1.5/.75 parameters, 014 advance guard, origin-adjacent stop, Core/rules/RNG/supply/map, and opponent policy remain unchanged. Grouped units may choose a shorter or different movement prefix; ungrouped units retain the old targets.

## Validation before games

`node ai/build.mjs` and the command below pass: **34/34**, six new, thirteen 022, fifteen prior movement/path checks.

```sh
node --test ai/tests/plan023.test.mjs ai/tests/plan022.test.mjs ai/tests/move006.test.mjs ai/tests/pathfinding.test.mjs ai/tests/movement-cost.test.mjs
node evidence/ai-plan-023/build.mjs
```

The new checks prove a provider-selected action absent from the old exact menu is accepted by actual shared Host/Core; unchanged artillery/opponent; independent completion/movement/death/engagement/congestion/rejection release; unreachable region → READY → phase clearing; hidden-state/RNG pairs and seat isolation; bounded three-action micro-flow and unchanged route/candidate bounds. These are not full campaigns. The baseline offline analysis verifies final hashes without creating new games (`offline-baseline-check.log`).

`build.mjs` reconstructs all six AI005 source blobs from `evidence/ai-eval-012/frozen/ai005`, validates their Git blob IDs, compiles them, and requires all **67 runtime JS hashes** to match the 014 recorded opponent exactly. It verifies the 014 basic/advance/parameters/minimal/candidates JS hashes, and permits only the already authorized 022 Host/routing/plan plus the new provider runtime differences. The current minimal retreat policy is used for both seats, matching 014. `.evaluation` and `.ai-dist` are temporary rebuildable outputs, not committed artifacts.

One initial build-identity attempt used `git show` of the historical management identity, which is not a source tree in this checkout; it failed after successfully matching the opponent. `initial-build-missing-git-object.log` preserves this failure. The final gate instead checks the exact previously recorded runtime hashes; no surrogate opponent or baseline was used. An exploratory fixture had a mistyped artillery template `G-ART`; corrected to existing `G-ARTY` before the six tests were written. No evaluation games were involved in either correction.

## Frozen experiment and replay

Leader commits sources, config, runner and build identity locally with `[CF-Pages-Skip]` **before** authorizing this command:

```sh
node evidence/ai-plan-023/run.mjs --run-frozen
```

The manifest records the local pre-run commit honestly. Remote mirroring happens after the experiment and is not presented as remote preregistration. Config/source/runtime/baseline hashes are checked before any game; tracked worktree must be clean. A pre-existing output manifest blocks repeat execution. Exactly 1017 then 1018 run with the candidate as German, 1800 decisions/180s per game/420s batch; failure stops the batch, is retained, and is not retried. Synchronous writes plus fsync on every journal row preserve completed steps; each job retains process failures and losslessly compressed full traces/events. A hard child timeout retains the trace and compresses it in the parent.

For a **separately authorized reproduction**, preserve the committed results and use a fresh destination:

```sh
node evidence/ai-plan-023/run.mjs --run-frozen /absolute/path/to/fresh-plan023-reproduction
```

Read-only replay of saved results (build first and expand archived `trace.ndjson.gz`/`events.ndjson.gz` if the raw copies are absent):

```sh
node evidence/ai-plan-023/run.mjs --replay-existing
```

Gameplay elapsedMs includes a passive authorized-DTO basic-policy call plus old/new candidate-menu diagnostics and per-step fsync; it is not a measurement of provider-only computation. replay/summaries are offline after gameplay but retain the original child `matchMs + 30000` and remaining batch wall deadline. Offline analyzer reads authoritative replay state only after the policy run and never supplies it to either agent. Passive unplanned policy/menu calculations are independent bounded diagnostics and never influence the returned choice; the strategy itself adds no route searches.

## Measurements and decision

`record.json` records accepted action replay/final hash, attacks, advances, step/unit losses, rejections, cap, errors, elapsed time, and full event hash. `comparison.json` adds all-alive-German mean/minimum capital distance, turn movement start/end points, accepted MOVE counts, unmoved eligible units at phase end, and friendly full-neighbor congestion. Waiting is descriptive: it does not prove a legal profitable move existed. Initial group membership is fixed for each phase; per-member positions, distance, alive state and movement samples continue after a member is removed from the live plan. Removal/change records remain separate. Corresponding 014 group IDs are compared at the same movement-phase boundaries (baseline start means its first German movement record of the corresponding turn, not the candidate decision number), without interpreting a survivor-only mean as improvement.

Actual plan impact reports changed policy choice on the same authorized DTO, chosen MOVE absent from the unplanned menu, and changed grouped MOVE menus. These are not interchangeable counts. Initial seed equality does not imply the same dice after action divergence; no per-battle causal attribution.

Two games can support only continued research. If progress is inconsistent or all-army mean/minimum regresses against 014, retain 014. Even consistent improvements merely retain a promising candidate and must report losses, rejections, cap and fixed-group readability. No second strategy, tuning, expanded games, deployment, push, PR or merge in this implementation task.

## Results

Pending the Leader's source/config freeze and explicit experiment gate. No new games have been run while preparing this file.
