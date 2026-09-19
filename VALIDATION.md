# UI-009R2 Mobile/Tablet Terrain Surface Validation

Current release classification: **RELEASE BLOCKED pending post-deploy Huawei tablet real-device verification**.

UI-009R2 replaces the resource-heavy live production terrain SVG paint path with one deterministic cached Canvas surface generated from the same canonical map/Geometry/P5R1 data. The live SVG retains the Hex grid, counters and interaction overlays.

## Frozen baselines

- Core v0.2.25 / 002G-3R1 SHA-256: `b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609`
- Geometry `src/geometry/hex.ts` SHA-256: `283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a`
- P5R1 `city/small/S02.png` SHA-256: `914593e3fb5c28b412fd0aff47418728f9ff360fce19659f63b870352890c55e`

## Final local gate

- TypeScript typecheck: **PASS**
- UI-009R1 interaction + UI-009R2 surface targeted tests: **22 / 22 PASS**
- Production build: **PASS**
- Production audit: **CLEAN**
- Runtime terrain rasters: **123**
- Static HTTP: **123 / 123 raster requests HTTP 200**
- Missing-asset 404s: **0**
- Forbidden production paths: **0**

## Strategic Reset F static surface coverage

Deterministic seed 17 / medium LOD plan:

- Ground: 1
- Plain: 460
- Forest: 92
- City: 9
- Marsh: 19
- Hill/Rough: 55
- River: 108
- Road: 60
- Railway: 132
- Bridge: 6
- Lake: 5
- selected P5R1 raster entries: 83 plan entries

The same canonical map + seed produces a byte-identical surface plan. Production live SVG with `staticTerrainSurface=true` contains no production raster `<image>` nodes; it retains the production Hex grid, deployment/interaction layers and counters.

## Cache/rebuild gate

`buildCachedTerrainSurface()` has one runtime call, in startup `boot()` only. Selection, deployment, combat, pan and zoom do not call the terrain builder. Full UI renders detach/reinsert the same Canvas object; pan/zoom apply presentation transforms to the existing Canvas and SVG together.

## Browser automation limitation

This execution environment applies a Chromium administrator policy that blocks navigation to `127.0.0.1` (`net::ERR_BLOCKED_BY_ADMINISTRATOR`). The task instruction explicitly permits recording this blocker instead of repeatedly rerunning browser automation. Earlier UI-009R1 browser pointer/pan evidence remains preserved; UI-009R2 local validation therefore uses deterministic renderer tests, production static HTTP verification and frozen-hash audits.

## Remaining real-device gate

After GitHub Pages redeploy, the user must verify the same public URL on:

1. Huawei tablet Microsoft Edge
2. Huawei tablet default browser

The release blocker closes only if both show the complete cached terrain surface (Forest, City, Marsh, Hill/Rough, River, Road, Railway, Bridge), with deployment, pan and zoom still usable. Until that real-device verification is received, status remains **RELEASE BLOCKED**.
