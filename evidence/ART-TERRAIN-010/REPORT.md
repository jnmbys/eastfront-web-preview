# ART-TERRAIN-010 — local terrain refinement

Base `83f4e2c22e2d75adefaa78c10c2b3de1f50610f6`; isolated branch `art-terrain-010`. Prior PROJECT_STATE / WORKER_PROTOCOL read at management `c7531c70fab4b7c7402cd2f7d927c2134adee228`. 009 preserved, no deployment or full-map extension. Visual review candidate, not final user/device/performance acceptance.

## Scope and actual changes
Exact eight cells: X14, W13, W14, V13, V14, W15, X15, Y15. Added one original generated static atlas with two distinct grass/rock relief profiles and dense/open woodland. Asset generation is documented with the complete prompt in experiments/art-terrain-010/ASSETS.md; the final WebP is tracked. All four existing input images are unchanged. Source PNG→WebP is format compression only; 1254×1254 RGBA and alpha channel confirmed identical. No external font/CDN request.

W14 uses a broad oblique ridge; V14 a taller sloping shoulder; Y15 a low compressed rough ledge with a different profile from W14. All retain original HILL/ROUGH semantics. W13 uses two tapering woodland strips on opposite sides of the real railway; V13 a continuous main canopy and open fringe. Tree terrain alpha is always FOREST-only. The new shape masks subtract real river/transport corridors and conservative unit rectangles, without expanding game obstructions.

River centerlines, topology, water widths, bridge registry and road/rail geometry remain original. Within the eight-cell mask, broad damp grass/soil transitions replace rigid outer bank bands; the original water, transport and bridge passes remain above the ground. No new crossing is painted. Shared upper-left light remains baked into assets/static Canvas; no realtime light system.

X14 buildings, tower, roof sizes and placements are exactly 009, seven total. The X14 label alone moves from y+29 to y−22 and uses centered anchoring; other labels and pointer routing remain unchanged. Unit and selection SVG layers remain above terrain. The 334 small decorations remain unchanged, no extra decorative DOM.

## Checks actually performed
Final TypeScript/static build passed. Four focused semantic groups passed: unchanged 640 cells / 257 edges / 58 fixtures, exactly eight cells and deterministic outside placements; unchanged 009 city buildings and terrain ownership; frozen detail count. All Core/AI/RNG/supply/map source is untouched.

Nine browser checks passed. Medium 300% captured first, then near 500%; each pair has identical camera, selection, unit SVG and hit polygons. Actual Canvas mask samples at five natural terrain cells found zero solid pixels outside terrain polygons or inside protected transport/water/counter corridors. Every tested terrain retains substantial visible area. X14 text bounding box plus padding intersects no building. Stack selection, forest click, city click, drag suppression and zero page errors/external requests passed. This is fixture interaction, not live-match movement/combat-hint or Huawei acceptance.

All four final screenshots opened and visually reviewed. current009-medium/near and refined-medium/near are unmodified headless Chromium browser screenshots, 1363×936 DPR1, 300%/500%, X14 selected. The generated atlas shown during work is only an input asset, not screenshot evidence. Chinese font already available; no font downloads.

## Resource / startup cost
Runtime 74 files / 3,964,473 bytes including manifest; +609,484 bytes versus packaged 009. New image 605,378 bytes. Main canvas remains 60,440,576 backing bytes, DOM 2449. New atlas decoded arithmetic 6,290,064 bytes plus new tiles 2,359,296 bytes: approximately 8.25 MiB extra potential backing, excluding transient/browser/GPU overhead. Not measured RSS or VRAM.

Final single cold-context samples: 009 decode+paint 784.8ms, 010 1542.8ms; navigation-to-ready 1179.0/1840.2ms; longest task 1266/1375ms. 010 local preparation 89.0ms. Linux headless Chromium, no CPU/network throttle, one final trial per variant. 010 was slower in this sample; no performance improvement or acceptance claimed. Ready flag is not presented-frame time. First valid candidate measured 799.0/2112.1ms and remains recorded separately, not pooled as a benchmark. Historical 007 ~0.9s versus ~0.25s and known 708ms startup issue remain open.

## Attempts and remaining limits
Two initial TypeScript attempts exposed the narrower inferred old placement type and optional tile index; fixed with explicit local type/non-null array entry, logged and not counted as passes. The first valid candidate passed checks, then medium/near visual review prompted one revision: feather new static tile alpha, shorten W13 strips to avoid squared-off rail clipping, and differentiate Y15's low profile. Final build/check/screenshots supersede first output. Generated dist folders were moved aside before rebuild to avoid the existing ENOTEMPTY environment cleanup issue; no build script fallback.

Visual limits: strict real rail and hex clearances still constrain the woodland edge; roads cut through the apparent hill relief, and the transition to unchanged neighboring 009 terrain remains visible at this eight-cell boundary. Atlas provides only two relief families. Startup cost is higher in observed samples. No broad tests, performance project, full-map propagation, new rules, realtime lighting or deployment. Next step is user review of this local candidate.
