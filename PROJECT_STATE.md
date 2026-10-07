# GRAND-PLAY communication integration branch state

- Branch: `grand-play-001-mp022-integration`; containing commit identifies this delivery.
- Gameplay base: `0a7e670e911ffd08cc99419aa5159d422d9189a7`.
- Fixed communication: `e5863d48b37e5b0c62158c9d1229346b081900d8`.
- Fixed city art: `003292992f24d4c82a8107ec3b6063b681d697dc` (already in base).
- One shared Campaign authority, existing ledger and fixed-step simulation; no CITY phase driver, duplicate economy or renderer.
- Two German co-command terminals, Soviet AI. Commands, pause, production and disk save use R1 WebSocket transport; full authorized view reconstructed before rendering.
- Local entry: http://127.0.0.1:4220/?client=a . Keep running for user; original4197/4198/4200/4201/4210/4213 services untouched.
- New targeted checks and real browser evidence: `evidence/grand-play-mp022/REPORT.md`.
- Start/stop/scope: `experiments/grand-play-mp022/README.md`.
- No gameplay retuning, deployment, merge, public exposure or paid resources. Existing simulation/CITY evidence reused.
