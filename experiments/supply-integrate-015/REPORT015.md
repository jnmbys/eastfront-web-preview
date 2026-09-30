# SUPPLY-INTEGRATE-015 delivery evidence

Status: implemented isolated main-game candidate; **not deployed; real browser/touch acceptance incomplete**.

## Delivered

Existing main map/rendering, deployment, movement and combat controls now connect to a same-origin Python authority through the existing network-session interface. Experimental creation fixes new/old mode for the match. Own stock, target reserve, debt, actual costs and delivery changes appear in the normal side panel; larger receipts/ledgers fold away. Hotseat handoff, explicit same-ID retry, resync and acknowledged close are provided. Frozen `live.execute`, sandbox Core, RNG, formulas/config and old default entry were not edited. Build explicitly blanks multiplayer server configuration for this isolated candidate. No production WSS or Secrets are used.

See `CONTRACT015.md` for baselines, operation schemas, server/client failure boundary, operator entry and next preview scope. SAVE-014 had no code modifications when paused.

## Validation actually run

- `build.mjs`: main browser and server TypeScript build, isolated sandbox Core build, static assets copied. Python compile check passed. Node 24.19.0, TypeScript 5.9.3, Python 3.12.14; Linux shared host, cgroup 8 CPU / 8 GiB. This is not a 0.5-CPU/512-MiB test and not Render evidence.
- `verify.py`: eight targeted groups passed; 19 recorded/duplicate Action observations. New and old initial deployment compared with frozen sandbox execution; legal checkpoint 66 plus nine Actions to advance and deliver; checkpoint 75 plus five recorded movement/attack/retreat Actions; one legal armor move costing 4. Complete result-state and recorded hash/dice/ledger comparisons passed. No campaign-wide replay or seed search.
- Duplicate success is a no-op; conflicting ID rejected. Forced post-execute projection delay beyond 3 seconds leaves **the entire slot** unchanged (Core, RNG, inventory, seen, journal, receipt and observation memory). Tests confirm busy 503, stale revision, mode lock, session isolation, expired Actions never recreating a game, denied observer, and read-only hotseat switching.
- Authorized packet scan withheld hidden unit IDs (31 for German / 24 for Soviet at checkpoint 66), enemy supply/resources, Core, RNG and private journals. Query availability is computed with hidden enemies removed, while actual execution retains full authority.
- `verify-ui.py` + `verify-ui.mjs`: **existing lightweight main event-binding adapter**, using the actual compiled main.ts handlers, actual SupplyClient/NetworkPlayerSession and real HTTP Python service. Passed deployment, armor move and duplicate retry, attack + real dice + retreat, advance + eight phase buttons + hotseat handoff + delivery. Resulting authoritative states equal separate sandbox execution of the same accepted Actions. German G-I-01 inventory recovery 8→12 verified after handoff. Added controlled lost-HTTP-response-after-commit: Chinese uncertain-result notice, same request retry, exactly one deployed unit/one revision, acknowledged close. Five cases pass. These tests are NOT a browser, layout, hit-target or Huawei test.
- Necessary old-mode regression: 37 Core/authorized-view tests passed immediately. Four existing network movement tests initially hit missing dependency bindings in the lightweight test harness, then all four passed after adding the newly referenced imports. No old Core or movement behavior was changed. Original and rerun logs retained.
- Largest measured targeted transaction: **1.187815434 seconds** on the shared local host. Budget remains 3 seconds inclusive of validation, execute and post-action projection. No new peak-memory measurement or target-cloud performance claim.

## Found and fixed

1. Initial comparison differed only in `logistics.core_state_hash` and corresponding journal hash. Python adapter appended controllerId after other fields, changing the existing Core bridge's raw JSON hash. Restoring sandbox Action key order fixed all state/ledger/dice comparisons; hashing/rules were not altered.
2. Existing test VM copied slices of main.ts but did not import SupplyClient/createDeploymentTouch. Added these references to the harness; production code had no such ReferenceError.
3. Network errors retain the previous authoritative snapshot and block fresh Actions; a user retry preserves ID/revision/payload. Action snapshots now retain normal authorized presentation events; handoff/resync clears old drafts/results and forces a full view refresh. Leaving awaits the server close acknowledgment, including an already expired session.

## Browser blocker and remaining gates

The cloud browser rejected the running candidate at `http://127.0.0.1:8765/?supply=experiment` with `ERR_BLOCKED_BY_CLIENT`. A local built-file attempt was explicitly denied by browser URL policy (HTTP/HTTPS only). No alternate automation or policy workaround was attempted. **No real interface screenshot was obtained and no real-browser deployment→movement→battle→delivery sequence is claimed.** `evidence/browser-block.json` records this limitation. The authorized packet artifact is data evidence, not a screenshot.

Therefore do not call this release/Huawei-ready. Next preview scope is ONLY the already-isolated service, full main-game hotseat new/old experiment entry, same single instance and 0.5 CPU/512 MiB, no AI/multiplayer/save feature. Before an approved preview update: build the supplied root-context Docker candidate, validate resources/budget with the existing CI approach, then perform real browser acceptance and capture screenshots on a reachable approved preview. Keep the frozen sandbox as rollback. This task did not build Docker, trigger CI, publish a URL, create resources, deploy, merge, change main/source-main, or call a hook.

Natural-campaign coverage gaps from 011/012, 30-minute session/cookie expiry, restart loss and no saves remain. No balance, AI, multiplayer or Huawei acceptance is claimed. Optional attacker support selection remains visibly unavailable; no mechanism was extended for coverage.

## Evidence map

- `evidence/verification.json`: targeted state/ledger/rollback/filter/session results and timings.
- `evidence/ui-bindings.json`: actual main-handler + HTTP cases, deterministic equality and lost-response retry.
- `evidence/initial-failures.json`: preserved first failures and cause classification.
- `evidence/build.log`, `old-regression-initial.log`, `old-regression-final.log`.
- `evidence/authorized-view.json.gz`: one actual own-side authorized packet, with no cookie or private Core state.
- `evidence/browser-block.json` and `source-fingerprints.json`.
