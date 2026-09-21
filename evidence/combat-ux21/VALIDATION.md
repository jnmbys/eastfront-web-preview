# EASTFRONT Combat UX Pass 2.1 — Leader review

Baseline commit: `e83b544eaaf20be3b3afeee6bd449eb9c6945844`

Baseline tree: `8d14765550e5ec3b770a7b62418f9314349c6ca9`

The baseline working tree was clean before creating branch `combat/ux2.1-map-attackers`.

## Change

After a combat draft has a target, tapping a friendly counter uses a Core-validated additional-attacker toggle before ordinary inspect. A second tap removes the additional attacker. Primary-attacker identity remains separate from the sorted Core action payload and cannot be removed by a map tap or compact chip. The existing advanced primary-replacement path remains available.

`attackGroup.ts` probes `validateAttackAction` with the entire proposed group, selected enemy hex, active controller and existing artillery support payload. It contains no adjacency, attack-strength, odds, modifier, supply or unit-type rules. Invalid friendly additions retain the draft and show localized Core rejection feedback.

Map feedback uses existing Counter V2 body outlines: primary uses ordinary selection, additional selected attackers use a solid teal outline, eligible units use a lighter dashed outline. Unit symbols, stack placement, hit targets and geometry are unchanged. The compact preview shows the attacker count, removable additional-attacker chips and Core total attack strength. Every map/chip edit refreshes the existing preview immediately.

## Flow and click count

- Single attack: primary → enemy → ATTACK = **3** principal clicks.
- Three-unit attack: primary → enemy → second friendly → third friendly → ATTACK = **5** principal clicks.
- Genuine post-attack decisions still stop for the player, as in UX2.
- Artillery remains in existing Advanced Options.

Counts were verified by executing the built application's actual counter and expanded-hit-target event bindings, panel binding and asynchronous ATTACK handler. The tests do not emulate hardware touch gestures or browser hit testing.

## Validation

- `npm run typecheck`: PASS.
- `npm run build`: PASS.
- `node --test tests/*.test.mjs`: 254/254 PASS; 15 new UX2.1 tests, all 239 prior tests retained (one prior assertion updated for the intentionally changed friendly-counter route).
- Both single- and three-attacker flows verified on the canonical 640-hex production scenario through real Core deployment/phase actions; integrity issues = 0.
- Map counter and existing expanded touch target both toggle additional attackers.
- Illegal, already-used, nonadjacent, destroyed, unauthorized, artillery-only and rail-dedicated candidates cannot enter the group through map selection. Core supply behavior and selected-artillery validation are preserved.
- Immediate strength, odds and relevant modifier updates checked against `buildCombatContext`.
- Inspect outside an editable combat draft/target remains available; pending decisions and privacy gates do not enter group routing.
- Primary protection, compact chip removal, map feedback, camera transforms and language changes covered.
- Six seeds (11, 17, 22, 2722, 5392, 8246) produce byte-identical serialized Core GameState hashes and identical RNG states/draw counts to the retained, verified UX2 production build for the same three-unit attack. Frozen baseline hashes are in `tests/fixtures/combat-ux21-baseline.json`.
- Existing fresh NEW GAME seed, terrain visual seed, Combat UX2 decision progression, camera, Counter V2, localization and VS2 tests pass.
- 440 tracked source/assets/vendor files outside this pass's runtime change set compare byte-for-byte with baseline; see `frozen-scope.json`.
- 11 new localization keys, complete zh-CN/en-US coverage; default language and fallback architecture unchanged.

## Visual / device verification limits

Static component review HTML is included in `preview-zh-CN.html` / `preview-en-US.html`; regenerate with `node evidence/combat-ux21/render-review.mjs` after building. These use the actual compiled panel/counters and source CSS, with an explicitly labeled prototype-terrain fixture; they are not gameplay screenshots.

Browser visual verification was not completed. The full static document exceeded the browser automatic-review 64 KB request limit; a smaller component-only document was then blocked by the cloud browser URL policy (only HTTP/HTTPS navigation supported). No workaround was used after the URL-policy rejection. No visual or physical Huawei tablet PASS is claimed. A Leader/device check of tap hit testing, chip wrapping and outline readability remains required.

No deployment was performed in this task.

No Core changes. No combat rule changes. No RNG changes.
