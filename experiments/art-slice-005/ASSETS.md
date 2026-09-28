# Original asset provenance

Three original imagegen outputs were generated for this experiment using the built-in image generation tool. No Civilization VII pixels, models, textures or UI were extracted. The prior approved concept was a direction reference, not a runtime background. The exact tracked WebP bytes below are the authoritative reusable art inputs; prompt-only regeneration is not deterministic. No exclusive copyright or third-party asset license is asserted for model output.

- `assets/meadow.webp`: continuous overhead meadow/loam material. Repeated in world space, with low-frequency transparent color variation across cells. It is not a complete landscape image.
- `assets/terrain-atlas.webp`: original transparent woodland copse, open copse, grass/limestone hill and village cluster. Explicit source rectangles in `sliceTerrain.ts`. The village-cluster quadrant is unused in the final candidate; individual buildings proved clearer. Tree sprites are placed at deterministically varied sizes without rotating their baked lighting. Hill and rough currently share one mound shape, a known repetition/readability limitation.
- `assets/buildings.webp`: four separated original buildings (farmhouse, brick house, barn and small church). Individual footprints are positioned inside X14, avoiding all road/rail corridors; only one church is used. No buildings outside the city are invented.

All three final assets are committed directly to Git; no external or signed URL is required to reconstruct the experiment. Runtime uses all three exact files. Intermediate PNGs are not build inputs. PNG→WebP used sharp quality 88, alphaQuality 100 without geometric/content editing. The build does not depend on sharp.

## Generation briefs (descriptive records, not a deterministic regeneration recipe)

1. Transparent atlas: 2×2 isolated stamps, dense irregular mixed woodland, looser copse, low grassy limestone hill and 1940s rural Eastern European building cluster. Near-overhead orthographic miniature realism, upper-left light, no hexes/labels/roads/rivers or backdrop.
2. Meadow: edge-to-edge overhead diffuse olive/sage grass with tiny dry straw and loam variation; no trees, buildings, routes, water, slope, grid or text. Tiling is visually usable at this slice scale; seamless/full-map repetition is not certified.
3. Buildings: 2×2 transparent individual plaster farmhouse, slate-roof brick house, low red-tile barn, modest church. Overhead-biased orthographic, consistent upper-left light, no terrain slab, roads, trees or labels.

The original generated assets differ somewhat in viewpoint and baked shadow scale. This prototype does not establish final asset-system consistency. The concept's rich riverbank vegetation and authored terrain continuity have not been fully reached.
