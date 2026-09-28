# ART-PREVIEW-002 — incremental acceptance / 2026-09-28

Status: isolated preview deployed; scoped layout/operation checks passed in actual iframe windows; full performance/device acceptance remains open.

## Immutable versions
- Management protocol read at 7c61fc727507a19801f7d5d4632bd17c540bf97d; Leader owns shared state.
- Original source 1f124566ef669fc50af93be7aaa34c7135b346d9; previous deployment bfacbb942274de37e9e6ea282931e7420499db2b.
- Initial incremental deployment 461d7034c297decf245aa845b6a895af57f94a86; https://30baba03.eastfront-web-preview.pages.dev .
- Corrected accepted-for-this-check deployment **8778cb4f307c3d01f471ac2b326f8beef4c5f500**, tree 633a4b39c154b126b93bca25ef9f9dd4beef680c.
- Actual final preview https://75a6305b.eastfront-web-preview.pages.dev . Cloudflare check-run success verified.
- Evidence-only child commit uses [CF-Pages-Skip]; resolve its full SHA from this file's containing commit. It does not replace the tested deployment or change any runtime file.
- Branch art-preview-001. No main/source-main changes, PR, Hook, backend publication or platform changes.

## Changes
1. Measurement dock starts collapsed (44px), expands into reserved 216px page space. It never overlays game controls; side panel retains its own scroll.
2. Candidate toolbar, header actions, native selectors and panel buttons/summary targets minimum 44×44 CSS px, regardless of coarse-pointer media query. Stack buttons use explicit contrasting fill/text; disabled buttons retain legible text plus dashed border.
3. Fixed iframe harness exposes actual innerWidth/innerHeight at 1024×768 and 1363×936. This is a real nested layout viewport, not image scaling; it is not outer-browser resize or Huawei acceptance.
4. Candidate no longer schedules unused Medium/Close texture prebuild. Its mountCachedTerrainSurface was already empty and both art modes draw SVG. First surface boot gate, loader, assets, errors/retry and cache remain. Baseline app/styles/loader unchanged; only the same measurement tool is installed for comparison. No SVG rewrite.
5. All candidate TypeScript source and preview instrumentation are tracked at task-source/ART-PREVIEW-002. Core/rules/protocol/AI/supply untouched.

## Verification
- Related existing art + MOVE001R1 runtime tests: 11/11. See targeted-tests.txt. They run against the exact minimally edited previously compiled JS, not a fresh compilation.
- node --check for changed JS and git diff --check passed.
- Source install npm ci --offline failed ENOTCACHED (ws). Full TypeScript compile NOT RUN. Compiled JS changes correspond to the scoped source scheduling removals; other compiled modules reused unchanged.
- Source JSON transfer initially changed line endings; full tree comparison found the one difference. Re-uploaded exact bytes, remote tree matched local before ref update.
- Bundle with exact remote commit objects saved and git bundle verify passed before each runtime push; first bundle also clone-restored. R1 bundle saved as ART-PREVIEW-002-R1.bundle (libfile_33d77396dc988191a5cf24f9eff00988). Normal handoff is Git, not that recovery bundle.

| Check | 1024×768 candidate | 1363×936 candidate |
|---|---|---|
| Local legal movement then switch | G-I01:0,10→1,10; confirm; direct G-I02 SELECT | Same chain passed |
| Same-hex disambiguation | G-I02→sidebar G-I01 passed | Same passed |
| Model display | Off→Auto→Off passed | Off→Auto→Off passed |
| Camera | Fit100% | Fit, zoom120%, drag passed |
| Battle close/history/reopen | B-000001 A3R retained | Same passed |
| Dice and explanation | 1 + 2 = 3, CRT requirements visible | Same visible |
| Panel scroll | scrollTop499 recorded while tools open | scrollTop255 / viewport794 / total1049 observed |
| Header/toolbar overflow | scrollWidth equals clientWidth | Same |
| Visible HTML button/select/summary minimum | no dimensions below44 found | no dimensions below44 found |
| Dock separation | footer bottom = dock top552 open | no overlap; separate reserved area |

The control-size audit excludes SVG map counters/hex targets. Far counters remain small; minimum44 does not mean all map units became44px. No changes to MOVE001R1 hit geometry. One-step route inspected; long dense-route occlusion not exhaustively tested.
Battle data still states actual per-unit losses/retreat details unavailable. No values fabricated; pending intermediate loss/retreat states remain outside this fixed CLOSED scenario.

## Same environment comparisons
Use viewport.html?w=1024 or 1363 &variant=baseline/candidate &scene=combat &models=off. Same seed17 fixture, Fit100%, identical viewBox and camera state; container dimensions differ by design. Dock collapsed in comparison screenshots.
- 1024 baseline/candidate: art002-final-1024-baseline.jpg / art002-final-1024-candidate.jpg.
- 1363: prefer art002-final-1363-baseline-full.jpg / art002-final-1363-candidate-full.jpg. Full-page images include the harness caption below the 936px-high iframe; no rescaling. Earlier viewport screenshots are retained but outer-browser dimensions changed to1341×921, clipping edges. Inner viewport measurements remained1363×936.
- Baseline at1024 visibly has crowded title/toolbar and38/42/36px controls; deliberately not repaired.

## Resource and timing evidence — limited claims
- Candidate measured147 resource entries, including20 terrain resources / 4,152,996 encoded bytes. Warm baseline snapshot154 entries,29 terrain resources /7,416,224 bytes and progressive detail still running; these are snapshot counts, not guaranteed final cache totals. Old candidate ART001 had73 terrain entries; measurement timings/cache differ. Clear conclusion: unused progressive work removed and fewer resources observed. First-surface cost remains.
- Candidate SVG node count remains roughly11k; baseline roughly1.7k. No inference that node count alone causes poor performance.
- First-visit candidate movement ready8712.9ms; first-visit baseline combat9025.4ms. Different scenes, no controlled cache clearing: NOT a valid cold-start speed comparison.
- Preheated same1363 combat/Off runs: baseline ready7197ms, candidate7145ms. Browser cache is a hint only; full startup CPU/GPU breakdown unavailable.
- Identical short drag path in same browser tab, tool open, five-second RAF: baseline293 intervals, mean17.0606ms,p9516.7ms,4 over33ms; candidate300,mean16.6628ms,p9516.7ms,0 over33ms. Not sustained5s stress, repeated-run statistics, GPU/paint or engine/network latency. Baseline complete JSON failed to remain in shared transfer; summary reproduced below from actual tool output; candidate raw JSON persisted. Do not treat missing baseline raw data as a fully reproducible performance result.
- Click-to-second-RAF examples at1024: path59ms, confirm87.3ms, switch68.3ms. This includes event/paint scheduling and is not authoritative action completion latency.

## Deployment byte verification
art002-final-integrity.json: actual origin75a6305b;761/761 served runtime files checked by UI-driven same-origin fetch + crypto SHA256, zero differences. Manifest SHA256 e39a0c9c4503a380b96177168d2a9bccbd7d9f50c85b4a7d83048a383fc012cb equals local.
_headers is Cloudflare platform configuration, not a served file; Git verified separately. First revision wrongly included it as HTTP content, giving1/762 difference. Its expected hash518240771936aaaa39b1e5c6b0a4e010808b4b06c21cbda9e425f377f26f2ef9, actual HTTP fallback13918d699741cb26ba61ecaf4b02911626363861f6b9885e9a18cb9ee7c0262a. Correction changed classification, not ignored a game-resource mismatch. Source/evidence are Git-verified and explicitly outside runtime manifest scope.

## Failures and remaining gates
- First1024 CSS hid the entire model label/select; fixed in8778cb4 and both sizes rechecked. First screenshot retained.
- Initial test command used wrong cwd; corrected and11/11 passed.
- One click arrived before fixture startup, locator deadline; inspected loading/ready state, then succeeded. Not silently counted as passed on first attempt.
- Direct parent-page contentDocument read unsupported in browser shim; used supported frame locator DOM reads instead, without bypass.
- Some screenshot/JSON writes did not persist through shared transfer. Full1363 screenshots recaptured and checked on disk; baseline RAF retains summary only. No claim all original raw logs survived.
- Not completed: controlled cold-cache test, full TypeScript compile, CPU/GPU profiling, sustained/frame-distribution study, outer-browser exact resize, Huawei touch/device acceptance, actual per-unit combat consequence fields, dense long-route cases. Supply remains suspended.

## Leader delta / next step
ART-PREVIEW-002 isolated usability fixes and scoped iframe acceptance complete; production replacement NOT approved. Record deployed8778cb4 separately from evidence child commit. Next: controlled cold/warm profiling and real-device acceptance when supported, plus functional Worker consequence fields. Do not remove first-surface startup protection based solely on these samples.
