# STARTUP-002 — Huawei terrain loading failure

## Scope and source evidence

User correction: failing device is a Huawei tablet, previously recorded as OpenHarmony 6.1; current browser version, network and VPN state are unknown. Both embedded window and standalone browser fail; PC with VPN works. These observations do not isolate device, browser or network. MP-006 device A/B remains paused.

Baseline source 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b / tree da03db67a07bb2d8a806dd476dcb8e4c2cb26c01; Pages 0f5ed94d57517fe79b84832578c62fabd163df03 / tree 281626669dd20b0d7310be1bd010c4235b28dc01. Both local worktrees clean and no subsequent remote commits at start.

Prior 79-resource byte audit retained at evidence/terrain-startup-recovery/assets-audit.json. Focused recheck from the development execution network (not Huawei): all three reported files return HTTP 200, image/webp, 512x512, decode successfully with Pillow, and exactly match the published/local assets. grass 450290 B; slope_material 430202 B; moist_soil 460014 B. See assets.json. Live baseline loader and build-record hashes also matched the prior release. No evidence of missing files or mixed release from this environment.

## Production audit

- ProgressiveTerrain has one running LOD. VS2 world material, forest, city and infrastructure loops await each image sequentially. WebKit adds one shared queue; its failure handler clears the queue rejection. UA classification alone cannot establish Huawei compatibility; no Huawei-specific UA workaround was added.
- Image timeout removes handlers, clears its timer and empties src before fallback. This is a cancellation request, not proof that a particular browser cancelled network I/O. Successful standard-path images previously had no explicit release callback; they now use the same disposal callback as other paths.
- Fetch timer previously only called AbortController.abort(). Reproduced with an injected fetch that ignores abort: its Promise never rejects and startup cannot terminate. This is a demonstrated recovery defect, not proof Huawei's fetch ignores abort.
- A late fetch/body cannot be adopted after the new deadline. Late headers trigger body cancellation without decoding. Browser-level transfer cancellation cannot be established without device evidence; diagnostics use abortRequested, not cancelled.
- Fallback remains one independent same-origin cache:reload request with unique query. It cannot reuse a prior failed Promise. Direct success performs no fallback. No new retry or higher timeout was added.
- Recovery cache-busting can redownload on a later LOD; original successful HTTP resources can use normal browser cache, but decoded resources are intentionally released. A failed startup rebuild does not preserve all prior decoded textures. No new persistent cache was introduced without proof this caused the failure.
- Failure on the initial LOD disposes the pipeline; successful surfaces and image/bitmap/Canvas resources use existing disposal. Background failure retains a usable completed LOD and explicit retry; failed-image cache entries are removed. No decoded-resource capacity increase.
- Final failure previously defaulted to direct-image-load even when fetch succeeded and the blob decoder failed. It now preserves final decoder stage; per-path diagnostic records retain HTTP status/type/body bytes, transfer/body phase, image completeness/dimensions, elapsed time and abort request.

## Candidate changes

1. Hard Promise deadline in addition to AbortController, with timer cleanup and discard of late response/results.
2. Explicit release and nonzero decoded-pixel check for standard onload success.
3. Accurate terminal stage and bounded diagnostics (12 recent image jobs, at most four path attempts per job; summary counters). Logical job concurrency is distinguished from actual network connections.
4. Existing fatal page gains a localized copyable report with build, UA, browser online/visibility hints and the above evidence. Clipboard denial leaves a readonly selectable text fallback. No telemetry request, storage/room/token/game DTO collection or raw URL/query/message export. Build is embedded locally at build time.

No terrain asset, visual algorithm, quality/LOD, Core, Gameplay, CRT, RNG, FOW, model, camera, animation, combat, snapshot format or server code changed. v2 default and explicit v3 retained.

## Validation and publication boundary

Targeted tests reproduce ignored-abort headers, ignored-abort body, late completion, successful recovery, final bounded failure, HTTP-versus-decode distinction, next attempt success, record bounds/query redaction, image cleanup and clipboard-denied fallback. Existing no-duplicate-build, pixel/asset, startup/queue and protocol tests remain required. Hash gates retain exact assertions; review records contain only explicitly changed files and dependent fixture hashes.

Release source lives on startup-002-huawei-loading. Do NOT advance source-main in this task: it is the existing Render auto-deploy branch, and this task forbids an unnecessary backend deployment. Pages will reference the exact source branch commit. Backend remains on the baseline source. Integration of the frontend source into source-main can accompany a future authorized backend release.

Huawei root cause remains unconfirmed. The result is a candidate recovery/diagnostic release, not a claim the Huawei device works. One device operation: open the formal entry and start once; if it fails, expand Startup diagnostics, copy the report and send it. No repeated device/network switching or MP-006 A/B requested.

No alternate distribution has been provisioned. Current evidence does not yet establish that the original host cannot serve the Huawei network. If report shows repeated pre-header failures, the smallest distribution alternative to evaluate is a byte-identical static-site mirror (not a game-server migration), with HTTPS, original paths/MIME, and approval for the new upload destination; multiplayer origin allowlist and account/domain settings must be reviewed. Costs depend on actual storage/egress and provider free quota, not quoted or assumed here. Do not provision or spend without authorization.

Validation completed: both typechecks/builds PASS; loader/diagnostic tests 30/30. Full regression covered 602 tests (599 passed, three test-harness mismatches); affected rerun 35/35 after injecting the actual new binding and preserving draw-time source metadata before image disposal. Original visual/camera assertions were retained. See validation.json. No second full-suite run is claimed.
