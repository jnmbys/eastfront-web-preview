# ART-BLEND-011 — local blend candidate

Base: `5a4835e237594c8dfe8510f2611b18f7ebed96fb` (ART-TERRAIN-010). Independent `art-blend-011`; no deployment, no main/source-main edits.

Only X14, W13, W14, V13, V14, W15, X15, Y15. The viewer switches the unchanged 010 renderer against 011 with the identical public map fixture, camera, units, hit polygons and label offset. No gameplay modules or map data changed.

011 replaces stacked 009/010 ground and bank washes with one spatial material field. Forest litter, footslope soil, town court/approach and variable riverbank widths share this field; it fades at the outer eight-cell boundary, not internal hex boundaries. Directional light comes from unchanged 010/009 assets. Existing natural stamps get baked alpha shoulders before the strict 010 terrain/corridor/counter clip. This softens steep relief beside real transport; there is no new transport line. Buildings, water centerlines/widths, bridge drawing and interaction are unchanged. Unused old terrain shadow tiles and local per-building halo layers are removed. The field and seven feathered stamps bake once per variant paint, not during drag/zoom. No live light system or renderer replacement.

## Reference and licensing

Reuse official references recorded in 007 ASSETS.md:
- https://blog.playstation.com/2024/12/04/civilization-vii-first-look-at-ps5-gameplay-ahead-of-february-11-launch/
- https://newsroom.2k.com/news/sid-meiers-civilizationr-vii-launching-worldwide-on-february-11-2025

The Firaxis article explicitly describes a playable museum diorama, readable realism and connected tile layouts. Our applied interpretation: transitions should come from broad shared ground materials and tapering mass/shadow, not isolated stamps or more tiny detail. This does not assert Civilization VII's internal rendering technique. No reference pixels are copied. All image files are reused unchanged; original asset provenance remains in 005/007/010 ASSETS.md. No new raster asset, font or remote dependency.

## Reproduce

```sh
node experiments/art-blend-011/build.mjs
node experiments/art-blend-011/validate.mjs
NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" node experiments/art-blend-011/check.cjs
NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" node experiments/art-blend-011/scope-check.cjs
```

Use the existing Chromium path or configure check.cjs CHROMIUM_PATH. Build serves only the static dependency closure; generated dist is ignored. All evidence is in `evidence/ART-BLEND-011`. Scope-check is an extra canvas comparison, not another timing benchmark. An initial semantic runner referenced a module removed from the dependency closure; corrected to import unchanged baseline 010 placements, then passed. No game-wide suite or performance campaign.

## Review boundary

300% shows softer forest/relief cuts and less isolated town ground; improvement is restrained, not a dramatic new atmosphere. 500% clarifies the blending, but some relief volume is lost at the mandatory transport clearance. River topology still looks angular, and water remains a narrow regular ribbon. Candidate retained for user review without more tuning. It does not establish Civilization VII quality or performance improvement. Historical 708ms startup issue remains open. Tests concern the static viewer/58 fixtures, not legal gameplay moves, combat or device acceptance.
