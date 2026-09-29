# AI-PREVIEW-002 prepared release

Source: 695ca0524eb039808491b18c69cea1fb74da0cca (AI-005).
Source tree: 983f68953604293de3b957b13ed286871c8306aa.
Previous preview/rollback: 3531d33efce2eb7b0b51cd6ae5d30ee4e3174f41; tree 2cce2f329276f0cb98a1f6bedd786b7130ed3f41.
Initial protected refs: main349369ad358b9b24fa0410735649de497a94b9ea; source-main5fe12513bca95c5b43c2ddc125021a117c5bcce4.

Built with existing ai/local/build.mjs, then the enclosed build.mjs applies preview-only timing adapters. Fair policy modules are byte-identical to the AI005 compiler output. Source tests58/58 and full-game evidence are reused from evidence/ai005 at source commit. Additional overlay tests3/3 passed; actual compiled Worker transport covered using Node adapter, not called browser acceptance. Worker audit73 modules, no Node imports or sockets. Backend URL empty; production gate remains false.

Copy this evidence directory into a clean source checkout and run node evidence/ai-preview-002/build.mjs. It asserts exact source commit and clean runtime inputs. The files preview-perf.js and worker-perf.js are the only new browser diagnostics modules. Scalar metrics contain no policy input, intent, hidden view or authoritative state. All strategy/runtime choices, action admission, rejection caps and existing exit/takeover semantics are untouched.

Open ?aiPerf=1 to display the collapsible scalar performance panel; ordinary URL has no panel or main-thread sampling. Worker timing includes pure policy count/total/max/last and the whole think+snapshot+postMessage step. Long Task API is feature-detected (>=50ms tasks); thinking attribution is the last received Worker metadata at observer delivery, an approximation. Input samples measure captured pointerup/wheel/click to next animation frame, not hardware latency or every frame. RAF gaps also include rendering and scheduler load; no device inference. Per-game reset on Worker creation, stopped metrics retained after exit. Default game entry and strategy unchanged.

Publication authorized only to existing ai-preview-001, fast-forward with prior remote parent. No main/source-main/backend/PR/hook/platform changes. Browser acceptance and exact deployment URL will be recorded separately after publication. To roll back, append a new commit whose parent is the then-current preview tip and whose tree is the saved rollback tree; publish that new commit without CF-Pages-Skip. Never force-update to an old commit.
