# MP-004 — ACK to authorized snapshot

Baseline: `d94c2400fd89bf072165d3b8f55e51835b04d4cb`, tree
`84aad135456262782291b33394df1ceff1d4c219`. Remote source-main matched at review.

## Evidence and limits

The previous 988 ms observation was not a fixed network delay. Its diagnostic
did not export requestId/serverSequence and timestamped receipt after an extra
JSON parse. The new isolated diagnostic records native message callback entry
before parsing and joins each SUBMIT_ACTION requestId to its acceptedRevision,
then to the non-resync snapshot with that revision and the next recipient
serverSequence. ACK alone leaves the canonical unit count unchanged.

Real Cloud Chrome 151, reported UA macOS 10_15_7, 1363×936, DPR 1, Models Auto,
Normal animations. GitHub Pages → original Render WSS, no simulated RTT. This is
not a physical Mac/iPad measurement. First 10 actions ran with LOD 2/3; the main
comparison uses actions 11–20 with all LOD complete. Both controller sessions
used the same diagnostic build and deployment sequence. Browser automation wall
time is excluded. No DevTools layout/paint trace was available. Native callback
entry is after full message delivery, not a timestamp of arriving TCP packets.
Control readiness is a synchronous UI proxy, not proof of pixel presentation.

Before, all-LOD actor (n=10), median / maximum, ms:

| Stage | Median | Maximum |
|---|---:|---:|
| Click → send | 0.3 | 0.4 |
| Submit → ACK native callback | 275.8 | 321.6 |
| ACK → matched snapshot native callback | 262.5 | 943.8 |
| Submit → snapshot callback | 537.5 | 1265.4 |
| JSON parse | 1.3 | 2.1 |
| Snapshot callback → handler finish | 26.65 | 40.9 |
| Submit → controls restored | 569.25 | 1306.3 |
| PERF-004 synchronous refresh | 24.95 | 39.5 |

Waiting client: parse 1.0 / 1.6 ms, handler 14.15 / 18.5 ms, refresh
12.85 / 17.2 ms. Neither recipient had a ≥50 ms task overlapping snapshot
application in this group. QUERY_MATCH=0, RESYNC_MATCH=0. Revisions 1–20 agree;
waiting viewer receives zero hidden opposing units. Waiting-client time is not
subtracted from the actor clock.

Snapshots contain 225,594 bytes for the waiting side and median 251,727 bytes
for the actor. This repeats static map data in the unchanged authorized DTO.
The server currently sends it uncompressed. Local instrumented Node 24.19
loopback WS independently measures validation, applyIntent, player projection,
serialization, send invocation and callback; these are **not Render timings**.
All processing and transport paths use their own monotonic clocks.

The local first comparison shows ~33–39 ms total server receive processing,
~6–7 ms per snapshot, <1 ms serialization. The source has no deliberate
post-ACK timer or wait on the other player. This supports testing large-frame
transport cost; it does not prove which external hop caused each public outlier.
No public server per-stage telemetry is available.

## Minimal change

Only `server/runtime.ts` changes production behavior. Negotiate standard
WebSocket permessage-deflate for snapshots and query replies, with level 3,
memLevel 7, concurrency 2, and no dictionary takeover in either direction.
ACKs, errors and identity messages bypass compression and keep their existing
send position. Non-negotiating clients retain exactly the previous JSON path.
No DTO field, protocol version, projection, authority or client rendering code
changes. No Action is re-executed to generate a response.

Real loopback frame-byte measurement, actions 11–20:

| Recipient | Before median bytes/action | After median bytes/action |
|---|---:|---:|
| Actor (ACK + snapshot framing) | 252000.5 | 24315 |
| Waiting player | 225604 | 21081.5 |

Compression adds work on a fast loopback link. These byte savings alone are
**not** a claim of public latency improvement. Public after-deployment timing
and the actual Render deployed version must be separately verified.

Health now exposes only a validated provider-issued `RENDER_GIT_COMMIT` SHA as
`sourceCommit`, or null. An HTTP 200 without the expected SHA is not version
proof. No new environment configuration is required; no token/environment dump
is logged. See [Render's documented value](https://render.com/docs/environment-variables)
and [ws compression API](https://github.com/websockets/ws/blob/master/doc/ws.md).

## Validation

- Final candidate client/server typecheck PASS; client and server builds PASS.
- Complete suite: **572 / 572 PASS**; includes MP-001/002/003, PERF-004,
  Safari, progressive terrain/pixel equality, FOW and combat regression.
- Four new transport tests check actual compressed frame flags/size, exact
  authorized decoded DTOs, uncompressed fallback, ACK ordering, repeated
  request idempotency, reconnect and continued deployment, decompressed input
  size enforcement, and health metadata validation.
- Existing MP-002/003 tests still cover ACK not deploying, rejected actions,
  genuine sequence loss and recovery, private combat decision ownership,
  movement/combat disclosure and no redundant deployment queries.
- No frozen manifest or assertion changed. No files under src/, vendor/,
  assets/, or map/scenario data changed. PERF-004 runtime remains byte-identical.

Diagnostic builds are isolated previews, never imported by the normal client.
`scripts/mp004/build-diagnostics.mjs` wraps compiled copies only; run
`node scripts/mp004/measure-server.mjs before|after` against separately preserved
compiled server copies. Raw evidence is metadata-only and gzip compressed.
Nested spans overlap and must not be summed. Server send callbacks mean local
write completion, not peer receipt. Full-test generated MP001/002 reports are
copied here; historical evidence was restored unchanged.

Physical Safari/iPad: PENDING. Friendly-hex move click routing and dice display
remain out of scope. Public after measurements and deployment verification are
recorded in the release receipt when available, not inferred from this gate.
