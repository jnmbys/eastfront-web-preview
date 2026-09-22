# MP-004.1 production compression verification

Baseline: `88b9536da78e799a0666f20736178e74d39abd5f`, tree `b6fd767ef48568e7540506fd385ec395b8acfd6b`.

This checkpoint adds missing observability, not speculative compression tuning.
Compression parameters, ACK timing, message format and contents remain unchanged.

- `/diagnostics/transport/` creates a fresh browser WebSocket, with no old MP004 subclass.
- `/?transportDiagnostics=1` observes the official game using actual browser socket objects. The normal URL does not load the observer.
- OPEN reports `extensions` and the implementation prototype getter independently. The native-code marker is informational, not proof of a direct network path.
- WELCOME connectionId correlates only the current live connection with an allowlisted-origin, no-store HTTP diagnostic endpoint. It conveys no controller authority. Invalid IDs, missing/disallowed origins and disconnected IDs fail closed. No list endpoint exists.
- The server records its received offer, generated acceptance header and actual ws.extensions. Only permessage-deflate syntax is echoed; no general request headers, cookies, tokens or game payloads are captured.
- At most 64 send records per explicitly observed live connection; close deletes the records. No detailed timing or byte counting on ordinary connections. No persistent database or log payloads.
- Byte counts are serialized/decompressed UTF-8, not compressed on-wire bytes. Compression CPU time and public frame capture are unavailable through these APIs. A send callback is local write completion, not client receipt.
- Client controlsSampleAt is a later timer observation, not exact apply completion or pixel presentation. No cross-clock subtraction is valid.

Local compression/fallback tests retain real frame inspection, authorized snapshot equality, per-socket ordering, at-most-once actions and reconnect. Added assertions validate production diagnostic headers, safe output and lifetime without weakening the original tests.

Public findings will be recorded after this diagnostic is deployed and tested on new connections. Physical Safari/iPad remains PENDING.

First public evidence (runtime `438f173`): a fresh Cloud Chrome 151 native socket
reports empty extensions through both property and prototype getter. The correlated
server sees no deflate offer, sends no acceptance and negotiates no extension.
This reproduces without the old MP004 subclass, so that subclass alone is not the
cause. Browser handshake request headers are not exposed by this browser tool.

The first public Node probe recorded an offer at the client, but no offer reached
the application server. Its initial frame counter omitted continuation frames and
two HELLO waits could select the correlated ROOM_STATE rather than WELCOME.
`public-node-probe-attempt1.json` is retained as raw evidence, NOT valid total-byte
or three-connection verification. The corrected probe counts all fragments and
requires WELCOME plus matching server connectionId; regression tests cover the
fragmentation bug. No production compression setting is changed to compensate for
an absent request offer.

## Verified public result

The corrected probe ran successfully on GitHub-hosted Ubuntu / Node 22.23.2,
workflow https://github.com/jnmbys/eastfront-web-preview/actions/runs/35727139409 .
It waited for Render to report `ba4c87f03407a0e61f657c3186f0938b979e6838` before
opening three new connections. Both compression-enabled clients recorded
`permessage-deflate; client_max_window_bits` in the Node request object; both
received no extension acceptance. Their matching server diagnostics recorded an
empty offer and empty negotiated extension. The plain connection also worked.
This is evidence of an offer disappearing before application ingress on this
public path, NOT proof of which intermediary removed it. It is not isolated to
the old diagnostic wrapper or an old browser connection. Browser request-header
capture itself remains unavailable.

Ten deployments in that PUBLIC Node flow had uncompressed RSV1=false snapshots.
Actor snapshot frame bytes (including all continuation headers, excluding TLS/TCP)
median 238116.5, maximum 244367; decoded JSON median 237882.5, max 244127.
Waiter frame bytes median 225815, maximum 225818. This is real public Node frame
evidence, not public browser frame evidence. Browser on-wire bytes remain UNMEASURED.
No 24 KB local result is substituted for the public path.

Official Pages entry, Cloud Chrome 151, 1363x936, DPR 1, Models Auto, all three LODs
complete, ten consecutive Soviet deployments, no simulated delay:

| Milliseconds | Median | Maximum |
|---|---:|---:|
| Submit -> ACK native callback | 280.2 | 381.2 |
| ACK -> matching snapshot callback | 993.35 | 1817.0 |
| Submit -> snapshot callback | 1273.55 | 2123.1 |
| Diagnostic JSON parse (additional observation) | 1.35 | 1.6 |
| Submit -> controls observed ready in later timer | 1321.0 | 2159.3 |
| Server ACK send call -> actor snapshot send call | 16.43 | 23.68 |
| Actor snapshot JSON serialization | 0.63 | 0.85 |
| Actor snapshot send call -> local write callback | 0.28 | 0.37 |

The timer control sample is an upper bound, not exact application duration or
pixel presentation. The production parser and renderer were not instrumented in
this run; no main-thread trace or compression CPU timing was captured. Server
bufferedBefore was zero for both recipients. Waiter serialization median/max
0.60/0.95 ms, local write callback 9.11/12.66 ms. Server times overlap and must not
be added to client times or subtracted across clocks.

Both official-game connections also reported empty extensions via property and
prototype getter, with matching empty offer/acceptance at the same deployed server.
Each accepted action matched requestId, acceptedRevision and recipient sequence;
actor reached revision 10 with ten units, waiter reached revision 10 with zero
hidden enemy units. ACK never placed units. QUERY_MATCH=0, RESYNC_MATCH=0.

The separate Node path measured submit->ACK 309/398 ms, ACK->snapshot 24/297 ms,
submit->snapshot 331/611 ms (median/max). This is NOT a controlled comparison to
Cloud Chrome: different execution and network paths. No compression-enabled
public browser condition was obtained, so no valid before/after improvement or
percentage is claimed. Long waiting remains before the native snapshot callback,
not in the measured server serialization or write queue; transport/intermediary
and browser delivery scheduling have not been separated.

## What changed / next required evidence

Only transport observability and its measurement bugs were addressed. No
production compression parameters, ACK schedule, business schema or gameplay
logic were changed. It would be invalid to compress unilaterally without an offer.

Next decisive evidence: open `/diagnostics/transport/` on a physical Safari/iPad
or ordinary desktop browser, click Test new connection and Copy. If its server
also sees no offer, pair its browser Network handshake request/response headers
with the displayed connectionId and obtain edge/ingress header evidence for that
same connection from the service operator. This identifies the missing hop before
requesting any hosting-side change. No region, plan, environment or WSS change was
made here. Physical Safari/iPad and mainland-China paths remain PENDING.

## Reconnect and validation

A first manual browser reconnect attempt exceeded the 60-second grace period and
was correctly rejected as an expired identity; it is not counted as a pass. In a
new match the browser deployed once, reloaded, opened Multiplayer and clicked
Connect immediately. A new connection received authorized revision 1 snapshots
(including resync=true), displayed one own unit, then successfully deployed again
to revision 2 with two own units. This is manual Connect recovery, not a claim of
seamless automatic reconnect. Safe before/after records and a screenshot are saved.

Client/server typecheck and builds PASS. Final complete suite: **574/574 PASS**
(572 existing plus two diagnostic regression tests). Compression and uncompressed
compatibility tests continue to verify real local frame flags/size, at-most-once,
authorized view equality, sequencing, decompressed size limits and reconnect.
Existing MP tests cover real sequence gaps, rejection and combat decision ownership.
Frozen updates are exactly six entries: four reviewed index.html hashes plus two
manifest dependency hashes. No assertions were deleted or relaxed.

Pages deployment: `7fbf6944ea6b492dd87fb0daa8ef22dd75aee494`, workflow
https://github.com/jnmbys/eastfront-web-preview/actions/runs/35726723656 SUCCESS.
Build provenance is `438f173`; later source commits add probe corrections, tests
and evidence, not frontend runtime differences. Twelve live artifact hashes match.
All src gameplay/render/network modules remain byte-identical to the baseline.
