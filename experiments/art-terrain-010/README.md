# ART-TERRAIN-010

Base `83f4e2c22e2d75adefaa78c10c2b3de1f50610f6`; independent `art-terrain-010`, no deployment. Original 009 files preserved.

```sh
npm ci --prefix task-source/ART-PREVIEW-002
node experiments/art-terrain-010/build.mjs
node experiments/art-terrain-010/validate.mjs
CHROMIUM_PATH=/path/to/chromium node experiments/art-terrain-010/check.cjs
python -m http.server 8770 --directory experiments/art-terrain-010/dist
```

Browser checks require Playwright available in the environment. Default variant is 010; toggle loads untouched 009 painter and original X14 label position. Medium 300% and near 500% share the same X14 camera. Preview uses public semantic map plus visual fixtures, no playable match/backend.

Static atlas and provenance: assets/terrain010.webp, ASSETS.md. Generated input is not screenshot evidence. No generation service is required to rebuild: final WebP is tracked. Three new experimental modules: artTerrain010.ts, terrain010Layout.ts and terrain010Terrain.ts. All natural terrain alpha passes through local masks; transport/bridge and unit overlays remain original. Image light and edge feather are prepared once in the static terrain canvas, not per interaction frame. Only X14 label position changes.

Evidence ../../evidence/ART-TERRAIN-010/REPORT.md includes actual attempts, checks, screenshot provenance, asset/resource and cold-context costs. Known startup issue remains open; no new live-game/device/performance acceptance.
