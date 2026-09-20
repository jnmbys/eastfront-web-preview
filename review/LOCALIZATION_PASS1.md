# EASTFRONT Localization Pass 1

## Source baseline

- Gameplay Seed Fix source bundle: `EASTFRONT-GAMEPLAY-SEED.bundle`.
- Baseline commit: `a08d058583fc05556df8c44fd2218fce283ad2cf`.
- Baseline tree: `c05ddc94e977b64cb694f70e60003a00db4f4976`.
- Working tree was clean before localization. This is the seed-fix baseline, not the older Final Integration or Pages artifact.

## Languages and implementation

- Default language: `zh-CN` 简体中文.
- Alternative and fallback: `en-US` English.
- 439 stable message keys; both catalogs cover the same keys and interpolation parameters.
- `src/localization/index.ts`: typed translation, English fallback, missing-key/parameter diagnostics, presentation-only deferred messages, locale preference.
- `en-US.ts` and `zh-CN.ts`: centralized language resources.
- `enumKeys.ts`: display names for the actual unit types, terrain, supply states, phases, battle stages and victory reasons. Canonical identifiers remain unchanged.
- `issues.ts`: actual validation codes and detail reasons mapped to player messages. Original Core objects are not mutated; English retains the original detailed error message.
- `languageControl.ts`: native language selector. Preference uses `eastfront.language` in localStorage; switching still works when storage is denied.
- Language changes repaint UI, retaining GameState identity, random state, camera transform, selections, drafts, panel scroll and expanded details.
- Stored deployment/action/fatal feedback is formatted at render time, so existing messages switch languages too.
- System fonts include Microsoft YaHei, PingFang SC, Hiragino Sans GB and Noto CJK fallbacks. No new font files, external font requests or package dependencies.

## Translated surfaces

Home, New Game confirmation, loading/failure screens, language selection, HUD, phases, factions, command panel, deployment roster/cards/confirmation dock and rejections, unit detail/status, movement/rail/reinforcement/recovery/entrenchment controls, map zoom labels and accessible descriptions, counter tooltips, privacy handoffs, game over and victory reasons.

Combat: attacker and enemy selection, preview, ATTACK, supporting units and artillery, CRT details/modifiers, defender reaction, loss allocation, retreat, advance, breakthrough, Schwerpunkt decisions, results and battle history. Controls, layout structure and decision order are retained. CRT result codes are unchanged.

## Validation

- `npm run typecheck`: PASS.
- `npm run build`: PASS (production dist freshly generated).
- `node --test --test-reporter=tap tests/*.test.mjs`: **220/220 PASS**.
- The total includes all 207 existing tests and 13 new localization tests. VS2, combat, interaction, camera, Counter V2 and deployment/UI tests pass.
- Existing English-string tests explicitly select English; feedback checks render the deferred message. Their behavioral assertions are retained.
- Localization tests cover catalog/placeholder parity, English fallback, missing keys/parameters, actual enum/error coverage, message retranslation, preference persistence/storage denial, real language-change handler, actual main render/camera binding, unchanged state/RNG/drafts/scroll, Chinese flow, all pending combat panels and phases, and unchanged counter symbols.
- Chinese automated flow: New Game UI → both sides deploy using selection/confirmation → movement path planning → select attacker/enemy → preview → ATTACK → resolve → end phase. English and Chinese runs with the same explicit seed produce identical GameState.
- New Game still consumes fresh entropy and rejects zero; explicit-seed replay remains supported. Language changes consume no entropy and preserve the next dice sequence. Terrain visual seed remains `17`.
- Scope audit: 37 existing functions (including camera, RNG and terrain functions) remain byte-identical; interaction routing/action bodies are identical after excluding display-message assignments. No changes under vendor/Core, geometry, adapter, canonical map/assets, unit data, terrain surface implementation or camera interaction module.
- `git diff --check`: PASS.

## Manual validation status / known limitations

**Manual browser/device validation is pending, not PASS.** The available cloud browser cannot open the local preview, and its security policy rejected opening a static local preview via a non-HTTP(S) URL. No alternate browser surface or security-policy bypass was used. Therefore Windows, Android/Huawei, iOS/macOS font rendering, tablet/mobile overflow, physical touch/pinch and the full manual Chinese journey need leader/device review before player release. Automated markup and state tests do not prove visual fit.

Static typography samples were generated as intermediate inspection material, but could not be opened in the available browser; they are not claimed as screenshots or visual evidence.

No English prose was detected in tested normal Chinese flows and decision panels. Intentionally retained: EASTFRONT branding, the English language option, unit/battle IDs, NATO/faction letter marks, CRT result codes, and raw developer/startup technical diagnostics. Developer-only debugging controls are outside the formal player UI and remain English.

No localization deployment has been made in this pass. Existing live Pages remain on the Gameplay Seed Fix build.

No Core changes. No gameplay rule changes. No RNG behavior changes.

READY FOR LEADER REVIEW — device/manual validation remains pending as stated above.
