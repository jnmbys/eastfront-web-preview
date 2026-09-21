# EASTFRONT Performance Pass 1 — review checkpoint

Baseline Commit: `e9d7dc90bfe85fb6ce762c10fb675f43ef52bb9f`  
Baseline Tree: `ddf00ae09300ad435ec55ddcac7f23096796472d`

Source-only checkpoint. No deployment. R2 was not merged.

## Evidence status

**Production-module/software-DOM evidence, not real-browser or Huawei profiling.**
The requested real-browser profile-first gate is **not fully satisfied**: before editing,
we measured the baseline production modules and same-DOM behavior in Node. The complete
A–J comparison then re-ran the untouched authoritative baseline and candidate in isolated
instrumented copies. No browser frame-rate or touch-latency acceptance is claimed.

The A–J pipeline executes real intent/controller, PlayerView, renderer, fog and animation
modules on Strategic Reset F (640 canonical hexes), seed 8246, identical deployment,
27 initially identified units and identical camera inputs. Movement and three-attacker
combat are accepted Core actions. Instrumentation exists only in temporary compiled copies.
The runtime source SHA-256 inventory is stored with each JSON report.

The timed map pipeline excludes side-panel HTML, browser event queues, CSS/style/layout,
image encoding, GPU compositing and physical input-to-display latency. Fog uses its actual
RGBA raster algorithm with a software encoder stub. DOM counters use the test SVG adapter.
These CPU medians/p95 values are **not frame intervals or FPS**. Single-sample move/combat
rows are individual observations; their p95 is not a statistical tail estimate.

## Profile findings and primary bottlenecks

Before any source edits, the production-module probe found repeated PlayerView projection,
whole-DTO cloning/traversal, and recreation of 7,580 Presence nodes across 20 syncs of an
unchanged 27-unit DOM. The initial fog raster median was approximately 100 ms. The camera
already avoided Core, PlayerView, Fog and terrain rebuilds, but read layout on every move
and rewrote the zoom scalar during pure pan, unnecessarily waking the LOD observer.

## Optimizations and invalidation

- **Camera-only:** existing camera arithmetic, constraints and LOD thresholds remain frozen.
  Bounds refresh at bind/ResizeObserver; pan/pinch/wheel handlers contain no layout read.
  Pure pan leaves the zoom scalar untouched. Identical inline transforms are not rewritten.
  Rebind/pagehide cancels pending pan RAF and disconnects the old ResizeObserver.
- **Selection / combat draft:** `DynamicMapRenderer` retains Counter, proxy and Presence
  identity. Only changed unit selection/group attributes, canonical selected-face values
  and the interaction overlays update. Original model hit/keyboard routes remain, with
  a WeakSet preventing duplicate listeners on retained inputs. A full render adopts its
  initial model so the first selection can also use this path.
- **PlayerView dirty:** state identity or explicit `stateRevision`, viewer, rules identity,
  knowledge identity or `knowledgeRevision` invalidates one WeakMap entry per session.
  Accepted dispatch increments host-side revision. Cached views are detached and deeply
  frozen; they cannot be corrupted by a consumer. Import/replay code performing in-place
  host edits must increment the explicit revision. UI selection/camera/animation are not keys.
- **Browser model:** share the immutable detached view/map arrays; clone only mutable UI
  structures. Hidden-issue scrubbing still covers every issue-bearing UI structure.
- **Fog dirty:** immutable view identity + selected friendly Recon controls plan reuse.
  Existing mask-key/viewer/bounds rules, bounded masks and privacy clearing are retained.
  A single bounded world-ground cache stores public-map coverage and deterministic haze
  values; visibility distances still recompute. This has no enemy state or visual RNG.
- **Full canonical refresh:** new authorized view, locale, root or debug mode still uses
  the conservative dynamic-map rebuild. Accepted movement/combat therefore still remount
  the unit set. This is an explicit remaining limitation, not an incremental-update claim.
- **Animation:** unchanged scheduler, timing, accepted event/privacy sequence and canonical
  settle. Same-DOM sync reuses bindings/definitions; changed selection toggles one existing
  base ellipse. No new idle RAF or external assets. Animation frames touch active units.

## Before / after CPU comparison

| Operation | N | Before median / p95 ms | After median / p95 ms | projections | Presence remounts | fog builds |
|---|---:|---:|---:|---|---|---|
| A select friendly | 12 | 13.144 / 16.697 | 1.768 / 3.505 | 3 → 0 | 27 → 0 | 0 → 0 |
| B select combat target | 12 | 15.294 / 17.33 | 1.54 / 3.524 | 4 → 0 | 27 → 0 | 0 → 0 |
| C toggle additional attacker | 12 | 14.389 / 16.891 | 1.578 / 1.983 | 3 → 0 | 27 → 0 | 0 → 0 |
| D pan 60 pointermoves | 12 | 0.301 / 0.801 | 0.209 / 0.742 | 0 → 0 | 0 → 0 | 0 → 0 |
| E pinch 30 pointermoves | 12 | 1.137 / 1.727 | 1.321 / 2.093 | 0 → 0 | 0 → 0 | 0 → 0 |
| F zoom threshold + wheel | 12 | 1.086 / 1.85 | 1.179 / 2.975 | 0 → 0 | 0 → 0 | 0 → 0 |
| J Models Auto-Off-Auto | 12 | 0.971 / 1.247 | 1.1 / 1.659 | 0 → 0 | 0 → 0 | 0 → 0 |
| I viewer switch | 6 | 131.408 / 137.997 | 45.943 / 48.7 | 3 → 1 | 27 → 27 | 1 → 1 |
| G accepted move + H visibility change | 1 | 189.187 / 189.187 | 53.683 / 53.683 | 9 → 5 | 27 → 27 | 1 → 1 |
| movement animation frame | 24 | 0.033 / 0.102 | 0.035 / 0.134 | 0 → 0 | 0 → 0 | 0 → 0 |
| multi-attacker accepted combat | 1 | 58.703 / 58.703 | 48.246 / 48.246 | 16 → 10 | 26 → 26 | 0 → 0 |

Projection/remount/build columns show the first recorded sample; all samples, exclusive
action CPU, map-pipeline duration, DOM update, presentation sync, projection, fog plan/raster,
markup duration, render calls, allocations/removals/touched existing nodes and bounds-read
counts are in the JSON/CSV. Timing stages overlap; do not sum inclusive stages.

Camera pan/pinch/wheel record zero instrumented `buildCachedTerrainSurface` calls, zero
PlayerView projections and zero Fog raster rebuilds. This checks the production terrain
build entry point; it is not a GPU paint measurement. VS2 implementation is byte frozen.

## CSS and compositing audit

No CSS changes were made without browser/GPU evidence. Presence grounding uses small SVG
ellipses, Fog uses bounded world-space raster images (no per-hex filters), and model mode
already disables Counter filtering. Counter selection/target drop-shadows remain as before.
Their Huawei compositing cost is not measured in this checkpoint.

## Validation

- Baseline working tree CLEAN; exact commit/tree verified.
- Baseline typecheck/build PASS; **433 / 433 tests PASS**.
- Candidate typecheck/build PASS; **452 / 452 tests PASS**, **19 new**, zero deleted/skipped.
- Full test logs retained in evidence/performance-pass1.
- **139 frozen files** verified byte-for-byte: Core/vendor, geometry, map/scenario, unit
  stats, supply/victory/RNG, spotting/privacy semantics, startup/loader, VS2, localization,
  UA timing/artwork, compact plate and Camera arithmetic modules.
- Six baseline fog raster hashes (German/Soviet/Observer × fog/recon) match exactly.
- Regression coverage includes state/knowledge invalidation, accepted move freshness,
  selection identity, bounded group patches, duplicate listener prevention, hidden-unit
  absence, language/model-toggle cache stability, camera bounds reads, animation settle
  and no idle RAF. Existing stack routing and Combat UX tests remain intact.
- Historical hash manifests explicitly rebase authorized optimization files and the
  adapted VM test harness. The new frozen manifest independently locks untouched scope.
  No tests were removed to obtain a green result.

## Reproduction

Run `npm run typecheck` and `npm test` in the candidate. Build the authoritative baseline
in a separate worktree, then execute:

```
node scripts/profile-performance-pass1.mjs /absolute/baseline before.json
node scripts/profile-performance-pass1.mjs /absolute/candidate after.json
node scripts/profile-performance-modules.mjs /absolute/candidate
python3 scripts/audit-performance-pass1.py
```

## Known issues / remaining acceptance

- **browser manual validation pending; Huawei device performance validation pending.**
  Presented median/p95 frame intervals, browser long tasks and tap-to-selection paint
  latency are unmeasured. The 60Hz and <100ms acceptance targets are not certified.
- Fog first build remains expensive. A visibility-changing move still has a synchronous
  raster cost; the measured candidate move pipeline remains above a single 16.7ms budget.
- Accepted state changes retain a full unit refresh. Locale, panel layout and full privacy
  handoff paths also retain conservative remount behavior. Side-panel work is not profiled.
- The public-map fog cache adds three bounded Float64 arrays, at most roughly 9.4 MiB for
  the theoretical 640×640 raster; the actual scenario allocation is smaller.
- Pinch/LOD/model-toggle CPU results are broadly similar; no claim of GPU/FPS improvement
  is made from small timing differences. No functionality, model, fog or animation disabled.

No Core changes. No gameplay rule changes. No gameplay RNG changes.

**READY FOR LEADER REVIEW — implementation/software evidence only; real-device performance acceptance pending.**
