# GRAND-DIVISION-001 — implementation checkpoint, not release

Base: e579dd95dcaea8f1ad885c82ecadc1adde25dac8 (Render Live verified 2026-10-10).
Branch: grand-division-001-vanilla-designer. No public deploy, no user-save writes.

Implemented in the unified game: create/name/copy/edit/remove battalion and support draft slots, permanent template IDs and revisions, own-side authorized view, authoritative draft save, optimistic template conflict detection, request replay, persistent save/restart. Draft editing does not adopt a template or modify units/resources. The provisional editing grid is not a claim that original rules or numerical data are fully verified.

Browser evidence: independent normal campaign on 4264; created 第一步兵试编, added infantry, saved v1; copied, added engineer support, saved a separate v1. Screenshot evidence/01-draft-editor.jpg is a real 1024×768 desktop viewport, not a physical tablet. Browser reload then reopening the draft library preserved both templates and the copied engineer support. No real conversion/production/refill/combat claim.

Targeted Node checks: create/edit/copy, invalid shape/type/duplicate support, side isolation, stale template, idempotent retry, restore rejection before mutation, real file save/restart and prior-era rejection. Twelve identical simulation steps with/without draft editing preserve state/economy/RNG/officer tasks; comparison excludes only explicitly identified wall-clock timing diagnostics. These are foundation checks, not full division acceptance.

## Leader decisions received

Leader chat 6ab1f5f2-4a10-83e8-994c-f171e81eb210, reply 83cd275f-7fdc-5077-877f-c31dafa5eb09:
- New campaign rules apply to every unit and both sides. Old saves retain old rules. No mixed damage scales in one battle.
- Necessary combat, equipment-piece accounting, manpower, training and army-experience changes are allowed for the new campaign; no made-up conversion multiplier for legacy abstract stocks.
- Initial army experience 0 is a scenario decision, not an HOI4 factual claim. Verify earning and spending rules. Draft-only is not final completion.
- Retain permanent unit IDs/corps/posts/orders and old-game continuation. Freeze explicit scenario setup separately from reference rules.

## Reference status and specific remaining gaps

| Source | Actually inspected | Limit |
|---|---|---|
| https://forumcontent.paradoxplaza.com/public/paradox/banners/HoI_IV_Strategy_Guide.pdf | Text, PDF pages 15–17 and 30: experience editing/exercises, equipment and attribute explanations | Not a same-version numerical specification; no claim of watching a designer demo |
| https://www.youtube.com/watch?v=aizLm3MvrwE | Official tutorial identified; browser DOM and screenshot both timed out | Not watched; no timestamps invented |
| https://hoi4.paradoxwikis.com/Division_designer and /Land_units | Access attempted | HTTP401, content not read |
| https://github.com/taw/hoi4/commit/7ce932f6b2448f75941d496659cc3a5352029380 | Commit says 1.10.1; vanilla.json and Division.js inspected | Third-party extraction, not independently verified vanilla/DLC rules. No LICENSE found at that commit; code/data not copied into runtime |

Open fields sent to Leader together: exact same-version army XP edit costs and exercise/combat income/caps; unit training XP effects; conversion/downsizing returns and org handling while fighting/encircled/unsupplied; damage/organization/armor/piercing/width constants; missing-equipment effects; the nine existing equipment categories mapped to original models/year/DLC. These gaps block safe adoption and real combat integration, not draft UI and persistence work.

Current published game remains unchanged. The candidate is NOT a completed custom-division system and must not be deployed as one.

## Developer reproduction and rollback

Build: `node experiments/grand-release-001/build.mjs`.
Test: `node --test experiments/grand-division-001/templates.test.mjs`.
Typecheck: `node node_modules/typescript/bin/tsc --noEmit`.
Isolated local process port4264, save directory `C:/Users/jinyibo/eastfront/runtime/grand-division-001`; original4263 untouched. Only stop the PID currently bound to4264 after verifying its command line; never stop all Node processes. Draft fields exist only after saving a draft; do not replace live saves with this development save. Public rollback is unnecessary because nothing was published.

## Local reference discovery (supersedes missing-install note)

Read-only Steam registry lookup found D:/steam; libraryfolders.vdf identified one library and installed app394360. Installation metadata: Operation Postern v1.19.3.0.c01a (5632), Steam build25205862. Official publisher Steam announcement lists 1.19.3 as released September17,2026: https://store.steampowered.com/app/394360/Hearts_of_Iron_IV/?l=english . The installed user launch configuration enables9mods and the last runtime log reports older1.19.2; neither proves clean1.19.3 behavior. No game executable launched, configuration changed or original scripts/assets copied. Hashes identify read-only source files; they are not a claim of Steam integrity verification.

`extract-demands.py` exports14 factual base definitions with original IDs, manpower, equipment archetype counts, groups, source paths and SHA256. The editor now sums these requirements (no current inventory conversions) and shows saved-vs-draft comparison. Example infantry+engineer:1300persons,110infantry equipment,30support equipment. These are base definition requirements, not operational stats or free issued resources. Existing abstract stocks are NOT silently treated as these pieces.

| Field / behavior |1.19.3 evidence|Still missing / blocked function|
|---|---|---|
|`manpower`, `need` per selected battalion/support|Local common/units; extracted file hashes|Verified as installed base definitions; DLC/technology availability remains separate|
|`MAX_DIVISION_BRIGADE_HEIGHT`, `MIN_DIVISION_BRIGADE_HEIGHT`|Defines5and4; ordinary support5; regimental support5×1|Fifth-row unlock/activation rules, regimental support conditions; provisional draft slots do not imply formal eligibility|
|`BASE_DIVISION_BRIGADE_GROUP_COST`, `BRIGADE_CHANGE_COST`, `SUPPORT_SLOT_COST`|Defines20,5,10|Complete before/after edit pricing and modifiers; constant names alone do not prove final cost|
|`TRAINING_EXPERIENCE_SCALE`, `FIELD_EXPERIENCE_SCALE`|Defines62,0.0008; cap fields present|Full engine aggregation/capping/exercise attrition behavior; blocks real XP spending cycle|
|`BATALION_CHANGED_EXPERIENCE_DROP`|Defines0.5, unchanged0|Which changed personnel/equipment fractions and timing; blocks safe conversion XP handling|
|`LAND_COMBAT_*`, armor/piercing mix|Local defines contain dice, damage factors, weights|Complete current engine ordering/partial piercing/equipment and experience effects; not copied as multipliers onto old combat|
|Surplus personnel/equipment return|No same-version behavior verified|Combat/encirclement/refill timing and org treatment; blocks adoption/downsizing|
|Concrete tank equipment and DLC|Local medium/heavy battalions request chassis archetypes|Model/module/year defaults; cannot substitute the old generic TANK field|

Installed `wiki/Division_Designer.html` dates2016 and `Experience.html` dates2016: rejected for1.19.3 rules. taw1.10.1 remains a historical cross-check only. Original designer video still unviewed due browser timeout. These are concrete missing evidentiary fields, not a new request for general permission to change architecture.

Second browser capture evidence/02-source-demands.jpg is1280×720 (requested viewport override did not apply to that tab; actual innerWidth/innerHeight checked). After a real4264 service restart, both saved templates and engineer support survived; demand comparison showed1300/110/30. No physical touch, vanilla-game execution, formal adoption or full production/refill acceptance was performed.

## Latest reference scope: owned official DLC (2026-10-10)

User supersedes the base-game-only acceptance constraint. Use 1.19.3 plus owned and enabled official DLC, without Mods; no purchase. See OWNED-DLC-REVIEW.md and evidence/owned-dlc-review.json. Steam lists eight checked DLC entries; installation has 44 descriptors and third-party API replacement files, so installed/enabled is not proof of official ownership. No new game launch or playset mutation occurred. Existing source facts and formal-adoption gates remain. Full personal backups stay local, not Git.
