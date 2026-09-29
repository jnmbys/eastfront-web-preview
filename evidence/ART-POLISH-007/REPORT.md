# ART-POLISH-007 — local renderer comparison

Status: local implementation + Git checkpoint; not deployed, not expanded across the full map, awaiting new art judgment. The earlier “okay” is explicitly superseded by the user's new feedback. Reference is Civilization VII, not VI. Management ref read remains c7531c70fab4b7c7402cd2f7d927c2134adee228; prior VII observations reused, no new long research pass.

## Fixed comparison
Parent/source evidence: 4e9ae0b465ca4b45d7e1cde90a8d69d92a08c8d8; reference implementation 846aa6f58416f66ca90ed48047398febdbb8e95f, published fabb559b757686c410164f8765277e383caf11ee. Both variants use the same original 640-cell map, all 257 edge records, and the same 58 public display fixtures. Only 49 cells T–Z / rows 11–17 are deliberately refined. No concept background is used.

- Near: current-near.jpg / polished-near.jpg, 1363×936, zoom 500%, same X14 focus, X14 selection and units.
- Medium: current-medium.jpg / polished-medium.jpg, same viewport and X14-centered camera, zoom 300%.
- All four are actual unmodified Chromium screenshots. Not Huawei captures or concept art. Screenshot tests assert identical camera, inspected cell, selected unit, entire counter SVG and hit-polygon markup across each pair.

## Changes and art limits
One new original transparent atlas supplies grass/flowers, shrubs, rubble, reeds, vegetable beds and courtyard props. 402 deterministic placements: 180 grass, 32 stone, 72 shrubs, 112 reeds, four gardens, two courtyard props. Cluster anchors, dimensions, two material tones and variable budgets give open areas between detail groups. Source family repetition remains; this is not a full new landscape asset set.

Forest canopy has localized green/shadow contrast, hill surfaces slightly stronger lit/shaded separation, water a cooler blue-green on the exact existing ribbon, and roofs warmer tile accents. Meadow tint is a localized soft-light radial blend, not a full-map saturation filter. The comparison tests the user's saturation hypothesis; it does not establish that saturation alone solves the art problem. Tiny city soil/courtyard material lies under existing buildings and transport; garden/yard props do not add roofed buildings, roads, bridges, military symbols or actions.

All added sprite rectangles lie within their original semantic cell and outside complete river/road/rail corridors, bridge openings and fixed counter envelopes. Low shrubs beside rivers do not reclassify plains as forest. All units and selected outlines remain above terrain. No rule/Core or production file changed. Original mapData/mapTerrain/artMap, geometry, unit renderer and shared gesture source remain unchanged; the new A/B harness delegates the current appearance to the original mapTerrain function.

## Related checks only
- TypeScript build passed, repeated runtime manifest identical. 70 build files including manifest, 3,319,667 bytes. No full game regression or full-map device tests repeated; existing 006 checks are historical evidence only.
- Five new geometry/placement checks passed: data unchanged, 49-cell confinement, sprite corners, full transport/water clearances, counter clearances, valid prop terrain and determinism (grouped assertions).
- Seven actual browser checks passed: two fixed-camera pairs, same-stack selection G-03 → G-02, forest/city hit ownership, drag suppression, no page errors/external requests. Detailed logs in browser-results.json and operations.json. Atlas load is local; no production multiplayer traffic is introduced.
- An extra strict-pixel probe initially failed. Final outside-region sample diagnostic: 5,319 samples, maximum channel difference 8/255, mean absolute channel difference 0.069/255. Readback/repaint backend rounding is a hypothesis, not a proved cause. Do not claim pixel-exact equality outside the region. Geometry/data are unchanged and deliberate visual edits are region-clipped. Initial failure remains in pixel-probe-initial.json.

## Cost, measured separately from estimates
Local HTTP, Linux headless Chromium 133.0.6943.0, 1363×936, DPR1; no CPU/network throttle; three fresh cache-cleared contexts per variant. Current and refined variants use the same comparison harness. No Huawei/GPU/RSS/VRAM measurement.

| Metric | Current 006 appearance | Local polish | Increment / limit |
| --- | ---: | ---: | --- |
| Runtime files / bytes vs released 006 bundle | 67 / 2,429,965 | 70 / 3,319,667 | +3 / +889,702 bytes |
| DOM nodes, each trial | 2,449 | 2,449 | 0 decoration nodes |
| Decode + paint-call median | 245.3 ms | 959.6 ms | +714.3 ms |
| Navigation → ready-flag median | 468.5 ms | 1,165.3 ms | +696.8 ms; not actual presentation time |
| Startup longest task, three trials | 687 / 631 / 775 ms | 760 / 882 / 947 ms | Startup is still a risk |

Main map canvas allocation remains the previous bounded 4096-longest-side canvas (~60.44 MB pixel-buffer formula). New decoded atlas estimate: 6,290,064 bytes; temporary tinted tile pixel-buffer estimate: 2,287,104 bytes, about +8.58 MB combined before browser copies/GC. These are formulas, not measured memory peaks. The A/B switch repaints one canvas and does not retain two full-map raster copies. Same node count refers to this A/B harness; the unused 003 survey layer was removed from both variants, so it is not an original-full-app node comparison.

First implementation used a filter per stamp, taking about 5.1–5.4 seconds per candidate paint call. Replacing that with small pre-tinted tiles removed that avoidable multiplier; initial records remain in first-filter-cost.json. Final cost is still materially higher than current. Do not claim a free visual upgrade or performance acceptance. The previous 708 ms startup issue remains open; this task neither diagnoses it fully nor fixes it. No further renderer restructuring was attempted.

## Handoff
Run instructions, exact generation prompt and provenance are in experiments/art-polish-007/{README,ASSETS}.md. Original detail image is tracked at experiments/art-polish-007/assets/details.webp. Built-in imagegen was used; the final rendered comparisons, not the atlas sheet, are the review deliverable.

Branch art-polish-007, remote commit prefixed [CF-Pages-Skip]. No change to main/source-main or existing preview branch, no deployment, PR, Hook or project settings. Keep this local scene for user judgment before any full-map propagation or publishing decision. Remaining: user aesthetic review, Huawei, GPU/CDN and startup cost; not automatically accepted from the older 005/006 feedback.
