# Drag responsiveness repair

Baseline runtime: `41717e84152902b2dd8dbf9e5b8ef5e8ef1f0cfc`. Same preview service, game rules, authority, transport, visitor isolation and save format. No hardware/tier change.

## Confirmed code path

`applyMapViewport` called the city, battle/force/arrow and industry painters on every pan animation frame, even when only translation changed. Those paths build strings, regroup forces and read screen matrices/bounds after style writes. Existing pointer protection only deferred `refreshDynamicView`, not these painters. City detail jobs and zoom observers could also run during gestures. Paint-time inspection gates repeatedly built render models just to read the viewer controller ID.

## Fix

- Drag applies the existing canvas/SVG transforms only. Pure translation needs no battle/force/arrow regrouping.
- Viewport-dependent detail/culling work is coalesced after 120 ms of gesture inactivity. Zoom work is retained, not discarded. Pending authorized-state presentation uses the latest received state once, not intermediate paints. Receipt processing, authorized-state application and world time are not paused.
- Pinch changes coalesce into animation frames. Final coordinates are flushed before pointer removal. Cancellation/focus loss cannot leave a phantom pinch or send a map click.
- City detail jobs pause during interaction. Terrain LOD mounting waits for settled zoom. Terrain and city assets are preserved; no reduced-detail replacement map.
- Interaction permission checks read the existing controller ID directly, while retaining live privacy/mode/command-target checks.

## Evidence and limitations

`node experiments/grand-release-tablet/map-drag-check.mjs` executes the old and new production viewport bindings and real gesture math in a deterministic event/clock adapter. It is **not a browser renderer or tablet FPS measurement**. For 120 moves at 16 ms intervals:

| Work | Before during drag | After during drag | After stopping (candidate) |
|---|---:|---:|---:|
| City viewport paint | 114 | 0 | 1 |
| Battle/forces/arrows paint | 114 | 0 | 0 |
| Industry viewport paint | 114 | 0 | 1 |
| Canvas/SVG transform writes | 230 | 230 | 0 additional |

Same final pan/zoom and aligned surfaces. Also passes burst pinch, wheel idle, latest-state paint, cancel, focus loss, tap and disposal cases. Existing camera interaction regression: 7/7 pass, including pointer anchor, next tap and legacy zoom cap. TypeScript and release build pass. Existing delayed HELLO/reconnect/durable save check passes (650 ms delayed handshake). No authority simulation code changed.

Browser-control inventory returned a connector fetch error; binding the existing game tab timed out after 40 seconds. No alternate browser-automation channel used. Actual Huawei drag smoothness remains unverified; no FPS/speedup claim. Newly exposed city detail may refine after the finger stops. The 120 ms wait is visual only.

## Release / rollback

Ship on the existing `eastfront-grand-preview` Render service by fast-forwarding the preview branch, setting the pinned `RELEASE_SOURCE_SHA`, and retaining all other environment variables and disk. Verify `/release/info` and served module hashes. Existing signed visitor cookie and persistent saves must be retained; users refresh and continue, not clear cookies/new-game.

Rollback to runtime `41717e84152902b2dd8dbf9e5b8ef5e8ef1f0cfc` through its prior Render deploy if necessary. No save conversion. Existing local services and user progress untouched.

## Live verification — 2026-10-09

Render deploy `dep-db47fj5g1s2s738h0gkg` is live at runtime `bdb3384e12bf2b98d7b7c135b9b5e55ab1f27e28`. Both fix and preview branch remote SHAs verified. `/release/info` reports the exact source, unchanged rules/save version and a clean build. The live main, viewport scheduler and city renderer modules compare byte-for-byte with locally built modules; all return revalidation cache headers. The online build manifest is retained in `live.json` (whole-manifest local/cloud hash equality is not claimed).

Actual production transport Client in a Node HTTPS/WSS adapter, using the existing separate test visitor: authorized route preview, DIRECT intent accepted in 797 ms, durable SAVE and paused reconnect retaining that exact intent all pass. This is command acceptance/persistence, not a completed march or graphical drag test. User campaign was not opened or manipulated. Initial probe stopped before any action because its copied expected-version constant was stale; corrected to the deployed full SHA before this successful run.

The graphical browser channel remains unavailable. User should refresh the existing URL and continue the existing campaign, retaining the visitor cookie. No claim that physical-tablet dragging has been validated.
