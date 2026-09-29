# AI-PERF-006 — candidate; browser performance acceptance incomplete

## Provenance / scope
Source parent: 695ca0524eb039808491b18c69cea1fb74da0cca, tree983f68953604293de3b957b13ed286871c8306aa. Management PROJECT_STATE/WORKER_PROTOCOL read at c7531c70fab4b7c7402cd2f7d927c2134adee228. Remote ai-perf-006 absent at start and final prepublication check; isolated worktree used.

Prior release f3fac5a9b58deab1f9391fd46e782c728711ef76 / evidence61836657db0eafd84b1aa0e0ee0d12e4794b8073 is unchanged. Candidate branch ai-perf-006, [CF-Pages-Skip]. No preview/production/backend update, PR, hook or force push. Source strategy, authority, Core, rules, RNG, server and core-adapter inputs unchanged (frozen-inputs.json). No skipped Actions, changed thinking interval, animation reduction or message dropping.

## What the old number measures
Read prior evidence/ai-preview-002/REVIEW.md, preview-perf.js and worker-perf.js. Old pointerup/wheel/click capture callback calls performance.now(), then records time until an RAF callback. It omits event dispatch queue delay, does not cover pointermove/continuous drag, and measures before paint rather than displayed pixels. RAF throttling/cloud scheduling and unrelated main work can enlarge it. Thinking attribution uses last received metadata at observer delivery; it is not a causal tag. Expanded live diagnostics repaint on messages/inputs/long tasks and can cover controls. Therefore ~1 second is neither device touch latency nor evidence that Dijkstra blocked the main thread. 70.4ms policy duration was in another thread; 355ms was main Long Task maximum in the previous run, not this candidate.

## Located issue and minimal change
Production updateLocalAiStatus rebuilt its entire bar and rebound handlers on every call. Snapshot view refresh and the client status callback call it repeatedly. A pointer sequence can lose its original Exit target between down/up, and repeated parsing/DOM allocation is avoidable. Reused PERF002/PERF004's retain-identity approach: initialize the bar once, update changed text, retain Exit/diagnostic/takeover nodes and their one handler. Handlers read current client metadata, not a captured old meta object. Diagnostic textarea is reused. This is a demonstrated control-identity/churn defect, NOT proof of the dominant 1-second stall cause.

Same seed17 33-state notification schedule,99 updates after initial mount, counted software DOM: before495 created nodes / after0; Exit identity false→true, listener count1; latest count/seat/takeover text correct. status-before-after.json records local software execution times, which exclude browser layout/paint and are not claimed as user response improvement.

## New opt-in measurement
Use an isolated build with ?aiPerf006=1&aiSeed=17; aiSeed is uint32 and only honored with diagnostics enabled. Default games retain fresh random seeds. No auto-changing seed or shortened Action sequence. Copy diagnostics during play with existing button; after Exit, use the opt-in home button to export the completed report. No live overlay/polling/RAF loop, no network export. Scalars only; last128 samples per stage plus total/count/max. No unit/state/action data in added Worker perf fields.

- policyMs: actual selected policy call. thinkMs: full LocalMatch.think including rule application and snapshot (inclusive).
- snapshotMs: authorized snapshot/model creation (also nested inside think).
- workerToMain: worker absolute performance time immediately before postMessage through main handler entry; includes cloning, dispatch/queue, and clock precision. It does NOT isolate serialization from transport.
- clientReceive / sessionApplyInclusive: synchronous recipient handling and subscription callback, inclusive of view refresh.
- sessionApplyOutsideView: callback duration minus measured viewUpdate duration; approximates non-view session work, not browser rendering cost.
- viewUpdate: existing dynamic refresh including map, side panel, fog/binding/camera updates. mapUpdate: DynamicMapRenderer subspan; nested, do NOT sum all stages.
- drag/zoom/exit/takeover EventQueue: performance.now minus event.timeStamp at capture, only valid nonnegative <60s samples. CallbackToRAF: capture to next RAF, before paint. Continuous pointermove is observed only with pressed buttons. Not hardware latency; no promise of presented pixels. Takeover opens the existing native confirmation; user/dialog waiting must be reported separately and excluded from an application-only latency claim.
- mainLongTask: supported browser Long Task entries >=50ms that begin in the current diagnostic generation; no speculative thinking attribution.
- exitHandler measures synchronous dispose/home work. stopHandled is a zero-duration count marker. Exit invalidates pending RAF callbacks; its post-exit paint latency is deliberately NOT reported as measured. No new pause contract; Stop fixture and Exit remain distinct.

Collector is disabled by default. Old-game RAFs and older long-task entries are excluded after restart; late disposed-client messages are checked before diagnostic measurement. Node Worker receives the same option via START; policy output untouched.

## Validation and same-condition data
- Build/typecheck: candidate-build.log, final-build.log, frontend-typecheck.log, test-build.log.
- targeted-tests.log:6/6; retained Exit identity/listener, seeded real module Worker before/after/diagnostics-on equality, late reply/new-client isolation, bounded/off diagnostics, synthetic input queue vs RAF and generation fencing, actual Worker termination after accepted3.
- local-final.log: existing11 local tests pass; forced flows, reaction/retreat/advance/breakthrough, stop/takeover, privacy, client/session single-flight, stale replies, cancelled cold startup.
- regression.log: those11 plus existing PERF004 fog/panel/presence regressions3 =14/14. No claim of a new full58-test strategy run; reuse sourceAI00558/58 evidence, since strategy untouched.
- worker-replay.json: seed17 initial full-map Soviet deployment,34 authorized snapshots (initial+33 accepted), exact normalized view/model/meta/revision hash identical before, after-off, after-on. Only random matchId fields normalized. This is NOT a full-campaign replay or movement-phase performance sample.
- cancel-worker.json: real Node module Worker terminated at accepted3, no later frames;30 remaining deployment actions not delivered. Existing explicit stop/takeover contracts passed separately. Browser click-to-stop latency remains unknown.
- stages-before-after.json / stages.log: three alternating before/after runs of the same seed17 initial33 actions. Real policy, LocalMatch, structuredClone, NetworkPlayerSession and DynamicMapRenderer; software DOM only. Equal full authorized trace hashes. All stages recorded including every sample/max. Small variations reverse across rounds (e.g. map-update maxima before10.46/5.49/0.66ms vs after0.78/0.80/1.96ms). Map algorithm was not optimized; these variations are warmup/runtime noise, NOT claimed speedup. Think-inclusive ranges44–65ms; policy maxima<2.5ms in this deployment-only fixture. Cannot compare with previous movement70.4ms as same workload.

No new real-browser longest-task number exists. Retain previous355ms only as historical context. No actual drag, pinch, stop or exit latency A/B accepted; no Huawei evidence. Existing automatic-match comparison and browser evidence are separate tiers.

## Failed attempts / uncompleted validation
Supported cloud browser could not open local candidate: net::ERR_BLOCKED_BY_CLIENT (browser-block.json). Local HTTP server itself started; no port/fingerprint/tunnel bypass or deployment attempted. Thus root-cause localization of the observed real-browser ~1-second delay remains incomplete. Candidate resolves only demonstrated bar churn/control replacement and prepares proper attribution for the next preview.

First test attempt omitted the compiled vendor subtree: failed-missing-vendor.log. Second raw replay comparison included randomized model.battleSummaries.matchId: failed-raw-replay.log; inspection showed that field differs, so only matchId is normalized and all behavior retained. Initial combined local-test run used the narrower local-build output without fair/index.js: failed-test-build-scope.log; compile ai/tsconfig.json for existing local tests. These were harness/build setup failures, not hidden as passes.

## Reproduction
Create a clean detached baseline worktree at695ca0524eb039808491b18c69cea1fb74da0cca and a candidate checkout. Use locked npm dependencies in both. In baseline: node ai/local/build.mjs, then copy vendor/ into .ai003-dist/vendor/. Set PERF006_BASELINE to its absolute .ai003-dist directory.
In candidate: node ai/local/build.mjs; node node_modules/typescript/bin/tsc -p ai/tsconfig.json; copy vendor/ into both .ai003-dist/vendor/ and .ai-dist/vendor/ for Node tests. Then:

    node --test ai/tests/perf006.test.mjs
    node --test ai/tests/local.test.mjs tests/perf004-frame.test.mjs
    node ai/tests/perf006-stages.mjs

No generated bulk or node_modules committed. Build outputs are ignored; evidence and source are in Git. Test helper baseline default /tmp/ai-perf006-baseline-dist is overridable with PERF006_BASELINE.

## Next gate (not executed)
After candidate review, arrange a separately authorized isolated preview. Compare instrumentation-only baseline and candidate with identical seed17, same human actions, same device/viewport/foreground visibility and collapsed diagnostics, including a movement phase (not just deployment). Record all stage spans plus Event Timing/presentation evidence when supported, Long Tasks, continuous pan/zoom and Exit timing. Confirm no late visible Actions after Exit and fresh restart. Repeat Huawei separately. Do not describe this candidate as having solved or explained the 1-second browser stall.
