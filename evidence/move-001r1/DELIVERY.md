# MOVE-001R1 delivery — 2026-09-27

Candidate fix published; Huawei acceptance pending.

## Versions
- Runtime source: 08882b33292d95f5113df612070b42545ede7d3b
- Source tree: 86490e038e702b29af048f3a5bb48a8ea53b188b
- Cloudflare main publication: d84c46a0cd5d107f373a66619dcb3d433ea23e2b
- Publication tree: ad440401d0b0f46dbb89ece9bcf33cdf0fd4f604
- Official URL: https://eastfront-web-preview.pages.dev/
- Deployment identification is Git main publication + live source marker. Cloudflare dashboard deployment UUID was not accessible.
- Source branch move-001r1-explicit-mode. Evidence-only successor branch move-001r1-verification does not change published runtime.
- Backend source-main unchanged at 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b; no backend publication.

## Cause and correction
Ordinary friendly selection entered MOVE_PATH automatically, and local confirmation cleared the draft without ending that mode. Subsequent friendly clicks were captured as destinations. New tests reproduced both failures on the previous code.

Ordinary selection now enters SELECT. The existing panel has an explicit Start Move button and status. Only explicit MOVE_PATH captures friendly destination clicks. Successful commit, cancel, undo-to-empty, and rejected moves release target selection; authoritative snapshots retain existing draft reset. Exit remains available before the first step, even while a read-only projection is pending. Existing Action, pending guard, revision and authority are retained.

Use: select unit -> Start Move -> target -> confirm -> directly select next unit. During target selection, Exit Move returns to selection. No refresh is needed to switch units.

## Automated verification
- Client/server typecheck and client build PASS; server test-runtime build PASS, not deployed.
- Full suite: 614 executed, 613 initially passed. One nested fixture hash failed; reviewed dependent hash corrected, affected UA003R1 9/9 passed. No claim of a second clean full-suite execution.
- Final movement/localization: 26/26 passed, including 13 movement cases.
- Final affected frozen/animation/scheduling: 77/77 passed.
- New tests cover complete A -> friendly B -> confirm -> C -> move chain, three target surfaces, empty/drafted cancellation, undo-to-empty, exhausted budget, same-hex selection, invalid/full targets, real local WebSocket pending duplicate prevention, rejection recovery, authoritative snapshot and cancellation during pending projection.
- Existing automated touch drag/pinch and model stack identity tests passed. Huawei gestures were not executed.
- Production audit CLEAN; static HTTP PASS; combat smoke PASS, zero integrity issues. Known stale historical UI008 English-home smoke was not rerun or claimed passing.

## Actual production browser verification
Performed in remote desktop Chromium through the public Cloudflare URL, fresh normal New Game and full deployment/phase progression; no game-state injection. This is not Huawei or a production multiplayer-device test.

1. Ordinary A then C clicks selected C with empty path.
2. G-I-01 (A) at 0,0 -> Start Move -> Counter G-I-02 (B) at 0,1 -> preview retained A and original position -> Confirm -> A at 0,1, SELECT shown.
3. Without cancel or reload: G-I-03 (C) at 1,0 -> Start Move -> Counter G-I-04 at 1,1 -> Confirm -> C at 1,1, SELECT shown.
4. At 200% zoom, clicked distinct model proxies for stacked G-I-02, G-I-01, G-I-02: inspector selected the requested unit each time. Start then Exit with zero steps allowed immediate selection of G-I-01.
5. G-I-02 moved from 0,1 to empty 0,0. G-I-04 selected -> Start -> model G-I-01 at 0,1: draft retained G-I-04 and selected 0,1. Exit cleared it; immediate G-I-03 selection worked.
6. Selected G-I-04 -> Start -> exposed blank part of legal friendly hex 0,1: same one-step preview -> Confirm -> directly selected G-I-03. Screenshot online-proof.png shows final ordinary selection.
7. Zoom controls and mouse map drag worked without changing selected unit or drafting movement. No physical touch or Huawei claim.

At 100% zoom, clicking the center of the whole stacked unit bounding box can hit its neighbor; that is not proof of individual selection. Verified the exposed Counter area and, at 200%, separate model hit regions instead. No geometry was changed.

Online bytes matched final dist for all 8 changed deployment files plus config, terrain loader and codec config (11 URLs), recorded in final-online-assets.json. Startup assets and v2/v3 settings were retained. Publication is confirmed by served code and actual operation, not build status alone.

## Rollback and acceptance
Create a new revert of d84c46a0cd5d107f373a66619dcb3d433ea23e2b on current main (review any newer updates), or a new main child restoring prior publication tree c77ce605fb51b64c6984c78352bd480ecc9118bf. Never force push. Existing Cloudflare integration republishes main. This fallback restores the previously rejected MOVE-001 behavior.

Huawei single acceptance chain: open official entrance, select A -> Start Move -> legal friendly B hex -> Confirm -> directly select C -> Start Move -> move C. No cancel or refresh between A and C. Candidate remains awaiting that device confirmation.
