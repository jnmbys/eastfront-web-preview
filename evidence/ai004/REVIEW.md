# AI-004 — Basic Autonomous Strategy

Status: implementation and targeted validation complete; remote status is established by the delivered branch/ref, not this file. No deployment or device acceptance claimed.

Management read: collaboration-setup-001 / 12db9ec797d69b47b0f875208fa6c899cfb5efbd.
Runtime base: ai-003-local-human / 99ee7fd8cff6aeda68ec058f179c7f34aaedf83b. No management runtime merge.
Task branch: ai-004-basic-strategy. All commits use [CF-Pages-Skip].

## Changes

- Add stateless basicAgent/scoreIntent; keep minimalAgent unchanged for forced flow and verification fixtures.
- Enable basicAgent only for the existing local campaign scenario. Explicit scripted attack, stop, reinforcement and terminal fixtures retain their original policies. Worker, cancellation, single-flight, takeover and decision-owner scheduling are reused unchanged.
- Existing observation candidates already proposed single-step MOVE and visible single-unit ATTACK. No authoritative query added and no candidate schema change. FairHost still admits the exact observation candidate then calls the real engine.
- Add explicit public-config allowlist: capitalCoreHexes coordinates, terrain and river attack shifts, entrenchment shift, OOS attack multiplier. These are static public scenario/rule values, not runtime unit positions, deployment, support or RNG. No multiplayer wire protocol changes.
- Move only when the distance to currently identified enemy positions, or public capital goals if none are identified, strictly decreases. Reject known lake/occupied/contact destinations, full known stacks and plainly dangerous adjacency. Existing hasMoved prevents repeating movement in the same phase. CONTACT/Last Known never become identified units or invented strengths.
- Attack only identified adjacent enemies with heuristic favorable strength: ratio >= 1.5 + 0.75 per observed negative terrain/river/entrenchment shift. These constants are conservative policy preferences, NOT new game rules or exact CRT odds. Charge worst visible crossing, ignore favorable flank/combined-arms/encirclement bonuses, do not infer hidden support or retreat availability.
- Seeded tie break is agentOrder, separate from combat RNG. No RNG call, engine simulation or preview inside policy.
- Candidate limit remains 128. Each equal observation remembers rejected intents; after three rejected tactical attempts choose phase end. If that is also rejected, STOP. Existing authority rejection cap remains eight. No module-global policy memory, and existing per-match/controller memory remains unchanged.

## Validation actually executed

- node ai/build.mjs: pass (TypeScript, including FairHost/projection/public contract).
- node ai/local/build.mjs: pass (normal frontend build + isolated Worker compile). Output stayed local; production feature gate false.
- node ai/local/audit.mjs: pass; 71 reachable Worker modules, no Node imports or sockets, empty multiplayer server, same-origin connect policy.
- Initial boundary + forced-flow + local tests: 39/40. Only failure was exact fair entry export allowlist missing new basicAgent and scoreIntent. Added exactly these names plus basicAgent module to allowed local imports; kept the authority-import exclusion and privacy assertions intact.
- Final boundary + new strategy suite: 29/29. The 19 forced-flow/local tests from the first run were already passing and were not redundantly rerun after only changing that export test.
- Strengthened paired-hidden-RNG test additionally changes actual random.state, not only seed: 1/1 targeted pass. First strategy run contained an invalid test field .rng; corrected to Core .random before final 29/29. Do not use the initial 8/8 alone as RNG evidence.
- No frozen gameplay hash, privacy assertion or game rule changed. No full Core/Web suite rerun; reuse established AI-003 baseline for unchanged areas.

## Actual autonomous evidence

Fixed micro scene, combat seed8246, agent seeds101/202: same policy on both seats; MOVE→READY_FOR_PHASE_END→ATTACK→PASS_REACTION→optional followup passes→next phase, all accepted. The attack comes from basicAgent scoring, not a scripted attack wrapper. Two fresh hosts reproduce identical decisions and authoritative final state. See autonomous-trace.json.

Fixed production map/campaign seed17, agent seeds101/202: two fresh complete runs agree exactly and naturally terminate GAME_OVER at the existing terminal checkpoint. 925 successful transitions (including terminal), 144 rejected transitions. Accepted authoritative log: 58 deployments, 157 phase ends, 692 moves, 11 reinforcements, 2 ATTACK, 2 PASS_REACTION, 2 RETREAT, 2 PASS_ADVANCE. See campaign-trace.json. Core accepted actionLog deliberately does not contain rejected attempts; the report retains aggregate rejected count, and reproduction runs reproduce it. Rejection error details are never policy input. Rejections remain a real limitation, not a zero-error claim.

Other checks: unfavorable stacked target declined; observed terrain/entrenchment cannot improve risk estimate; no-visible-enemy public-goal approach; paired hidden enemies/support/deployment and altered future RNG inputs/output equality; CONTACT/Last Known uncertainty; same-observation rejection suppression; no seat/match global memory; repeated scoring leaves host RNG unchanged. Existing tests cover actual compulsory multi-loss, blocked retreat, breakthrough integrity, stops/takeover, cancellation and stale Worker replies.

## Reproduce

From repository root with Node and locked dependencies:

```sh
npm ci
node ai/build.mjs
node --test ai/tests/strategy.test.mjs ai/tests/boundary.test.mjs ai/tests/flow.test.mjs ai/tests/local.test.mjs
node ai/local/build.mjs
node ai/local/audit.mjs
```

For local viewing only, serve .ai003-preview with an ordinary static HTTP server. Do not deploy it in this task. Prior AI-PREVIEW-001 remains source99ee7fd8/releasef8b1a1ff; it does NOT contain AI-004.

## Limitations and handoff

This is weak baseline strategy: one hex per move, one attacker per attack, no pathfinding detours, coordinated assaults, support selection, withdrawal planning or long-term front management. Capital goals are capture goals for Germans and defense concentration goals for Soviets. Visible-goal changes can alter direction across turns; fixed-goal distance is monotone, not a universal anti-oscillation proof. Forced optional advance/breakthrough may be legally passed. Two attacks in a full run are evidence of autonomy, not strategic strength, balance or victory quality. No new browser/Huawei/performance acceptance for AI-004; AI-PREVIEW-001 acceptance is historical and separate.

AI-PREVIEW-001 Git handoff is now included in evidence/ai-preview-001/: REVIEW, original11/11, remote480-file comparison, static audit, release provenance, two screenshots and HTTP403 failures. It does not require a ZIP. Existing larger bundle recovery evidence remains described by hash in that report.

Scope diff must stay within ai/ and these task evidence directories. Core/vendor/src UI/server/protocol/rules/art untouched. New public DTO fields are local fair-agent data only. Rollback: select source99ee7fd8 for future local builds; nothing was deployed, so production/preview rollback is unnecessary.

State Delta for Leader: AI-PREVIEW-001 fetchable evidence gap closed; AI-004 basic autonomous policy and targeted tests complete, isolated, not deployed. Huawei preview acceptance remains open. Suggested next step: review risk scoring and rejection cases, then separately authorize browser evaluation of autonomous local play; no training or advanced-strategy claim.
