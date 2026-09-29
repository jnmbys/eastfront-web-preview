# ART-POLISH-007 — local A/B review, not deployed

Base source/evidence: 4e9ae0b465ca4b45d7e1cde90a8d69d92a08c8d8; ART-MAP-006 source 846aa6f58416f66ca90ed48047398febdbb8e95f; published reference fabb559b757686c410164f8765277e383caf11ee. User now rejects the prior full-map finish as too simple; prior acceptance is not final art approval. Target is Civilization VII, not VI.

```sh
npm ci --prefix task-source/ART-PREVIEW-002
node experiments/art-polish-007/build.mjs
node experiments/art-polish-007/validate.mjs
python -m http.server 8767 --directory experiments/art-polish-007/dist
# Existing installed Playwright + Chromium required only for browser verification:
CHROMIUM_PATH=/path/to/chromium node experiments/art-polish-007/check.cjs
```

Open http://localhost:8767 . The new isolated entry retains the original 640-cell source map and 58 public display fixtures, but only T–Z / rows 11–17 (49 cells) receives polish. Default view centers X14 at 500%. `查看当前版` / `查看精修版` swaps the same canvas, preserving camera, hexes, selection and counter SVG. Query ?variant=baseline starts the unmodified ART-MAP-006 material renderer. This is not the old line-art engineering baseline.

Source changes are only new experimental art/preview modules plus this build/test subtree and ignored dist. Original mapTerrain/mapData/artMap, Core, rules, geometry, camera gesture module and unit renderer remain unchanged. The comparison harness removes the unused survey layer from both A/B variants; it does not claim DOM parity with the earlier 006 app. Decorations use no DOM/SVG nodes or pointer targets. All real hit polygons and counters stay on top.

402 deterministic stamps: 180 grass, 32 small stone clusters, 72 low shrubs, 112 riparian/marsh reeds, four crop patches, two tiny yard prop groups. Gardens are only within existing CITY or adjacent PLAIN; roofed buildings, routes, bridges, units and actions are not added. Courtyard material sits beneath existing city roofs and transport paint. Corpus footprints avoid complete river/transport corridors and the fixed fixture envelope. The plain remains open terrain; crops are ornamental, not a new resource or rule.

The current comparison uses the same original mapTerrain function. Local material changes separate canopy/roof/relief treatment, a subtle meadow soft-light blend, and water palette on the original river ribbon. No whole-map saturation pass. Detail atlas comes from one new built-in imagegen result, see ASSETS.md. Runtime generates small tinted tiles instead of applying a costly image filter for each stamp. Finite atlas reuse remains visible; no claim of matching Civilization VII fidelity or solving large-scale repetition.

Build creates 70 runtime files; outputs are not pushed to a preview branch in this task. No deployment, main/source-main changes, PR or Hook. See ../../evidence/ART-POLISH-007/REPORT.md for comparisons, cost and remaining limits. Full-map expansion requires user art acceptance first.
