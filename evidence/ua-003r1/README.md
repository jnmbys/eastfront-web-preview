# EASTFRONT UA-003R1 — Unit Grounding & Readability

Source checkpoint for leader review; this pass does not deploy the public site.

Baseline commit: `f32429a0972eb178a6f89bf3d507363a0a09715d`
Baseline tree: `0624660cffc171927c731958b787d0ef53422db7`

## Scope and composition

Only three existing runtime files changed: `src/presentation/unitPresenceTypes.ts`, `unitPresenceSvg.ts`, and `unitPresence.ts`. They contain family artwork, local display composition, and its existing SVG binding. The UA coordinator, queue, accepted events, motion profiles and timing remain byte-identical.

Single units occupy a rear ground strip, with 9 / 12 world units between the feet baseline and the Counter edge at Medium / Close. A broad ambient ellipse and a tight contact ellipse sit under the feet, tracks or carriage. The ground and model share the existing Counter animation transform. There is no floating CSS drop-shadow, terrain sampling, external artwork or new startup dependency.

Approximate unstacked silhouette width / Counter width (excluding thin separation rim and transient fire cue):

| Family | Medium | Close |
|---|---:|---:|
| Infantry | 1.19× | 1.54× |
| Armor | 1.26× | 1.61× |
| Heavy armor | 1.34× | 1.71× |
| Artillery | 1.18× | 1.56× |

Other existing families use individual profiles; no unit type was added. Infantry has a wider three-figure formation, stronger torso/head separation and more visible feet. Armor has a wider hull, dark track plane, raised turret and readable barrel. Artillery has a wider carriage and open trails so its low silhouette differs from armor. Restrained faction body colors, a narrow neutral separation edge, dark sides and Close top facets improve contrast against complex VS2 backgrounds.

Far remains completely Counter-only. Medium already displays the larger silhouette and ground contact. Close increases scale and reveals the existing detail layer. LOD thresholds and hysteresis are unchanged.

## Stack and animation behavior

Stacked models use the existing Counter stack sign and anchor. Both models fan left/right onto the near ground strip below their information plates, at 86% of the solo family scale. This was chosen after the dense three-attacker crop exposed occlusion from the preceding occupied Counter row when both models remained above the plates. Counter placement, overlap, stack badge, selection, stats, NATO symbol and touch target are untouched.

Entering or leaving a stack interpolates only the local display offset/scale using the existing UnitPresentationState progress. The initial visual composition remains at its actual source; skip/Instant and normal completion restore exactly the canonical destination composition. No second clock or animation engine was introduced.

Move, retreat, advance, breakthrough, fire, hit, destroyed, multi-attacker stagger and accepted supporting-artillery cues continue through the existing UA system. Presence remains pointer-inert and aria-hidden. Ghost cleanup, speed controls, reduced motion and Camera independence remain covered by the original suite.

## Visual evidence — SOFTWARE-RENDERED

These are production SVG Counter/Presence renderings over the actual production VS2 F3 cached world surface, rasterized with Skia and librsvg. **They are not real browser captures.** All pairs use identical terrain, camera crop, pixel scale and unit anchors. Each static panel is a 704 × 464 player-scale map crop with neighboring map context, not an isolated hex enlargement.

| Evidence | Coverage |
|---|---|
| `01-infantry-{plain,forest,hill,city}.png` | UA-003 / R1, Medium + Close, four real terrain backgrounds |
| `01-armor-{plain,forest,hill,city}.png` | Same matched matrix for armor |
| `01-artillery-{plain,forest,hill,city}.png` | Same matched matrix for artillery |
| `02-stack-{plain,forest,city}.png` | Two-unit stack with original Counter anchors, Medium + Close |
| `03-player-scale-lod.png` | Far / Medium / Close map crops |
| `movement-{medium,close}.gif` | Matched accepted MOVE on the canonical production map |
| `combat-{medium,close}.gif` | Three actual attackers, fire, hit/destroyed, accepted defender artillery support |
| `evidence-manifest.json` | Scene coordinates, accepted action/event traces, frame states and terrain accounting |
| `evidence-review-checks.json` | All three attackers + support fire verified; every sequence ends with zero active states |

Static scenes arrange real roster identities on canonical map hexes to compare terrain contrast; these are explicitly visual fixtures, not claims that those deployments were accepted. Animation scenes instead use accepted Core deployment, MOVE, ATTACK and COMBAT_REACTION actions. Both renderers receive the same states and time samples. Seed 8246 fixes that evidence battle only; no runtime RNG was changed.

Far / Medium / Close use projected hex widths of approximately 31 / 67 / 106 px, and Counter widths of 20 / 44 / 70 px. GIFs sample Normal playback every 20 ms, with 400 ms first-frame and 700 ms last-frame review holds; these holds are not game timing changes.

## Visual acceptance assessment

| Question | Software evidence assessment |
|---|---|
| Immediately distinguish infantry / tank / artillery at normal Medium scale? | Yes: spread human formation, solid hull/turret/tracks, open gun carriage/trails. |
| Models stand on the ground? | Yes: separate feet/track baseline, contact ellipses and a visible terrain gap from the Counter. |
| Clearly larger than UA-003? | Yes, in every matched Medium / Close panel. |
| Counter remains clear? | Yes: it is rendered above Presence; the actual Counter markup is byte-identical. |
| Forest and city readability? | Yes in the matched real forest and MAIN_CITY crops; dark/light planes and restrained rim remain visible. |
| Two-unit stack readable? | Yes in the inspected plain/forest/city and three-attacker scenes; two ground footprints remain distinct. |

## Validation

Before editing: exact baseline commit/tree verified, working tree CLEAN, typecheck PASS, build PASS, **356 / 356 baseline tests PASS**.

After editing: typecheck PASS, build PASS, **365 / 365 tests PASS**: 356 original + 9 new, none deleted or altered. New regressions cover inert presence, unchanged Counter markup/anchors and stack truth, silhouette bounds, canonical animation/skip/Instant end state, source-to-stack continuity through remount, no gameplay RNG or frame-time Core reads, real VS2 cache stability, and frozen file hashes.

`frozen-scope.json` verifies 506 frozen files, including all other runtime code, existing tests, Core, geometry, canonical map, Scenario, Counter mechanics, Camera, Combat UX2.1, localization, Startup Loading and VS2. Validation logs are in `validation/`.

`performance.json` records software DOM allocation/cleanup and module sizes, not device FPS. Actual terrain is built once for the full visual export; its build count stays at 1 and its image-draw counter stays at 1451 during all animation frames. Per active unit, the only additional frame work is a local ground-composition transform. No new RAF, particle canvas, model images or runtime dependency is introduced.

## Reproducing evidence

Build an untouched checkout of the baseline and retain its `dist` directory. Build R1, then run `node scripts/export-ua003r1-evidence.mjs <output-dir> <baseline-dist> <frame-dir>`. The exporter uses the existing test DOM and production renderers; Skia and sharp are provided by the host runtime through `CODEX_PRIMARY_RUNTIME_NODE_MODULES`, not added to game dependencies. Run `python3 scripts/animate-ua003-evidence.py <frame-dir> <output-dir>` to create the matched GIFs. Run `node scripts/measure-ua003r1-performance.mjs` and `python3 scripts/audit-ua003r1-scope.py` from the repository root for the accounting reports.

## Known issues / limits

- **browser manual validation pending**. No Huawei device or browser performance PASS is claimed. Close panels explicitly render at a 106 px projected hex width; whether a given viewport reaches that LOD remains governed by the unchanged Camera/LOD system.
- Dense neighboring occupied hexes can still overlap presentation footprints. Counter information always wins; the supplied three-attacker and two-unit stack cases have been inspected, not every possible deployment.
- The public GitHub Pages deployment remains UA-003. This deliverable is the R1 source checkpoint and review evidence.

No Core changes. No combat rule changes. No gameplay RNG changes. No startup loader strategy changes.

READY FOR LEADER REVIEW
