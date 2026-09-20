# Renderer issues observed in checkpoint D exports

These reports are based on the native Canvas exports described in VISUAL_REVIEW.md. Browser confirmation is still required. No production files were changed.

## E-01 — City clusters fail visual recognition

- Source: checkpoint D, seed 17, Strategic Reset F.
- Evidence: 06-city-railway-road.png (R10, Close) and 01-full-vs2-far.png; compare 02-full-v1-same-camera.png.
- Actual: individual structures appear as tiny isolated coloured pixels around the transport intersection. The occupied area does not read as a city cluster. City locations largely vanish at Far, while V1 city masses remain identifiable.
- Expected: city presence and a clustered built-up area should be recognizable at intended player scales without changing canonical city cells or scenario semantics.
- Impact: players may have difficulty recognizing cities from terrain presentation alone.
- Follow-up: confirm in browser at matching cameras; inspect sprite content bounds, placed sizes and Far silhouette contrast. Root cause has not been established. Do not alter scenario density to compensate without a separate approved change.

## E-02 — Abrupt river brightness changes between connected segments

- Source: checkpoint D, seed 17, Strategic Reset F.
- Evidence: 05-south-marsh-river.png, especially the alternating pale diagonal segments on the central horizontal zigzag and the pale segment approaching the upper-right marsh.
- Actual: connected river segments change sharply from dark blue to pale cyan at joints. These are not gaps in canonical connectivity, but interrupt the appearance of one continuous watercourse.
- Expected: consistent material appearance through connected segments while preserving canonical river geometry and bridges.
- Impact: river reads as separately coloured pieces and can suggest false crossings or material changes.
- Follow-up: reproduce in browser and inspect UV sampling/orientation and join compositing. This evidence does not establish which operation causes the discontinuity.
