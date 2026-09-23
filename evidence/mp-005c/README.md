# MP-005C — Remaining deployment wait

Baseline runtime/source-main: 950ac195d3b78ea9ca72b9afad3f46323fe24616 / 37ac041d16cee9bcdb25b9706c6e1534e99ecfb1. Remote verified unchanged at start. Branch starts from MP-005B evidence checkpoint 40a8ddc5 (identical runtime) to retain its evidence. Original unrelated image edit in the other worktree remains untouched.

## Current finding and bounded scope

VID_066.mp4 is 12.667s, 784×544, 30fps. Contact-sheet inspection supports the supplied observation: two visible waits followed by completed deployments. It provides no packet format, RTT, revision or full main-thread trace; its timings must not be combined with cloud timings. The user video is not republished into the public repository.

Code path: confirm-deployment click directly calls deploySelectedUnit → NetworkPlayerSession.submit → LobbyClient.sendRaw → native send. No deliberate deployment delay/timer. ACK clears transport pending but the session correctly stays submitting until the authoritative snapshot. Snapshot receive clears submitting/deadline synchronously, adopts the authorized model, publishes authorized events and synchronously refreshes; no animation completion is awaited. Zero-delay timers handle read-only query coalescing or already-authorized forced decisions, not deployment snapshot adoption. Recovery timers are deadlines, not an added normal wait.

Pending disables mutation/selection controls in the side panel, not Camera, zoom, panel scrolling or existing authorized Counter inspection. Existing Counter handlers use only authorized units; mutation remains guarded by session.interactive. No global input overlay or wholesale Camera disable was found. No speculative unlock/placement or pending-label suppression is introduced.

The existing official opt-in observer omitted snapshot format and reported a later timer sample without measuring production decode/apply. MP-005C fixes this **measurement gap only**, not a proven gameplay latency bug:

- Existing `?transportDiagnostics=1` now records requested/selected format, each actual wire snapshot's format and UTF-8 JSON size, explicit full override, legacy negotiation rejection, full resync baseline and malformed-snapshot recovery reason.
- Capture-phase deployment click is linked to synchronous send using performance.now; no event.timeStamp cross-origin/epoch arithmetic.
- Tiny opt-in production timing hook separates parse/UTF-8 bounds/envelope checks, snapshot validation/rebuild and synchronous receive/notify/application. It emits only type/request/revision/sequence/times/outcome, never payloads, tokens, units, routes or GameState.
- The existing diagnostic reads the actual DOM revision and interactive flag after synchronous processing. This is not proof of pixel presentation. Old timer samples remain explicitly labeled. Observer JSON parsing itself is separately reported and adds opt-in overhead.
- Default URL neither installs the observer nor emits timing events. No server/protocol/codec/Core/rendering/Camera behavior change.

## Validation

Client/server typecheck and builds PASS. Full suite **587/587 PASS**. New targeted test drives the actual production client receive path with compact samples: correlates monotonic stages and revision/sequence, exports no payload, and confirms invalid compact input leaves the old snapshot intact and requests bounded full recovery. Existing no-opt-in inert test and all MP-005B compatibility/privacy/sequence tests pass. No frozen hash updates or assertion weakening.

## Production sampling / honest stopping rule

Release and one focused official-entry sample will be recorded separately. No latency-reduction claim is made by this checkpoint. If the confirmed compact sample spends most time before the native snapshot callback and no post-apply stall is found, stop with this boundary and request one physical-device trace; do not tune transport/hosting or invent a client delay fix. A before/after optimization comparison is inapplicable unless an actual behavioral fix is identified.

Physical collection: close old game tabs; open the normal URL with `?transportDiagnostics=1` on the affected device, connect and enter the match, wait until all terrain details finish, perform three ordinary deployments. Open “连接诊断 / Transport diagnostics”, click “刷新服务器证据 / Refresh” once, then “复制安全结果 / Copy”. Return that text with device/OS/browser/network/VPN and whether the same 2–4s wait occurred. Do not use the standalone HELLO-only page. No token or game-state export is requested.

No Core/gameplay/FOW changes. Compact compatibility and server authority preserved. Remaining friendly-hex click and dice UI work excluded.
