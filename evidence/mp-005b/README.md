# MP-005B — Self-contained compact snapshot integration

Production baseline: `69ad789a23e3899e1dd251b9ab7ef3e43a3cb5ad` / `8dca261c08a228db5ae8e0797c7a9c53336d2b3f`.
Audit parent: `df962c38d3b4801769a80d0e5967dad1249a402c` / `24d834d0d8925797f05ab68d939191e912ffefe5`.
Branch: `mp-005b-compact-snapshot`.

The original worktree had an unrelated modified `evidence/ua-001/movement-midpoint.png`; it remains untouched. Work is isolated in a new git worktree. No frozen hashes/ assertions were changed.

## Representation and compatibility

`src/multiplayer/snapshotCodec.ts` removes exactly model.playerView, model.hexes and model.edges from a **self-contained** authorized packet, then restores independent deep copies from that packet's view. No map/delta cache, rules execution, knowledge inference or cross-view reuse exists. `snapshot-v1` is preserved; new format is `snapshot-v2-inline-view`.

Implementation uses a smaller capability exchange than MP-005A's proposed version-3 handshake. The actual baseline parser returns a correlated `UNSUPPORTED_MESSAGE` for an unknown type without accepting arbitrary extra fields. Therefore envelope version 2 and HELLO/RECONNECT stay byte-compatible:

```json
{"protocolVersion":2,"messageType":"SET_SNAPSHOT_FORMAT","requestId":"format-1","payload":{"format":"snapshot-v2-inline-view"}}
```

Only an authenticated connection may select a known format. New server responds with `SNAPSHOT_FORMAT_SELECTED` and the selected format under the same requestId, before sending compact snapshots. Old clients never request it and receive no new message types/formats. New clients on the baseline server accept **only a correlated explicit UNSUPPORTED_MESSAGE** as fallback, remain on the same connection and use full snapshots. Other errors/timeouts are not interpreted as successful negotiation. No Action is retried.

Capabilities belong to each connection. Reconnect begins in full mode and negotiates again. Normal game entry does this automatically. For controlled comparison/temporary client rollback, open a new connection with `?snapshotFormat=snapshot-v1` (diagnostic constructor option is also available); default remains automatic.

Server snapshot assembly takes the already filtered query model's PlayerView so its three aliases are identical by construction. The encoder uses reference checks and falls back to full format if a future model diverges; it does not silently drop different data. ACK emission and the application mutation path are unchanged. Format negotiation is outside the existing per-recipient match sequence; Action/query/snapshot ordering and revision remain unchanged.

## Validation and bounded recovery

Both formats pass a 2MiB UTF-8 message cap, bounded/depth-limited JSON tree check, authorized-view/model/decision/event shape checks and revision/viewer consistency before application. Observer and privileged fields are rejected. Compact cannot be accepted before negotiation, or masquerade as a resync baseline. A partially decoded object is never installed.

A malformed snapshot can request one authorized RESYNC on the known match. While recovery is outstanding, late valid packets are not applied as its answer; the matching fresh full response is required. If recovery is malformed or times out, stop with an error instead of looping. Format failure disables compact for the client instance. The server disables compact for that connection on RESYNC_MATCH and sends a full current snapshot with resync=true / events=[]. A real sequence gap uses the same full recovery barrier. Normal transport reconnect retains the existing token/authority behavior.

One small networkSession change resumes already server-authorized forced decisions/queued read-only queries when negotiation finishes. It does not invent a decision, bypass ownership or execute an Action twice.

## Automated evidence

- Client/server typecheck: PASS.
- Client/server builds: PASS, WSS config unchanged.
- Complete existing + new suite: **586/586 PASS**; full log is `full-tests.log.gz`.
- Actual production encode/decode roundtrip of all **142 MP-005A authorized snapshots**, including 32 Soviet / 26 German deployments, movement, multi-attacker combat, private reaction/artillery, CONTACT→Last Known / observation loss, and resync: equivalent DTOs and preserved independent copies.
- Exact baseline client and baseline server endpoint source captured under tests/fixtures/mp005b-legacy from the pinned commit. Tests transpile these endpoints against the unchanged shared rules/projection modules, not a guessed permissive legacy stub.
- Real local WebSocket mixed old/new room, new-client/old-server fallback, ACK-no-placement, duplicate Action, real sequence gap, reconnect and continued deployment: PASS.
- Malformed legacy/compact DTOs, unnegotiated format, no partial fake unit, one full fallback and persistent-error termination: PASS.
- Full suite retains rejection, combat decision ownership, FOW, Safari, MP-003, PERF-002/003/004 and visual/frozen assertions. The main-thread renderer, terrain, models and Core are untouched.

## Local CPU and payload evidence

`local-codec.json` contains 116 deployment snapshots (both recipients), encoded in both modes. Node 24.19.0 / Linux / AMD EPYC 9V74, two warmups then alternating mode order, one measured pass, performance.now. This compares the **new client forced-full vs compact**, including its shared validation, not the earlier client without validation. No network, browser or paint timings are included.

Typical medians in bytes:

| Group | N | Full | Compact |
| --- | --- | --- | --- |
| Soviet actor | 32 | 253095 | 96294.5 |
| Soviet waiting | 32 | 225594 | 78419 |
| German actor | 26 | 244192 | 89190 |
| German waiting | 26 | 274339 | 108585 |

For Soviet actor: pack/stringify 0.722→0.255ms; parse 1.480→0.584ms; validation/rebuild 1.718→2.370ms; total client parse/validation/rebuild 3.233→2.958ms. Every group's median, maximum and raw sample are saved. Deep-copy reconstruction remains real work. JSON bytes are not WS/TLS on-wire bytes. Local CPU data does not establish public latency improvement.

## Deployment gates and browser evidence

Prepublication automated gate is complete. Backend and Pages statuses are to be recorded in `release.json` after actual publication; this document alone is not a deployment-success claim.

`.github/workflows/mp005b-verification.yml` waits for the exact integrated source SHA in Render /health, then checks a real public mixed legacy/compact room, authorized deployment, full reconnect and continued action. It does not investigate WebSocket compression. Pages release waits for this gate.

`node scripts/mp005b/build-browser.mjs` generates an isolated `dist/diagnostics/mp005b/` entry from the same final build, with only timing wrappers and a bounded 10-deployment UI driver. Normal entry is uninstrumented. It records native callback/actual parse, codec, snapshot application, controls-ready microtask, JSON sizes and Long Tasks. It requires all 3 LODs ready and supports the same full-format query switch. Nested spans are not added; controls-ready is not a pixel-presentation timestamp. HTTP/cache/path differences and physical-device limitations must be reported with the resulting evidence.

Current Cloud browser can open official Pages, but direct backend /health and local 127.0.0.1 preview returned ERR_BLOCKED_BY_CLIENT. These are browser-path limits, not a backend-failure or region diagnosis. Public workflow and browser game verification remain separate evidence sources.

## Executable rollback

1. For a session: reopen normal entry with `?snapshotFormat=snapshot-v1`; connection starts full and does not request compact. A normal RESYNC also disables compact on that connection.
2. Frontend rollback: make a **new normal commit** restoring the previous Pages tree (`7fbf6944ea6b492dd87fb0daa8ef22dd75aee494`), preserving any intervening work; never force-push main. Compatible new backend serves old clients full format.
3. Backend rollback: revert this runtime change on source-main with a normal revert commit, then verify Render's exact new revert SHA. New clients explicitly fall back on the old server's UNSUPPORTED_MESSAGE. No database migration, cached delta base, gameplay state conversion or hosting change is needed.
4. If privacy/state/compatibility fails, stop compact rollout; do not ignore decoder/sequence errors or retry Actions to mask it.

Physical Safari/iPad/Huawei: PENDING unless separately recorded with actual device evidence. Deployment performance, ACK→snapshot external waiting, movement-click conflict and dice UI are not assumed fixed by a payload reduction.

No Core rule changes. No gameplay rule changes. No FOW privacy changes.
Only authorized snapshot representation/capability extensions. Server authority preserved.
