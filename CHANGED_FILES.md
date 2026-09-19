# UI-009R2D2 Changed Files

Source changes relative to UI-009R2D1:
- `src/render/terrainSurface.ts` — direct URL image primary; AbortController-backed optional fetch fallback; remove force-cache; cleanup image timeout lifecycle.
- `src/web/preview.ts` — build label UI-009R2D2 only.
- `tests/ui009r2-startup-loader.test.mjs` — update D2 loader expectations.
- `tests/ui009r2d2-loader.test.mjs` — direct-image/no-fetch and abort lifecycle regressions.
- `README.md`, `LEADER_REVIEW_SUMMARY.md`, `docs/UI009R2D2_LOADER_REQUEST_FIX.md` — D2 evidence/documentation.

Production deploy delta relative to D1:
- `app/render/terrainSurface.js`
- `app/web/preview.js`
