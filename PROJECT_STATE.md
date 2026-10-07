# GRAND-PLAY-001 branch state

- Branch: `grand-play-001-paused-campaign`; this file's containing commit is the delivery identity.
- Base: `e008340a69304529ebab2f336938dba993366f34`.
- City presentation source: `003292992f24d4c82a8107ec3b6063b681d697dc`, selectively integrated; no wholesale main.ts replacement.
- Candidate: common fixed-step continuous campaign, German player / Soviet AI, 3 corps per side, 36 active units on existing 1280-hex map. Existing economic settlement and city ownership retained, time-scaled once per 120 minutes.
- Local service: `http://127.0.0.1:4200/`; start/stop in `experiments/grand-play-001/`. Keep running for user play. Protected 4197/4198 untouched.
- Validation: build; 10 targeted simulation checks; 3 complete fixed-seed campaigns; equipment/personnel/budget conservation audit; takeover/assignment seams; actual browser orders, combat, withdrawal, production, save/restart/load/resume. Latest city integration checks complete authorized DTO, retained SVG, ground inspection, unit and command-target priority. No old recapture campaign rerun.
- Results: both attack plans achieve German objective at tick150 with materially different losses; basic hold loses objective. Development examples, no balance or human enjoyment claim.
- Limits: German player only, one local manual disk slot, heuristic AI, no active rail/bridge repair command in continuous UI. Old modes remain. No cloud saves, deployment, paid resources or production merge.
- Evidence and operating guide: `evidence/grand-play-001/REPORT.md`, `experiments/grand-play-001/README.md`.
- Follow-up: user play; no automatic new strategy variants or expansion. MP-022 owns network state/delta merge; this branch does not add a second network or city renderer.
