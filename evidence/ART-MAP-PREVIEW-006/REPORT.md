# ART-MAP-PREVIEW-006

Source: 846aa6f58416f66ca90ed48047398febdbb8e95f.
Publication: fabb559b757686c410164f8765277e383caf11ee.
Runtime tree: 762aca3d6250397d749a2a6ae0a817c156633fc0.
Branch: art-slice-preview-005; direct fast-forward child of 8ae9579b871520b3616619f0e67c060dc1db583f, force=false.
Actual browser-verified URL: https://art-slice-preview-005.eastfront-web-preview.pages.dev/

## Scope and integrity
Reused the already verified build. 67/67 local files match committed ART-MAP-006 SHA-256 manifest; 67/67 remote Git runtime blobs match local Git object hashes. 2,429,965 bytes. Remote root tree has exactly the intended files, no source/evidence/backend/config additions. See release-files.json and manifest-diff.txt. Only entry modules, HTML/CSS and manifest differ from the old release; no rendering edits or new tests/research added.

Production refs checked unchanged: main 349369ad358b9b24fa0410735649de497a94b9ea, source-main 5fe12513bca95c5b43c2ddc125021a117c5bcce4. No backend/PR/Hook/project-setting operation. Runtime still has self-only CSP and the previously audited standalone dependency closure; 58 display fixtures, not a live match or multiplayer connection.

## Online acceptance — actual cloud Chrome, 1363×936
Recorded via CUA DOM observations and unmodified screenshots:

1. Header shows 006 / full map / 640 cells; html data-ready=true; DOM counts 640 terrain polygons and 58 counters.
2. Click G-03: X13 stack panel displays full G-02 and damaged G-03; click side-panel G-02 yields aria-pressed=true.
3. Click G-01: single-unit panel displays armor 8/6/6.
4. Click X14: city panel and original road/rail entries.
5. Fit 100%: full-map screenshot live-far.png.
6. Eight + clicks: 300%, middle view live-medium.png.
7. X14 focus: 500%, clear terrain/counters in close view.
8. Drag (744,604) → (664,654): world transform changes from translate(-875.586px,0px) scale(5) to translate(-955.586px,50px) scale(5); inspected X14 remains selected. Screenshot live-near.png.
9. − gives 475%; Fit restores 100%.

This is online desktop-pointer evidence, not Huawei/touch/GPU acceptance. Existing full-map tests and performance measurements are reused, not rerun in this publication task.

## Remaining verification
Standard HTTP download of the branch manifest returned 403; see http-hash-attempt.json. CDN-served file bytes remain unverified. Exact Git artifact integrity and visible 006/640/58 page identity are verified; do not describe these as CDN byte equality.

At the recorded check read, GitHub's Cloudflare check still reports in_progress (deployment ID 2427a241-78e6-4c24-a76b-7f512dc61241), although the actual branch URL already serves the working 006 full-map page. No completed-success check is claimed unless a later status record supersedes this. One direct check-run URL was unsupported by the GitHub connector; commit check-runs endpoint remains readable.

Keep the previously measured 708 ms startup main-thread long task open. No startup, GPU or perceived-readiness improvement is claimed. Full-map Huawei operations and aesthetics await the user. For tablet acceptance: full overview → X14 focus → drag/pinch and X13 unit choice.

Rollback is prepared in ROLLBACK.md: create a new forward commit using the old runtime tree and current publication head as parent, then update with force=false. Existing immutable 35-cell URL is preserved. Rollback has not been executed.
