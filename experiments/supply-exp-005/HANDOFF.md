# SUPPLY-EXP-005 Git handoff

- Task: SUPPLY-EXP-005
- Branch: supply-exp-005-checkpoint
- Commit: containing commit (`git log -1 --format=%H -- experiments/supply-exp-005/HANDOFF.md`).
- Runtime base: db183c7733ae59d2f5a3bcb8f3f384357b7d59e6 (unchanged).
- Management read: collaboration-setup-001 @ 12db9ec797d69b47b0f875208fa6c899cfb5efbd; no management code merged.
- Source, contracts, brief: this directory, CONTRACT.md, REPORT.md.
- Reused validation: evidence/test005.log (11 tests), evidence/test005-dice-rollback.log (1 test), evidence/recovered-attack-replay.log (12 commits), evidence/browser005.json and screenshots. Prior execution evidence, not rerun by Git migration.
- Git packaging check: restore-fixtures.py validates every restored byte; isolated TypeScript rebuild and git diff --check. Fixtures/fonts compressed losslessly; no node_modules/browser binaries/cache. Original logs and failures retained.
- Publication: task branch only, commit prefix [CF-Pages-Skip]; no deployment/PR/merge. Remote availability must be confirmed with remote ref after push.
- Known limits: automatic optional combat followups; experimental recovery capacities; no final victory integration, balance or human acceptance. Online version unknown.
- Leader delta: EXP005 minimum actual-action/combat loop completed; replace legacy ZIP-only handoff with this task branch after remote verification. Leader owns shared project state.
