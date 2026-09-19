# UI-007 Performance Notes

Measured with the compiled `coreSvgMarkup()` renderer on the same Strategic Reset F state, seed 17, 20 warm/measurement iterations after 4 warmups. These are renderer-construction timings, **not FPS**.

| Asset set | LOD | Mean | Min | Max | Approx SVG nodes | Unique asset URLs |
|---|---:|---:|---:|---:|---:|---:|
| P4R3 baseline | Far | 38.55 ms | 28.46 | 64.11 | 7,447 | 60 |
| P5 | Far | 25.14 ms | 19.57 | 33.04 | 7,447 | 60 |
| P4R3 baseline | Medium | 44.93 ms | 30.01 | 59.11 | 8,352 | 89 |
| P5 | Medium | 46.65 ms | 31.17 | 61.12 | 8,352 | 89 |

Interpretation:

- P5 does **not** increase renderer node count or unique URL count because the manifest/variant contract is unchanged.
- Medium construction time is ~3.8% above the same-binary P4R3 A/B measurement; this is within ordinary Node timing noise and is not a structural renderer regression.
- Far timing was lower in this run; no performance claim is made from that difference.
- Runtime P5 reusable raster payload is **6.117 MiB** versus the smaller P4R3 baseline, still below the preferred 8 MiB asset budget.

Machine-readable measurements: `docs/UI007_PERFORMANCE.json`.
