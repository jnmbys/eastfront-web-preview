# UI-009R2D2 Loader Request Lifecycle Fix

D1 real-device failure identified `M01` (`marsh_wet`) timing out at the mandatory fetch stage. The same direct asset URL worked in a separate Huawei Edge tab.

D1 code defect: a `Promise.race(fetch, timeout)` timeout did not cancel the fetch. The direct image fallback then issued another request for the same URL while the timed-out fetch could remain active. `cache:'force-cache'` was also used on that mandatory fetch.

D2 makes direct URL `HTMLImageElement.onload` the primary path. Fetch is optional secondary fallback only, uses `AbortController`, and removes `force-cache`.

No changes to Core, Geometry, scenario/map, P5R1 assets, cached Canvas architecture or VS2.
