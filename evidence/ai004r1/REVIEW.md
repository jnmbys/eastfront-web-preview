# AI-004R1 — rejection diagnosis and narrow public-cost fix

Base ea71d31dd7277565b1684453bc1a4baf126912d6; management read 674265e3b49f4f67ddf132100dff92edbd0658ae. Branch ai-004r1-rejection. Source commits use [CF-Pages-Skip]. Production/main/source-main/backend untouched. Preview publication and browser acceptance recorded separately in PREVIEW.md when performed.

## Diagnosis

Trusted offline evaluator ai/tests/rejection-diagnostic.mjs records original phase, intent, issue, repeated attempts and authorized context. It calls Core on a clone only AFTER the live host has already rejected an action. No diagnostics, issue codes, cloned states or legality callbacks enter strategy input or player UI; FairHost and LocalMatch are unchanged. Raw traces are losslessly gzip-compressed in this directory (JSON.gz); regenerate with the script, inspect with gzip -dc.

Seed17 exactly reproduced 692 MOVE, 2 ATTACK, 144 rejection and natural GAME_OVER. All 144 are INSUFFICIENT_MP: 124 Soviet movement, 20 German movement. Publicly avoidable:144; hidden-information rejection:0; candidate/phase defect:0. The missing public-cost scoring check is the cause. Within turn+phase+identical intent there are 40 distinct rejected attempts and 104 repeats. Observation-wide rejection memory changes when another unit moves, allowing these known-unaffordable crossings to recur. The narrow cost check removes this diagnosed family without adding blanket cross-observation rejection memory (which could wrongly suppress a now-legal action).

Example first rejection: T5 S-AT-01 from20,-3 to21,-4 FOREST across a major river costs4, supplied MP3. Other failures include low-MP artillery, infantry and OOS engineers. All original issues and per-attempt evidence are retained in before-17.json.gz.

## Fix and boundaries

Three runtime files only: ai/fair/basicAgent.ts, ai/fair/types.ts, ai/authority/projection.ts. Extend explicit public-rule allowlist with terrain movement costs, river surcharges, road/bridge factors and existing OOS movement penalty. Score one-step moves only if their public cost can fit available MP. Account for Jager forest/hill discount, active ROAD/BOTH bridges and road bonus. Unknown ZOC never removes a possible bonus; uncertain intents still reach the engine. No core movement validator/oracle imported, no full state, hidden support, future RNG or simulation in policy. Actual rejection limit8, same-observation tactical limit3, candidate limit128, phase end priority, attack threshold, forced actions and takeover unchanged. No new routing, cooperation, training, supply reset or save/load.

## Fixed-seed comparison

| seed | MOVE before→after | ATTACK before→after | rejection before→after | phase ends | outcome |
|---|---:|---:|---:|---:|---|
|17|692→806|2→4|144→0|157→157|natural GAME_OVER both|
|18|691→777|2→2|146→0|157→157|natural GAME_OVER both|
|19|692→777|2→3|144→0|157→157|natural GAME_OVER both|

No stops or action-limit exits in these runs. Reinforcements11→13; deployment58 unchanged. Accepted step statuses17:925→1044 (terminal transition reported separately by GAME_OVER, as in AI004). No reduction of action volume or extra phase skipping. Zero rejections is limited to these three seeds, not universal. Raw final RNG, all intents and steps retained. after17 and replay17 are byte-equivalent JSON values; earlier strategy full-campaign test also compared independent state/action replays.

## Sparse attacks

Original seed17:31 distinct combat phases, only5 with identified enemies and adjacent attack candidates;2 phases contain favorable candidates. First attack T12, second T13. T15 German/Soviet and T16 German have adjacent candidates but none meet unchanged risk threshold. Thus lack of observed contact dominates; conservative scoring also matters in three late opportunities. One-step greedy progress and no detours are existing limits. 144 failed crossings obstructed movement but the fix does not make attacks frequent: after17,31 phases/5 with visible enemies/4 with adjacency/3 with favorable candidates,4 accepted attacks. No blind threshold reduction or inference about unseen enemy opportunities. Before/after combat records include individual scored attack intents; JSON null score represents -Infinity.

## Validation and failures

- node ai/build.mjs PASS.
- node --test ai/tests/movement-cost.test.mjs ai/tests/strategy.test.mjs ai/tests/boundary.test.mjs ai/tests/flow.test.mjs ai/tests/local.test.mjs:51/51 PASS, targeted-tests.log. Includes paired hidden state and RNG, isolation/determinism, real forced combat, cancel/single-flight, actual Worker bridge, stop and takeover.
- Cost test exhaustively compares288 no-hidden-blocker rule combinations to the real Core: terrain/river/roads/bridges/OOS/Jager; test-only engine oracle never enters policy.
- node ai/local/build.mjs PASS; node ai/local/audit.mjs PASS,71 reachable Worker modules, no sockets/Node imports, empty multiplayer server and same-origin connect policy. Core/vendor/UI/server unchanged.
- Seed17/18/19 before and after: comparison.json and compressed traces; seed17 diagnostic replay equality verified.
- Initial new fixture failed: SWAMP was not the current terrain enum (MARSH); goal3,0 gave no alternate strictly-progressing neighbor, corrected alternate-route fixture to3,-1. Original failure retained. Production logic was not changed in response.
- An extra optional hidden-ZOC fixture was invalid: assumed distance2 enemy was CONTACT, but current spotting identifies it. Failed experiment retained as extra-fixture-failure.log; removed this invalid additional test, not a production regression. Final test file is the already-passing three-test version; no rerun-to-green. Current rule inputs/hidden pairs remain covered by51/51 and the unchanged paired-state tests.
- No full Core/Web gate repeated; unchanged areas reuse AI004/AI003 evidence. Huawei/performance not accepted.

## Reproduction

npm ci; node ai/build.mjs; run the targeted test command above. node ai/tests/rejection-diagnostic.mjs after 17 (and18,19). For before evidence, run the same test-only diagnostic script with the original ea71d31 source in a separate checkout. node ai/local/build.mjs; node ai/local/audit.mjs. No publication occurs in these scripts.

Completed next gate: isolated preview3531d33 published; real full-campaign browser segment throughT2 includes4 autonomous attacks, observed movement2,6→3,6, human retreats and AI followups; stop/takeover and exit/new game passed. Details and limitations in PREVIEW.md. Next: Huawei acceptance and separate design of routing/strategy improvements; no advanced strategy expansion in this task.
