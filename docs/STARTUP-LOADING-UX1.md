# EASTFRONT Startup Loading UX Pass 1

Baseline commit: `cd360123402deb4b0c8520cbc861a6268b27b9ed`
Baseline tree: `59332aa20e33c151ef93226ab29e52d07e5da434`
Baseline working tree: CLEAN.

## Scope and architecture

Startup feedback only. The production map/manifest promises still start together,
then the same fixed-seed terrain session and VS2 hook are created. The existing
far → medium → close cache loop retains its order, arguments, awaited boundaries
and final medium cache selection. NEW GAME retains its independent fresh seed.

`boot / successful image load / existing VS2 batch boundaries → read-only notifications → StartupProgress → small Loading DOM updates`.

The notification bus never receives GameState or decoded image objects. Observer
exceptions are isolated from the loader. Success notifications return the exact
same image object, preserving release behavior. The subscription is removed on
both successful startup and failure. Startup has no dependency on the UA-001
queue, timing, speed, skip or reduced-motion runtime.

## Honest progress sources

| Display | Actual source |
| --- | --- |
| Horizontal bar and “Startup steps · n / 6” | Resources ready; render model and VS2 hook ready; far cache; medium cache; close cache; successfully generated home markup |
| Current asset batch `loaded / total` | Existing selected world material IDs, forest asset IDs, city asset IDs; their actual array lengths |
| Assets loaded, without denominator | Completed loader calls when infrastructure branches make the total unknown |
| 100% / Ready | All five loader milestones complete and home markup generation succeeds |

The bar measures completed startup steps, **not** byte transfer or elapsed work.
No weighted overall percentage or ETA is invented. Only final success is labeled
100%. Asset counts are successful load/decode operations, including repeated
loads across LODs; they are not a claim that every manifest entry is requested or
that every operation is a unique file. No hardcoded 79-item denominator is used.

Loading stages are Initializing game → Loading map assets ↔ Building battlefield
(for the existing cache passes) → Ready. Resource failure uses the existing fatal
screen, diagnostic formatting and Reload action. It never reports success.

## Before / after

Previously the app root was empty until the main module graph executed, then a
static Loading message remained until HOME. The build now embeds localized
Chinese Loading markup in HTML. A small independent shell restores the existing
language preference and control while main modules load. The main script stays
in its original entry position after that shell; it is not dynamically imported
or rescheduled by the shell.

During work, labels and real counters update in place. Six completed milestones
advance the bar monotonically. Once the final HOME markup is ready, two UI-only
requestAnimationFrame callbacks allow one paint of true 100% before HOME mounts.
They do not delay resource requests, change loader timeouts or drive simulated
progress. Language switching retains the current progress state.

## Localization and performance

All new loading text uses the existing zh-CN / en-US catalogs. Chinese remains
the build-time default; saved English preferences are restored by the lightweight
shell. Core localization architecture is unchanged.

No new images, canvas scene, WebGL or per-frame terrain work. Updates touch only
small text nodes, ARIA values and one CSS transform. A 180ms ease-out transition
approaches actual milestone targets without overshoot. A subtle opacity pulse
indicates activity without advancing the bar. Reduced motion disables both.
Unknown totals remain unknown. Synchronous VS2 CPU work is unchanged: its phase
can be shown at boundaries, but it cannot emit intermediate CPU progress while
the main thread is occupied. There is no artificial timer-based progress.

## Validation

- Baseline: 285 tests, 285 PASS.
- Added: 16 tests. Final: 301 tests, 301 PASS, 0 fail, 0 skipped.
- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `npm test` (all existing tests retained): PASS.
- `git diff --check`: PASS.
- Baseline source hash guards verify loader and VS2 generation differ only by
  observer imports/calls; direct image, fetch/blob fallback, bitmap fallback,
  timeout/cache and failure semantics remain intact.
- Runtime VS2 observer on/off comparison checks identical resource order, draw
  trace, generated pixel data and surface statistics.
- Existing seed, Combat UX2.1, camera, Counter V2, localization and UA-001 tests
  remain PASS. The session adapter and UA-001 modules are byte-identical.

Evidence is in `evidence/startup-loading-ux1/`; new coverage is in
`tests/startup-progress.test.mjs` and its baseline hash fixture.

## Manual validation / known limits

**browser manual validation pending**. The available cloud browser environment
rejected a loopback preview listener with EPERM. No real browser visual PASS,
Huawei device PASS or measured 300–500ms first-feedback PASS is claimed.

The static HTML feedback precedes all game module execution. Absolute time to
first paint still depends on document/CSS delivery and the device. CPU-bound VS2
operations remain synchronous to preserve their established behavior.

Leader manual checklist: cold slow connection (default Chinese and saved English),
visible initial feedback, changing batch counts/stages, final 100% → HOME,
language switching during loading, fatal-resource behavior, and UA-001 controls
after NEW GAME. Confirm on Huawei hardware before accepting the timing target.

No Core changes. No RNG changes. No loader strategy changes. No gameplay changes.
