# MOVE-001 delivery

- Source commit: `946bfbddb1335acd5230a539aead90756b55fd1e`
- Source tree: `c16f247cc4fc0437a93a05cae7beec8c0d1cd799`
- Frontend publication / main: `23f3d96f8906bb78c9422227e5feb03424426fe7`
- Publication tree: `c77ce605fb51b64c6984c78352bd480ecc9118bf`
- Production: https://eastfront-web-preview.pages.dev/
- Cloudflare Git integration: existing project, main, precompiled repository root. The live source marker is 946bfbdd; eight selected live resources match the built bytes (online-assets.json). Cloudflare's dashboard-specific deployment UUID was not available; main publication SHA and served source SHA identify the verified release.
- Changed deployed files: app/main.js, app/web/startupDiagnostics.js (build marker only), diagnostics/transport/build.json. All other deployed files, including assets, configuration, previews and protocol, are retained byte-for-byte.
- Backend source-main remains `8876f812b6e9bb137d7f08fd6e92eecfb5635b4b`. No backend release performed.

## Actual browser verification

Remote cloud Chrome, default production URL, normal singleplayer UI; no game-state injection. Reloaded after the new source marker was publicly served. Started map, deployed all 32 Soviet and 26 German units through visible controls, completed handoffs and supply/rail phase, entered German movement.

1. Selected G-I-01 at 0,0. The existing move projection marks friendly G-I-02 at 0,1 legal.
2. Clicked G-I-02 Counter: G-I-01 remained selected, one-step draft to 0,1, mover remained at 0,0 before confirmation.
3. Cancelled path, clicked G-I-02: normal selection and unit details switched to G-I-02 with an empty path.
4. Zoomed to 200% and dragged map. Path remained empty and selection unchanged. Clicked actual `.model-hit-proxy` belonging to G-I-01: one-step legal draft to 0,0, G-I-02 remained at 0,1.
5. Undid that step. Clicked an exposed blank point in the friendly 0,0 move polygon (verified actual DOM hit target). Same one-step legal draft, same selected mover.
6. Confirmed once: feedback reports G-I-02 moved one step to 0,0; both G-I-01 and G-I-02 counter hex attributes are 0,0; path cleared. Screenshot online-proof.jpg captures final result.

Automated tests cover illegal/full targets, original-hex undo, repeat bindings and bubbling, mouse/touch drag/pinch arbitration, real local WebSocket two-player pending/duplicate/rejected Actions and authorized snapshot placement. Production cloud-browser multiplayer transport remains an environment limitation from STARTUP-002; this release's multiplayer behavior was verified with actual local WebSocket clients/server, not claimed as a production two-device browser test. Huawei MOVE-001 hardware acceptance is still pending.

## Test accounting and known limitation

Full suite initially 608 cases: 603 passed, five outdated fixture/hash failures resolved by the affected 85-case rerun. A subsequently added multiplayer full-stack test brings relevant total coverage to 609 cases; all seven MOVE-001 tests pass. No second full suite was run. Client/server typecheck, client build, production asset/static HTTP audit and deep combat smoke passed. See README.md and hash-review.json.

Historical UI008 production-smoke is not reported as passing: it stops at hardcoded English NEW GAME against unchanged localized home markup. No assertion was relaxed; current lifecycle tests and actual production browser start/deploy/move provide the relevant evidence.

## Rollback and Huawei acceptance

Rollback main by a new revert commit for 23f3d96, or a new child using previous publication tree `a41e341bbd7f6062afaf70a5ad29e64f1a33d8bc` (previous commit ca7175d87872d7611eaa570c66d0cbd94802131d). Cloudflare redeploys via its existing integration; no force push, no backend changes.

Huawei: reload the official entrance once; during movement select a friendly unit, tap an adjacent legal friendly-occupied Counter/model, then confirm movement. The original unit should remain selected and enter that hex exactly once. Cancelling the path should allow ordinary unit switching.
