# MP-005B release and browser acceptance

## Published versions

- Runtime/source-main: `950ac195d3b78ea9ca72b9afad3f46323fe24616`.
- Source tree: `37ac041d16cee9bcdb25b9706c6e1534e99ecfb1`.
- Pages: `75fc78706596c6826be1d00eb4b54e6dab2b8c8f`.
- Backend gate: https://github.com/jnmbys/eastfront-web-preview/actions/runs/35799164198 — SUCCESS.
- Pages workflow: https://github.com/jnmbys/eastfront-web-preview/actions/runs/35799648015 — SUCCESS.
- Public entry: https://jnmbys.github.io/eastfront-web-preview/
- Optional isolated timing entry: https://jnmbys.github.io/eastfront-web-preview/diagnostics/mp005b/

Independent branch was pushed first, source-main advanced through its existing history, backend exact-version gate passed, then Pages was published. No force push, host configuration change or backend migration. Subsequent release evidence is saved on the independent branch only; it does not trigger another runtime deployment.

`public-backend.json` records Render's exact sourceCommit plus a public mixed-format room: legacy recipient received full snapshots, compact recipient received self-contained compact snapshots, hidden deployment checks passed, reconnect restored full revision 1 and continued to revision 2. This is a GitHub Actions Node probe, not browser/physical-device evidence. Server send callbacks are not claimed as delivery timestamps.

`live-artifacts.json` and `live-diagnostic-artifacts.json` compare public HTTP response bytes to the final local build: all 8 runtime/config files and 6 diagnostic files match. New snapshotCodec, protocol, client, networkSession, existing networkIntents, main, Safari terrainSurface and WSS configuration were verified. Diagnostics include copied vendor modules and loaded successfully in the real browser. No artifact was inferred current merely from homepage HTTP 200.

## Browser comparison

Cloud Chrome 151 (reported desktop UA, not a physical Mac/iPad), 1363×936, DPR 1, zoom 100%, Models Auto, normal animations. Same cloud browser and public Render WSS path, no simulated latency. Two independent controller sessions, Soviet operator and German waiting recipient. Full group then compact group, one separate match each; identical first-ten Soviet unit/plain-card sequence. Both clients completed all three LODs before each batch. HTTP caching was not controlled, but initialization was excluded and each fresh page finished its surface builds. External network load and VM scheduling were not controlled. Fresh seeds differ between matches; no deployment result was client-generated.

Exactly 10 accepted actions per group, revisions 1–10 once each. Every actor sample links requestId → acceptedRevision → same applied matchRevision, recipient snapshotSequence=ackSequence+1, and controls-ready. Both waiting views applied revisions 1–10, with zero hidden enemy units. Both groups: **zero QUERY_MATCH and zero RESYNC_MATCH during deployment**. Full group actually received `snapshot-v1`; compact group actually received `snapshot-v2-inline-view`; compact initial/reconnect baselines remained full. Raw safe records and aggregation script are included.

Values below are **median / maximum**. Time is milliseconds. Bytes are UTF-8 JSON, not compressed frame/TLS sizes.

| Operator metric | Full (N=10) | Compact (N=10) |
|---|---:|---:|
| Snapshot JSON bytes | 237878 / 244118 | 87480.5 / 91087 |
| Submit → ACK callback | 288.45 / 407.50 | 308.25 / 380.50 |
| ACK → corresponding snapshot callback | 239.60 / 921.10 | 228.45 / 437.80 |
| Submit → snapshot callback | 556.95 / 1213.30 | 535.25 / 761.50 |
| JSON parse | 1.25 / 1.90 | 0.65 / 0.90 |
| Validation + independent-copy reconstruction | 3.20 / 8.40 | 4.10 / 8.80 |
| Existing session snapshot application | 33.05 / 50.30 | 26.75 / 40.90 |
| Submit → controls-ready proxy | 602.55 / 1251.70 | 571.20 / 799.00 |
| Controls-ready, first 5 | 682.00 / 1251.70 | 581.50 / 799.00 |
| Controls-ready, last 5 | 553.10 / 617.30 | 552.60 / 575.20 |

| Waiting recipient metric | Full (N=10) | Compact (N=10) |
|---|---:|---:|
| Snapshot JSON bytes | 225591 / 225594 | 78416 / 78419 |
| JSON parse | 1.10 / 5.30 | 0.45 / 0.60 |
| Validation + independent-copy reconstruction | 5.00 / 13.20 | 5.30 / 15.60 |
| Existing session snapshot application | 15.15 / 33.50 | 15.20 / 28.30 |

Waiting recipients have no corresponding submit or ACK; their clocks were **not** subtracted from the actor's. Actor observation windows contained 7 Long Tasks (max 342ms) in full mode and 2 (max 282ms) in compact mode; waiting windows contained none ≥50ms. These task counts include UI driver selection/other page work; this is not a trace attributing them to transport. Significant stalls remain. Nested application/render timings overlap and are not added. Native callback timing includes complete-message receipt plus browser scheduling; controls-ready is a DOM microtask observation, not pixel presentation. No true on-wire frame measurement was made this round.

**Conclusion:** snapshot JSON size improvement is proven in the production path (~63% actor, ~65% waiting in this sequence). Parsing is cheaper, independent-copy reconstruction slightly more expensive. This single ordered 10+10 public sample does not prove durable latency improvement: the later-five control medians are nearly identical, and submit→ACK was higher in compact mode. Do not reuse MP-004.1's 993ms result as this run's baseline or claim all stutter resolved. Local CPU/142-state equivalence results remain separately recorded in README/local-codec.json; they are not public latency evidence.

## Formal entry / reconnect smoke

After compact revision 10, navigating from diagnostics to the normal entry and connecting first returned **SESSION_CONNECTED** (server still considered the prior controller online). This cross-entry navigation was not counted as successful recovery and its precise cause was not established. One targeted normal full-page reload then recovered the same match at revision 10; a manual normal-entry deployment advanced both clients to revision 11, operator showed 11 placed units, and waiting compact snapshot had zero hidden enemy units. See `mp005b-browser-reconnect.json`. No takeover, token bypass or auto-reconnect redesign was introduced. Both browser sessions then left the room and returned HOME; public Node probe also leaves its room.

Screenshot `mp005b-compact-revision10.jpg` is actual Cloud browser UI, not software DOM. Physical Safari/iPad/Huawei acceptance remains **PENDING**. The normal-entry actor's wire format was not separately instrumented; its unmodified published client hash matches the instrumented copy's production source, while normal-entry recovery and continued action were observed in UI and the peer's authorized snapshot.

## Validation and boundaries

- Same runtime candidate: client/server typecheck PASS; client/server builds PASS; complete suite **586/586 PASS**.
- 142 authorized snapshots through the actual production codec roundtrip, independent-reference isolation, hidden artillery, CONTACT/Last Known/observation loss, combat and private decisions: PASS.
- Actual pinned legacy endpoints: old-client/new-server, new-client/old-server and mixed room PASS.
- Malformed compact/full input, one bounded full recovery, persistent invalid response termination, true sequence gap, duplicate Action, ACK-no-placement, rejection and reconnect: PASS.
- No frozen assertions/hashes were weakened or bulk-updated. Core, terrain, renderer/model/Camera/FOW implementations were not modified.
- Post-publication additions are evidence + a pure aggregation script only. Aggregation validates sample count, correlation, revision/privacy and completed-LOD conditions; no unrelated suite rerun was needed for these report-only additions.
- Local preview and direct backend browser navigation were unavailable in Cloud; exact backend validation used the authorized public workflow. A reload of an earlier browser error page was rejected for its non-HTTP URL scheme; no bypass was used. Public files were verified with ordinary HTTPS curl.

## Rollback / remaining work

Open a **new connection** with `?snapshotFormat=snapshot-v1` for immediate per-client full-format fallback. A RESYNC uses full format and disables compact on that connection; malformed-format recovery disables it for that client instance. If rollback is required, publish a normal commit restoring the pre-release Pages tree from `7fbf6944ea6b492dd87fb0daa8ef22dd75aee494`, preserving subsequent work. New backend remains compatible with old clients. Backend can be normally reverted and exact Render revert SHA verified; new clients fall back on the old endpoint's correlated UNSUPPORTED_MESSAGE. Never force-push or retry Actions to mask errors.

Remaining: unexplained navigation SESSION_CONNECTED transition; real-device and Chinese-network deployment timings; substantial public wait/Long Tasks; friendly-hex move click conflict and dice display. These were not fixed here. No delta state/cache, application gzip or hidden-state reconstruction was introduced.

For physical acceptance: close the old game page, reopen the normal URL, create/join a room and deploy several units; record device/browser/network and waiting/resync behavior. Use the full-format query switch on a fresh connection only for a deliberate matched comparison.

No Core rule changes. No gameplay rule changes. No FOW privacy changes. Server authority preserved. Snapshot representation/capability extension only; terrain/model quality and PERF-004 implementation preserved.
