# EASTFRONT Combat UX Pass 2 — Leader Review

Baseline Commit: e6529395eccb48527fb4c096cb71bcd8d283abb1
Baseline Tree: 81a5c5a8f712282f269d85e9b16c39623bdd8157
Baseline working tree: CLEAN before modification.

## Result

A normal attack uses three primary clicks: select attacker → click enemy → Attack. The UI submits ATTACK, automatically passes a defender reaction only when Core accepts no available artillery or HQ option, and continues forced stages until a genuine decision or CLOSED. Completed battles return to map interaction with the current camera and zoom.

Before: select attacker → enemy → Attack → defender handoff confirmation → pass reaction / resolve → return handoff confirmation (six clicks in the no-choice branch, as traced in the baseline handlers).
After: select attacker → enemy → Attack (three clicks in the event-handler tests). Retreat, advance, support and loss allocation add only their actual player decisions. Combat ownership is shown inline instead of a separate handoff screen. Deployment/turn privacy handoffs remain unchanged.

## Changes

- Compact preview shows participants, target terrain, odds, final shift and contributing modifiers; advanced options stay collapsed.
- Supporting attackers, artillery, detailed context and a full CRT table remain available. CRT data is read from Core rules, with original result codes preserved.
- Defensive artillery and HQ Last Stand remain explicit choices when legal. Selecting the last available reaction automatically continues resolution.
- Core already resolves unique loss allocations. Non-unique loss choices stop for the player and submit when all loss steps have been selected.
- Retreat highlights use Core queries against a cloned projection of ordered drafts. The final destination submits the ordered RETREAT action; no separate retreat confirmation remains. Friendly counters above destination polygons route to the same map action.
- A unit initially unable to retreat does not lock the order: another unit can move first and free its route. Final acceptance, losses and legality still belong to Core.
- Advance highlights the original target. One eligible advancer is preselected; multiple eligible advancers require a player choice. Clicking the highlighted hex applies advance; declining remains available.
- Stages with no legal advance, breakthrough or Schwerpunkt option are passed automatically after Core validation. Available optional moves and second attacks remain explicit.
- CLOSED clears combat drafts and target overlays. Immediate submitting feedback and duplicate-submit protection are wired to the primary Attack button.
- 27 new keys are provided in both zh-CN and en-US. Chinese remains default; language switching preserves attack and retreat drafts, GameState and RNG.

## Core boundary

No vendor/Core, rules, CRT, odds, modifiers, scenario, geometry, unit data, supply, RNG or VS2 rendering changes. Read-only option probes run the existing RulesEngine on isolated state clones; only dispatchGameAction can adopt an accepted state. No combat formula, retreat rule or advance rule is reimplemented in the UI. Viewer switching is presentation-only and Core still checks decision ownership.

Frozen scope: 101 protected tracked files match the baseline byte for byte. The NEW GAME/camera function span, boot function and renderCounter implementation also match exactly. See frozen-scope.json.

## Validation

- npm run typecheck: PASS.
- npm run build: PASS.
- node --test tests/*.test.mjs: 239 / 239 PASS, zero skipped.
- 19 new UX2 tests cover actual button/counter/map event bindings, busy feedback and double-submit protection, six-seed baseline GameState/RNG equality, no-choice stages, artillery/HQ decisions, loss choices, ordered retreat, blocked-route ordering, advance, breakthrough/Schwerpunkt, camera, language switching, fresh NEW GAME seeds and the production 640-hex scenario.
- Production scenario: legally deploy all 58 units, reach GERMAN_COMBAT, then invoke the actual built main.ts counter and Attack handlers. Three clicks reach CLOSED, integrity issues = 0. Camera remains translate(94px, -61px) scale(1.8). See interaction-trace.json.
- Existing VS2, interaction, camera, Counter, combat and localization tests pass.

## Manual validation limitation

The browser could not access the local candidate preview: net::ERR_BLOCKED_BY_CLIENT at http://127.0.0.1:4173/. No workaround or deployment was attempted. The three-click result is measured by actual application event handlers using a minimal DOM adapter, not by a real browser session. Tablet layout, browser hit testing, visual overflow and touch behavior of this candidate still need a real browser review. Existing camera/pinch tests pass; that does not replace device testing.

## Changed runtime files

- src/interaction/combatFlow.ts
- src/interaction/intents.ts
- src/localization/en-US.ts
- src/localization/zh-CN.ts
- src/main.ts
- src/render/coreModel.ts
- src/render/coreSvg.ts (combat overlays only; renderCounter unchanged)
- src/state/presentation.ts
- src/ui/combatAttackPanel.ts
- styles.css (combat feedback/layout only)

## Tests and evidence

- tests/combat-ux2.test.mjs
- tests/helpers/combat-dom.mjs
- tests/helpers/combat-fixture.mjs
- tests/combat-target-routing.test.mjs (updated advanced-options label)
- tests/localization.test.mjs (updated combat presentation fixture)
- evidence/combat-ux2/REVIEW.md
- evidence/combat-ux2/frozen-scope.json
- evidence/combat-ux2/interaction-trace.json
- evidence/combat-ux2/typecheck.log
- evidence/combat-ux2/build.log
- evidence/combat-ux2/tests.log

No Core changes.
No combat rule changes.
No RNG changes.

READY FOR LEADER REVIEW — real-browser manual validation remains outstanding as disclosed above.
