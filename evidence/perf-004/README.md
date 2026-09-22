# PERF-004 — deployment frame stutter

Baseline: `307cd9ba4747271ebfca0da58be124a7f6756733`, tree `646b90c3ef727b8a8f4fdb0892ea7f6ebe440241`.

Only five runtime modules change: deployment panel reconciliation, its main handler binding/scroll restoration, Fog raster candidate lookup, SVG presentation binding and Presence reconciliation. Core, server, protocol, PlayerView, Fog style/knowledge, camera, terrain assets, Safari image loading and PERF-003 scheduling/rasterization are unchanged.

## Root cause and correction

Real Cloud Chrome measurements on the current baseline found repeated full-panel layout: PERF-002 kept location-card identities but removed and reattached their ancestors, then wrote scrollTop. A measured MP deployment spent 130.5 ms in that write and 60.8 ms in Fog rasterization; PNG encoding was only 2.2 ms. The panel now retains its ancestor chain and unchanged roster rows. Scroll offsets remain on those same nodes; layout-sensitive reads are also skipped unless the renderer actually replaces the panel. A later instrumented sample isolated a remaining 54.55 ms median scrollTop read on local deployment, which this lazy capture removes. retained controls bind once using the existing WeakSet. Changing selected unit type updates the card label text in place, preventing cache invalidation/full panel reconstruction at type boundaries.

Fog's per-pixel 3×3 string-key Map lookup is replaced by a prepared numeric spatial grid of the same candidate points, in the same order. Distance and feather math, resolution, opacity and transition timing are unchanged. No asynchronous Fog task or delayed information update is introduced. The static ground cache remains bounded; dynamic visibility candidates are local to the authorized raster call.

Presence used to rebuild every model and its definitions after adding one unit. When the canonical Counter layer remains mounted, only new/changed Counter bindings and corresponding models are rebuilt; unchanged models, definitions and observers survive. Removed authorized identities disappear synchronously. Full root/viewer/session reset still disposes all presentation objects.

## Correctness and scope review

Client/server typecheck, client build with production WSS config, server build and full test suite: **568/568 PASS**. Logs are included. New tests compare 68 full-map deployment/recon RGBA outputs to the original baseline, forbid detaching retained panel ancestors, check single listeners, compare incremental stacked Presence to a fresh render, exercise model mode switching and clear hidden models on viewer changes. Existing tests cover all 32 Soviet deployments, rejection/no phantom, phase handoff, MP authority/idempotency/revision/resync/reconnect/privacy, zero redundant deployment queries, animation/combat, Safari fallback and PERF-003 cooperative scheduling/final raster output.

The PERF-002 test still compares complete card text/selection/occupancy to fresh markup; its type-change identity expectation is strengthened to require retention under the new in-place label update. Locale/session/viewer/map/phase invalidation remains tested. The software DOM helper now supplies standard createElement and parses HTML void tags correctly, so roster siblings match real HTML. It is not layout or paint evidence.

`frozen-review.json` lists all 14 explicitly reviewed digest entry updates, including three manifest dependencies. No freeze assertion was removed. `scope-review.json` lists the runtime allowlist and hashes. `mp001-regression.json` and `mp002-regression.json` preserve this run's generated network evidence without overwriting historical reports.

## Measurement method and limitations

Real Chrome 151 on cloud Linux, 1363×936 CSS viewport, DPR 1, initial 100% zoom, Models Auto, Normal animation. Both builds use the same page diagnostic wrappers and DOM-driven selection/destination/confirmation sequence; each click is separated by a task boundary. Terrain assets are loaded before confirmation samples; all-LOD-complete samples are explicitly separated from background-LOD samples. Public Pages and Render WSS are used without simulated RTT. HTTP cache was not explicitly controlled; deployment samples exclude startup.

Page performance.now measures nested synchronous spans; nested values must not be added. PerformanceObserver measures native Long Tasks (tasks under 50 ms are absent, represented by 0 in the maximum-overlap proxy). Confirmation-to-application and two-rAF readiness are separate proxies, not proof of pixel presentation. Cloud browser rAF scheduling can have roughly one-second intervals; no FPS or physical input-to-pixel claim is made. No DevTools layout/paint/GPU trace was available. Browser tool execution time is never used as gameplay latency. Network RTT and ACK→snapshot intervals use one client clock; server processing/one-way latency are not inferred.

The first exploratory diagnostics placed select/target/confirm in one task; those Long Tasks were excluded from final comparisons. Candidate 1 revealed remaining type-boundary full-panel refresh; candidate 2 patches labels in place; candidate 3 also removes unused retained-panel scroll reads. The final result tables and raw samples are recorded alongside this report.

Physical Safari/iPad: **PENDING**. This is real Chrome evidence, not an iPad performance claim.

## Remaining boundaries

ACK→full-snapshot waiting remains outside this change. Friendly-occupied-hex move routing and combat dice display remain separate tasks. Nonzero style/layout/Fog/roster work remains; do not interpret publication as elimination of every possible long task. Terrain and model quality are unchanged.

## Final real-browser results

Each row contains 10 consecutive deployments per build. Times are milliseconds, median / maximum. All-LOD batches use units 11–20; background batches use units 1–10. Local background samples all began at 2/3 LOD; MP final first sample began at 1/3 and the remaining nine at 2/3, while the baseline background ten began at 2/3. Background jobs continued and reached 3/3; no scheduler or terrain code changed. Cloud host load and HTTP caching were not strictly controlled; no percentage or physical-device improvement claim is made.

| Group | Refresh before | Refresh final | Apply-task maximum before → final |
|---|---:|---:|---:|
| Local / all LOD | 245.65 / 284.3 | 22.1 / 26 | 306 → 50 |
| MP actor / all LOD | 317.9 / 344.3 | 25.85 / 71.3 | 348 → 85 |
| MP waiter / all LOD | 13.85 / 58.1 | 13.65 / 16 | 61 → 0 |
| Local / background LOD | 275.85 / 319.5 | 19.35 / 43.2 | 346 → 74 |
| MP actor / background LOD | 305.35 / 468.7 | 29.9 / 35.4 | 476 → 0 |
| MP waiter / background LOD | 14.8 / 38.8 | 11.1 / 15.6 | 0 → 0 |

0 in the last column means no observed task ≥50 ms overlapping application, not zero execution time.

The all-LOD local confirmation-to-application median/max changed from 267.4/305.3 to 41.1/49.8 ms. MP snapshot application changed from 320.15/345.8 to 27.1/75.9 ms; overall confirmation-to-application was 1601.15/1648.2 before and 1290.75/1385.7 after. MP action RTT stayed comparable (293.3/355.5 vs 276.95/320.3); ACK→snapshot remained 987.95/1035.2 vs 988.3/1027.9 ms. This wait is not fixed.

Two-rAF proxies did not improve: local median 1383.4→1672.55 ms, MP actor 2419→2697.8 ms. These cloud scheduling proxies are explicitly not display latency. Broader request windows still contained other Long Tasks up to 417 ms (during waiting, outside the snapshot application interval); no layout/paint trace exists to attribute these. A final snapshot-application outlier still reached 85 ms. This is not a claim that all visible stutter is eliminated.

`comparison.json` includes every measured nested stage, counts, early/late samples, frame-gap proxies, network intervals and both long-task scopes. The compressed `browser/*.json.gz` files contain the original per-deployment timings. Total synchronous refresh work is reduced; it is not moved into a deferred task. No async Fog or new render scheduling is introduced.

Final observed ordinary deployment creates one Counter and one Presence model while reusing the prior models; Fog builds once when the observation changes, and the waiter has no hidden unit/Fog update. Deployment QUERY_MATCH and RESYNC_MATCH counts are zero in the recorded normal-action windows.

Final candidate 3 browser acceptance: local 32/32 deployed, privacy handoff cleared all previous units/models; zoom remained 100% during samples and Auto/Off was verified at 250% afterward. MP actor/waiter revisions 1–20 matched, each submit added exactly one authorized unit, and the waiter retained zero enemy units. Refresh reconnected to revision 20 (including the explicit current-state resync), continued revisions 21–32, then both clients entered German deployment with Germany still seeing zero Soviet units. Initial automatic reconnect displayed disconnected; one explicit Connect restored the controller within grace. No infrastructure cause is inferred.
