# ART-SLICE-PREVIEW-005 publication record

## Release
- Source: `b2bb0734386f94c9e46e42c914768b123af0bd68`.
- Publication branch: `art-slice-preview-005`.
- Publication SHA: `8ae9579b871520b3616619f0e67c060dc1db583f`.
- Root tree: `ef731b263b2d9c48540b9dcf84723b621ea12dcc`.
- Verified live URL: https://4ffa913a.eastfront-web-preview.pages.dev/
- Cloudflare project: `eastfront-web-preview`; deployment `4ffa913a-a995-4a7f-a721-a40cf37215a4`; success check saved in DEPLOYMENT.json.
- Exact 67-file runtime closure, 2,423,311 bytes including manifest. No new art, map expansion, backend, Hook or PR.
- Runtime manifest SHA-256: `89f794658c1440113fe91fdcb8eb33e7ea5e98c3b8a38d3625ba9492ba083fdd`.
- Local runtime bytes matched the committed source manifest; every remote Git release blob matched local Git hash. RELEASE-MANIFEST.json records paths, hashes and sizes. RELEASE-DIFF.txt records source-to-runtime-only diff (source files omitted intentionally).

## Isolation and unchanged refs
The standalone entry imports the experimental renderer, map data, geometry and counter UI, not production bootstrap or multiplayer client. Units are display fixtures; no move/combat/session action. CSP connect-src is self. This is source/closure verification, not a live network packet capture.

After deployment main remains `349369ad358b9b24fa0410735649de497a94b9ea`; source-main remains `5fe12513bca95c5b43c2ddc125021a117c5bcce4`. The source art-slice-005 branch is used only for this evidence-only follow-up, with CF-Pages-Skip.

## Live browser observations
Cloud Chrome, viewport screenshot 1363 × 936, desktop pointer, immutable URL above. Screenshots are actual unmodified browser captures. Browser event timestamps 2026-09-29 UTC; execution host clock differs, so no synthetic wall-clock loading time is asserted.

| Action | Observed result |
| --- | --- |
| Initial open | 35-cell candidate and textured assets rendered; preparation notice cleared |
| Select X13 engineer G-03 | G-03 checked; damaged state and two-unit panel visible |
| Choose panel G-02 | G-02 checked, G-03 unchecked; X13 retained |
| Select tank G-01 | G-01 checked; W12 panel and 8/6/6 status |
| Click V13 | Forest panel; V12–V13, V13–W13, V13–W14 main river entries |
| Click X14 | City panel and four road/rail entries; live-far.png at 100% |
| Zoom in twice | 100% → 150%, larger terrain and counters |
| Drag (744,607) → (659,670) | Map visibly translated −85,+63; X14 inspected state retained; live-near.png |
| Zoom out | 150% → 125% |
| Toggle baseline and return | 003 engineering baseline then 005 material slice |
| Fit | Restored 100% |

A role-based checkbox locator did not match the baseline control; AX click then succeeded. This was an automation selector mismatch, not an app failure. Console read showed extension metadata errors; they are not attributed to the app.

## Verification limits
- Initial terminal Chromium failed ERR_EMPTY_RESPONSE; retained in LIVE-RESULTS.json (this file describes the failed terminal attempt, not the subsequent successful cloud UI checks).
- Standard urllib request for live manifest returned HTTP 403. No alternate network route or access-control workaround used. Therefore CDN-served byte hashes are **not verified**, despite exact local→Git hashes and successful SHA-linked Cloudflare deployment. verify-live.cjs retains the intended repeatable hash/UI check for a network-enabled environment; it did not pass here.
- No new FPS/GPU or load-time measurement claimed. Reuse source evidence for local measured performance, separately from deployment UI observations.
- Huawei touch/pinch, Huawei GPU, user aesthetic acceptance and full-map scaling remain unverified. Cloud desktop success does not replace them.

## Open and rollback
Open the live URL directly on the tablet, preferably landscape. Drag the map, use +/− or touch gestures, tap a unit or terrain; use the right panel to disambiguate the two X13 units. Touch gestures remain a device acceptance task.

Rollback is not executed: delete only branch art-slice-preview-005, then delete deployment 4ffa913a-a995-4a7f-a721-a40cf37215a4 in Cloudflare Pages project eastfront-web-preview. Branch deletion alone does not guarantee removal of the immutable deployment URL. Do not reset main/source-main. No backend rollback is involved.
