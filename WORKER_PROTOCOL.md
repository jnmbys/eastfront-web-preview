# EASTFRONT WORKER PROTOCOL

## Start

1. Read `PROJECT_STATE.md` at the Leader-designated management ref and record its commit.
2. Confirm repository, task branch/checkpoint, working tree and applicable `AGENTS.md`; check the task's actual implementation before editing. Management branch code is not automatically the task runtime baseline.
3. State objective, allowed/forbidden files or behavior, validation and publication scope. Ask only for missing information that affects correct execution.
4. Use an isolated branch/worktree. Do not switch, reset, clean or overwrite another Worker's workspace.

## Execute

Use `[STATE] → [OBJECTIVE] → [SCOPE] → [ACTION] → [VALIDATION]` for complex tasks. Reuse architecture and existing contracts; make minimal scoped changes. Analysis-only tasks do not imply implementation; deployment/verification-only tasks do not imply code changes.

Preserve RNG, privacy and rules contracts; explicitly identify experimental exceptions. Keep a rollback path. Test the changed boundary and required gates; reuse dated evidence where valid. Avoid repeated background, broad searches, unrelated tests and full logs in chat. Correctness takes priority over token savings.

## Git Handoff and Shared State

Canonical management branch: `collaboration-setup-001` in `jnmbys/eastfront-web-preview`. Read these files through Git or the GitHub connector; record the fetched SHA. Management-only publication must prefix the commit message with `[CF-Pages-Skip]` to prevent Pages deployment. Do not change platform settings.

- A checkpoint is a named branch plus an immutable commit, with reproduction instructions/evidence tracked at that commit. Do not use a ZIP as the normal handoff.
- Distinguish local commit, remotely fetchable commit, deployed build and accepted build. Local SHA alone does not make work accessible to another chat.
- Confirm authorization and deployment triggers before pushing. Never push `main`/`source-main`, create PRs, call hooks or deploy without applicable authorization. Do not force push.
- After an authorized push, verify the remote ref and required files. Report the full SHA, not just a moving branch name. If access blocks publication, preserve the checkpoint and report “local only”; do not claim handoff complete.
- Save source and essential reproducibility evidence in Git; omit credentials, node_modules and generated bulk that can be rebuilt. For non-Git large assets, provide a durable location and hash; do not pretend omitted assets are recoverable from Git.
- Leader owns the consolidated PROJECT_STATE and CHANGELOG on the designated management branch. Workers propose only their task delta in the completion report; they do not concurrently overwrite the shared state or merge unrelated code.
- Leader reads the delivered commit/evidence, updates state with provenance and distinguishes reported versus independently verified results. Resolve state conflicts by inspecting the latest file; never replace it with an older whole copy.
- Chats share context through explicit Git reads when invoked. This protocol does not provide automatic messaging, polling or cross-chat execution. Until a management ref is published, mark this workflow as locally prepared.

## Completion Report

```text
TASK COMPLETE
Task ID:
Status: local only / remotely available / deployed / accepted (state separately)
Branch:
Commit: full immutable SHA
Checkpoint / Base:
Changed Files:
Validation: commands, outcomes, evidence paths; identify reused/unrun checks
Known Issues:
Recommended Next Step:
State Delta: completed / active / blocker changes for Leader
```

A blocked or partial task must say so instead of claiming completion. Keep the chat report concise and put detailed evidence in the checkpoint. State and changelog entries reference the task commit; the setup entry may identify its containing commit by a Git lookup to avoid circular self-hashing.
