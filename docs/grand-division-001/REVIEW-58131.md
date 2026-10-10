# 58131 implementation checkpoint — not adoption-ready, not deployed

Baseline: 57e29cc48ed26f377755c51ddfbb3e3ddd062a3f. Same branch and isolated candidate, public game unchanged.

## Code delivered
- The authoritative transport receipt now carries only the successful division save's templateId/templateVersion. UI matches that receipt, never a name or list order. Missing receipt identity locks the save rather than risking duplicate creation.
- Two cooperating clients creating identical names receive distinct permanent IDs. Retrying creates no additional template; editing A does not change B. Tested through the real ReleaseAdapter queue, not claimed as simultaneous browser testing.
- The 1024×768 editor retains full grid, compact manpower/equipment demand summary and 44px save button together. Detailed comparison folds away. Actual browser create/save selected the new template. During continuous pushes from 06:00 to 09:00 the unsaved name, focus and scroll=0 remained intact.
- reference-profile.json fixes 1.19.3 base/no optional DLC, drives draft shape, records technology, fifth row, regimental support and same-regiment eligibility as UNVERIFIED. Unknown fifth-row additions are rejected by authority; old five-row drafts still load and permit removal. Four editable draft rows do NOT mean formal eligibility has been established.
- Six focused tests cover receipts, replay, ownership, restart, unknown-slot rejection, legacy read, and unchanged settlement for identical simulation steps; TypeScript passes.

## Original-game isolation attempts and concrete blocker
The existing executable's launcher-settings.json reports Operation Postern v1.19.3.0.c01a (5632). Its binary contains userdir= and userdir.txt strings, which establish discovery only, not isolation guarantees. Native desktop control is available; Steam and HOI4 were initially not running.

Three bounded launch probes used the pre-existing installation and a separate empty user directory containing enabled_mods=[] and disabled_dlcs listing the 44 optional DLC descriptors. No campaign was opened or gameplay action performed.

| Probe | Actual result |
|---|---|
| -userdir=<isolated path> | Isolated directory received no logs/cache; original user directory received system.log and settings.txt writes. Stopped exact PID 11484. |
| --userdir=<isolated path> | Same failure; exact configuration copies were taken before this probe and restored afterward. Stopped exact PID 38868. |
| temporary installation userdir.txt, no command-line override | Same failure. Stopped exact PID 29028; temporary file verified then removed. Original launcher-settings.json was never edited. |

The redirect methods could not establish a clean running base-game session. Therefore no claim is made about observed designer cost, exercise XP, expansion/shrink refund, organization or training behavior. Neither MAX/MIN nor cost constants were promoted into rules.

### Side effect, explicitly retained
The FIRST probe changed the original settings.txt checksum. Only a pre-launch checksum, not the original contents, had been retained, so that first display-settings rewrite cannot be claimed restored. Later probes were restored to the exact second-probe backup. dlc_load.json (nine enabled Mods), launcher-v2.sqlite, pdx_settings.txt and continue_game.json match their initial hashes. No original save was opened, edited or loaded by the test. We did not fingerprint every save successfully, so we do not claim full save-directory hash verification. No game process or userdir.txt redirect remains.

## What is still blocked, and the smallest next input
- Costs for net edits/reverts/copy/rename; XP acquisition and training attrition; expansion/shrink personnel/equipment/org/training behavior require a demonstrably isolated 1.19.3 base runtime or equivalent verified observations.
- Technology/unlocks and new regimental support qualification remain unverified; the selected version alone does not establish these.
- Formal adoption, army XP earning and the new shared combat/refill chain are NOT implemented; live units continue the old rules. This is a further code checkpoint, not the requested final playable chain.
- Minimum environment input if needed: an independently functioning original-game test profile whose actual runtime logs confirm both the separate user directory and no optional DLC/Mods. Merely toggling the user's existing Mod list is neither requested nor sufficient. No architecture approval is requested again.

Sources checked: launcher-settings.json and installed binary strings (read-only); official support https://support.paradoxplaza.com/hc/en-us/articles/360019724999-Mods-won-t-load-Mod-load-order-failed (does not document safe isolation, destructive suggestions NOT followed); historical community quotation https://steamcommunity.com/app/394360/discussions/0/3004430610117174368/ (conflicting reports, not proof for 1.19.3). Launch_options wiki returned Internal Error. No original-game video or behavior test is represented as watched/passed.

Evidence: evidence/03-review-layout-1024.jpg is a real browser viewport capture, not native tablet testing. Local independent port 4264 remains available for development; it is not offered as a replacement for the pending approved public delivery. No deploy or fee change.
