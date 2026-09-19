# UI-006R1 Asset Fidelity Feedback

Status: **READY FOR LEADER REVIEW** — corrected-renderer fidelity attribution only; not a Painter PASS.

## Review basis

This assessment supersedes the original UI-006 fidelity attribution. It is based on the **corrected UI-006R1 renderer**, after removing duplicate terrain-family passes, treating Hill height rasters as masks/modulation inputs, completing the River material stack, adding Railway contact shadow, restoring Far Hill/Rough cues, and connecting asset transforms to the active visual seed.

Authoritative visual evidence is the refreshed real-map SVG set under `screenshots/ui006/` using Strategic Reset F, locked Hex geometry, frozen Core data, and the canonical P4R3 asset pack.

## Family assessment after renderer correction

| Family | Assessment | Corrected-renderer finding |
|---|---|---|
| Ground | **GOOD AS-IS** | The continuous low-frequency substrate still works well as the shared world surface. No R1 correctness issue was attributed to this family. |
| Plain | **RENDERER TUNING NEEDED** | Quiet countryside remains viable. The main remaining gap is crop/field frequency, blending and repetition control, not a correctness or geometry issue. |
| Forest | **ASSET ART REVISION NEEDED** | Duplicate forest-mass rendering is fixed, so previous excess darkness/density is no longer part of the diagnosis. Even once rendered exactly once with deterministic fringe continuity, the reusable canopy masses still read more like stylized cluster stamps than the dense, physically varied woodland of P2S-R1. This remains the clearest targeted Painter revision candidate. |
| Hill | **RENDERER TUNING NEEDED** | The prior black/white Hill evidence was a renderer defect, not an asset-art failure. R1 now shows the material raster while the grayscale height image is used only as a mask/light-modulation input. The contract is viable; further relief/value tuning can stay renderer-side. |
| Rough | **RENDERER TUNING NEEDED** | Far identity is now intentionally preserved by a cheap broad cue and Medium/Close still use the P4R3 base/rock system. Remaining work is integration strength and density tuning, not geometry or rule semantics. |
| Marsh | **ASSET ART REVISION NEEDED** | Duplicate wet-base rendering is fixed, removing the false darkening attribution. The corrected wet→pool→reed stack is technically sound, but the reusable wet/pool silhouettes still read more motif-like than the embedded muddy wetland in P2S-R1. A focused natural-material uplift is still justified. |
| City | **ASSET ART REVISION NEEDED** | R1 fixes the hidden duplicate `city_medium` layer and now uses exactly one size-appropriate primary: Small / Medium / Major. With that distortion removed, the assets still read noticeably as stylized boardgame-scale building modules compared with the denser integrated settlement mass in P2S-R1. Renderer placement can improve integration, but the remaining fidelity gap is not renderer-only. |
| River | **RENDERER TUNING NEEDED** | R1 now uses the intended stack: shadow → bank → water → highlight, with edge vegetation at Close. The material kit is usable; the remaining gap is bend/junction continuity, width tuning and compositing softness along canonical shared-edge geometry. |
| Road | **GOOD AS-IS** | Material quality is adequate for current use. Keep it subordinate and tune shoulder opacity/LOD only if needed. |
| Railway | **GOOD AS-IS** | R1 adds the missing contact shadow before ballast/sleepers/rail pair. The corrected stack is clear and operationally readable. Further work is polish, not an asset blocker. |
| Bridge | **RENDERER TUNING NEEDED** | Assets remain usable and geometry-aligned. Final quality depends on abutment/contact integration with the widened River/Road/Rail stack. |

## Revised Painter recommendation

If Leader authorizes a targeted Painter patch after UI-006R1 review, prioritize:

1. **Forest** — highest impact and most persistent P2S-R1 gap.
2. **Marsh** — natural-material uplift after the corrected single wet-base pass.
3. **City** — denser, less token-like settlement modules if the P2S-R1 target remains the acceptance bar.

Do **not** request Painter changes for Hill based on the old black/white UI-006 evidence; that artifact was renderer misuse of the grayscale height map and is fixed in R1.

## Renderer conclusion

The R1 corrections materially improve attribution quality. The deterministic modular architecture remains valid: the remaining visual gap does not justify Core or Geometry changes. River, Hill, Rough, Plain and Bridge should receive renderer tuning first; Forest, Marsh and City are the families where the corrected renderer still leaves a meaningful asset-art gap.
