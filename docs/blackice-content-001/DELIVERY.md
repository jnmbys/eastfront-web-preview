# BLACKICE-CONTENT-001 — author evidence, not full closure

2026-10-11. Branch `blackice-mp-001`; runtime tested: `c69b38b32bcae748dd631a4297fe16118b69fb5f`, rules `BLACKICE-001-LAND-1-R1`. Only experiment tools/docs/evidence changed. No product fix, parameter change, push, merge, deployment or original-service restart.

## Result

**Production → paid dispatch → cross-period arrival → equipment replenishment is demonstrated. Full personnel replenishment is NOT demonstrated.** The fixed normal campaign reached its ten-day observation budget (tick 2880), not campaign termination. No seed search or resource injection. P2 drawing and browser/tablet items are untouched.

Normal seed 219031, 36 initial units, ordinary Soviet AI. German legal scripted orders: HOLD, one existing gun factory reassigned to support production, one formal engineer template saved at naturally earned XP ≥10, three existing two-infantry formations adopted at tick 240. This costs 10 army XP once; adoption does not charge again. Factory starts at 0.1 efficiency after allocation, reaches 0.25. Steel 2 / aluminium 1 are resource **capacity requirements**, not inventory purchases. Each support item costs 4 factory work; 52 completed, 1.96875 work remains, total 209.96875 work. Existing gun production was forgone (0 new guns); no new factory or resources.

Added demand per unit: 350 personnel, 5 rifles, 30 support items. Template totals: 2850 personnel, 255 rifles, 30 support; 52 HP, manpower-weighted max organization ≈33.77193. Partial personnel are proportionally allocated under unchanged rules.

| Unit | First support arrival (tick) | All equipment filled | Personnel received / actual casualties | End personnel / target |
|---|---:|---:|---:|---:|
| G-025 | 322 | 1482 (123h30m from start) | 160 / 0 | 2660 / 2850 |
| G-026 | 352 | 1791 (149h15m) | 155 / 181 | 2474 / 2850 |
| G-030 | 381 | 2108 (175h40m) | 129 / 0 | 2629 / 2850 |

Each ends with 255 rifles and 30 support. National support accounting: **60 initial + 52 produced = 21 warehouse + 90 in cohort + 1 lost**. Thus at least 31 newly produced items were needed for these actual deliveries/losses; fungible stocks do not identify a particular manufactured item. The former 48-hour evidence is not used as proof.

## Transport and remaining constraint

First support batches: G-026/G-030 dispatched tick 241; arrival 352/381, 27 rail edges plus loading/last mile. G-025 dispatched 252 and arrived 322 over 13 rail edges. One item costs 0.05 freight tonnes and respectively 1.35 / 0.65 train-work units. There is no invented monetary transport fee.

Unique cohort batches: 372; end 24 pending batches. Totals: personnel 492 dispatched = 444 arrived +48 pending; rifles 31=31+0; support 91=91+0. No cancellation residual. Personnel checks: 2500+160−2660=0; 2500+155−2474=181; 2500+129−2629=0. Inventory validator ran every simulation step, including escrow.

At the final point `GERMAN-depot-3` capacity is 12 per hour: daily supply uses 10.4866667, shared replenishment uses 1.5133333, summing to 12. National manpower remains 3180, support stock21, material resource factor1. The cohort receives only about 14.1–17.5 personnel/day over its adopted period, far below the 300/day reception ceiling. Daily supply being full does **not** mean spare replenishment capacity. G-026 additionally lost 181 personnel in actual combat. This demonstrates a shared transport bottleneck, not a reason to increase production or give free personnel. It does not claim every earlier delayed step has the identical bottleneck.

No confirmed implementation error was identified that justifies a gameplay patch. Minimal next decision, if full-strength closure is required: retain these rates and test a fixed legal rear-area refit / prioritization or the actual shared hub-and-rail upgrades. Do not raise reception limits alone or promise one hub upgrade fixes downstream rails. Such a follow-up was **not** silently added to the frozen run. Full-staff engineer closure remains open.

## Restart and scope of checks

Saved at tick241 with real support cargo in flight. Node PID7636 closed its service and exited; new process PID19972 restored the same HTTP visitor/campaign, same tick, paused. Resource ledger, transit, production/economy (excluding the single derived legacy cache), unit state and RNG digest match. Final save succeeded at tick2880; arrivals above occurred after restart, no second debit or missing batch.

Two collector issues are retained: initially IDs omitted their hyphens, before the first simulation step; then an overly broad digest included `econ.modern.lastPersonnel`, which restore intentionally rebuilds. This cache is consumed by the old economy loss recorder, overridden in the model-ledger campaign. A separate twelve-step saved-state continuation with retained versus rebuilt cache gave equal units/ledger/RNG each step. No game code was changed to make the check pass. The first failed restore attempt did not advance time; the same tick241 save was resumed.

Protocol scope: real HTTP visitor and seat-session creation, existing authority adapter commands and persistent-service restart. Commands were **not** issued by a browser/WS client; do not call this a browser or full multiplayer protocol pass. No shared runtime code changed, so unrelated MP/industrial/18-case combat suites were not rerun.

## Existing engineer effect

Controlled combat-kernel ablation uses naturally obtained G-025 at tick2880: 2660/2850 people, all equipment, actual engineer satisfaction 0.933333. With identical other attributes/opponent/dice, the implemented river attack factor is 0.79 versus 0.65 when only the engineer-specific benefit is disabled; effective river attack 2.683893 versus2.208267, requested HP damage0.0402584 versus0.033124. This proves that existing effect is applied at actual partial staffing, **not** a natural battle victory or full-strength result. No campaign inventory, RNG or position was modified by the comparison.

Existing works formula is documented in PLAN; G-025 has accrued288 work ticks. Forest/hill catalog bonuses are not consumed by this BLACKICE combat resolver and are not claimed. A natural engineer crossing battle and browser operation are unverified.

## Evidence / rerun

- `evidence/blackice-content-001/summary.json`: timings, actual arrivals/losses, conservation, bottleneck.
- `timeline.ndjson.gz`: step-linked observations; unpack streaming. Non-player cargo diagnostics omitted; original full collector file remains in isolated temporary evidence, not a real save.
- `restart.json`, `transit-before-restart.json`, `restart-differences.json`, `restored-cache-control.json`: actual process restart and cache exception.
- `effects.json`: controlled effect calculation; `start.json`, `final.json`: own cohort / economy detail.
- `setup-error.json` / `setup-failed.ndjson`: pre-simulation collector failure.

From this worktree:

```powershell
node experiments/blackice-content-001/run.mjs evidence/blackice-content-001/replay-NEW
node experiments/blackice-content-001/analyze.mjs evidence/blackice-content-001/replay-NEW
```

Choose an unused output directory. The runner refuses overwrite, creates a random loopback port and temporary save directory, and performs an actual child-process restart. It advances full legal five-minute steps offline, not real-time performance. `restored-check.mjs <private-test-directory> <evidence-directory>` reproduces the isolated cache control; no user save is read.

Temporary port51130 is closed. Original4275/PID50880 and4277/PID54068 remain untouched. No browser was started. Private test identity/save retained only in the OS temporary test directory. Local commit contains these author results; existing running game code was not replaced. Submit to Leader; do not mark full engineer closure, BICE balance, drawing or touch validation complete.
