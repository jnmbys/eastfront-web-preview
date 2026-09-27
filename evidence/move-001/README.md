# MOVE-001 — friendly occupied target routing

Baseline source 74a9d821e20bedd8a1ebb83bc901ddcbd1d745c9 / tree 75ba46d8710fea239e5e0acbaa6491d68ab7471d. Production main ca7175d87872d7611eaa570c66d0cbd94802131d / tree a41e341bbd7f6062afaf70a5ad29e64f1a33d8bc. Remote refs rechecked before publication; initial worktrees clean.

Cloudflare project eastfront-web-preview serves repository main (precompiled root, build exit 0, output .). Official URL https://eastfront-web-preview.pages.dev/. Source-main 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b is also the backend deployment source and is intentionally untouched.

MP-006 stage closed: volume optimization delivered, latency improvement unproven; v2 default, explicit v3. STARTUP-002 and mirror configuration retained. Earlier Huawei user reported mirror startup and basic two-player deployment success; this does not establish MOVE-001 acceptance.

## Reproduction and fix

Actual compiled application's counter binding changed selectedUnitId from mover to friend in the new regression before the fix. Blank hexes used extendMoveDraft; both counter/model hit paths selected a unit instead. The new common unit router gives MOVE_PATH friendly hex routing priority, reusing the same chooseMoveTarget handler and unchanged local/network extendMoveDraft. The existing model-hit proxy still bubbles to its owning counter; hit rectangles use the same handler. No new movement validity rules or Actions.

Cancel now clears the existing path and returns presentation mode to SELECT, allowing normal selection and details. Selecting a unit starts MOVE_PATH as before. Origin clicks use existing path undo/adjacency feedback. Invalid local drafts still display Core issues and Core refuses commit; remote drafts still accept only server-projected legal options. Snapshot application remains the only remote position update.

Consumed click events stop propagation; WeakSets avoid rebinding retained counter/hit/hex nodes. Invocation-time network guards prevent stale listeners from drafting or stealing selection while submission/projection is pending. Existing gesture arbitration, camera, geometry, artwork, animation, gameplay, fog, terrain, startup, codecs and backend are unchanged.

## Verification

- Client + server typecheck PASS; client build PASS.
- Full test run: 608 tests, 603 initially passed. Five failures: three exact frozen hashes, one source-string assertion reflecting the moved select call, one ordinary model-selection fixture that assumed selection could override MOVE_PATH.
- Hash review explicitly lists the changed main file and dependent fixture/helper hashes; exact equality assertions retained. Ordinary model selection fixture now cancels MOVE_PATH first, retaining identity/state assertions. Affected UA regression rerun: 85/85 PASS. This is full suite plus affected rerun, not a second full run.
- MOVE-001 focused tests: 7/7 PASS, including a later added multiplayer full-stack test. Three target surfaces, origin undo, invalid distant/full destinations, cancellation/switching, unchanged pre-confirm state, single binding/bubbling, real local WebSocket two-client Actions and snapshots, duplicate pending click, server rejection and subsequent successful move.
- Existing camera tests: 6/6 PASS, mouse/touch drag threshold, pinch, cancellation and suppressed synthetic click. DOM fixtures validate actual handlers, not physical browser hit testing or Huawei hardware.
- Production asset audit CLEAN; pure-static HTTP gate PASS (123 retained raster files); deep production combat smoke PASS, zero integrity issues.
- Historical UI008 production-smoke script fails its first hardcoded English `NEW GAME` assertion against the unchanged localized home markup; it predates current UI. Neither script nor home was modified to suppress this. Current production lifecycle/combat tests passed in the full suite, and deep combat smoke passed separately.
- Online artifact and browser UI verification follow publication. Huawei MOVE-001 acceptance pending.

## Rollback

Revert the frontend publication commit on main with a new commit, or publish the exact previous main tree a41e341bbd7f6062afaf70a5ad29e64f1a33d8bc as a new child of current main. Cloudflare then redeploys; no force push or backend release. Source rollback: revert this task's commit on its dedicated source branch.
