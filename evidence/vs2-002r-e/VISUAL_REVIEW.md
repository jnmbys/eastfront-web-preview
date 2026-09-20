# VS2-002R-E visual evidence

Source renderer: `5d68a233a667ab2fc5864fcc25a8dff7c79a1cfe` (accepted checkpoint D).
Seed: 17. Strategic Reset F: 20 × 32, 640 canonical hexes.

## Evidence method and limits

These are offline exports of the unchanged compiled production rendering functions using @napi-rs/canvas (Skia). They are not browser screenshots or a browser visual acceptance result. The supported browser could not access the local service (ERR_BLOCKED_BY_CLIENT). No deployment or alternative browser automation was used.

The harness creates a fresh production session from the existing scenario and invokes buildCachedTerrainSurface with the D worldBase hooks; the V1 comparison omits those hooks. It uses canonical coordinates, the existing SVG grid polygons, and production grid paint. Because the native SVG decoder did not reliably apply class CSS, the export adapter repeats the grid's paint as explicit attributes and converts its non-scaling stroke to camera units. This correction affects only the evidence harness. Initial black-filled adapter outputs were discarded.

The grid is rasterized for the PNG exports. The application live grid and interaction code are untouched, but their browser behavior is not exercised here. UI, units and deployment tints are omitted to expose the terrain. Camera scale is explicit rather than an interactive zoom gesture. Full maps use Far and details use Close; this set does not add a Medium capture. Native decoding, compositing and resampling may differ from a browser.

CAPTURE_MANIFEST.json records cameras, output dimensions, PNG hashes, asset read hashes, renderer counts and the scenario hash. Rendering leaves the serialized session and model unchanged. All pre-existing tracked files remain identical to checkpoint D.

## Captures

| File | Coverage |
| --- | --- |
| 01-full-vs2-far.png | All 640 hexes, VS2 Far |
| 02-full-v1-same-camera.png | V1/P5R1, identical seed, camera, dimensions and grid |
| 03-north-forest-close.png | North forest and surrounding plain, H4 centre |
| 04-central-plain-hill-infrastructure.png | Central terrain and infrastructure, P9 centre |
| 05-south-marsh-river.png | Southern marsh and river, P17 centre |
| 06-city-railway-road.png | City and transport intersection, R10 centre |

## Visual findings

| Criterion | Result in exported evidence |
| --- | --- |
| Continuous world surface | Ground texture crosses hex boundaries without the V1 flat cell fills. Fine-grained repetition remains prominent; hill/plain differentiation is weak in image 04. This is an observation, not a map redesign request. |
| Hex grid hierarchy | Grid is subordinate to surface and infrastructure, visible in Close. It becomes difficult to read over detailed ground in Far; browser/player-scale acceptance remains open. |
| Forest continuity | Adjacent northern and central forest cells form connected canopies without interior hex-shaped holes. Isolated canonical forest cells remain islands; continuity does not imply filling scenario gaps. |
| Marsh readability | Cyan/blue-green marsh areas are distinguishable from dry ground in images 01 and 05. Their resemblance to shallow water needs player review. |
| Railway visual weight | Railway no longer dominates the image; close-up sleepers help distinguish it from the pale road. Far railway routes are difficult to follow over the noisy ground. |
| City cluster appearance | Not acceptable in this evidence: buildings are tiny dispersed specks even in image 06; full-map cities largely disappear compared with V1. See separate issue E-01. |

River segment brightness discontinuities are also visible; see issue E-02. This checkpoint records evidence and issues, not a production visual sign-off. No renderer fixes were made.

## Reproduction

Run `npm run build`, then `node evidence/vs2-002r-e/export-evidence.mjs` from the repository root. The harness requires @napi-rs/canvas available through CODEX_PRIMARY_RUNTIME_NODE_MODULES. It uses the unchanged dist output and reads real local assets. The manifest records the HEAD used on each run; the committed captures record D.

Build passed for this export. Evidence generation completed with six PNGs and unchanged source state. E changes only evidence files, so no additional application test suite was required or claimed.
