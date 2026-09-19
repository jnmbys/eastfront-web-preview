# UI-009R2D1 Startup Resource Diagnostic / Compatibility Fix

Status: RELEASE BLOCKED — pending Huawei tablet real-device verification.

## Confirmed regression mechanism

UI-009R2 introduced a boot-time `preloadPlannedAssets()` phase that decoded all 83 unique Strategic Reset F terrain assets before Home and retained every decoded image in the cache until the complete static surface was drawn. The planned images represent about 50.875 MiB of decoded RGBA pixels; the 2541×2294 cached terrain canvas adds about 22.24 MiB before browser/GPU copies. Any single `HTMLImageElement.onerror` rejected the all-or-nothing preload and `boot()` replaced the specific failure with `Required production resources could not be loaded.`

The exact asset that failed on the already-deployed R2 Huawei run cannot be recovered retrospectively because the old production build discarded the asset URL/family/stage. The R2 code did not use `createImageBitmap`, `OffscreenCanvas`, or mandatory `HTMLImageElement.decode()`, so those APIs were not the direct cause of the original generic failure.

## Narrow fix

- Remove all-at-once terrain preload.
- Decode/draw assets on demand.
- Retain at most 16 decoded terrain images in an LRU; release evicted `ImageBitmap`s and release the cache after surface composition.
- Fetch each resource first so HTTP status is known.
- If supported, try `createImageBitmap(blob)` as an optional fast path.
- On failure/unsupported API, fall back to blob-backed `HTMLImageElement.onload`, then direct-URL `HTMLImageElement.onload`.
- `HTMLImageElement.decode()`, `OffscreenCanvas`, and `createImageBitmap` are not mandatory for startup.
- Add 15 s resource timeouts and exact startup diagnostics: stage, URL, asset ID, terrain family, HTTP status, preferred API chain, underlying cause and capability state.
- Preserve the existing cached Canvas renderer, deterministic surface plan, Core action flow, Geometry, P5R1 assets and UI-009R1 pointer/pan fixes.

## Desktop automation limitation

A single headless Chromium startup attempt was made after the fix. The container Chromium process did not exit within the 30 s budget and the outer command timed out; no repeat attempt was made. Typecheck, production build, targeted regression, production audit and static HTTP verification passed.
