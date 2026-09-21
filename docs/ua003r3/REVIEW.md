# EASTFRONT UA-003R3 — Model-First Unit Composition

Baseline commit: `d11712ce6693a493c5fb887e1b48bcbcc9d3539b`

Baseline tree: `07de73146d7efc9929682150901d4f2a474dd827`

UA-003R2 is not an ancestor and is not merged. The original UA-003R1 vector artwork remains byte-identical, without R2 vertical flattening.

## Architecture

The existing projected CounterModel supplies the full Counter and a new Compact Unit Plate inside the same canonical `data-unit-id` button. The UA renderer selects the display surface using its existing Camera/LOD reading:

| Preference | Far | Medium | Close |
| --- | --- | --- | --- |
| Auto (default) | Full Counter V2 | Model + compact plate | Larger/detail model + compact plate |
| Off | Full Counter V2 | Full Counter V2 | Full Counter V2 |

The full Counter artwork stays available for instant restoration but is hidden in model mode. The Presence layer remains inert and decorative. The compact plate has no independent unit state or rules. Toggle state belongs to the presentation runtime, optionally persists under `eastfront.unitModels`, and never remounts the session or map. Storage denial falls back safely to the in-memory/default preference.

### Model composition

Natural silhouette proportions are unchanged. Solo miniature widths are approximately 62–67% of hex width at Medium and 76–82% at Close; heavy armor may reach roughly 87%. Stack entry/exit plate and proxy offsets reuse the exact model interpolation, not a second clock. The model foot baseline is the canonical unit ground plane, not a gap above the Counter top border. A compact contact shadow and ambient shadow sit beneath its feet. Model, shadow and plate share the existing UA transform during travel and reactions.

Two-unit stacks reuse the existing identity/order/anchor displacement. Smaller miniatures fan left/right, with one plate and one proxy per unit; both feet align to the owning hex ground plane. No stack legality or Core location is changed. Stack scale is deliberately lower than solo scale to fit two readable silhouettes.

Far/Off have no miniature drawing. Presence paint exits immediately in that state, and the layer remains hidden. LOD uses existing thresholds and hysteresis; short opacity entry transitions avoid a long full-Counter/full-model overlap. Reduced-motion disables those CSS transitions.

### Compact information

The plate contains faction, localized short category, attack/defense/movement values, step-loss slashes and damage edge, stack count, and existing out-of-supply/entrenchment indicators. Selection and primary attacker use restrained brass borders, supporting attackers teal, and selected targets a distinct dashed bright border. It does not repeat the large NATO symbol. The existing full accessible unit label and detail panel remain available.

New player text uses the existing zh-CN/en-US catalog: 单位模型 / Unit Models, 自动 / Auto, 关闭 / Off and short category labels. Chinese remains the default.

### Interaction

Each model/plate composition has an invisible rectangle within its existing unit button. Clicking it bubbles to the unchanged unit selection, inspect, attack-target or combat-decision handler. It contains no new gameplay identity, hex calculation or legality logic. Stack proxy centers are separately selectable and their rectangles do not overlap each other in the canonical resting arrangement.

Model and Counter hit surfaces are explicitly mutually exclusive. SVG `pointer-events="all"` ignores visibility, so inactive proxies receive `pointer-events="none"`, not just a visibility flag. Destroyed clone sanitization strips identity and disables every descendant immediately, including the new proxy; later LOD changes cannot reactivate it. The existing keyboard-focusable unit button is preserved.

### Animation and privacy

No new animation engine or timing is introduced. Model and plate move under the existing unit transform; Skip/Instant settle to the same canonical presentation. Off can be changed during playback and does not alter queue outcomes.

Only IDENTIFIED projected units enter Counter/plate/model/proxy generation. HIDDEN has none of these nodes. CONTACT and LAST KNOWN markup and behavior are unchanged. Viewer handoff continues to reset old authorized animation/presentation through the FOW-001 runtime boundary. FOW-002 mask/material/transition modules are byte-identical. Model toggling/animation never requests a fog or VS2 rebuild.

## Validation

- Exact baseline commit/tree verified; starting working tree clean.
- Baseline typecheck/build PASS; tests 412/412.
- Final typecheck/build PASS; tests **433/433** (21 added, none deleted or skipped).
- New tests cover Auto LOD, Off restoration, state/selection/draft/Camera/RNG isolation, proxy ownership, separate stack routing through actual application bindings, hidden enemy absence, unchanged intelligence markers, motion/Skip/Instant, inert destroyed cleanup, disabled miniature paint in Off, fog build stability, localization and frozen scope.
- Existing Combat UX2.1, fresh NEW GAME seed, VS2 cache and FOW regressions remain passing.
- Existing artwork equality tests now distinguish display-only visibility/opacity/proxy flags from canonical Counter content. Old R1 front-strip/scale expectations were updated to the explicitly requested model-first contract. State, anchor, damage and interaction assertions remain.
- Existing hash manifests were refreshed only for authorized presentation/UI/localization changes and affected tests. A new baseline SHA-256 manifest freezes all other source/vendor files.

## Visual evidence

All evidence is **software-rendered**, not real-browser capture. It uses production VS2 F3, the actual FOW-002 raster, projected units, production SVG renderers and accepted Core MOVE/ATTACK actions. Static units are arranged from the real roster on the canonical map to expose visual cases. Evidence uses en-US because this software renderer has no CJK font; the product still defaults to zh-CN and both catalogs pass coverage tests.

- Matched baseline / Auto / Off, same camera at Far, Medium and Close: infantry, armor, artillery, damage, selected unit and two-unit stack together on production terrain.
- Full German and Soviet player views.
- Soviet city infantry at Medium and Close.
- Visible/fog boundary with CONTACT and historical intelligence.
- Model + plate movement GIF and start/during/end frames.
- Three-attacker combat GIF and frames; matched dense battle Auto/Off comparison.
- Manifest records actual actions, playback phase coverage and cache counters.

The combat fixture uses the authorized Observer projection to expose all participants for animation review. Player-specific privacy is separately demonstrated in German/Soviet evidence and tests. No screenshot includes an authoritative hidden roster underneath a fog veil.

Reproduce with `npm run build`, then `node scripts/export-ua003r3-evidence.mjs <output> <untouched-FOW002-dist>`. The evidence environment needs `sharp` and `@napi-rs/canvas` via `CODEX_PRIMARY_RUNTIME_NODE_MODULES`; these are not new game dependencies or startup resources.

## Acceptance review

| Question | Software review result |
| --- | --- |
| Models dominate Medium/Close | Yes; full Counter face is absent and plate is substantially smaller. |
| Clear owning hex | Feet/shadow occupy the canonical ground plane, with plate immediately below. |
| Infantry/armor/artillery distinguishable without NATO | Yes in matched production crops; original silhouette proportions retained. |
| Key stats clear | Dedicated high-contrast plate row; stack text is smaller and needs tablet review. |
| Selection/damage/stack clear | Plate borders, slashes, damage edge and ×2 remain visible. |
| Model click routes correctly | Proxy identity and actual application routing tests pass; real touch hit testing pending. |
| Off restores full Counter | Yes at every tested LOD, with miniature painting disabled. |
| Far remains a wargame view | Yes, full Counter-only. |
| Fog privacy preserved | Hidden nodes absent; CONTACT/Last Known unaffected. |
| Dense battle cleaner | Less repeated NATO/Counter decoration; two separate plates clarify stacked units. |

## Frozen scope and known issues

No Core, combat rules, CRT, gameplay RNG, Supply, Victory, Geometry, scenario map, spotting, PlayerView privacy, fog material/edge, Camera mechanics, Combat UX flow, startup loader strategy or UA timing changes. No AI/network/campaign implementation. Source checkpoint only; no deployment.

**browser manual validation pending**. Real browser pan/pinch, Huawei touch targets, text readability and rendering performance have not been claimed as passed. Stack proxies are narrower than solo proxies to remain separately selectable; this is a specific real-device acceptance target. Very dense adjacent formations can still partially overlap in silhouette, although they no longer share large Counter faces. GIF palette quantization may slightly dither terrain.

READY FOR LEADER REVIEW
