# ART-PREVIEW-002 prepared
Management protocol read at 7c61fc727507a19801f7d5d4632bd17c540bf97d.
Base deployment bfacbb942274de37e9e6ea282931e7420499db2b; original source 1f124566ef669fc50af93be7aaa34c7135b346d9. No baseline switch.
Changes: candidate touch targets/contrast; reserved measurement dock in both variants for comparable instrumentation; fixed iframe window layouts; explicit UI integrity checker; candidate stops unmounted Medium/Close prebuild. First surface startup checks, retry/error paths remain. Baseline app/styles unchanged. No Core/rules/protocol changes.
Source: task-source/ART-PREVIEW-002/src plus styles and preview-only tooling.
Tests: 11/11 targeted art and MOVE001R1 tests against minimally patched existing compiled runtime, not a fresh TypeScript build. Initial command ran in wrong directory and failed; corrected command succeeded. npm ci --offline failed ENOTCACHED(ws); full TypeScript compile NOT RUN. Browser increment checks pending at this checkpoint.
Terrain dependency finding: mountCachedTerrainSurface is empty in original art candidate; both ink/relief are SVG. First cached surface still gates boot and startNewGame. Only continueAll scheduling removed; no fallback assets deleted. cachedTerrainSurfaces and loader retained. DOM node growth not rewritten.
Rollback: return preview branch to previous content using a new reverting commit, never force push; old immutable preview remains https://1b617ef1.eastfront-web-preview.pages.dev .

Incremental browser findings at 461d703: actual iframe1024×768, movement/stack switching passed; dock reserves space and visible targets >=44px. Narrow CSS accidentally hid model selector; corrected by hiding only animation label text, keeping model label/select visible. First integrity scan includes reserved _headers; now classify as Git-verified platform config, not served resource. Initial failed scan retained.
