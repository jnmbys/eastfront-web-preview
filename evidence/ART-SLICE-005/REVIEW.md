# ART-SLICE-005 — real interactive slice

Status: local browser/semantic/build checks passed; visual fidelity PARTIAL; not deployed or Huawei accepted. Source/evidence publication is authorized only to art-slice-005 with [CF-Pages-Skip].

## Implemented

- 35 original cells T–Z / 12–16, 33 touching canonical edges (17 river, 9 road, 16 railway, 2 bridges; flags overlap). Full cell/edge audit: semantic-audit.json. No manual topology substitution.
- Existing Canvas + SVG approach retained; original importer, hex geometry, bridge derivation, counter renderer and gesture helpers reused unchanged. Three original reusable texture/atlas inputs; no concept painting used as a map background.
- Drag, wheel/buttons, pinch, counter choice, explicit same-cell selector, terrain/edge inspector; candidate/baseline switch preserves scene and camera. Four public display fixtures, not a live rules match.
- Candidate assets draw only in semantic masks and never own input events. All unit/status rendering sits above terrain. Roads/rails are exact imported shared corridors; where co-located, railway dominates visually and inspector reports both.

## Verification

- Formal source build includes strict TypeScript check: build.log. No hand-patched emitted JS.
- Clean export of the staged source tree, fresh locked npm install and formal rebuild passed; all 66 manifest hashes and manifest bytes match the tested build. See clean-rebuild.log.
- 8/8 map/placement boundary checks: tests.json; complete semantic-audit.json includes geometry and placements.
- Existing related art/movement regressions: 11/11 passed on freshly built source (regression.log). These are preserved upstream behavior, not claims that this slice implements movement actions.
- 22/22 actual Chromium checks: browser-results.json. At 1363×936 and 1024×768: selecting/switching, damaged stack member, terrain lookup, drag click suppression, zoom buttons/wheel, baseline preservation, side-panel scrolling, visible buttons >=44×44 and no toolbar overflow. Actual touch dispatch also tests tap/stack choice/pinch at 1024. It is desktop Chromium touch emulation, not Huawei.
- Screenshots: candidate-far/near, baseline-far/near and stack at both sizes (10 JPEGs). All captured from rendered browser pages, no imagegen screenshot stand-ins.
- No page errors or external/backend requests in these checks. Browser: Chromium 133.0.6943.0 headless Linux, DPR 1, local HTTP, no CPU/network throttle; local CJK font was installed for screenshot fidelity.

## Loading and resources — measurements, not estimates

HTTP cache was cleared through CDP before each cold navigation; warm means same-context reload with cache enabled. The browser process, OS cache, JIT and graphics resources were not cold-reset. Each cell below is ONE sample, not a benchmark distribution. Baseline and candidate use the same scene/UI; candidate additionally decodes and paints original art.

| Viewport | Variant | HTTP cache | Entry-to-ready ms | Navigation-to-ready ms | Resource body bytes | Transferred resource bytes |
|---|---|---|---:|---:|---:|---:|
| 1363×936 | baseline | cleared | 22.0 | 156.5 | 664726 | 683026 |
| 1363×936 | baseline | warm-reload | 15.0 | 46.2 | 664726 | 0 |
| 1363×936 | candidate | cleared | 174.9 | 262.3 | 2408776 | 2427976 |
| 1363×936 | candidate | warm-reload | 178.9 | 217.0 | 2408776 | 0 |
| 1024×768 | baseline | cleared | 17.4 | 128.2 | 664726 | 683026 |
| 1024×768 | baseline | warm-reload | 15.7 | 45.7 | 664726 | 0 |
| 1024×768 | candidate | cleared | 180.3 | 267.5 | 2408776 | 2427976 |
| 1024×768 | candidate | warm-reload | 101.9 | 120.5 | 2408776 | 0 |

Ready means the application has constructed layers, decoded/painted requested terrain and bound input. It is not a first-presented-frame timestamp. Resource entries exclude the HTML navigation itself. TransferSize=0 on warm reload is a browser cache report, not zero decode work. These localhost timings cannot predict Chinese campus Internet, Cloudflare or Huawei load times.

Prepared static root: 66 manifest entries, plus manifest itself = 67 files. Total listed bytes: 2411725. Manifest SHA256: `89f794658c1440113fe91fdcb8eb33e7ea5e98c3b8a38d3625ba9492ba083fdd`. Exactly 3 raster assets; candidate initial page made 64 resource requests including modules/map/assets. The runtime dependency closure excludes main.js, multiplayer client/bootstrap, and backend config. No live CDN hashes are claimed.

## Frame intervals

One foreground 5-second sample per variant/size with continuous synthetic mouse dragging for ~4.9 seconds; browser input events change the existing camera transform. The terrain canvas is not repainted during drag. All raw intervals are retained in browser-results.json and per-size operations files.

| Viewport | Variant | Mean ms | P95 ms | >33 ms intervals |
|---|---|---:|---:|---:|
| 1363×936 | candidate | 16.653 | 16.700 | 0 |
| 1363×936 | baseline | 16.657 | 16.800 | 0 |
| 1024×768 | candidate | 16.654 | 16.700 | 0 |
| 1024×768 | baseline | 16.655 | 16.800 | 0 |

These are RAF callback intervals, not GPU/compositor timings, end-to-end input latency or sustained device performance. Operation handler and next-RAF measurements are recorded separately in the raw action logs.

## Estimated memory / tablet risk

The fixed 3× world-resolution canvas is 2,734,755 pixels, about 10.43 MiB RGBA backing. Three 1254² RGBA decoded images add about 18.0 MiB. Their simple sum is ~28.4 MiB, before browser copies, GPU surfaces, metadata or compositing. This is arithmetic, NOT measured process/GPU memory. Full-map scaling, residency/LOD, context loss and Huawei touch/zoom are unverified. Do not extrapolate this slice to 640 cells.

## Gap from approved concept — not a visual acceptance pass

- Materials and terrain volume are real interactive assets, but the scene is less naturally authored and less rich than ART-DIRECTION-004.
- A single hill motif repeats; rough terrain shares it and is not distinct enough visually. Hill edges and straight transport cuts still reveal cell-scale construction.
- River geometry is constrained to canonical edges, with small rounded junctions and irregular gravel banks; it still looks diagrammatic and lacks the concept’s riparian vegetation/material depth.
- X14 is semantically contained and roads remain open, but individual buildings are sparser and less cohesive than the concept’s town. Asset viewpoints and baked shadow scales are not perfectly unified.
- W13 forest is interrupted by original transport and river corridors; it is intentionally less dense than the unconstrained generated image. Far-view terrain identification is additionally supported by grid labels and inspector.
- Labels/counter text scale with the existing camera. Close zoom can make counters dominate the scene, and far-mode 1024 stack counters themselves are smaller than panel buttons; explicit stack choices provide >=44px targets.
- No moving units, combat, fog, multiplayer, or full-map integration in this experiment. No production, Core, rules, AI, supply or backend changes.

## Publication / next step

Source branch: art-slice-005, [CF-Pages-Skip]. No PR, Hook or deployment. Proposed later publication is ONLY generated dist root to a new art-slice-preview-005 preview branch, with actual URL/hash checks after separately authorized release. Do not publish this source-branch root. See experiments/art-slice-005/README.md.

Leader delta: interactive slice and local evidence complete; conceptual style implementation PARTIAL; Huawei/full-map/GPU/public-preview acceptance remain open. Review these real screenshots before deciding whether to refine this asset approach or publish the isolated tablet preview.

## Environment failures retained

- First strict build caught invalid fixture supply enum IN_SUPPLY; corrected to the existing SUPPLIED enum before any passing build or test.
- Playwright browser download returned truncated/non-ZIP data; used existing @sparticuz Chromium 133.0.0 runtime instead. No sandbox/network escalation or credential extraction.
- Initial separate Python server connection was refused in this execution environment; browser harness now runs its own local HTTP server in the same process. No public tunnel or hosting used.
- First screenshots showed missing CJK system fonts; installed NotoSansCJKsc-Regular for browser QA, not as a shipped runtime asset.
- First visual iteration was sparse and used an oversized conservative corridor exclusion; improved exact rectangle/segment exclusion and introduced single-building sprites. Final screenshots/metrics are from final source.
