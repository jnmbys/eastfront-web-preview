# CHANGELOG

Date: 2026-10-01 (Asia/Shanghai)

Task ID: AI-PLAN-023

Change: Add one opt-in, German-only shared intermediate-region planning provider and a fixed two-game evaluation with cohort records.

Reason: Test the main-attack coordination hypothesis after resolving the shared-candidate interface in 022.

Commit: The pre-run commit containing the frozen source/config/runner; runtime manifest records its exact SHA. Local preregistration is distinct from subsequent remote delivery.

Validation: AI build and 34/34 targeted checks passed; AI005 opponent runtime matches 67/67 historical hashes. Independent source/runner review completed. Two games are still pending at this entry's preregistration; results will be recorded in `evidence/ai-plan-023/README.md`.

---

Date: 2026-10-01 (Asia/Shanghai)

Task ID: AUTO-COORD-001 / AI-PLAN-022

Change: Establish scoped Leader/subagent coordination and Git state handoff; see the task evidence for the plan-interface implementation and test results.

Reason: Avoid manual message relaying and resolve AI-021's disagreement between private plan routing and Host candidate admission.

Commit: The commit containing this entry; parent checkpoint `ca0d53ca76f44013f61170355c9e5fb1a620eefa`.

Validation: AI build and 28/28 targeted checks passed; old advance014 regression unavailable because its external original build is missing. Failures and final evidence are retained in `evidence/ai-plan-interface-022/README.md`. No strategic improvement, production deployment or autonomous background service is claimed.
