# ART-POLISH-009 — local diorama candidate

Base: `56477d3131ed62bf05cd03db87838fe4cba8da15`, branch `art-polish-009`. Management protocol read at `c7531c70fab4b7c7402cd2f7d927c2134adee228`. No deployment. This is a visual review candidate, not user acceptance or Civilization VII equivalence.

## Actual change
Only X14, W13, W14, V13, V14, W15, X15, Y15. X14 changes from nine 008 buildings to seven with a 26×28 principal tower/church sprite (008 civic sprite 14×17), closer side buildings, high/low roofs and connected warm courtyard ground. The existing church image is decorative: no new game function, icon or rules meaning. Same four licensed/provenanced original atlas assets; no image generation or external assets. Courtyard is a decorative surface, not a new transport edge.

Upper-left light and lower-right contact shadow are baked once per map painting into eight small local canvases, then into the existing static world canvas. No animation or gesture-time light loop. Local forest mass/shadow and relief contact shading use the existing terrain atlas; local river depth/sky tone follows original centerlines inside the eight-cell mask, before original roads/bridges. No global saturation change.

Original 007 and 008 source remains byte-identical. Added three experimental modules and a separate build/check entry. Core, AI, RNG, supply, semantic map, bridge/road geometry, counters, gesture contracts and production branches untouched. 334 tiny decorations unchanged from 008; no new decoration DOM. Units/selection remain SVG above the terrain canvas.

## Evidence / tests actually run
- Final TypeScript/static build passed (build.log).
- Four focused semantic groups passed: frozen semantic objects (640 cells, 257 edges, 58 visual fixtures), eight-cell scope and unchanged outside placements, city/forest ownership and corner/transport/counter clearance, prominent main building and reduced detail count. See semantic-tests.json.
- Seven browser checks passed: same camera/selection/counter SVG/hit polygons at near and medium; stacked unit switching; forest and city click ownership; drag suppression; no JS errors/external requests. See browser-results.json.
- All four final JPGs opened and visually inspected after the last successful build. Actual unmodified Chromium screenshots: refined-near / refined-medium are 009, current008-near / current008-medium are unchanged 008 in the same shell. 1363×936 DPR1, 500% / 300%, identical X14 selection and pan. Existing original-shell 007 and 008 comparisons remain at ../ART-POLISH-008. Chinese is readable; host font reused, no download.
- Final image review: main tower, larger side roofs and connected ground give a clearer silhouette at 300%; buildings remain small at this tactical scale, X14 label overlaps the foreground roof area, atlas family repetition persists. User judgment pending.

## Cost
Runtime 73 files / 3,354,989 bytes including manifest; delta from packaged 008 +9,222 bytes. Four image hashes identical: zero new image bytes. Both 2449 DOM nodes. Main canvas backing 60,440,576 bytes unchanged; local light tiles add estimated 2,097,152 bytes, with temporary tint canvases during preparation. This is backing-size accounting, not RSS/VRAM measurement.
Final single cold-context samples: 008 decode+paint 837.9ms, 009 850.9ms; navigation-to-ready 1201.3ms / 1155.5ms; longest task 1253ms / 1300ms. 009 local tile bake 14.0ms. Headless Linux Chromium, no CPU/network throttle, one sample each; ready flag is not presented-frame time. Not a stable benchmark or performance improvement. Historical 007 ~0.9s versus 006 ~0.25s and known 708ms startup issue remain unresolved. No Huawei/GPU/gesture benchmark.

## Attempts / limitations
The first validation import referenced 007 module outside the 009 dependency closure; changed the check to the identical base placement function in 008. Two south-house arrangements failed unchanged clearance guards and were moved inward. First valid screenshots led to one visual revision (larger closer side buildings, softer paving); its compact passing/cost record is retained in first-candidate-summary.json. Final rebuild initially hit ENOTEMPTY removing generated dist; moved generated folders aside and rebuilt using unchanged build script. Failure logs retained, never counted as passes; final files supersede first screenshots.

Preview contains visual fixtures and selection/drag only: it does not exercise legal movement or combat hints in a live match. Existing unit/selection layer contract unchanged, but no new live-game/device acceptance. No full regression or performance project, no expansion beyond eight cells. Next step: user reviews this local candidate before further art or publication.
