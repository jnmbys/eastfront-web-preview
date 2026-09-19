# UI-006 Performance Notes

These are renderer-construction observations, not FPS claims.

Measured on the UI-006 validation container using the real 640-Hex Strategic Reset F render model, five `coreSvgMarkup()` runs per LOD:

| LOD | Average construction | Best observed | SVG bytes | Approx. SVG nodes | Asset references | Unique asset URLs |
|---|---:|---:|---:|---:|---:|---:|
| Far | 35.76 ms | 18.66 ms | 895,842 | 7,327 | 970 | 60 |
| Medium | 39.39 ms | 30.71 ms | 1,077,476 | 8,013 | 1,656 | 86 |

Notes:

- These timings measure string/render construction in Node, not browser paint/composite time.
- No precise FPS claim is made.
- Far LOD removes microdetail such as railway sleepers.
- Asset URL reuse keeps unique requests well below raw image-instance count.
- P4R3 reusable production raster payload is 5.774 MiB, under the Painter budget target.
- No per-Hex runtime blur chain was introduced.
- iPad browser paint/memory profiling remains a later device-level validation item; no resource warning was observed in the Node-side renderer construction run.
