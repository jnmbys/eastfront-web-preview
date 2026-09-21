# EASTFRONT FOW-002 — Strategic Fog Visuals & Spotting Readability

Status: READY FOR LEADER REVIEW. Browser manual validation pending.

Baseline commit: `887132ba162b92def89154d6ccb3907e27279613`

Baseline tree: `7031425e93511c480d06a39c91fd2a4222188be8`

## Architecture

`authorized PlayerView → deriveFogPlan → cached bounded raster → world-space SVG image`

The fog surface receives only PlayerView, the selected unit ID, and the presentation speed. It does not receive authoritative enemy state. Public map geometry locates the mask; PlayerView's current contact/observation hex set determines its clear region. Observer has no veil. Existing FOW-001 projection still removes HIDDEN units before Counter, Presence, panels, and animation receive information. Fog is not the privacy mechanism.

The image sits above static map presentation and below dynamic units. It follows the existing SVG camera transform. The selected friendly Recon can add a restrained brass observation-boundary preview using the same centralized spotting configuration. No new spotting parameters or UI settings were introduced: ordinary identify radius 1; Recon identify radius 2, contact radius 3.

## Material and edge

A cool blue-grey translucent veil reduces the saturation and contrast of known but unobserved terrain without changing VS2. Its nominal opacity is 0.47. Cities, roads, railway and rivers remain visible. Clear regions use continuous distance to observed canonical centers, 48 world-unit feathering and restrained deterministic two-scale world noise. There are no individual fog hex polygons or per-hex filters. Existing strategic grid lines remain visible; they are not fog boundaries.

Fog raster resolution is bounded to 640 pixels on the longest axis. The SVG image interpolates that field at the existing world-space bounds. Mask generation uses deterministic integer hashing, never gameplay RNG.

## Update and privacy behavior

Visibility truth changes immediately. Only the veil crossfades for 220 ms on same-viewer observation changes. New Counter/Presence information uses the new PlayerView immediately; hidden units and animations are not retained for the fade. Viewer changes clear former-viewer fog cache and images immediately, with no crossfade. Existing hotseat privacy handling remains authoritative.

Normal rendering uses one fog image; a transition temporarily uses two, plus at most one selected Recon preview. Caches are bounded to three entries. Selection changes reuse the main mask. Unchanged observation sets, camera changes and language changes do not rebuild it. No idle RAF, terrain redraw, per-frame Core query, or per-frame GameState clone is added. Skip, Instant, reduced motion and page hide settle the transition. Remounts reuse cached images and clean old transition listeners.

## CONTACT and LAST KNOWN

CONTACT is a compact intelligence badge with a question mark and abstract formation dots/chevrons. It contains no NATO type, unit ID, damage, stats or supply information.

LAST KNOWN uses a lower-opacity dashed outline and clock symbol, with the existing localized last-seen-turn label. It is visibly distinct from a current contact. Neither marker gains a gameplay hit target. Memory remains the unchanged FOW-001 projection; hidden movement does not update its last-known position.

No new player-facing strings were required. Existing zh-CN/en-US labels and Chinese default remain intact.

## Validation

- Initial working tree: clean; baseline commit/tree matched exactly.
- Baseline typecheck/build: PASS. Baseline tests: 394/394.
- Final `npm run typecheck`: PASS.
- Final `npm run build` (also run by `npm test`): PASS.
- Final tests: 412/412; 18 new, no deletions or skips.
- `git diff --check`: PASS.
- New regressions cover authorized input, absent hidden units, deterministic masks, edge alpha, bounded nodes, caching, transitions, viewer purge, recon reuse, marker privacy, historical memory, hidden animation filtering, camera/RNG isolation, accepted movement and frozen modules.
- Existing camera/language VM test now includes the real fog synchronization dependency; its assertions are preserved.
- Existing frozen fingerprint manifests were refreshed only for permitted main/render/CSS integration and dependent manifest digests. A new 137-file baseline audit locks Core, FOW-001, UA, Camera, startup and VS2 modules outside those integration files.

## Evidence

All images and GIFs are **software-rendered**, not real browser captures. They use the real production VS2 F3 terrain builder, production Counter/Presence and projected player views on the canonical map. The real roster is deliberately arranged to expose each visual case. Movement uses an accepted Core MOVE and the existing UA animation runtime. GIF fog opacity samples the same 220 ms ease-out transition; it is not browser CSS capture.

| Review item | Evidence file |
| --- | --- |
| Full German / Soviet maps | `01-full-german.png`, `01-full-soviet.png` |
| Observer baseline and same-camera comparison | `01-full-observer.png`, `02-matched-three-views.png` |
| Soft boundary | `03-visible-fog-edge.png` |
| Forest / city | `04-forest-fog.png`, `05-city-fog.png` |
| River and railway through veil | `06-river-railway-fog.png` |
| Selected Recon and ordinary/Recon comparison | `07-recon-selected.png`, `10-spotting-comparison.png` |
| Current CONTACT / historical LAST KNOWN | `08-contact.png`, `09-last-known.png` |
| Movement reveal / fog return | `11-move-reveal.gif`, `11-move-return.gif` |
| Immediate viewer replacement | `12-viewer-switch-privacy.png` |
| Counts, accepted action and privacy assertions | `evidence-manifest.json` |

Production terrain build count is 1 before and after all evidence frames; terrain draw count is 1451. Hidden Counter and Presence node counts are zero in both player views. These are software-run observations, not Huawei performance measurements.

Reproduction: build, then run `node scripts/export-fow002-evidence.mjs <output-directory>` in the evidence environment with `sharp` and `@napi-rs/canvas` available. These are development evidence tools, not browser startup dependencies.

## Acceptance answers from software evidence

1. Unobserved territory is visibly fogged: yes, cooler and lower contrast than current observation.
2. Terrain/cities/railways remain recognizable: yes, inspected on production forest, city and transport crops.
3. No hard hex fog edge: yes; the soft continuous contour is distinct from the unchanged map grid.
4. Visible and fogged regions differ clearly: yes in matched full-map and close-up views.
5. CONTACT differs from a formal unit: yes, uncertainty badge without NATO/stats.
6. LAST KNOWN differs from a current unit/contact: yes, dashed clock marker.
7. Recon has visible intelligence value: yes, larger observed footprint and optional selection emphasis; current parameters remain unchanged.
8. Hidden units/animations are not leaked: automated projection/render/privacy regressions pass; software evidence contains zero hidden unit nodes.

## Frozen scope

No Core combat, CRT, odds, RNG, Geometry, scenario map, unit stats, Supply, Victory, Camera mechanics, Counter mechanics, Combat UX rules flow, startup loading strategy, UA timing/art/grounding or VS2 source changes. No AI, multiplayer or deployment work.

Changed production files are limited to `src/fog/surface.ts`, `src/fog/runtime.ts`, fog integration in `src/main.ts` and `src/render/coreSvg.ts`, marker presentation in `src/render/contactMarkers.ts`, and six appended CSS lines. Tests, evidence generator and this review document accompany them.

## Known issues and follow-up

- **browser manual validation pending**: actual pan/pinch, handoff, transition smoothness and Huawei hardware performance have not been claimed as passed.
- Bounded raster resolution trades extreme-close edge detail for tablet cost. Software crops are readable; real-device evaluation remains needed.
- GIF palette quantization can produce minor haze dithering absent from PNG evidence.
- Spotting balance is unchanged; the ordinary/Recon comparison is evidence for review, not a balancing decision.

No Core combat changes. No gameplay RNG changes. No Camera changes.
