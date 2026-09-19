# UI-009R2D2 Mobile Terrain Loader Request Fix — Leader Review Summary

Status: **RELEASE BLOCKED — pending Huawei tablet real-device verification**.

## Real-device evidence

Huawei tablet / Microsoft Edge on D1 reported:

- asset: `M01`
- family: `marsh_wet`
- stage: `fetch`
- fetch timed out after 15000 ms
- direct `HTMLImageElement(url)` fallback also timed out

The exact asset URL opened normally in a separate Huawei Edge tab. Therefore the asset exists, URL is correct, GitHub Pages serves it, and the device can decode/display it.

## Exact D1 request-lifecycle defect

D1 used `Promise.race(fetch(...), timeout)` without aborting the underlying fetch. When timeout won, the original request remained alive while fallback immediately requested the same URL. D1 also put `cache:'force-cache'` on the mandatory fetch path. This created an avoidable duplicate-request/cache/connection lifecycle on the affected mobile browser.

## D2 narrow fix

No renderer redesign. The cached Canvas surface remains unchanged.

1. Direct `HTMLImageElement(url)` + `onload/onerror` is primary.
2. A successful direct image load does not invoke fetch at all.
3. Fetch/blob/createImageBitmap is optional secondary fallback only after direct-image failure.
4. Secondary fetch uses `AbortController`; timeout calls `abort()` and clears its timer.
5. `cache:'force-cache'` is removed.
6. Direct image timeout clears handlers and clears `src` to avoid a hanging image request.
7. Detailed fatal diagnostics remain available if all supported paths fail.

## Validation

- TypeScript typecheck: PASS
- Production build: PASS
- Targeted regression: **29/29 PASS**
- Direct-image-success regression confirms `fetchCalls === 0`
- Fetch-timeout regression confirms `abort === 1` and active underlying requests return to `0` before control returns
- R1 pointer/tap/drag/pan and authoritative Core deployment tests remain PASS
- R2 deterministic cached-surface / build-once / pan-zoom reuse tests remain PASS
- Production audit: CLEAN
- Static HTTP: 123/123 runtime rasters HTTP 200, 0 missing asset 404

Release remains blocked until Huawei Edge and Huawei default browser pass startup, full terrain visibility, deployment, pan and zoom.
