# ART-BUILD-003

Source base: 040b4988b9d47efa761f3bb93039ea8940723871. Management read: 4f891f50.
Accepted runtime: 8778cb4f307c3d01f471ac2b326f8beef4c5f500.

## Rebuild from a clean checkout

Requires Node >=22 (verified v24.19.0), npm (verified 11.9.0).

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix task-source/ART-PREVIEW-002
npm run typecheck --prefix task-source/ART-PREVIEW-002
npm run build --prefix task-source/ART-PREVIEW-002
npm test --prefix task-source/ART-PREVIEW-002
npm run compare --prefix task-source/ART-PREVIEW-002
```

Output: task-source/ART-PREVIEW-002/dist/. The complete TypeScript source and unchanged lockfile are tracked. Locked TypeScript is 5.9.3. Build uses frozen candidate/vendor Core declarations/runtime and candidate static assets; those are dependency inputs, not game implementation changes. No candidate/app file is copied. All app JS is emitted by tsc. Preview guard, disabled multiplayer entry, fixed-scene bootstrap and instrumentation are applied by the checked-in build script using existing preview-only sources. No hand-edited emitted logic.

The previously broken package scripts pointed to missing full-project/server scripts; they now expose only the isolated frontend operations. Backend typechecking is outside this task. No Core/protocol/rules/AI changes.

## Evidence and exact difference

380 generated candidate files; 379 byte-identical to 8778cb4f. Only app/main.js differs (artifact-diff.json records every generated hash; artifact.diff records all four hunks). Differences are duplicate/comment wording, comment placement, and indentation. TypeScript parses both without errors and prints identical syntax when comments are removed. This is a specific syntax comparison, not a claim of byte identity or a complete behavioral proof. The 11 tests run against freshly compiled dist all pass.

Legacy startupDiagnostics/build.json sourceCommit is intentionally preserved as accepted historical origin 1f124566ef669fc50af93be7aaa34c7135b346d9 to avoid unrelated runtime metadata changes. It is not the ART-BUILD-003 build commit; use this task branch/commit for build provenance. Baseline and accepted runtime remain tracked unchanged on this source/evidence branch.

Install used normal npm ci, succeeded (5 packages). No offline retries. An initial relative clone attempt used the wrong working directory and failed before the corrected absolute clean clone. npm emits an existing http-proxy configuration warning but exits successfully. No failures hidden.

Browser verification and preview release result are recorded separately in ACCEPTANCE.md. Existing two-size layout evidence remains under evidence/ART-PREVIEW-002. GPU and Huawei validation remain unclaimed.
