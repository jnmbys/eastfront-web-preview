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
