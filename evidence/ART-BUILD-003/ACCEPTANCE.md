# ART-BUILD-003 handoff

- Task: ART-BUILD-003; source/evidence branch: art-build-003.
- Management: 4f891f50eb7ae008890418b87d6fcef92b03526c (PROJECT_STATE and WORKER_PROTOCOL read).
- Source/build commit: 75e39c7e164f7c23e46be597d10f83b8e8098299, remotely available, [CF-Pages-Skip].
- Source base: 040b4988b9d47efa761f3bb93039ea8940723871; accepted runtime comparison: 8778cb4f307c3d01f471ac2b326f8beef4c5f500.
- New runtime deployment: 6fac36a0c5e0e77ee15c3a02ecb2bebd4dcabb04 on art-preview-001. Cloudflare check 108974052537 completed success.
- Actual immutable preview: https://2ccb0505.eastfront-web-preview.pages.dev
- Verified browser URL: https://2ccb0505.eastfront-web-preview.pages.dev/viewport?w=1363&variant=candidate&scene=combat&models=off

## Build closure

See BUILD.md for exact commands. Fresh clone of 75e39c7e, normal locked npm ci, frontend typecheck, formal build and all 11 tests succeeded (clean-checkout.log). Worktree remained clean because temporary vendor/dist/node_modules are ignored. Full 380-file generated hash inventory matches first rebuild exactly. No cache-only dependency workaround or emitted logic editing.

Relative to accepted 8778: 379/380 byte-identical; app/main.js differs only in four comment/format hunks. Both parsed without errors; comment-free TypeScript printer output identical. Full hashes and diff are recorded. We do not call the old and new builds byte-identical. New deployment contains exact fresh-compiled bytes. Deployment diff is only candidate/app/main.js and artifact-manifest.json; baseline, game source, settings, production branches and backend untouched.

## Browser incremental checks (2026-09-28 UTC)

- 1024x768 actual iframe window: fixed authorized movement fixture. End supply/rail phase; Fit map; select G-I-02 then disambiguate G-I-01; start movement, choose legal 1,10, confirm; select G-I-02 directly; resulting operation SELECT, G-I-02 at 0,10, zero planned steps. Auto then Off succeeded. art003-movement.txt/jpg.
- 1363x936 actual iframe window: combat fixture B-000001; close result, expand history and reopen. Dice 1 and 2, total 3, A3R, CRT explanation, finished-state text and missing per-unit actual-consequence disclaimer remain visible. art003-combat.txt/jpg.
- Measurement snapshots verify exact iframe sizes, no topbar/toolbar horizontal overflow and no small visible HTML buttons flagged. Expanded measurement dock reserves space and sidebar remains scrollable. Default screenshots show dock collapsed. This is not Huawei/native-device acceptance and does not expand existing SVG hit-target claims.
- New preview integrity UI fetched all 761 listed runtime resources: 761 matched, zero failures. Manifest SHA256 256b3d0d16bfb78c2bf847fe4d02243f5ec6985cf4e31184c4be0f5ae916f34a. integrity.json. _headers remains unchanged platform config, not an HTTP artifact.

## Measurement limits / reused evidence

Each incremental scene recorded 147 resources, including 20 terrain resources. Ready times 8946.3 ms (1024 movement) and 8263.8 ms (1363 combat) are observations only, not a comparison: integrity probing preceded both, cache was not forcibly cleared, and scenes differ. Second-RAF click values are UI instrumentation proxies, not engine completion, GPU or complete latency measurements.

Controlled cold/warm feasibility was evaluated after build closure: current advertised browser API has no cache reset or network throttling controls. Existing UI supports warm reload, but without a controlled cold counterpart repeating warm samples would not close the comparative performance gate. No new cold/warm conclusion or GPU claim. No additional RAF run. Prior same-scene layout/baseline and drag evidence under evidence/ART-PREVIEW-002 is reused because only comments/whitespace changed; broad unchanged tests were not rerun. Huawei remains pending.

## Rollback / next step / Leader delta

Rollback only if needed: create a normal descendant commit on art-preview-001 restoring candidate/app/main.js and artifact-manifest.json from 040b4988; no force push, production change, PR or Hook. Existing 75a6305b immutable preview remains available.

Leader delta: source reproducibility blocker closed, source-generated preview deployed and incremental browser/hash checks passed. Byte discrepancy explicitly explained rather than labeled exact equality. Controlled cold/warm, GPU tooling and Huawei remain separate pending items; no production replacement approved. Next step is controlled performance/device validation when capability exists, not another art/build rewrite.
