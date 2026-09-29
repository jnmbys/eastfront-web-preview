# AI-PREVIEW-002 delivery — published, acceptance qualified

## Identity and scope
- Source SHA: 695ca0524eb039808491b18c69cea1fb74da0cca (AI-005).
- Published SHA: f3fac5a9b58deab1f9391fd46e782c728711ef76.
- Published tree: 4d0f889c73e343c6722b570d78d5d0a8aa1c16fa.
- Branch: ai-preview-001; previous parent / rollback SHA: 3531d33efce2eb7b0b51cd6ae5d30ee4e3174f41.
- Actual immutable URL, opened in Chrome: https://e0d7bb15.eastfront-web-preview.pages.dev/
- Performance session URL: https://e0d7bb15.eastfront-web-preview.pages.dev/?aiPerf=1
- Cloudflare check succeeded; deployment e0d7bb15-b3d1-4131-bb72-969489a3cf9b. Raw result: deployment-check.json.
- Existing build/publication flow reused. No policy additions, rules/Core/RNG/supply/art/backend changes, no PR or hook calls, no force push.
- main remains 349369ad358b9b24fa0410735649de497a94b9ea; source-main remains 5fe12513bca95c5b43c2ddc125021a117c5bcce4.

## Artifact validation
AI-PREVIEW-MANIFEST.json records source and hashes for 483 payload files. Remote Git tree equals the locally reviewed build. Actual browser module Worker produced policy telemetry identifying AI-005 and exact source SHA; autonomous full campaign exercised that Worker. Additional 3 overlay tests passed; compiled fair basicAgent/routing bytes match source output, routing import is present. Worker audit: 73 modules, no Node imports or sockets; connect-src self and empty backend URL. See build.log, overlay-tests.log, artifact-audit.json and PREPARED.md.

Online manifest retrieval from the terminal returned HTTP 403 (live-manifest-check.json). Therefore this report does NOT assert an independently downloaded whole-site hash match. Deployment check, Git tree identity and live Worker version together establish the observed publication. Existing top banner still says v0.0.10; precise preview version is in build provenance and optional diagnostics.

## Reused automated evidence
Source evidence/ai005/REVIEW.md: 58/58 tests, seed17 exact trace replay, seeds17/18/19 comparison against R1, zero rejections, natural T16 Soviet endings. No rerun or new tablet inference. These are automated matches, separate from the browser interaction below.

## Real cloud Chrome interaction
Full campaign, human Soviet; deliberately forward weak artillery at 3,15 / 3,18 / 3,6 and remaining units far east to expose combat interactions. Random browser seed, not the automated benchmark setup. German policy is autonomous (not scripted AI attack fixture).
- Both entries work: Soviet deployment32; German fresh campaign AI Soviet deployment33 accepted and human German deployment becomes available. See deployment.json, german-reopened.txt.
- T1: real AI action chain reaches three autonomous attacks B-000001..3; accepted96/rejected0 at turn end. Human defender passes support and executes two retreats (3,15 to5,15; 3,6 to4,5); one defender eliminated. AI follow-up resolves and hands back Soviet phases. See campaign-*reaction*, *retreat*, turn1-complete.
- T2: ordinary human phase-end actions resume autonomous German movement (thinking snapshot at accepted110, phase movement), followed by B-000004 against moved target4,5; battle resolves and Soviet reinforcement/supply returns, no rejection. This demonstrates resumed pursuit/actions, not an exhaustive movement trace. Visible German T1 DOM positions saved; T2 position extraction was empty after target elimination/fog and cannot establish a per-unit coordinate diff.
- Separate existing breakthrough fixture: real precomputed combat result; human advance8,-2 to9,-2 accepted, then skip all breakthrough accepted; final accepted2/rejected0 and battle closed. This verifies UI choices only, not AI initiative. See breakthrough-advance.txt and breakthrough-closed-confirmed.txt.
- Existing stop fixture: AGENT_STOP:NO_CANDIDATE, then explicit confirmation switches to manual Soviet authorized view. See stop-ready.txt / takeover-confirmed.txt. Native confirm creates a long blocked interval; its timing is excluded from campaign performance.
- Exit/new game returns home and terminates Worker (stopped:true); fresh game resets counters, no prior battle state carried. A separate cancel attempt started while status AI processing/accepted1, but final metrics show all33 deployment steps completed before termination. Functional cancellation works, but this does NOT prove immediate interruption mid-planning or bounded stop latency. Existing interface has Exit/New game, not a separate pause button.
- Zoom controls visibly changed120% to100% while AI was processing movement. Drag was delivered, but before/after viewBox identical and gesture overlapped phase completion; pan responsiveness is NOT independently verified. No claim of smooth drag.

## Measured performance and limitations
Campaign through T2 (browser/campaign-perf-t2.json):89 policy calls, total680.5ms, max70.4ms; whole Worker think/snapshot/send step max123.6ms. These are policy-call timings including deployment/forced choices, not isolated Dijkstra-only durations or browser Worker task profiling.

Main Long Task API:141 tasks >=50ms, max355ms; approximate thinking subset7, max68ms. Maximum RAF gap1066.5ms; thinking gap1033.1ms.169 pointer/click samples; maximum capture-to-next-frame1017.7ms; thinking subset4 with same maximum. These include rendering/scheduler overhead and remote browser behavior, not hardware touch latency. Long-task thinking attribution uses last received metadata at observer delivery. Four samples are insufficient for percentile or worst-case guarantees.

Result: cloud functionality broadly works, but smooth performance, immediate stop latency and pan responsiveness are NOT accepted. Huawei tablet has not been tested. No performance guarantee, no claim that 355ms covers every Worker task, no tablet extrapolation.

Expanded optional perf panel overlaps the lower-right controls. Two skip-breakthrough attempts hit the panel instead of the button; collapsing the panel allowed accepted2 and closed battle. Ordinary URL has no panel. A final wait reported a CDP deadline although locator diagnostics already showed the closed status; subsequent DOM confirmed completion. Other harness issues: label selector did not match select, fixed using observed combobox role; generic phase-end regex did not match combat-specific label, fixed using exact visible name; native confirm click timeout resolved by accepting the actual dialog. Console sample contains extension metadata errors, not app errors; this is a bounded sample, not a guarantee of no errors.

## Huawei acceptance — three steps (pending)
1. Open immutable URL, choose each player side in turn and start a full campaign; confirm deployments/turn transfer. For metrics append ?aiPerf=1, expand briefly to record version and values, then collapse before map/sidebar actions.
2. During AI thinking, drag and pinch/zoom repeatedly, then press Exit/New game; record visible stutter, tap-to-home delay, device/browser versions, and whether old actions leak into a restarted game. Do not accept cloud timings as device results.
3. Use the existing postbattle fixture to advance and skip breakthrough, and stop fixture to explicitly take over; also play ordinary campaign until autonomous contact/attack and human retreat. Save diagnostic text/screenshots and report any stuck state or rejection.

## Rollback
Saved old release SHA3531d33efce2eb7b0b51cd6ae5d30ee4e3174f41, tree2cce2f329276f0cb98a1f6bedd786b7130ed3f41. Re-read then-current remote ai-preview-001 tip; review intervening commits, append a NEW commit with that tip as parent and saved old tree, without CF-Pages-Skip, and update ref force:false. This redeploys old preview without rewriting history. Do not reset protected branches. Current evidence-only follow-up uses [CF-Pages-Skip]; published payload remains f3fac5a9b58deab1f9391fd46e782c728711ef76.
