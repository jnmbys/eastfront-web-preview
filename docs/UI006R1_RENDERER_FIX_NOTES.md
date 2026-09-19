# UI-006R1 Renderer Fix Notes

## Scope

Renderer correctness only. No Core changes, no Hex Geometry changes, no P4R3 repainting, and no gameplay feature work.

## Fixes

1. **Single primary terrain path**
   - removed generic-family + specialized-family double rendering;
   - Forest now renders one `forest_mass` primary;
   - Marsh renders one `marsh_wet` primary;
   - City uses exactly one primary size family (`city_small`, `city_medium`, or `city_major`).

2. **Hill height-mask semantics**
   - `hill/height/*_height.png` is no longer visible terrain artwork;
   - the companion `hill/material/*_material.png` is the visible terrain material;
   - height raster is used only inside an SVG mask for lightweight fixed-light modulation;
   - no blur/filter chain was added.

3. **River material stack**
   - Far: water + simplified existing cue;
   - Medium: bank shadow → bank → water → inner highlight;
   - Close: Medium stack + edge vegetation;
   - every layer follows exact `HexEdge.river` / `sharedHexEdge()` geometry.

4. **Railway contact shadow**
   - Medium/Close order is now contact shadow → ballast → sleepers → rail pair;
   - Far keeps the simplified corridor.

5. **Far Hill/Rough identity**
   - Hill keeps companion material + light cue at Far;
   - Rough uses a cheap subdued canonical-Hex mass cue at Far;
   - no Close-only rock microdetail leaks into Far.

6. **Active visual-seed transforms**
   - rotation/mirror selection now uses the active renderer visual/scenario seed;
   - no fixed transform seed constants remain;
   - gameplay RNG remains untouched.

## Regression coverage

All original 71 UI-006 tests remain, plus 12 UI-006R1 tests for the fixes above. Final count: **83/83 PASS**.

## Refreshed authoritative evidence

The real Strategic Reset F SVG evidence under `screenshots/ui006/` was regenerated after the fixes, including full Far map, north/central/south Medium views, Close city/infrastructure, Turn 1 counters, combat overlay, and Prototype-vs-Production A/B views.

PNG/browser raster export remains optional; authoritative correctness evidence is SVG.
