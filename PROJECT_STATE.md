# EASTFRONT PROJECT STATE

- Last Update: 2026-09-28 (Asia/Shanghai)
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
| AI candidate | `ai-003-local-human`: `99ee7fd8cff6aeda68ec058f179c7f34aaedf83b` | Remote ref verified; browser acceptance pending |
| Art preview publication branch | `art-preview-001`: `bfacbb942274de37e9e6ea282931e7420499db2b` | Remote ref verified; deployment/browser acceptance not verified here |
| Supply experiment | SUPPLY-EXP-004 checkpoint v1 | Report reviewed; Git SHA not supplied, not yet Git-only handoff |

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
| AI-PREVIEW-001 | Isolated AI preview and real browser Worker/flow acceptance | 编程worker | Assigned; no completed delivery received |
| ART-PREVIEW-001 | Publish fixed artifacts and compare browser operation/layout | 美术优化worker | Remote branch now exists; await deployment URL and acceptance evidence |
| SUPPLY-EXP-005 | Make new supply affect legal movement/combat in isolated short scenarios | 规则优化worker | Assigned; no completed delivery received |
| COLLAB-SETUP-001 | Establish these three management documents | Leader | Documentation checkpoint; authorized remote publication with Pages skip flag |

## Architecture

- Frontend: TypeScript browser client, hex map/terrain/unit presentation, localized interface and authorized player views. Cloudflare Pages production: https://eastfront-web-preview.pages.dev/ .
- Backend: Node.js/TypeScript WebSocket authoritative service on Render; endpoint `wss://eastfront-server.onrender.com/ws`. Server owns action validation and multiplayer outcomes.
- Game Core: deterministic rules, Actions, integrity checks and combat RNG; production consumes vendor artifacts. Recovered Core source/build exists on isolated Core/AI branches, not necessarily this source baseline. Do not treat historical paper rules as current implementation.
- AI: isolated FairHost and policy boundary. Policies receive own PlayerView, public rule subset and limited own history; no full state, future RNG or omniscient legality oracle. AI-003 uses a browser Worker for local authority/scheduling; strategy remains weak and is not a malicious-code sandbox.
- Multiplayer: authoritative snapshots, recipient filtering, bounded recovery and compatibility negotiation; default v2, explicit v3. Human + AI mixed multiplayer is not implemented by the local AI candidate.
- Supply candidate: Python exact solver plus continuous ledger remains experimental; EXP005 is tasked with isolated Core integration. No new supply production contract has been adopted.

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
- Terminal Git authentication previously failed for art; remote art ref now exists, so do not reuse the earlier “branch absent” conclusion. Publishing and acceptance evidence still needed.
- AI real-browser and Huawei testing pending; proactive strategy and save/load absent.
- Supply effects on Core gameplay and balance unverified; timing, reinforcement reserves and captured-hub treatment are experimental decisions, not final rules.
- Historical paper AI/rules must be adapted to current fair views and current contracts before reuse.

## Next Actions

1. Read this management branch at its verified remote SHA; only the three requested documents differ from the source baseline.
2. Workers read PROJECT_STATE.md and WORKER_PROTOCOL.md from collaboration-setup-001, then continue on their own runtime branches; do not merge management-branch runtime code.
3. Workers continue their already assigned tasks above; report branch, immutable commit, evidence paths and concise delta. Leader consolidates state without merging runtime code.
4. Migrate the supply checkpoint into an isolated Git branch when authorized; until its source/evidence are fetchable, explicitly keep the legacy handoff gap.
