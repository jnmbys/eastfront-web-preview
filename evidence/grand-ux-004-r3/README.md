# GRAND-UX-004-R3

## Fixed baseline and measurement boundaries
- Runtime before: `98ce391f48120a474295d057a231a45192e47f35`; starting evidence commit `85cc259d72cc11dbbd77e8adeabb5f9f5f728a98`.
- User upgraded Render. Read-only confirmation: `1c-2g`, Singapore, one instance, existing 1 GB disk, deployment `dep-db4bq4m0tbcc73ds0g3g` Live. No plan/resource/fee change by this task.
- `public-1core-before.json`: isolated visitor, deterministic normal initial state, 60 seconds paused/1x/4x each, actual production Client over HTTPS/WSS. These are protocol timings, not browser/tablet timings. After-run uses the same initial configuration, not an import of the user's live save. Initial authorized state is retained for comparison. No public checkpoint-injection endpoint was introduced.
- `same-save-profile.json`: exact existing R2 `browser-campaign.json.gz` checkpoint, 120 steps per version, same CPU. Authority, economy, RNG and both authorized views match. Mean simulation 69.25 -> 53.78 ms, snapshot 14.27 -> 13.34 ms. This is an offline code comparison, not a hardware speed claim.
- Historic 0.5-core evidence is unmatched; do not calculate a hardware improvement ratio.

## Changes and unchanged guarantees
Bulk detached PlayerView cloning, reuse a fair view only inside one enemy planning call, copy-on-write sequential delta application, avoid cloning an already owned outgoing snapshot. No state packet skipped. Continuous UI no longer queries the unrelated legacy Core projection. Snapshot pushes yield while the atomic authority queue is busy; each simulation step yields a real I/O opportunity. Auto/manual saves retain fsync, atomic rename and valid backup, with asynchronous disk waits. Duplicate acknowledged business requests do not repeat disk writes. Simulation/AI/economy rates and outcomes unchanged for identical accepted actions/ticks.

Own marker selects immediately; “移至友军格” is the explicit move-to-occupied-hex tool. Manual tasks retain corps membership; STOP persists. Show marching/waiting/completed/replaced rather than stale acceptance. Clock pending is distinct from confirmed pause; under-speed is disclosed. Joystick avoids current bars/sidebar. Corps primary control follows pause state. Infantry/armor/artillery/engineer/HQ symbols use existing role data. Production identity and allocation stay together; animation controls moved to settings.

## Actual browser fragment
Windows Codex IAB, 1024x768 desktop viewport, native clicks/drags. Not a Huawei/iPad test; no claim of dual-touch hardware verification.
1. At 1x, select G-013, G-025, G-037, each click an empty adjacent destination: six clicks, no confirmation/ownership step. All execute while time advances.
2. Drag changes translate(0,0) to (50,30), scale remains 1.4. Joystick changes translation only and stops on release.
3. Open production, remove one factory from antitank and add it to infantry. Accepted allocation/efficiency/day-rate visibly update.
4. Draw two real front cells with the map tool during pushes, finish draft, submit HOLD. Authorized front becomes two cells; primary button becomes pause.
5. G-037 -> “移至友军格” -> G-042 marker issues travel to 21,9. A subsequent marker click selects G-042. At completion both are selectable in the real same-hex stack.
6. Stop G-042, advance at 4x, pause, save. Restart only our 4266 process; July 4 04:40 remains paused, persistent manual HOLD survives. Select member and restore corps plan, save again.

Evidence PNGs 01–05 and compressed browser/server observations retained. 30 click-to-next-animation-callback samples: median 2.75 ms, maximum 23.9 ms. This measures local callback opportunity, not end-to-end painting or tablet latency. About 117 seconds at 1x and 109 seconds at 4x observed; 12 long tasks, 50–59 ms. rAF diagnostic sample distribution is not advertised as display FPS. Core browser actions were performed before final pending-button wording/backup-suffix polish; reloaded final build verified persistence/selection/resume.

## Safety and rollback
`check.mjs`, `seams-check.mjs`: deterministic outcomes, actual manual movement/hold/resume, withdrawal preservation, unauthorized control rejection; ordered immutable patches; durable acknowledgment, duplicate request, valid backup, restart pause and old-era rejection, failed-save reporting.
Deployment startup validates and copies existing visitor saves to `.before-ux004-r3` once, after old process shutdown. Same save/rules versions. Roll back code to `98ce391...` with current latest saves; never replace new progress with an old backup routinely. Existing `.bak` and prior backups remain. No user credential or save deletion, no fee changes.

Public after-run results and exact online/evidence SHAs will be appended after deployment, not asserted in advance.
