# COMBAT-UX3 checkpoint

Baseline runtime source 08882b33292d95f5113df612070b42545ede7d3b / tree 86490e038e702b29af048f3a5bb48a8ea53b188b, main publication d84c46a0cd5d107f373a66619dcb3d433ea23e2b. Source workspace started clean at evidence successor 82c6e6e539909af950008313600f61e4ad6a0280. Remote main and live build marker matched. MOVE-001R1 accepted on Huawei by user.

## Authorized data audit and scope limits
Existing BrowserRenderModel.combat.battle has independent dice.die1/die2/total, resolution, context.baseOdds/finalShift/finalCRTColumnLabel and per-factor column shifts. CRT uses the raw dice total; no dice modifier field is supplied. Animation events carry battle identity but no dice. UI never fabricates faces, accesses full GameState or invokes RNG.

Server queryModel deliberately sets combat=null for non-decision owners. Public battle does not include transaction lossesApplied or resolved retreat routes. This frontend-only pass cannot give both clients every result at the same instant or show a complete confirmed per-unit consequence ledger. It shows only authorized result data already delivered to that viewer, marks CRT quantities as requirements, pending decisions as pending, and CLOSED as flow completion. No inferred unit losses are presented as confirmed. Minimum follow-up (not implemented): a privacy-filtered per-viewer battle summary including dice/context and confirmed consequences, also available to non-owner snapshots and history. This needs separately scoped server/projection changes; no protocol/backend change was made here.

## UI
Compact side-panel result card with actual independent dice, total, CRT result and requirement explanation, applied odds/column shift, pending status. Existing controls/map remain active; close is local UI only and at least 44px. CSS-only 480ms reveal, no random intermediate faces, OS reduced motion supported. Result remains until close or new battle. Existing records reopen via authorized selectedBattleId query; cached history opens immediately and never replays. During unresolved decisions an uncached older record can be unavailable rather than replacing authority. Per-session/per-viewer memory, no persistent storage. Browser refresh restores only what the existing session/host supports; initial/restored results are static. Duplicate live battle event IDs are consumed once; resync clears queued reveals. No Action/ACK/revision/RNG/Core changes.

## Verification before publication
Typecheck/build PASS. New UX3 eight tests PASS. Existing combat+MOVE001R1 targeted 39/39 PASS. Full suite 623 executed: 614 initially passed, 9 failures were legacy DOM harness missing new module or oversimplified matches(selector); fixed harness wiring/matching without weakening assertions. Affected localization, combat, scheduling, deployment/performance: 61/61 PASS. Reviewed frozen hashes retained exact assertions; hash-review.json documents paths. Final frozen tests/gates and live verification to be appended.

Production audit CLEAN, static HTTP PASS, combat smoke PASS with zero integrity errors. Runtime changes restricted to main, result presentation module, attack panel duplicate-result removal, localized strings and CSS. Existing server, protocol, Core, terrain, camera, movement state machine and v2/v3 files unchanged. No backend publication.

Rollback with a new main child restoring publication tree ad440401d0b0f46dbb89ece9bcf33cdf0fd4f604, or revert this task's publication on current main after reviewing later updates. No force push.

Final affected frozen tests 103/103 PASS; final combat tests 42/42 PASS. Typecheck/build and static/audit gates rechecked after final presentation changes.
