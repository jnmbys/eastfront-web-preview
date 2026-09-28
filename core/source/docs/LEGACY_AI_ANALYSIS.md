# Existing Python simulator: reuse analysis

Reference inspected: `reference/legacy-v6-operational-graph-simulator.py` (2433 lines).

The current simulator mixes three concerns in one inheritance-heavy Python file. Digital Branch should separate them rather than port the file line-for-line.

## A. True game rules — port/regression-test

These are suitable as **Reference Implementation / Regression Oracle**:

- lines ~11–61: hex neighborhood, offset→cube distance, road/rail/river graph loading
- lines ~63–146: unit stat tables, ZOC/support/armor classifications, CRT, reinforcement schedule
- lines ~224–330: stacking, city control, ZOC, supply reachability
- lines ~334–379: rail repair legality/rate (AI allocation score itself is not a rule)
- lines ~381–394: HQ command legality/cost/range skeleton
- lines ~424–470: movement cost + road + river + ZOC/recon movement semantics
- lines ~620–710: combat strength, CRT shifts, combined arms, terrain, river, AT, artillery, flank, entrenchment, HQ shifts, ±2 cap
- lines ~875–909: fair multi-step loss application and retreat legality skeleton
- lines ~1030–1093: reinforcements, recovery constraints, entrenchment, turn flag reset
- lines ~1094–1140: victory/timing and high-level turn order

These should become deterministic pure functions in TypeScript and be compared against fixed Python fixtures.

## B. AI decision logic — do NOT port into Rules Engine

Examples:

- `_strategic_score()` and movement destination scoring
- `target_value()`
- candidate attack subset search
- `_expected_utility()`
- automatic HQ command spending heuristics
- V4/V5/V6 strategic plans, rollout bonuses, adaptive memory
- V6 operational graph objectives and cross-sector movement priorities
- route-aware rail repair *selection* scores
- Soviet defensive geometry and reserve positioning

AI may call rule-query APIs (`legalMoves`, `combatPreview`, `supplyPreview`) but may never redefine legality or combat resolution.

## C. Simulation / instrumentation — keep outside rules

- frame/replay snapshots
- event commentary
- metrics counters
- batch runners
- CSV export
- CLI argument parsing
- random tie-breakers used only by AI planning

These belong in a simulation harness package later.

## D. Specific legacy behaviors already captured in milestone 1

- hard two-total-unit stack cap
- road edge movement cost 1
- forest/hill Jäger movement reduction
- minor/major river movement surcharge
- recon one-use ZOC exception
- CRT ratios and ±2 net shift
- combined arms / forest / AT / artillery / flank modifiers
- deterministic replacement for scattered `random.Random` usage

## E. Migration recommendation

Do not delete the Python simulator until the TypeScript engine can run fixture-by-fixture parity tests for:

1. movement cost and reachable paths
2. supply state on a frozen position
3. combat breakdown and 2D6 result
4. losses/retreat/advance
5. rail repair legality
6. a complete scripted 2–3 turn action log

Only after parity exists should AI simulation be redirected to TypeScript.
