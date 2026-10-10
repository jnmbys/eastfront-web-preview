# Settings preservation and read-only recovery review

Parent checkpoint: f3c8a1dc3b7740117a0aae384b239f401783758a.

## Recovery result
No exact original settings.txt was found; **unable to restore precisely**. No restore was performed. Target pre-probe SHA256: d7dec667a70112e9915b32f36cc1edc5c049f577d24fad2bea7fee031584ee0b.

Current complete file, all existing probe files, second-probe configuration backups, prior probe report and timestamp/SHA256 manifest are preserved in `C:/Users/jinyibo/eastfront/runtime/division-settings-preservation-20261010`. Full personal configuration/database copies remain local, not committed to the repository. Current file matches its newly preserved copy (d18b7f1cdecb59f27b0dd5cc315e031f152e19ef635228acb0523269daa931f9).

Read-only search scope: the actual game's user-directory settings/backup filenames; this task's two runtime directories, documentation/evidence; existing Windows FileHistory configuration path; available dated Codex transcript directory (2026/10/07) only for the exact game/settings reference (no candidates; 10/09 and 10/10 directories absent). No disk-wide scan or new system configuration.

Two settings.txt candidates: the isolated test stub and pre-second-attempt/settings.txt; neither matches the target hash. The latter is explicitly NOT a first-probe backup. No usable FileHistory configuration was present at its normal per-user path. Win32_ShadowCopy read-only query returned `初始化失败`; this is an unavailable inspection channel, NOT proof that no historical copy exists anywhere.

Known probe PIDs 11484/38868/29028 and bookkeeping PIDs 38376/42184 were absent. Temporary installation userdir.txt was absent. Nothing was killed or deleted this turn. Original game was never launched this turn. Probe records and backups remain preserved. There are no pre-probe complete save-directory hashes: no claim that all saves were proved unchanged, and no evidence-based claim that any save is damaged.

## New code
- Read-only extractor now retains 14 units' explicitly declared scalar base attributes and every relevant technology enable_subunits occurrence, including enclosing technology conditions and source hash. Missing attributes remain absent/unknown, not zero.
- Extracted four additional_brigade_column_size effects under distinct land-doctrine milestones. These are source facts; runtime eligibility remains unverified and fifth-row adoption stays locked.
- Designer exposes source facts in optional details. Base battalion organization/strength/width/supply values are NOT represented as division effective combat attributes.
- Server computes and stores personnel/equipment demand on draft save, ignores client-provided demand, checks reference profile identity when supplied, and rejects a saved derived demand inconsistent with its composition. Older drafts without derived demand remain readable. No campaign unit or resource changes.
- Focused tests cover authoritative demands, stale profile, forged saved demand, ownership, two-client same-name receipts, restart, slot boundary and unchanged settlement. TypeScript check passes.

## External condition for behavior tests
A verified original 1.19.3 **separate execution environment** is needed (for example a separately provisioned test machine/VM), with a demonstrably independent user directory, no user/cloud saves, no Mods or optional DLC, and runtime version/DLC/log evidence. Only after that boundary exists can costs, exercise XP/attrition, conversion refunds, organization and training-experience changes be tested. No more launch parameters, redirects, or changes to the user's existing game configuration will be attempted here. No further overall architecture approval is needed.

Formal adoption, real XP acquisition and unified new combat attributes remain unavailable; they are not simulated with invented constants. No deployment, fee, or user campaign modification.

Actual browser verification used a separate paused test instance on 4265: added one infantry battalion, saved the draft, opened source facts and saved the campaign. Persisted demand is 1000 personnel / 100 infantry equipment; source facts show organization 60, strength 25, width 2, supply 0.06. Screenshot: evidence/04-source-attributes.jpg. No formal conversion or new combat effectiveness is claimed. Test instance closed after evidence; existing 4264 service and its campaign were not restarted or advanced.
