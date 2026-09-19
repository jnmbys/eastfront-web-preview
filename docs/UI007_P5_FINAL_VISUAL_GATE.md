# UI-007 P5 Final Visual Gate

> **Historical UI-007 report. Superseded for final visual closure by `UI007R1_VISUAL_CLOSURE.md`.**


Status: **READY FOR LEADER REVIEW** — not formal PASS.

This report evaluates the Leader-approved P5 asset pack inside the real UI-006R1 production renderer on Strategic Reset F. Core, Geometry, map topology, renderer correctness rules, deterministic selectors, transforms and LOD semantics are unchanged.

## Family decisions

| Family | Decision | Integrated evidence / reason |
|---|---|---|
| Ground | **FINAL ACCEPT** | P5 freezes all 4 ground rasters. The continuous world-space substrate remains unchanged and P5 introduces no integration regression. |
| Plain | **FINAL ACCEPT** | P5 freezes 8 plain-ground + 6 field overlays. Canonical continuous ground and deterministic field selection remain unchanged. |
| Forest | **FINAL ACCEPT** | P5 replaces 12 mass + 6 fringe sprites. The real map uses all 12 mass variants across 92 Forest Hexes (seed 17); observed counts range 4–10 per variant, so no single repeated canopy dominates. Existing neighbor-seeded fringe logic and north corridors remain unchanged; grid/counters remain above terrain. |
| Hill | **FINAL ACCEPT** | P5 replaces only the 6 material companions. UI-006R1 continues to use the frozen grayscale height rasters only as masks/light modulation; Far identity remains present. No raw height artwork regression. |
| Rough | **FINAL ACCEPT** | P5 replaces 6 base + 4 rock clusters. Far still uses the cheap canonical-Hex mass cue; Medium/Close retain P5 detail without changing semantics or hit testing. |
| Marsh | **RENDERER TUNING ONLY** | P5 replaces all 8 wet + 5 pool + 4 reed sprites and the real map uses the full family. The remaining risk is compositor continuity: wet/pool/reed layers are still selected per Hex and clipped per canonical Hex, with no Marsh-neighbor bridging stage. Any residual “wet island” effect therefore belongs to renderer continuity, not an identified defective P5 asset. No asset ID is rejected. |
| City | **TARGETED ASSET REVISION REQUIRED** | Exact semantic risk found: production `OUTER_CITY` Hex `29,-5` selects **S02** at seed 17. That Hex has **no canonical Road edge**, only canonical railway, while P5 `city/small/S02.png` contains a strong dirt path entering/exiting the settlement footprint. This can imply a strategic road that does not exist. Do not move canonical geometry; request a narrow Painter correction to soften/remove edge-reaching road-like detail in **S02**. Other production-selected City assets are not rejected by this finding. |
| River | **FINAL ACCEPT** | P5 freezes the River kit. UI-006R1 full Medium stack (shadow → bank → water → highlight) and Close vegetation remain geometry-derived from real `HexEdge.river`. |
| Road | **FINAL ACCEPT** | P5 freezes Road materials; canonical Core edge geometry remains sole road truth. |
| Railway | **FINAL ACCEPT** | P5 freezes ballast/contact-shadow/sleeper/rail-pair. UI-006R1 contact-shadow correction remains Green. |
| Bridge | **FINAL ACCEPT** | P5 freezes bridge rasters; placement/orientation remains derived only from real bridge crossings. |

## City canonical infrastructure audit

Production city selection at seed 17:

- `3,8` CITY → M06; canonical Road + Rail present.
- `9,1` CITY → M05; canonical Road + Rail present.
- `12,8` CITY → M06; canonical Road + Rail present.
- `17,1` CITY → M04; canonical Road + Rail present.
- `21,-6` CITY → M01; canonical Road + Rail present.
- `23,2` CITY → M04; canonical Road + Rail present.
- `28,-5` MAIN_CITY → L03; canonical Road + Rail present.
- `28,-4` MAIN_CITY → L02; canonical Road + Rail present.
- `29,-5` OUTER_CITY → **S02; canonical Road absent; Rail present.**

The S02 case is the narrow P5R1 candidate. Decorative settlement paths remain visual-only and are never used by Core/Geometry or hit testing.

## Forest repetition audit

Real-map seed-17 Forest mass usage spans all 12 P5 mass variants; no variant exceeds 10 of 92 Forest placements. This is consistent with deterministic variation rather than obvious single-sprite repetition. The renderer still uses unordered-edge seeds for selective fringe connections rather than connecting every Forest edge.

## Marsh attribution

The production map uses all 8 wet variants, all 5 pool variants and all 4 reed variants in the compiled Close renderer. The unresolved continuity concern is structural: local layers are clipped per Hex and Marsh lacks a dedicated neighbor continuity pass. The appropriate next action, if Leader still sees islanding in-browser, is a renderer-only continuity treatment within the existing canonical footprint contract—not repainting a named P5 asset without new evidence.

## Tactical readability

Automated renderer/action regressions remain Green. Production terrain is below the existing grid, tactical overlays and real counters. P5/P4R3 A/B switching changes only asset URLs in presentation and does not mutate `GameState`, counter anchors, hit areas or overlay geometry.

## Evidence

Authoritative compiled-renderer SVG evidence is under `screenshots/ui007/` and listed in `review-evidence/UI007_VISUAL_EVIDENCE_MANIFEST.json`.

A trusted PNG export was not obtained in this environment. CairoSVG cannot faithfully rasterize this external-image/clip/mask stack and its batch timed out after three invalid dark outputs; headless Chromium loaded the review page over HTTP 200 but did not complete the screenshot command within 120 seconds. Per task instructions, refreshed SVG remains authoritative and the failed PNGs are excluded from the Candidate/Bundle.
