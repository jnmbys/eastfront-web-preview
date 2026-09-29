# ART-MAP-006 — isolated full-map candidate

Source parent: f283e5194275fe0f0690dadf8f75f125ce978797 (ART-SLICE-005 plus publication evidence). Management ref read: c7531c70fab4b7c7402cd2f7d927c2134adee228. User accepted slice quality/readability/operations; this does not accept the full map.

## Run

```sh
npm ci --prefix task-source/ART-PREVIEW-002
node experiments/art-map-006/build.mjs
node experiments/art-map-006/validate.mjs
python -m http.server 8766 --directory experiments/art-map-006/dist
```

Open http://localhost:8766 . `全览` fits all 640 cells; `X14` goes to the same southern comparison scene at 500%; +/−, drag, wheel and pinch use the existing selection/gesture model with an isolated full-map 100–800% camera range. Baseline toggle preserves selection and camera. 58 public display fixtures stress the counter layer, not an actual game deployment. No movement, combat, authority, fog or multiplayer.

Browser regression (requires installed Playwright and Chromium; this task reused the existing pinned local runtime):

```sh
CHROMIUM_PATH=/path/to/chromium node experiments/art-map-006/browser-check.cjs
```

## Scope

New mapData/mapTerrain/artMap entry modules fork only the experimental slice. Core, rules, production source, shared unit renderer and gesture module remain byte-identical. Canvas terrain remains below non-intercepting SVG scenery and existing unit/hit layers. Bounded raster longest side 4096, neighborhood-only placement checks and cell-local collision lists address measured expansion costs. Removing persistent will-change allows SVG counters to reraster sharply after large zooms.

Canonical map: candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json. The importer is unchanged. 640 cells, nine terrain types; full registry includes 257 edges, 108 river flags, 60 road flags, 132 rail flags, six bridges (counts overlap). Procedural marsh/lake material supplements the three accepted original asset files. Main/outer cities reuse the building atlas with denser placement. Relief varies scale, offset and mound count; woodland varies cluster sizes/density and clearings. No rotated baked lighting. Atlas-family repetition remains possible and is not claimed eliminated.

## Assets

Build copies the three exact tracked WebP inputs from ../art-slice-005/assets. Provenance remains ../art-slice-005/ASSETS.md. No external downloads, new licenses or image generation required. Marsh reeds/pools, shoreline, composition and riverbank detail are original code-generated marks; they do not alter semantic map data.

## Prepared publication scope — not executed

Only the generated dist/ closure (67 files including manifest.json and _headers) would be published to a NEW standalone Cloudflare Pages preview branch after explicit release authorization. Reuse the existing runtime-only publication process. Do not publish the source tree, evidence, node_modules, main.js game bootstrap, backend code or production config. CSP connect-src self, no production multiplayer imports. No deployment branch/PR/Hook/platform setting is changed in this task. art-map-006 is source/evidence only and every remote commit must carry [CF-Pages-Skip].

Full-map Huawei, GPU, CDN byte hashes and user aesthetic acceptance remain open. See ../../evidence/ART-MAP-006/REPORT.md for measured conditions, results and screenshot paths.
