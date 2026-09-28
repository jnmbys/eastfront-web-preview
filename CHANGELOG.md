# EASTFRONT CHANGELOG

This log starts with collaboration setup. Prior milestones are summarized in PROJECT_STATE.md; no historical changes are fabricated or retrospectively relabeled as new commits.

## 2026-09-28 — COLLAB-SETUP-001

Date: 2026-09-28 (Asia/Shanghai)

Task ID: COLLAB-SETUP-001

Change: Add PROJECT_STATE.md, WORKER_PROTOCOL.md and CHANGELOG.md only.

Reason: Establish concise Git/checkpoint-based handoff between Leader and Workers, with explicit validation and publication status.

Commit: Containing setup commit; resolve with `git log -1 --format=%H -- CHANGELOG.md` at this checkpoint. Parent: `5fe12513bca95c5b43c2ddc125021a117c5bcce4`.

Validation: Check status, staged diff and committed parent diff for exactly three added files; run `git diff --check`; confirm clean tree after commit. Game builds/tests are not rerun for documentation-only changes. No code/config edits, push, deployment or PR.

## Entry Format

```text
Date:
Task ID:
Change:
Reason:
Commit:
Validation:
```

## 2026-09-28 — COLLAB-PUBLISH-001

Date: 2026-09-28 (Asia/Shanghai)

Task ID: COLLAB-PUBLISH-001

Change: Publish the three management documents to collaboration-setup-001 through the authenticated GitHub connector, with the official [CF-Pages-Skip] message prefix.

Reason: User authorized the next step so Workers can read shared Git state without downloading ZIPs.

Commit: Resolve the containing remote checkpoint via `git log -1 --format=%H -- CHANGELOG.md`. The unpublished initial local setup was b761b459fc3b7c16a4bdcec4726bb63e20a411a6; this publication supersedes it and retains source parent 5fe12513bca95c5b43c2ddc125021a117c5bcce4.

Validation: Remote-ref and full-tree comparison are the publication gates; only three document additions are allowed relative to the source parent. Production refs must stay unchanged. No runtime rebuild required. Pages skip prefix is based on official documentation; absence of a deployed build must not be inferred solely from an absent status check.

## 2026-09-28 — AI-PREVIEW-001 / ART-PREVIEW-001 status intake

Date: 2026-09-28 22:02 (Asia/Shanghai)
Task ID: COLLAB-STATE-002
Change: Record reported AI cloud-browser acceptance and art partial acceptance; track ART-PREVIEW-002 and propose AI-004.
Reason: Keep completed engineering, remaining device checks and autonomous strategy distinct.
Commit: AI release f8b1a1ff31a0d50d4e6dcd8d0837edb3b6506f70; art release bfacbb942274de37e9e6ea282931e7420499db2b.
Validation: Leader read attached AI review and user-provided art summary; AI release remote ref fetched. Browser/test claims are Worker-reported, not rerun. Management update changes two Markdown files only.

## 2026-09-28 — SUPPLY-EXP-005 status intake

Date: 2026-09-28 22:09 (Asia/Shanghai)
Task ID: COLLAB-STATE-003
Change: Record isolated supply runtime effects and remaining automatic combat choices; propose Git migration and player-choice completion.
Reason: Separate operational supply effects from balance and full tactical acceptance.
Commit: EXP005 Git SHA not supplied; base Core db183c7733ae59d2f5a3bcb8f3f384357b7d59e6.
Validation: Leader read supplied report; 12 seam tests, replay and Chromium claims are Worker-reported. No game code changed by this state update.

## 2026-09-28 — ART-PREVIEW-002 Git intake

Date: 2026-09-28 22:16 (Asia/Shanghai)
Task ID: COLLAB-STATE-004
Change: Record two-size iframe acceptance and identify fresh source build as next priority.
Reason: Runtime tests on patched JS do not establish reproducible TypeScript output.
Commit: Handoff 040b4988b9d47efa761f3bb93039ea8940723871; deployment 8778cb4f307c3d01f471ac2b326f8beef4c5f500.
Validation: Leader fetched Git and read ACCEPTANCE.md/PREPARED.md; Worker test/browser/hash evidence not independently rerun. Management files only.

## 2026-09-28 — AI004 Git intake
Date: 2026-09-28 22:21 (Asia/Shanghai)
Task ID: COLLAB-STATE-005
Change: Record autonomous baseline, 144 aggregate rejections and closure of AI-PREVIEW-001 Git evidence gap.
Reason: Distinguish natural game termination from strategic quality.
Commit: ea71d31dd7277565b1684453bc1a4baf126912d6.
Validation: Leader fetched immutable source and read Git REVIEW.md; tests and autonomous run counts are Worker-reported, not rerun.

## 2026-09-28 — ART-BUILD-003 closure
Date: 2026-09-28 22:34 (Asia/Shanghai)
Task ID: COLLAB-STATE-006
Change: Close source build blocker; freeze art candidate pending independent performance/device gates.
Reason: Fresh source build and scoped acceptance now documented; available browser cannot control cold cache.
Commit: Handoff c3d6e890892fc58960251c9215e066e46eef7436; deployed6fac36a0c5e0e77ee15c3a02ecb2bebd4dcabb04.
Validation: Leader fetched Git and read BUILD/ACCEPTANCE; 380-file repeat build, 11 tests and 761 online hashes are Worker evidence, not rerun by Leader.
