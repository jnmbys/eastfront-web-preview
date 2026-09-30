# ART-POLISH-009

Base `56477d3131ed62bf05cd03db87838fe4cba8da15`; independent `art-polish-009`. No deployment.

```sh
npm ci --prefix task-source/ART-PREVIEW-002
node experiments/art-polish-009/build.mjs
node experiments/art-polish-009/validate.mjs
CHROMIUM_PATH=/path/to/chromium node experiments/art-polish-009/check.cjs
python -m http.server 8769 --directory experiments/art-polish-009/dist
```

Browser check requires Playwright in the environment. Open http://localhost:8769/. Default is 009; toggle compares unchanged 008. Public map and 58 visual fixtures only, no match/backend. Near 500%, medium 300%, X14 camera matches saved 007/008 views. Only original eight cells changed. Existing building/church imagery is decorative, adds no game function.

Source: artDiorama.ts, dioramaLayout.ts, dioramaTerrain.ts. Lighting is prepared in small offscreen tiles once when rendering terrain, not computed per interaction frame. Four input image assets unchanged. Build resolves static dependency closure; generated dist is ignored.

Evidence: ../../evidence/ART-POLISH-009/REPORT.md, screenshots, semantic-tests.json, browser-results.json, cost.json, runtime-manifest.json. 007/008 original comparisons remain under ../../evidence/ART-POLISH-008. No new whole-game or performance acceptance.
