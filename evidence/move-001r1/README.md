# MOVE-001R1 — explicit movement selection

MOVE-001 is not accepted: Huawei user confirmed friendly-occupied movement works but selecting the next unit fails. Dice UI remains paused.

Baseline actual production source 946bfbddb1335acd5230a539aead90756b55fd1e, publication 23f3d96f8906bb78c9422227e5feb03424426fe7. Workspace starts at evidence-only successor bd7ea1b60eb8c4aa11b9fd9010b36d56b9ec5682 (tree 879ebaf9077d342c624aacf7dc58d9ab1023a2f8), clean. Remote refs and Cloudflare build marker checked; no newer baseline detected. Backend source-main remains 8876f812b6e9bb137d7f08fd6e92eecfb5635b4b and will not be published.

## Confirmed cause

Both local and network selectCounter unconditionally entered MOVE_PATH during movement. Local successful commit cleared path but did not end MOVE_PATH. Main intercepted every subsequent friendly click as a target, including first-step empty paths. Two new actual-binding tests failed on the prior release: ordinary selection returned MOVE_PATH, and successful move still returned MOVE_PATH. The previous tests incorrectly accommodated this by requiring a cancellation before selecting another unit.

## Minimal frontend correction

- Friendly selection now enters SELECT. A selected unit is not movement intent.
- Existing movement panel gains START MOVE / 开始移动. This explicitly enters MOVE_PATH even with zero steps. Only this mode routes Counter, hit/model and blank-hex clicks to the existing draft handler. Panel explicitly labels destination mode versus ordinary unit selection.
- Successful local commit returns SELECT. Local rejection clears the invalid draft and exits while retaining error feedback. Cancel and undo-to-empty (including origin backstep) exit; exiting before the first step works.
- Multiplayer keeps pending protection and existing Action/revision/snapshot authority. ACK does not apply state. Authoritative snapshots already clear modes; ACTION_REJECTED now explicitly clears movement capture before permitting fresh selection. Stale-revision resync path is unchanged.
- No Core/MP costs/stack/ZOC/Combat/FOW/protocol/server/terrain/camera/STARTUP-002 changes. v2 remains default, v3 opt-in. No backend release.

## Tests performed

Client and server typecheck PASS; client build and server test-runtime build PASS.

Full regression executed: 614 tests, 613 initial PASS, one nested fixture hash failure (UA003R1's hash of the updated UA002 frozen fixture). Reviewed dependency hash updated without weakening assertions; affected UA003R1 rerun 9/9 PASS. This is one full run plus affected rerun, not an unexecuted claim of a second clean full run. Hash changes are recorded in hash-review.json; historical startup baseline was not changed.

All 12 MOVE tests passed in the full run:
- Complete A -> explicit start -> friendly B target -> confirm -> select C without cancel -> explicit start -> move C. Local loop covers Counter, hit rect and blank hex.
- Normal selection and blank-hex no-op outside target mode; empty first-step cancel, draft cancel, final undo by button/origin; separate same-hex unit selection.
- Full movement-budget commit then select C; invalid/full destination refusal and safe recovery.
- Actual local WebSocket clients/server: three surfaces, pending duplicate and stale cancel events, authoritative snapshot, immediate C selection and second completed move. Server rejection returns SELECT and permits another successful move without cancellation. Full-stack remote target sends no Action.
- Existing touch/mouse drag/pinch/cancellation and model identity/stack tests also passed.

Production asset audit CLEAN, static HTTP check PASS, deep combat smoke PASS with zero integrity issues. Historical UI008 smoke is known from MOVE-001 to contain a stale English home assertion; not rerun or claimed passing. Online/browser evidence will be added after publication.

## Use and rollback

Select a unit -> Start Move -> destination -> confirm. Successful confirmation returns to normal selection. During destination selection, Exit Move can be used even before the first step. Undoing the last step also returns to unit selection.

Rollback frontend with a new revert commit or a new child of main using old publication tree c77ce605fb51b64c6984c78352bd480ecc9118bf. Do not force push. This restores rejected MOVE-001 behavior, so rollback is only a fallback, not acceptance. Cloudflare main integration is retained; backend is untouched.
