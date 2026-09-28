# ART-DIRECTION-004 — X14 / southern approach

Status: one finished offline AI concept, awaiting user art-direction review. Not gameplay, not a runtime asset, not a topology-accurate replacement. No renderer/rules/production changes.

## Provenance
- Management read: collaboration-setup-001 at c7531c70fab4b7c7402cd2f7d927c2134adee228; PROJECT_STATE.md and WORKER_PROTOCOL.md.
- Engineering baseline retained: art-build-003 c3d6e890892fc58960251c9215e066e46eef7436. No management runtime merge. No AGENTS.md found in this baseline tree.
- Map source: candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json, Git blob 5e8213ccb2c9abc409b45b53a709c377e1cc0cd4.
- Crop: T–Z columns, rows 11–17 (49 cells). X14 city; plain, forest, hill, rough and marsh; existing roads/rail and edge rivers including southern confluence. region.json retains exact source entries and boundary-crossing edges.
- layout-guide.svg is the deterministic semantic blueprint, NOT proposed final art. Odd columns in zero-based coordinates offset down half a row; flat-top hexes, vertical scale 0.8. River segments are the shared edges between their recorded cells, not center-to-center lines.
- PROMPT.txt records built-in image generation instructions. The exact saved CONCEPT.png is authoritative: model generation is not deterministic from prompt alone.
- VIEW.html displays the SAME image at detailed and 360 CSS px overview sizes; no independent invented distant scene. This is a static reading comparison, not game camera/LOD acceptance.

## Official references and observations
Sources viewed at 3840×2160 from 2K newsroom, accessed 2026-09-28:
- https://newsroom.2k.com/news/sid-meiers-civilizationr-vii-launching-worldwide-on-february-11-2025
- Roman City: https://cdn.prgloo.com/media/665a299504a742c48337d081070cc4be.png?height=2160&width=3840
- Military Battle: https://cdn.prgloo.com/media/59a9e14076244d3bb971d7b8b6a9d1b7.png?height=2160&width=3840
- Firaxis executive producer's official explanation: https://blog.playstation.com/2024/12/04/civilization-vii-first-look-at-ps5-gameplay-ahead-of-february-11-launch/

| Aspect | Visible observation | EASTFRONT design inference |
|---|---|---|
| Volume | Rock faces, sloped ground and cast shadows make height readable. | Low rolling relief and baked directional shading; do not introduce mountainous tactical obstacles. |
| Material | Grass, exposed soil, stone and roof surfaces have distinct small-scale variation. | Continuous world-space texture and local roughness, avoiding per-hex flat fills. |
| Vegetation | Mixed crown sizes, loose groups, gaps and undergrowth; no identical symbol grid. | Authored forest clusters with density masks and irregular edges within terrain constraints. |
| Water/banks | Roman coastal screenshot shows a shaped shoreline and surface reflections; battle image has small wet ground areas. | Bank shelves/reeds and continuous channel joins are our proposed treatment. These two images do NOT establish Civ VII river-confluence implementation. |
| Roads | Thin routes remain visible within ground and settlement layout. | Blend dirt shoulders, preserve exact graph and mandatory crossings. |
| Cities | Dense groups of varied roofs, courtyards and connecting streets rather than one building icon. | A compact 1940s Eastern European cluster inside X14; no Roman assets. |
| Lighting | Consistent lit faces/contact shadows make groups cohere. | Bake static light; keep unit/highlight layer above ground. Shader/engine implementation cannot be deduced from screenshots. |
| Scale | Official text discusses aerial and close views. Stills alone do not prove transitions or LOD behavior. | Distant view suppresses microdetail while keeping forest mass, river/road hierarchy, city and counters. Our resized proof does not test dynamic LOD. |

## Sample review and limits
The sample establishes continuous textured land, varied woodland, raised hill forms, shaped riverbanks/confluence, a building cluster and contrasting unit overlays. Unit markers are illustrative, not a current PlayerView or a validated move/combat state.

Semantic fidelity is partial: major river/city/forest relationships follow the guide, but generation added minor tracks/buildings and an extra crossing near the central forest; city/vegetation extents and river curvature can spill across the exact mask. Do not import this bitmap into gameplay as-is. The source mask is exact; the concept pixels are NOT certified cell-exact. This discrepancy is explicitly retained, not treated as a pass. The selected-unit outline is a readability proposal, not a legal-move indication.

The generated raster is original model output, with official images used as style-method references only. No extracted Civ VII texture, mesh, UI or building asset is included. Reference images remain copyrighted by their owners and are linked rather than redistributed. Do not assert an exclusive copyright or third-party asset license for generated output.

## Minimum implementation after approval only
1. Keep current hex geometry, camera, input, unit/highlight layer and terrain semantics. Author a small X14-region art layer clipped by exact terrain and infrastructure masks.
2. Bake continuous ground/relief shadows into spatial chunks; render trees/building groups as a small set of pre-rendered transparent atlas clusters. Preserve original river/road graph and explicit bridges. Terrain raster + existing interactive overlay is a feasibility proposal, not implemented code.
3. Prepare grass/soil/rock/wet-bank materials, roughly 6–8 woodland clusters, 4–6 hill/rough patches, 3 city clusters with period building variants, continuous river banks/junctions, road/rail/bridge pieces. Quantities are initial authoring estimates.
4. Two raster resolution levels; distant view reduces texture detail, retains terrain silhouettes and infrastructure. Keep counters/highlights independent and at usable screen sizes.

Tablet risks: texture memory/upload stalls, alpha overdraw from tree atlases, seams during zoom, expensive full-map canvases and misleading terrain boundaries. One 2048² RGBA texture uses 16 MiB before mipmaps (~21.3 MiB with a full chain); several layers/chunks can multiply this. Proposed limits must be tested on iPad/Huawei; none are performance measurements. Avoid per-tree DOM/SVG nodes and real-time shadow passes in the first prototype. Static baking constrains camera rotation and lighting.

## Validation / next step
- Official high-resolution source images visually inspected; observation and inference separated above.
- Crop values extracted from the frozen map; source, blueprint, generation prompt and final raster preserved with hashes.
- Distant view uses identical image bytes at reduced CSS size.
- No runtime build/test/performance/device claims: this is art-direction work.
- User reviews texture, volume, scale and readability FIRST. If approved, next task is a mask-constrained small implementation proof and topology correction, not full-map conversion.
- Save on isolated art-direction-004 with [CF-Pages-Skip]; no PR, Hook or deployment. ART-BUILD-003 remains engineering comparison.
