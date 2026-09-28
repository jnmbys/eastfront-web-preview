# SUPPLY-EXP-006 handoff

- Runtime parent: supply-exp-005-checkpoint @ 0e3ea184a7394d8a9984e6e7e73fc74ccfb0456a.
- Core base unchanged: db183c7733ae59d2f5a3bcb8f3f384357b7d59e6 with frozen EXP005 isolated changes.
- Management read: collaboration-setup-001 @ 4f891f50eb7ae008890418b87d6fcef92b03526c (newer than requested 69c4be6c); PROJECT_STATE.md / WORKER_PROTOCOL.md read, no management runtime merged.
- Branch: supply-exp-006-player-choice. Commit: containing remote commit (reported separately).
- Scope: experiments/supply-exp-005 only; no production, PR, hook or deployment. Commit prefix [CF-Pages-Skip].
- Changes: live.py, core-bridge.mjs, server.py, sandbox.html, CONTRACT006.md, tests and scoped evidence. Existing solver, Core TS, source fixtures and experimental parameters unchanged.
- EXP005 remote root tree e85bb6a8aa290ffbe78658393b0778a1f1021176 matches local tracked tree. Recreated clean experimental subtree (226 tracked blobs checked against Git SHA1), restored fixtures with SHA256, TypeScript 5.7.3 build and real move/duplicate smoke passed. Full repository clone failed on unrelated absent partial-clone objects; no full frontend build claimed. Prior 12 seams and Chromium evidence reused only as EXP005 evidence.
- Startup: follow README fixture restoration/build/dependency steps, python3 server.py; http://127.0.0.1:8765. Additional contract: CONTRACT006.md. Existing three clip links unchanged.
- Validation: test006.py, evidence/choices006.json fixed legal frame + Action recipes, evidence/test006.log, evidence/browser006.json. Test-only choice-probe.mjs is authoritative, never used by player candidate endpoints.
- Limits: no human/device/balance acceptance, no formal victory/full campaign. Manual ordered retreat path entry; rejection remains generic. Special recovery capacity unchanged. Browser evidence is local Chromium only.

- Final result: 6+2 scoped tests passed; browser actual choices passed; REPORT006.md and evidence/replay006-summary.json contain result limits and replay receipts. Generated large replay/screenshot files are reproducible, not included in Git; no external asset dependency added.
