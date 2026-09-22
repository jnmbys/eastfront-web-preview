# EASTFRONT PERF-002 — Deployment Stutter checkpoint

Deployment: **Not deployed.** This branch is for review/integration only. Neither source-main nor Pages main is updated.

Baseline: `e025b16d8ee2a25e89d6032ecf3d312cfb6f116b` / tree `49d4bb30d24b34d8694d6e468546394359207753`.
Branch: `perf-002-deployment-stutter`.

Remote source-main was fetched before work and still pointed to the deployed Safari + MP-003 integration. The independent branch starts from that formal source commit, without reimporting either earlier repair branch. Existing clean worktrees were retained.

## Root cause and limits

Measurements support redundant work in the shared deployment presentation path:

1. `refreshDynamicView` regenerated all location cards (575 Soviet positions), and `deploymentLocations` and `renderDeploymentZone` repeatedly scanned the 640-hex array for each position.
2. `DynamicMapRenderer` treated each new PlayerView identity as a reason to replace the entire dynamic map layer, including already-present unit Counters and deployment zone polygons.
3. `bindDynamic` scanned/bound controls for unrelated combat/movement stages during deployment. Reusing deployment polygons/cards requires binding them only once.
4. The network confirmation handler ran a complete refresh immediately after submitting the intent and ran another on the authoritative snapshot. MP-003 already eliminated deployment queries; the measured query/resync counts remain zero.

These are measured production JavaScript paths and structural DOM churn, not proof that they explain every physical-device frame stall. No Safari, Render-region or cold-start cause is asserted. Fog changed once per acting-player deployment as observation legitimately expanded, with zero waiting-player raster rebuilds; static Terrain was not rebuilt. Neither was suppressed or delayed by this fix.

## Minimal changes

- `src/main.ts`: use the retained deployment location renderer, a deployment-only binding path, one-time bindings for retained nodes, and network pending status without a redundant pre-snapshot refresh. Full remount/resync clears the location cache. Camera functions and combat action routing bodies remain unchanged.
- `src/ui/deploymentPanelRenderer.ts` (new): retain one mounted location section; update authorized occupancy and latest selection. The small panel shell/roster still refreshes normally, with existing scroll restoration.
- `src/ui/commandPresentation.ts`: build terrain/occupancy indices once; location-card markup remains equivalent.
- `src/render/coreSvg.ts`: index deployment hexes once and expose the unchanged canonical hit-target builder.
- `src/render/dynamicMap.ts`: reconcile only changed deployment Counters/hits, preserve canonical stack order, retain identical overlays, and remove identities absent from the new authorized model. Other phases retain the previous update path.

Cache scope is one panel and session owner, with viewer/controller/phase/active side/locale/unit type/zone order/terrain dependencies. Each update reads the current authoritative model and patches occupancy/selection from it; it does not reuse an old revision's unit data. Existing network revision/sequence checks remain untouched. Session/viewer/phase changes, full remount and reconnect resync invalidate the relevant cache. No full GameState is introduced into the network client.

Existing Unit Presence/model artwork lifecycle is unchanged. It still remounts Presence artwork when the set of Counter bindings changes; this remaining allocation is recorded, not claimed fixed. Local auto-selection can replace one formerly selected Counter. Quality, Fog, models, rules, legal validation and knowledge timing are unchanged.

## Before / After

Same host: Node v24.19.0, AMD EPYC 9V74. Same production map, deployment order, medium LOD, Models Auto, camera zoom 1.8/pan (94,-61). **Software DOM has no CSS viewport/layout/paint/GPU.** It executes built main handlers with production projection/Fog/renderer modules. Terrain initialization is excluded; static map mounted first. PNG encoding is stubbed, Fog planning/raster calculation is real. Animation callbacks are queued by a software clock; no animation-to-pixels result is inferred.

For each build: 2 warm-up deployments + **10 measured sequential deployments** for local, network actor and network waiter. The network pair uses actual loopback WebSockets and the existing authoritative runtime, with **no simulated link delay**. Measurements run sequentially, not alongside the full suite. Baseline and candidate use the same diagnostic script/helper; timing wrappers operate only on temporary copies. Raw rows and module hashes are in `before.json` / `after.json`.

All times below are milliseconds, **median / maximum**. Stage times are inclusive and must not be summed together. The 10-sample median averages the middle two values.

### Synchronous refresh work per deployment

| Mode | Before | After | Refresh count |
| --- | --- | --- | --- |
| 单机 | 193.3 / 210.6 | 105.6 / 126.9 | 1 → 1 |
| 多人操作方 | 261.4 / 306.2 | 104.1 / 124.6 | 2 → 1 |
| 多人等待方 | 8.6 / 9.8 | 8.7 / 10.5 | 1 → 1 |

The waiting viewer has no meaningful timing improvement. Its small panel/Fog-plan work remains. No overall device-fluidity claim is made.

### DOM churn (median per deployment)

| Mode | Created nodes | Removed Counter nodes | Reused Counter nodes |
| --- | --- | --- | --- |
| 单机 | 4697 → 527.5 | 6.5 → 1 | 0 → 5.5 |
| 多人操作方 | 9004 → 473.5 | 6.5 → 0 | 6.5 → 6.5 |
| 多人等待方 | 310 → 245 | 0 → 0 | 0 → 0 |

Actor-side values count both baseline refreshes. Node counts include helper fragments, panel and map nodes. Existing nodes reused during the redundant baseline pending refresh do not imply they survived the subsequent snapshot; baseline removed all prior Counters on that snapshot. All raw per-refresh counts are available.

Terrain rebuilds: **0 → 0** in all measured modes. Fog raster rebuilds: **1 → 1** for local and actor; **0 → 0** for waiter. Necessary Fog raster CPU did not improve and sometimes measured slightly higher; it is outside this repair's changes.

### Early vs later units

Median synchronous refresh, measured deployments 3–7 versus 8–12:

| Mode | Early before → after | Later before → after |
| --- | --- | --- |
| 单机 | 187.6 → 96.4 | 193.9 → 115.2 |
| 多人操作方 | 255.8 → 98.9 | 273.9 → 110.4 |
| 多人等待方 | 7.7 → 8.2 | 9.2 → 8.8 |

### Synchronous callback proxy

Maximum-duration callback within each deployment (local click or network submit/message application), then median / maximum across samples:

| Mode | Before | After |
| --- | --- | --- |
| 单机 | 227.7 / 244.2 | 142.7 / 168.0 |
| 多人操作方 | 222.1 / 259.3 | 127.6 / 149.8 |
| 多人等待方 | 12.8 / 13.9 | 13.4 / 14.8 |

These are **software callback durations**, not browser Long Task entries. The adapter's selector/event/parser overhead is not representative of browser native DOM cost. Real longest main-thread task, frame intervals, layout, painting, GC pauses and confirmation-to-visible-pixels are **NOT MEASURED**. The script's elapsedMs is only click → updated software DOM/revisions/ready proxy; network completion waits for both clients and includes polling/measurement overhead. No requestAnimationFrame callback is treated as proof of a presented frame.

### Network observations

| Measurement | Before | After |
| --- | --- | --- |
| 操作方观察到的 send → ACK RTT | 123.1 / 138.0 | 59.1 / 65.5 |
| Server receive handler（含规则与双方投影） | 29.7 / 33.0 | 32.8 / 40.7 |

The same-process loopback RTT includes client event-loop blocking and server work; its reduction is not a faster Internet link or a public latency result. Server processing shows no improvement. No client/server wall clocks are subtracted to estimate one-way latency.

## Validation

- Client + server typecheck: PASS (`typecheck.log`).
- Client build: PASS (`build.log`).
- Server build: PASS (`server-build.log`).
- Full suite: **558/558 PASS**, 0 skipped/cancelled (`full-tests.log`).
- Included: Performance Pass 1, deployment, FOW-001/FOW-002, MP-001/MP-002/MP-003, Safari loader, Startup, VS2, local Scenario, combat, camera, models and RNG/seed regressions.
- Five focused new tests: retained cards match canonical fresh markup; latest selection/occupancy/type/locale; session/viewer/phase/terrain/resync invalidation; canonical stack/hit ordering with unrelated Counter identity preservation; actual main-handler full 32-unit deployment/phase handoff; invalid stacking and no phantom/latest-intent behavior.
- Measurement harness additionally asserts 12 sequential real-WebSocket deployments per side of the comparison, one SUBMIT_ACTION despite duplicate click, no optimistic unit before a snapshot, matching phases/revisions, exact own positions and zero enemy units/DOM for waiting side. After measurements, disconnect/reconnect restores the current revision, replaces the retained card cache, and accepts a 13th deployment. Zero QUERY_MATCH and zero unexpected RESYNC_MATCH throughout.
- Existing MP regressions retain duplicate request-id idempotency, actual sequence-gap recovery, stale/reordered message handling, privacy, reconnect, and complete Scenario/combat behavior.
- Existing tests' assertions are unchanged. Three VM fixtures now import/inject the new renderer. **17 explicit frozen-hash entries** updated in six manifests, including two nested-manifest dependencies. See `frozen-hash-review.json`; no blanket regeneration.
- `scope-audit.json`: 165 protected baseline files byte-identical; Camera handlers identical; server/Core/FOW/protocol/Safari loader/MP-003 modules unchanged.

## Browser and physical-device boundary

Cloud Chrome could not open the local preview: `net::ERR_BLOCKED_BY_CLIENT`. Its exposed browser interface did not provide a performance-trace export capability. This repair has **no real-browser before/after performance trace**, and no physical Safari/iPad/Huawei acceptance. All are **PENDING**, not PASS. Prior production smoke from the integration task and prior MP-003 simulated-delay figures are not reused as PERF-002 evidence.

For follow-up browser acceptance, serve the baseline and candidate locally with the same viewport, Models Auto and device/network, finish terrain startup, warm up two deployments, then record at least ten identical deployments with DevTools/Web Inspector Performance. Record local and both multiplayer clients separately. Keep long-task/paint/frame observations distinct from request/response timing. Verify final deployment, privacy handoff, reconnect and panel/camera retention. This checkpoint deliberately does not deploy production to obtain that evidence.

## Reproduce

From each source tree build client/server normally. From this checkpoint run:

```sh
npm run typecheck
npm run build
npm run server:build
node --test tests/*.test.mjs
node scripts/measure-perf002-deployment.mjs /path/to/built/baseline before.json
node scripts/measure-perf002-deployment.mjs . after.json
```

The comparison script uses this checkpoint's unchanged server runtime for both measurements and the specified source tree's built client. Logs contain counts, types and durations, never reconnect tokens, full GameState or hidden payloads. Absolute milliseconds can vary with host load. No cross-player cache or network protocol is added.

## Remaining issues

Physical-device stutter is not certified eliminated. Necessary Fog raster work, unchanged Presence remounting and small panel updates remain. Waiting-client CPU did not materially improve. Browser layout/paint, GC and frame intervals require actual traces. Movement clicks on friendly-occupied hexes and combat dice presentation remain separate tasks. No Supply, HQ, Cavalry, AI or Industry was added.

No Core rule changes.
No gameplay rule changes.
No FOW privacy changes.
No MP protocol changes.
Server authority preserved.
Safari and MP-003 fixes preserved.
