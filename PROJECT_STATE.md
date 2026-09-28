# EASTFRONT PROJECT STATE

- Last Update: 2026-09-28 22:34 (Asia/Shanghai)
- Current Branch: `collaboration-setup-001` (documentation only; designated shared management branch)
- Current Commit: source baseline `5fe12513bca95c5b43c2ddc125021a117c5bcce4`; documentation checkpoint is the commit containing this file (`git log -1 --format=%H -- PROJECT_STATE.md`). A commit cannot embed its own final SHA.
- Current Build: baseline package `0.0.10`; no build performed for this documentation-only task. Production frontend and experimental candidates are separate versions below.
- Project Goal: Headless Game → iPad Browser Multiplayer → Human + AI Mixed Wargame
- Repository: `jnmbys/eastfront-web-preview`

## Evidence / Version Policy

Remote refs were fetched for this setup. Historical validation below is Worker/user-reported unless explicitly stated otherwise; it was not rerun here. A remote commit is not proof of deployment or device acceptance. No single candidate branch represents all completed work. This file is a dated snapshot, not automatic cross-chat synchronization.

| Role | Version / checkpoint | Status |
| --- | --- | --- |
| Frontend production branch | `main`: `349369ad358b9b24fa0410735649de497a94b9ea` | Remote ref verified; live files not rechecked |
| Backend source branch | `source-main`: `5fe12513bca95c5b43c2ddc125021a117c5bcce4` | Remote ref verified; runtime not rechecked |
| Core tested candidate | `core-baseline-002`: `db183c7733ae59d2f5a3bcb8f3f384357b7d59e6` | Isolated, not production |
| AI candidate | `ai-003-local-human`: `99ee7fd8cff6aeda68ec058f179c7f34aaedf83b` | Worker-reported cloud browser acceptance passed; Huawei pending |
| Art preview publication branch | `art-preview-001`: `040b4988b9d47efa761f3bb93039ea8940723871` (handoff), `8778cb4f307c3d01f471ac2b326f8beef4c5f500` (deployment) | Git evidence read; two iframe sizes passed per Worker; source rebuild/device/performance pending |
| Supply experiment | SUPPLY-EXP-005 checkpoint v1 | Report reviewed; Git SHA not supplied, not yet Git-only handoff |

## Completed

| Version / Task ID | Commit | Validation result / limits |
| --- | --- | --- |
| MP-006 compact map encoding | `123e87e31a703c49fbc47933cb31d049ce214c8e` | Reported compatibility and deployment checks; ~30% offline message reduction; latency benefit unproven, A/B paused |
| STARTUP-002 | `74a9d821e20bedd8a1ebb83bc901ddcbd1d745c9` | Huawei new-site startup and multiplayer entrance accepted; not complete multiplayer acceptance |
| MOVE-001R1 | `08882b33292d95f5113df612070b42545ede7d3b` | Explicit movement mode, subsequent unit selection; user accepted |
| COMBAT-UX3.1 | `0d60f5b745981094ffad90bc95e64bd79f1e3967` | Reported Web 637/637 and cloud two-client results/history/reconnect; Huawei multiplayer pending |
| CORE-FIX-001 / CORE-BASELINE-002 | `f8e732138a8e3c01d2885ddac09a33e2fedfec18` / `db183c7733ae59d2f5a3bcb8f3f384357b7d59e6` | Reported Core 97/97, Web 637/637, smoke 28/28; baseline cleanup did not alter 76 runtime artifacts |
| AI-002 forced flows | `a8f9dadd7252f7572440b3767d5a11b7ccb7c094` | Reported 221 accepted actions, natural end and deterministic replay; not evidence of strong strategy |
| AI-003 local human entry | `99ee7fd8cff6aeda68ec058f179c7f34aaedf83b` | Reported Web 637/637, AI 39/39, final local 11/11 separately; browser blocked; no save/load |
| ART-PREVIEW-001 prepared candidate | `1f124566ef669fc50af93be7aaa34c7135b346d9` | Reported 760 manifest entries plus manifest, immutable preview artifacts; browser/layout/performance pending |
| SUPPLY-EXP-004 | Git SHA unavailable; checkpoint v1 | Report reviewed: 957 legal Actions, 54 conserved settlements, cold 0/9 and warm 0/54 timeouts after fix, Chromium operations; Core still uses old supply |

## Active Tasks

| Task ID | Objective | Owner | Status |
| --- | --- | --- | --- |
| AI-PREVIEW-001 | Isolated AI preview and real browser Worker/flow acceptance | 编程worker | Cloud acceptance reported; release f8b1a1ff31a0d50d4e6dcd8d0837edb3b6506f70, deployment a736b1db; Huawei/performance pending |
| AI-004 | Basic autonomous movement and attack using fair views | 编程worker | Git handoff ea71d31dd7277565b1684453bc1a4baf126912d6 reviewed; isolated complete, not deployed |
| ART-BUILD-003 | Reproducible source build and generated preview | 美术优化worker | Complete; c3d6e890892fc58960251c9215e066e46eef7436. Candidate frozen pending supported controlled performance/device checks |
| SUPPLY-EXP-005 | Make new supply affect legal movement/combat in isolated short scenarios | 规则优化worker | Report reviewed: minimal runtime loop complete, isolated/local only; no Git SHA delivered |
| SUPPLY-EXP-006 | Git handoff plus player-controlled combat follow-up in supply sandbox | 规则优化worker | Next task proposed; no execution claimed |
| COLLAB-SETUP-001 | Establish these three management documents | Leader | Documentation checkpoint; authorized remote publication with Pages skip flag |

## Supply EXP005 Evidence Intake

Leader read SUPPLY_EXP_005_REPORT_2026-09-28.md; results below are Worker-reported, not independently rerun. Local-only checkpoint v1, no commit delivered. Base Core db183c7733ae59d2f5a3bcb8f3f384357b7d59e6, six isolated TS changes; solver unchanged. 12 seam tests and actual Chromium operations passed; 12-commit replay hashes match. Same 5+1 dice gave new AR vs old NE with identical RNG states. Recovery example uses explicit higher experimental capacity and delayed full-round-end distribution; it is not a balanced production configuration. Automatic combat choices limit tactical evaluation. Atomic rollback and material conservation reported. Git migration remains required before normal Git-only handoff.

## ART-BUILD-003 Closure

Leader fetched c3d6e890892fc58960251c9215e066e46eef7436 on art-build-003 and read evidence/ART-BUILD-003/{ACCEPTANCE,BUILD}.md. Source/build 75e39c7e164f7c23e46be597d10f83b8e8098299; deployed 6fac36a0c5e0e77ee15c3a02ecb2bebd4dcabb04 at https://2ccb0505.eastfront-web-preview.pages.dev/ . Worker reports clean clone, locked dependency install, isolated frontend typecheck/build and 11 tests passed. Repeated 380-file builds identical; versus accepted8778, 379 identical and main.js differs only comments/format with comment-free syntax equality. 761 served resources matched; necessary two-size iframe operations passed. Leader closes source reproducibility blocker on reviewed evidence, not an independent rerun. Backend build outside this art task. Legacy startup build.json remains historical1f124566; use task source/deployment commits for current provenance. Current browser API lacks controlled cache reset/network throttling; cold/warm comparison and GPU evidence remain open, Huawei untested. Freeze this candidate; no additional art/build rewrite or production replacement authorized.

## Art EXP002 Evidence Intake

Leader fetched immutable handoff 040b4988b9d47efa761f3bb93039ea8940723871 and read evidence/ART-PREVIEW-002/ACCEPTANCE.md and PREPARED.md directly from Git. Deployment 8778cb4f307c3d01f471ac2b326f8beef4c5f500 at https://75a6305b.eastfront-web-preview.pages.dev/ is separate from the evidence-only child. Worker reports dock, HTML touch-target/contrast fixes, removal of unused Medium/Close prebuild and 11/11 scoped tests. Tests used edited compiled JS, not a fresh TypeScript build; offline npm install failed on missing ws. Historical build gap CLOSED by ART-BUILD-003 below. 761/761 served files matched; _headers verified in Git separately. Iframe acceptance is not Huawei acceptance; roughly 11k SVG nodes and partial RAF samples do not prove regression or improvement. Controlled cold-cache/GPU evidence absent; baseline RAF raw log incomplete. No production replacement approved.

## AI004 Git Intake

Leader fetched ea71d31dd7277565b1684453bc1a4baf126912d6 and read evidence/ai004/REVIEW.md. Worker reports strategy/boundary 29/29, reused passing forced/local 19/19, builds and 71-module Worker audit. Fixed seed17 campaign repeats: 925 successful transitions including terminal, 692 MOVE, 2 ATTACK, 144 rejected attempts. Only rejection aggregate persisted; next priority is trusted-host diagnostic replay to classify avoidable vs hidden-information rejection without expanding policy feedback. One-step greedy approach, single-attacker scoring and no detours/cooperation remain weak-policy limits. Direction changes across turns are not ruled out by fixed-goal monotonic distance. Browser/Huawei acceptance for AI004 absent. AI-PREVIEW-001 still uses original AI003 source. Proposed AI004R1: narrow rejection diagnosis/fixes, then isolated preview validation; no claim task has executed.

## Latest Acceptance Evidence

Leader read the supplied AI-PREVIEW-001-REVIEW.md (2026-09-28); no independent browser replay was performed. Source 99ee7fd8cff6aeda68ec058f179c7f34aaedf83b; release f8b1a1ff31a0d50d4e6dcd8d0837edb3b6506f70; fixed preview https://a736b1db.eastfront-web-preview.pages.dev/ . Report covers both seats, actual Worker, movement/switching, combat/advance/breakthrough, reinforcements, explicit takeover, exit/new game, terminal flow; scripted attacks do not establish autonomous strategy. 480 remote artifact paths and live manifest were reported matching; 10 extra HTTP resource checks returned 403. AI-PREVIEW-001 report and essential evidence are now fetchable under evidence/ai-preview-001 at ea71d31dd7277565b1684453bc1a4baf126912d6.

## Architecture

- Frontend: TypeScript browser client, hex map/terrain/unit presentation, localized interface and authorized player views. Cloudflare Pages production: https://eastfront-web-preview.pages.dev/ .
- Backend: Node.js/TypeScript WebSocket authoritative service on Render; endpoint `wss://eastfront-server.onrender.com/ws`. Server owns action validation and multiplayer outcomes.
- Game Core: deterministic rules, Actions, integrity checks and combat RNG; production consumes vendor artifacts. Recovered Core source/build exists on isolated Core/AI branches, not necessarily this source baseline. Do not treat historical paper rules as current implementation.
- AI: isolated FairHost and policy boundary. Policies receive own PlayerView, public rule subset and limited own history; no full state, future RNG or omniscient legality oracle. AI-003 uses a browser Worker for local authority/scheduling; strategy remains weak and is not a malicious-code sandbox.
- Multiplayer: authoritative snapshots, recipient filtering, bounded recovery and compatibility negotiation; default v2, explicit v3. Human + AI mixed multiplayer is not implemented by the local AI candidate.
- Supply candidate: EXP005 Python solver invokes isolated Node Core; Core/resources/debt/epoch/request IDs/replay commit atomically. Movement/attack costs, shortage MP cap, attack reduction, attrition and recovery now affect actual rules in experimental new mode. Old penalties disabled in new mode; old-mode equality reported. No production supply contract adopted.

## Rules / Constraints

- 不未经授权修改 `main` / `source-main`；实验保持隔离；修改前确认 scope；必须验证。
- Preserve RNG / Rules contracts and PlayerView privacy. Rule experiments must identify their explicit isolated deviations; never silently change production rules.
- Keep STARTUP-002, MOVE-001R1 and established combat behavior; do not merge unrelated candidates implicitly.
- No deployment, PR, hooks or configuration changes from this documentation task. Management-branch publication is authorized; commit and push remain separate operations.
- Existing deployment evidence: Pages previews allow non-production branches (`exit 0`, output `.`); Render listens to `source-main`, PR previews off. A new branch push can deploy a Pages preview. Management publication must use the official `[CF-Pages-Skip]` commit-message prefix; retain that prefix on future management updates. Existing Actions restrict push triggers to source-main. Reference: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/ .
- Runtime validation, browser acceptance, device acceptance and balance are distinct. Record failures and reused evidence; never label unrun tests passed.
- Documentation-only work needs diff/content checks, not repeated game builds or full regressions.

## Blockers

- Cross-chat notifications remain manual. Fetch and verify the designated remote ref before claiming a handoff; Git does not wake or message other chats.
- Terminal Git authentication previously failed for art; remote art ref now exists, so do not reuse the earlier “branch absent” conclusion. Worker now reports art deployment https://1b617ef1.eastfront-web-preview.pages.dev/ and partial acceptance; ART002 supersedes this: actual iframe sizes passed and 761/761 served runtime hashes matched per evidence; ART-BUILD-003 closes the isolated frontend TypeScript/build gap; controlled performance and Huawei remain open.
- AI cloud Chrome 1363×936 operations and real Worker passed per reviewed AI-PREVIEW-001 report; local tests 11/11. Huawei touch, exact tablet sizes and performance pending; AI004 basic autonomous strategy now exists on its isolated source branch, not the published preview; save/load absent. Extra HTTP checks returned 403 and remain unverified.
- Supply EXP005 actual gameplay effects demonstrated in isolated scenarios, not balance or human experience. Combat loss/retreat are automatic and optional advance/breakthrough/Schwerpunkt are declined. HQ/artillery/recovery interactions incomplete; experimental run stops after T15 without formal victory. Timing, reinforcement reserves and captured-hub treatment remain experimental.
- Historical paper AI/rules must be adapted to current fair views and current contracts before reuse.

## Next Actions

1. Read this management branch at its verified remote SHA; only the three requested documents differ from the source baseline.
2. Workers read PROJECT_STATE.md and WORKER_PROTOCOL.md from collaboration-setup-001, then continue on their own runtime branches; do not merge management-branch runtime code.
3. Workers continue their already assigned tasks above; report branch, immutable commit, evidence paths and concise delta. Leader consolidates state without merging runtime code.
4. Migrate the supply checkpoint into an isolated Git branch when authorized; until its source/evidence are fetchable, explicitly keep the legacy handoff gap.
