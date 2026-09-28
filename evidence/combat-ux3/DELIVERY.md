# COMBAT-UX3 delivery

Published supported authorized-data presentation. Huawei acceptance pending. Two data gaps remain; this is not a claim of complete simultaneous multiplayer result delivery or a confirmed per-unit consequence ledger.

## Version and deployment
- Runtime Source: bd4b561b7d402a2dd6b097830407451d2dfdd509
- Runtime Tree: 86d30beec7322d3de714c296c4865173eee26411
- Cloudflare main publication: 416675112dda6c31feebe5f2318cef8800438246
- Publication Tree: 8295c63e885bc36c3ee79e5019a441fd28982860
- Official entrance: https://eastfront-web-preview.pages.dev/
- Cloudflare existing Git integration, main prebuilt root. Live source marker and all 11 relevant URLs matched final dist bytes (online-assets.json). Cloudflare dashboard UUID was not accessed; deployment is identified by Git publication + verified live source marker.
- Backend source-main unchanged: 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b. No backend publication.
- Baseline MOVE-001R1 accepted by user's Huawei feedback. Its source 08882b3 and publication d84c46a were protected. Runtime changes only six frontend files (main, result module, attack panel, two locales, CSS); compiled release also updates build markers.

## Data semantics and behavior
Existing authorized combat.battle supplies true independent dice, total, context and CRT resolution. Column modifiers remain column modifiers; no dice arithmetic is invented. The result component reads detached BrowserRenderModel DTOs and filtered event battle IDs only, never full GameState or RNG.

Submitting shows waiting before the action, suppressing the previous card. Accepted data reveals real faces with bounded CSS animation (480ms; OS reduced motion is static). Battle-ID playback deduplication is shared across local decision-owner handoff, while result data remains isolated per viewer. Resync drops queued playback; initial/restored records and history are static. No changes to Action, ACK, revision, snapshot recovery, server authority or protocol.

Results stay until close or a new battle. Closing and cached history are local read-only controls even during network waiting. Existing selectedBattleId query retrieves uncached history when allowed; it submits no combat action. During pending decisions, an uncached historical detail may remain unavailable. Refresh does not add a new local save/recovery feature: existing multiplayer reconnection returns only existing authorized data, and a fresh local game cannot restore an unsaved local battle.

The card is inside the scrolling side panel; map and existing loss/retreat/advance/breakthrough controls remain available. CRT quantities are explicitly requirements; current decisions say pending. CLOSED means follow-up flow finished, not a fabricated actual loss ledger.

## Remaining data gaps
1. Existing server queryModel sends combat=null to non-decision owners. The UI therefore cannot promise both clients an immediate complete result for every battle. It never borrows the other viewer's cache or reconstructs hidden information.
2. Public battle projection omits lossesApplied and actual retreat routes. No per-unit confirmed consequences are invented. Existing permitted map state and follow-up controls continue to show actual changes.

Minimal separately scoped follow-up: add a per-viewer, privacy-filtered combat result summary (independent dice/context/CRT and confirmed consequences), available to authorized non-owner snapshots and history. That requires server/projection work; no new protocol field or backend change was made in this task.

## Verification
- Typecheck and build PASS on final source.
- Full suite executed once at first implementation: 623 tests, 614 pass, 9 fail. Failures were old DOM harness imports and an inaccurate matches(selector) stub. Corrected harnesses without weakening assertions; affected rerun 61/61 pass.
- Final frozen-scope regression 103/103 pass; combat 42/42 pass; copy/localization related 85/85 pass.
- Final decision-owner-handoff correction: combat/localization/MOVE001R1 regression 61/61 pass, including nine UX3 tests. The added regression failed before the correction. No claim of a second full suite run.
- Tests compare authorized display with Core resolution, multi-attacker behavior, unchanged RNG, duplicate events, history, refreshed/restored initialization, resync, reduced-motion output, consecutive battle IDs, per-viewer isolation, pending consequences and actual existing bindings. Existing multiplayer pending/refusal/recovery and camera/touch tests passed in the full run.
- Final production audit CLEAN, static HTTP PASS. Existing deep combat gate PASS: loss, retreat, advance, breakthrough and closure, zero integrity issues. Historical stale UI008 English-home browser smoke was not run or claimed passing.

## Real production browser (remote desktop Chrome)
Normal New Game, both complete deployments (32 Soviet / 26 German), normal phase progression; no state injection, test seed, hidden runtime access or fabricated outcome.

First published iteration: G-PZ-01 + G-I-01 attacked S-I-01 at 3,-1. Actual 2+2=4, base 2:1, terrain -1 column, effective 3:2, AR. Both attackers retreated through normal map actions; result changed from pending to closed. Close/history and English/Chinese switch retained the result, no replay.

Final source bd4b561b was rechecked in a fresh tab after its live marker was confirmed:
1. Same normal multi-attacker setup: G-PZ-01 at 2,-1 and G-I-01 at 2,0, target S-I-01 at 3,-1.
2. Captured visible waiting text before resolution; no result was announced early.
3. Actual result 4+4=8, base 2:1, terrain -1 column, effective 3:2, DR. Soviet decision view showed retreat pending, same true dice. final-result.jpg records that moment.
4. Clicked retreat 4,-1; control passed to German advance with unchanged dice/result.
5. Chose G-PZ-01 and clicked advance 3,-1; actual DOM counters confirmed G-PZ-01 at 3,-1 and S-I-01 at 4,-1. Flow closed. No reveal class on subsequent updates.
6. Closed result, opened existing B-000001 · DR history button. Same 4/4/8/DR, static. final-completed.jpg records final state.

Browser operation verifies normal single-device hotseat and real map hit testing. This is not a physical touch test, Huawei test or two-device production multiplayer result test. Reduced motion, repeated/resync payload handling, multiplayer guards and privacy limits are covered by automated tests/source audit, not claimed as cloud-browser device tests.

## Checkpoint, rollback, acceptance
Source and publication retain history. Delivery evidence is saved on an evidence-only successor branch combat-ux3-verification; it does not republish runtime.

Rollback: create a new main child restoring baseline publication tree ad440401d0b0f46dbb89ece9bcf33cdf0fd4f604 after checking for later updates, or revert this task's three publication commits in reverse order (4166751, bbe3c60, 0339e7e) with a new commit. Existing Cloudflare integration deploys main. Never force push; no backend rollback needed.

Huawei one acceptance step: complete one battle at the official entrance, check true two-dice total and result remain visible, complete any pending retreat/loss/advance, then close and reopen the same battle record; points must be unchanged and no new roll should play.
