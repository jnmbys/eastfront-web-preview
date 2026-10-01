# AI-PLAN-022 — shared authorized plan interface

Base: `ca0d53ca76f44013f61170355c9e5fb1a620eefa` (021 evidence, unchanged 014 policy).

**Outcome:** the frozen 021 route now enters through the real opt-in Host candidate gate and is accepted by Core. This fixes the demonstrated interface mismatch. It does not implement a main-attack planner, demonstrate strategy improvement, or change the existing preview.

## Scope and contract

- Headless `FairHost` only, opt in with `planProviders: { GERMAN: provider }` (or SOVIET). No provider is installed by default. Worker/UI/Lab registration is unchanged; there is no production planning heuristic.
- Audited provider receives **only** a copied/frozen `FairInput` and its previous seat-local plan. This is not a sandbox for hostile code: providers must not capture a Host, authoritative state, external oracle or future RNG in closures.
- Output is `null` or exactly `{unitIds, goals}`. One shared region, at most 8 owned alive units and 7 unique public map cells. These are transport limits, not a selected grouping strategy. Extra fields, paths, unknown/foreign units, off-map cells and oversized payloads fail closed (`AGENT_ERROR`, no Core call).
- Host normalizes and copies the spec; it adds a `fair-plan-v1` snapshot with match/controller/side scope, observationKey, own decisionIndex and seat-local revision. The optional `plan` field is absent in default v1 packets.
- Repeated reads of the same authorized observation and own decision reuse one prepared immutable snapshot. **No authoritative/global hidden state revision controls cache invalidation or the exposed plan revision.** This avoids exposing invisible state changes through a plan counter.
- On a changed authorized observation or own decision, the provider is called again and must revalidate/recompute its intent. Returning `null` clears it. Public phase/turn changes clear stored plans even when changes came through human takeover without observing the inactive seat.
- `planGoals` ignores stale observation/decision and cross-match/controller/side snapshots. The Host's exact candidate menu is built from its own frozen input, not a policy-supplied copy.
- Group members replace their reverse-search target set with the shared region; unassigned units retain the previous target logic. Cost/risk, origin adjacency stop, score formula, prefix construction, Core and combat RNG are unchanged. Unseen blockers remain uncertain and can reject a submitted route; policies get the existing narrow feedback.
- Existing 768/unit, 32768/decision, 16/path, 128 base candidate and 8-rejection limits are unchanged. Shared targets replace prior targets; they do not append unlimited alternate routes. The existing combined one-hop/prefix menu stays at most 255 entries.

## Concrete code

| File | Change |
|---|---|
| `ai/fair/plan.ts` | Narrow spec/snapshot/provider types, normalization and stale-scope checks. Runtime dependency only the pre-existing public hex helper. |
| `ai/fair/types.ts` | Optional versioned `plan` extension; default v1 bytes unchanged. |
| `ai/authority/FairHost.ts` | Opt-in audited provider, isolated plan/cache ownership, exact-menu shared input, provider errors handled, public phase/turn clearing. |
| `ai/fair/routing.ts` | Use validated shared goals for assigned units; original targets otherwise. |
| `ai/tests/plan022.test.mjs` | 13 frozen-node and short-flow checks. |

`basicAgent`, `observationCandidates` and Host already all call `createMoveScorer(input)`; no duplicate planner implementation or new action type was needed.

## Verified evidence

`evidence/ai-plan-021/checkpoint.json.gz` and its proof are reused unchanged. At 1017/E T6 n383, G-ENG-01's diagnostic region generates `(10,5) -> (11,4)`:

1. Disabled Host retains the old menu, rejects the proposed route before calling Core, and preserves state.
2. Enabled Host and scorer share the same plan; the exact route exists in the Host menu.
3. The real `FairHost.step` accepts it via Core, reaches `(11,4)`, and leaves combat RNG unchanged.

Further checks cover frozen/copy isolation, provider payload rejection and exceptions, stale/cross-scope snapshot rejection, unchanged unassigned routing, hidden-state/RNG paired inputs and outputs, accepted decision compatibility when disabled, phase clearing during human takeover, original candidate/search/rejection bounds and compiled fair-plan import restrictions.

- `node ai/build.mjs`: passed (exit 0; build.log is empty on success).
- `node --test ai/tests/plan022.test.mjs ai/tests/move006.test.mjs ai/tests/pathfinding.test.mjs ai/tests/movement-cost.test.mjs`: **28/28 passed**, including 13 new and 15 existing checks; `tests.log`.
- No new campaign/batch evaluations. Tests use frozen decisions, micro route sequences and a bounded phase cycle, not completed evaluation games.
- No full regression or browser/device/performance acceptance claimed.

## Failures retained

- First TypeScript build rejected setting an exact-optional property to `undefined`; changed to `delete memory.prepared`, final build passed. This occurred before the build log was captured.
- Initial selected regression also included `advance014.test.mjs`; it could not load `.evaluation/original/.ai-dist/ai/fair/advance.js`, an external baseline build absent from this checkout. Preserved in `initial-tests-with-missing-advance-fixture.log`. No assertions were weakened and no surrogate baseline was fabricated. That suite remains unverified here; unchanged advance source is outside this patch.
- The first human-phase fixture stopped after 8 phase transitions, before returning to GERMAN_MOVEMENT. Preserved in `initial-human-phase-fixture.log`; its test-only traversal bound was corrected to 16 (not an AI action/search/retry limit). The final phase-clearing check passes.

## Remaining work

Main-attack membership, region selection, completion/abandonment and strategy value are still unimplemented. A next isolated task can supply a genuinely fair bounded planning provider, integrate it in the evaluator, and only after local gates run the previously specified small development comparison. Existing-candidate-only reranking remains an interface-free fallback but is not equivalent to goal-directed route generation.

No deployment, merge, PR, production config, Core/RNG/rules change or existing external Worker takeover in this task.
