# UI Visual Pass B

Parent: 895eb360946dd822c2042c97b25b49f7db45276b.

## Changes

- Campaign HUD with authoritative phase, turn, faction seal and resource hierarchy; no invented date or scenario name.
- Commander dossier: larger type emblem, attack/defense/movement readings, supply, status and position.
- Phase advance button: current phase label, weighted brass frame and inset directional medallion. It still invokes readyForPhase, with existing Core ready gates.
- Deployment: type-first roster, larger icons, three-step visual guide and selected-unit message. An optional, initially open position list offers 48px targets for the same projected deployment zone. Position buttons invoke deploySelectedUnit, exactly as the map does. Core still decides legality and stacking. Existing next-reserve selection is unchanged. Roster and position-list scroll offsets survive dynamic refresh.
- Asymmetric menu typography and layered dark framing. Player footer no longer contains frozen-Core/build assertions. Developer-only diagnostics remain behind existing developer gates.

## Scope

Production changes: src/main.ts, src/ui/commandPresentation.ts, styles.css. No Core, Geometry, scenario, combat, unit rules, terrain assets, renderer or localization-workflow edits. The new position control is a UI input alternative, not a deployment-rule change. It does not snap arbitrary map taps or choose a destination automatically.

## Validation

Typecheck PASS. Build PASS. 42/42 targeted tests PASS (new position-projection/Core-dispatch tests, existing interaction, loader and web-preview suites). Frozen Core/Geometry/P5R1 checks passed within those tests. git diff --check PASS.

## Visual evidence and known issues

BEFORE-AFTER.html is a self-contained static comparison against Pass A. Home uses actual production home markup; roster uses actual production functions and fresh scenario projection. HUD is a representative composition with a fixed checkpoint-D map export. It does not execute game actions and is not a screenshot.

Actual browser rendering, iPad/Huawei interaction and final visual quality are NOT verified. The earlier supported-browser localhost attempt was blocked; no deployment or bypass was attempted. Large position buttons still display canonical coordinate pairs; this avoids tiny hit targets but is less spatially intuitive than the map. Invalid/occupied destinations can still be rejected by Core and reported in the existing order report. Small screens retain the existing overlay panel behavior, which can obscure part of the map. Dynamic refresh reopens the position disclosure while a reserve is selected. These limitations need device review before claiming improved player usability.

No Civilization commercial images, icons, layouts or artwork are included. Original serif hierarchy, faction letter seals, thin brass divisions and navy command surfaces express the requested strategic tone.
