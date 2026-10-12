# 招募与部署候选 — author handoff

Branch/worktree: `hoi4-recruitment-001`, `C:\Users\jinyibo\eastfront\work\hoi4-recruitment-001`.
Independent new rule `HOI4-RECRUITMENT-001-1`. Base factory-conversion remains pending review. No Push, merge, deployment or changes to4298/other existing services.

## Play

Local candidate http://127.0.0.1:4299/ . Enter, open **招募**, select a formal template, city and quantity, then **招募所选编制**. Each row shows equipment/personnel and training progress. Up/down changes recruitment priority. Click **缺口与运输** for actual amounts; cancellation stops requisitions and waits for paid return. Save uses the existing manual/autosave controls. New units appear in the existing unit list, initially independent and resting; use normal direct orders or assign a corps.

This is local single-player-vs-AI entry. Dual independent identities were tested using an isolated room protocol worker, not two-browser gameplay. There is no public deployment.

## Actual results

- **Normal new game**, fixed seed219031, default economy/AI/weather, queue German two-infantry template at桦林. Budget fixed16days; no resources/work/readiness injected. Actual deployment tick3861 =321h45m elapsed,2500 personnel/250 rifles, XP0.1, org0. Normal production over this interval1342 rifles and107 guns; initial reserve and ongoing production share the existing fungible pool, so this is not a claim of lot-level provenance for every delivered rifle.
- From that natural checkpoint, isolated continuation rested160steps then issued ADVANCE. Unit moved **5,2→6,2**, end tick4201; no injected organization or relocation. `deployed-action.json`.
- Web, independent local identity: select template/city→enqueue→run→see52/2500 persons,8/250 rifles,4 in transit→cancel→manualsave→reload/re-enter. Original row remained cancelling with unchanged arrived amounts. `web-assembly.png`, `web-reconnected.png`, `web.json`. Not a full thirteen-day browser run and not tablet certification.
- Controlled ready fixture transfers existing reserve into recruitment and sets a near-complete training checkpoint, explicitly synthetic. Deployment once, legal direct order, next step and restore pass. It is not used as normal progress evidence.
- Scarce-stock controlled test leaves one existing rifle (remaining stock moved to a field holder, not destroyed/granted): two recruit rows cannot spend it twice; cancelled first row returns before second receives.
- Actual child service exit/restart with in-flight recruitment; restored paused, same inventory/weather/RNG; next120steps exactly match uninterrupted reference. Separate two-identity room restart preserves private queues/identity and saves again. A second explicit ready fixture transfers existing reserves and sets training XP; a further real process restart retains exactly one deployed ID and one deployment record.
- Foreign recruit/cancel rejected; private queue absent; stale economy generation rejected; duplicate request creates only once. Capture/recapture freezes/resumes without asset duplication. Old/new save rejection confirmed. TypeScript check passes.

## Reproduce

Run from this worktree with existing dependencies:

```
node experiments/hoi4-recruitment-001/build.mjs
node experiments/hoi4-recruitment-001/check.mjs
node experiments/hoi4-recruitment-001/competition.mjs
node experiments/hoi4-recruitment-001/protocol.mjs
node experiments/hoi4-recruitment-001/restart-check.mjs
node experiments/hoi4-recruitment-001/normal.mjs
node experiments/hoi4-recruitment-001/deployed-action.mjs
```

Normal runner uses the full authority, at most4608steps; no altered simulation speed/cost. Other tests are marked controlled/component/protocol. Original development baseline normal result retained as `baseline-normal.json`; final supply-accounted run is `normal.json`. Runtime details and stop-file path are in `evidence/hoi4-recruitment-001/preview-process.json`; creating that stop file gracefully closes **this** service. Do not stop4298 or use its saves. Rollback means stop this independent candidate and return to prior entry; never pass new saves to the old engine.

## DeepSeek review focus / remaining limits

Review scoped transport pool and source/return reservations, cancel while inbound/outbound, conservation totals including recruits, no-corps unit registration, generation protection and private snapshot filtering. Sources/parameter adaptations in MODEL.md. Heavy-template natural completion, actual combat of a newly recruited unit, dual-browser recruitment and tablet interaction are not separately verified. Permanently occupied cities retain blocked escrow. Current UI uses dropdown deployment location rather than map-click assignment. This is author verification, not independent acceptance or full HOI4 reproduction.
