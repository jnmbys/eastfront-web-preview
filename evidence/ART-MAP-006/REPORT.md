# ART-MAP-006 handoff

## State and scope
User accepted ART-SLICE-005 quality, readability and operation. This candidate extends that direction; full-map aesthetic/device acceptance is not inherited. Source/evidence only, branch art-map-006, [CF-Pages-Skip]. No deployment, PR, Hook, production main/source-main mutation or backend work. Parent f283e5194275fe0f0690dadf8f75f125ce978797; accepted runtime 8ae9579b871520b3616619f0e67c060dc1db583f. Management c7531c70fab4b7c7402cd2f7d927c2134adee228 read, not merged.

## Implementation
Reused existing Canvas terrain + SVG counter/hit-layer architecture and the three accepted original WebP inputs. Three isolated experimental modules, one standalone builder/UI/test subtree, and an ignored dist path are the only source changes. Frozen Core, rules, source map, shared unit renderer and shared gesture functions are unchanged. Full-map camera range extends to 800% inside the experimental entry; X14 focuses the previous slice neighborhood at 500%. No new unit actions or selection ownership changes.

Full map: 640 cells, 257 imported edges. Flags overlap: 108 rivers, 60 roads, 132 railways, six bridges. Terrain counts: 460 plain, 92 forest, 37 hill, 18 rough, 19 marsh, five lake, six city, two main city, one outer city. The audit records every cell polygon, edge, flag and material stamp against the unchanged source JSON. River centerlines follow canonical shared edges; transport follows canonical center-to-center edges; no fabricated bridge crossings. Internal lake boundaries do not add shore outlines. Marsh/lake procedural materials and denser main/outer city composition cover types absent from the original slice.

Relief now varies mound count, scale and offset (rough: multiple smaller forms). Forests vary copse size, density and bias, while preserving baked light direction and transport clearances. Sprite-family repetition remains detectable; there are no new mountain/forest asset families. Far view supports terrain distribution and unit side/type scanning; exact unit stats and small city detail require medium/close zoom. No guarantee of exact far-zoom touch targets for all 640 cells.

58 **public display fixtures**, including the original X13 stack, exercise counter load and damage/selection marks. They are not actual deployments or an authoritative full game, and do not establish fog/combat/AI/multiplayer performance. The runtime dependency closure excludes production bootstrap and networking; browser tests observed zero external requests and zero page errors.

## Validation actually run
- Fresh detached checkout, npm ci --offline from package lock: success; no copied node_modules. Clean TypeScript build: success.
- Clean/workspace outputs: 67/67 byte-identical including manifest and _headers. Total 2,429,965 bytes; original three assets total 1,744,050 bytes. runtime-manifest.json records SHA-256 per file. Prepared output remains reproducible under experiments/art-map-006/dist; no CDN publication occurred.
- 10/10 full-map checks: 640 raw terrain identities and coordinates, all imported edges unchanged, canonical river segments, bridge registry, forest/city sprite footprints and corridor clearance, populated material cells, deterministic visual layout, stack/damage fixtures, all nine terrain types and 58 fixtures, distinct relief forms.
- 11/11 scoped existing art/movement regression tests rerun from the correct package cwd. Initial root-cwd run failed to locate vendor reference data; its log is retained. No rule/core code was changed.
- 32/32 browser checks on the clean build: 1363×936 and 1024×768 desktop; selection, stack disambiguation, underlying forest/city/other terrain ownership, pan suppression, buttons/wheel, baseline/candidate camera and selection parity, controls/layout/measurement panel. Additional Chromium touch emulation verified tap, stack choice and pinch; it is not Huawei.
- First full-map browser attempt clicked an occupied main-city center and was intercepted by its unit, as required by the contract. The test was corrected to click exposed terrain without forcing/bypassing hit testing; source interaction was not changed. Failure saved in first-browser-attempt.json.
- Cloud browser local URL attempt returned ERR_BLOCKED_BY_CLIENT. The local regression harness, reusing the existing Chromium runtime and test workflow, provided real-browser evidence; screenshots are actual local browser captures, not cloud/CDN evidence.

## Performance measurements and limits
Linux headless Chromium 133.0.6943.0; local HTTP; DPR 1; no network or CPU throttle. Cache explicitly cleared before cold navigation; warm is same-context reload. These are one cold and one warm observation per variant/size, not statistical device benchmarks. Dates in browser/tool runtime and shell host differ, so execution order rather than filename clock is authoritative.

| Viewport | Candidate cold ready flag | Candidate warm ready flag | Decode + paint call, cold | Candidate pan/zoom RAF P95 far / close |
| --- | ---: | ---: | ---: | ---: |
| 1363×936 | 595.6 ms | 438.0 ms | 385.0 ms (rounded) | 16.7 / 16.7 ms |
| 1024×768 | 539.8 ms | 367.6 ms | 275.0 ms (rounded) | 16.7 / 16.8 ms |

Each of eight samples covers five seconds; about 4.9 seconds continuous pointer drag with alternating wheel zoom. Four candidate samples: 300–302 callbacks each, mean 16.60–16.70 ms, at most one interval above 33 ms. Baseline P95 16.7–16.8 ms in the final run. Raw interval samples, conditions and operations are saved; do not infer a significant performance advantage from one run.

**Startup limitation:** ready flag is set before raster/compositor completion and is not time-to-first-visible or a user-perceived readiness claim. Candidate startup Long Task maxima were 708/537 ms (1363 cold/warm) and 653/510 ms (1024). Full-map drawing still creates a startup stall on this software/browser environment. GPU time, VRAM/RSS and Huawei behavior are unmeasured. No assertion of smooth startup on Huawei is made.

Measured targeted work: direct expansion of the original global placement scans took 1,838.8 ms in Node; neighborhood-only/cell-local placement took 68.9, 21.8, 21.3 ms (different stamp composition, not an identical-algorithm benchmark). Canvas backing-store formula reduced from 200,945,976 to 60,440,576 bytes by bounding longest side to 4096, retaining the same renderer. This is an estimated pixel-buffer allocation, not measured GPU/process memory. It excludes image decoding and browser compositing copies. The first close screenshot exposed blurred counters from persistent will-change caching; removing it restored sharp SVG text without a measured pan/zoom P95 regression in these observations. Pre-fix performance is retained separately.

## Screenshots
For each width 1363 and 1024: candidate/baseline-far, candidate/baseline-medium, candidate/baseline-near are matched-camera pairs. Near centers on X14, the prior approved neighborhood. stack images show selection state. No screenshots are a substitute for full-map human/Huawei acceptance.

## Exact future release scope — not authorized/executed here
Publish only the 67 files listed in runtime-manifest.json from experiments/art-map-006/dist into a new independent preview branch of eastfront-web-preview. Build output includes static module closure, map.json, three local assets, index/CSS, manifest and noindex/no-cache headers; no production multiplayer endpoint or game bootstrap. Keep main/source-main and existing art-slice-preview-005 untouched. Future release must first verify this manifest against the chosen source commit and obtain release authorization; CDN hashes must then be checked separately. Do not publish repository source, evidence or node_modules.

Open items: CDN bytes (not deployed), GPU profiling, full-map Huawei interaction/performance, full-map human aesthetic acceptance, startup raster stall and actual full-game load. Recommended next step: separately authorized isolated full-map preview, then Huawei acceptance using full overview → X14 → stack/terrain/drag/pinch. No production replacement is proposed from the current evidence.
