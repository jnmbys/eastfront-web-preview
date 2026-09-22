# PERF-003 — progressive terrain startup

Baseline: `eb3a5e1216b7aea549b99dd000d9503d7dbd2ff4` / `0f347bfe334a83e74f3198190790195ebc1718b7`.

The initial viewport's complete terrain surface gates entry. The same authorized Fog, units and input bindings initialize before interaction. A three-surface static-only cache serializes remaining work; a completed surface temporarily covers an unfinished zoom level. Completion swaps only the Canvas and preserves the SVG, camera and session. No PlayerView/unit/knowledge is retained in the terrain task's geometry snapshot.

The CPU raster and forest coverage run in small deterministic batches with real timer task boundaries and a 6 ms target slice. Canvas pixel transfer uses complete, unscaled stripes; no partially built surface mounts. City planning uses the same candidate/packing order, with invariant centrality computed once. The first browser audit detected timing-dependent antialias differences when yielding inside an open Canvas path. Decorative calculations now cooperatively record a bounded command buffer and replay the exact original Canvas call stream in one short transaction.

Cache lifetime is one static production map per page, at most three completed surfaces and one in-flight build. Leaving a network match/page pauses at a safe batch; entering resumes/reuses static surfaces. Disposal rejects pending requests, releases finished Canvases and prevents stale completion callbacks. Failures remain visible with an explicit retry; zoom changes never retry failures automatically. Safari direct-image/decode/Bitmap fallback and timeout scheduling are byte-identical.

Tests retain all frozen assertions. `frozen-hash-review.json` lists only reviewed startup/render/localization changes and their exact test/manifest dependencies. `protected-scope.json` verifies camera operation blocks, loader prefix, Core, FOW, protocol, server, assets and geometry remain unchanged. Raster and city reference hashes were generated from the exact original baseline, not the modified implementation.

Timing boundaries: diagnostic browser entry records native performance.now, Long Tasks, resource timing and rAF scheduling gaps. A function return or rAF callback is not proof that pixels have been presented. HTTP cold cache is not controllable through the available browser interface. Physical Safari/iPad acceptance remains pending.

## Final candidate browser evidence

Same Cloud Chrome 151, 1363×936, DPR 1, Auto models. HTTP-warm proxy means image resource transferSize is zero; this is not a rigorously controlled cold-cache experiment. New-page surface cache is empty in each row. One baseline warm run and two final candidate warm local runs; public WSS samples use two independent tab-scoped controller identities, no simulated delay.

| Measurement | Baseline local warm | Final local warm (2 runs) | Final MP Germany / Soviet |
|---|---:|---:|---:|
| Start / authorized snapshot → PLAYING render return | 34.788 s | 4.662 / 4.573 s | 6.333 / 6.602 s |
| First complete LOD | 2.699 s | 4.421 / 4.305 s | 6.083 / 6.093 s |
| All LODs complete | 32.708 s | 61.747 / 62.800 s | 56.954 / 69.520 s |
| Longest native Long Task | 20,967 ms | 242 / 282 ms | 251 / 511 ms |
| Longest observed cooperative work slice | synchronous raster 20,836 ms | 13.5 / 19.3 ms | 26.6 / 42.9 ms |

The old close raster dominates the long task; projection is roughly 10–20 ms and decorative/city work is secondary. The new work is still substantial and completion is slower because it deliberately yields. Initial authorized Fog/UI still has 0.2–0.5 s tasks; this task does not remove them. Render return and rAF gaps are interaction/scheduling proxies, not pixel presentation. No CPU/network throttling was requested. Shared cloud CPU variability remains.

During background close construction, local and network deployment succeeded, zoom input changed the camera, and a network drag completed. Network background pointer event lag was 0.5–24.2 ms in the observed sequence. Ten accepted network actions produced revisions 1–10 on both clients, ten Soviet counters and zero German-view enemy counters. No QUERY_MATCH or RESYNC_MATCH was sent. Native action ACK RTT was 269.5–291.4 ms; full snapshot arrival was about 1.25 s after submit. That existing snapshot wait is not fixed here. Tool invocation durations are never used as latency measurements.

Three final full RGBA comparisons exactly match the baseline. An earlier experimental variant yielded inside vector paths and failed this gate; it was not released. The final bounded command plan/replay preserves Canvas transaction order and passes all three pixel hashes.


The same-page fully completed terrain cache was reused on network→local entry: zero new surfaces, zero old units, startNewGame 122.6 ms. Ten subsequent local deployments succeeded. In a separate public WSS reconnect check, refresh interrupted close construction at 2/3; the existing Connect control reclaimed the same controller, restored revision 1 and the deployed unit, then an accepted action reached revision 2. Leaving at 2/3 and immediately starting local reset units to zero; completion retained zero and did not overwrite the new session. The counterpart for this controlled reconnect was a real Node WSS peer. An earlier two-browser reconnect attempt was interrupted by the counterpart disconnecting; its recovery/continuation is not claimed as a pass. Two-browser room/start/ten-deployment/privacy evidence is separate.

Scope still excludes deployment Fog/Presence/panel stalls, ACK→snapshot wait, friendly-unit move clicks and combat dice presentation. Safari/iPad physical acceptance is PENDING. The Safari direct-image/decode/Canvas fallback code and Chrome direct path are unchanged and their regression tests pass; Cloud Chrome is not Safari evidence.
