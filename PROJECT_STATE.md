# EASTFRONT PROJECT STATE

- Last Update: 2026-10-01 (Asia/Shanghai)
- Current Branch: `ai-plan-interface-022`
- Current Commit: use `git rev-parse HEAD`; parent checkpoint `ca0d53ca76f44013f61170355c9e5fb1a620eefa`. The commit containing this file is the handoff identity; do not embed a self-referencing SHA.
- Current Build: AI build passed; 28/28 targeted checks (13 new, 15 existing). Old advance014 suite lacks its external comparison build and was not validated. See `evidence/ai-plan-interface-022/README.md`; no globally green Web/Core build is claimed.
- Project Goal: Headless Game → iPad Browser Multiplayer → Human + AI Mixed Wargame

## Completed

| Task / version | Commit | Validation / status |
| --- | --- | --- |
| AI-PLAN-021 | `ca0d53ca76f44013f61170355c9e5fb1a620eefa` | Leader read the remote evidence and code: private intermediate goals can produce a Core-accepted route absent from Host's exact candidate menu. No new games or strategy implementation. |
| AI-014 experimental comparison baseline | `a655892a1eed5f8a136b6c73b9d9000560df8d91` | Retained for experiments, not production adoption. Later 017/019/020 candidates are not incorporated. |
| AI-PLAN-022 / AUTO-COORD-001 | Commit containing this file | Shared authorized plan interface: frozen 021 route accepted by real Host; 28/28 checks. Leader reviewed source and caught/fixed hidden-revision cache risk. No new campaign or deployment. |

## Active Tasks

| Task ID | Objective | Owner | Status |
| --- | --- | --- | --- |
| AI-PLAN-023 (proposed) | One bounded main-attack planning policy using the shared interface | Leader to dispatch programming subagent | Not started; interface is ready, strategy hypothesis remains untested |

Other independent Worker chats are **not** members of this agent tree. Their tasks are not automatically reassigned or presumed stopped. User-supplied checkpoints remain reports until read and verified; this file is branch-scoped, not a merged global release manifest.

## Architecture

- Frontend: TypeScript browser client; local AI Worker is separate from this headless interface trial.
- Backend: existing multiplayer authority; unchanged by this task.
- Game Core: existing rules engine and vendored runtime; frozen.
- AI: authorized `FairInput` → observation-derived candidates → exact Host admission → authoritative Core. Plan extension is opt-in; no legality oracle for policies.
- Multiplayer: existing protocol and production services; unchanged by this task.

## Rules / Constraints

- Do not modify `main` / `source-main`, merge, create PRs, deploy, invoke hooks, or create paid resources outside explicit authorization.
- Experiments use isolated branches. Source-only commits carry `[CF-Pages-Skip]`.
- Preserve Core, RNG, rules, information boundaries, search and rejection budgets.
- Establish scope before changes; verify the changed contract; retain evidence and rollback checkpoints.
- Never equate a passing interface test with stronger AI, balance, or browser acceptance.

## Blockers

- Whether a shared main-attack plan improves strategy remains untested.
- Other existing Worker conversations cannot receive messages through this thread's subagent tools.
- Production deployment and a permanently running background coordinator are outside this trial.

## Next Actions

1. Implement one bounded plan policy as a separate experiment; no unbounded tuning, no claim that 022 itself makes AI stronger.
2. Adopt completed external Worker checkpoints when reported, without duplicating their in-flight work.
