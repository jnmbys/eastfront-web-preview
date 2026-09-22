# MP-005A proposed format: full snapshot with one inline authorized view

**DESIGN + OFFLINE CODE ONLY — not enabled or supported on production.**
No delta, no static-map first-send reference, no binary wrapper, no application compression. This proposal removes only same-message aliases. It needs an explicit new format/negotiation; sending it as current protocol 2 would break the contract.

## What changes on the wire

Current `snapshot-v1` contains:

- `payload.view`: entire authorized PlayerView.
- `payload.model.playerView`: same value again.
- `payload.model.hexes` / `edges`: same values as view.hexes / edges again.
- Model counters, legal options, deployment roster, pending combat UI and other model fields.

Proposed `snapshot-v2-inline-view` sends one complete `payload.view` and a model **without exactly those three alias fields**. Everything else remains byte-for-byte equivalent as JSON values, including explicit nulls, ordering metadata, events, forcedAction and canAct. One full message per recipient remains sufficient after initial creation, every Action, resync or reconnect. It contains **no reference to an earlier packet or a shared other-player view**.

The offline encoder/decoder are in `scripts/mp005a/inline-view-proposal.mjs`. They are not imported by client/server builds; no production feature flag was added. The decoder deep-copies the three fields to preserve the current independently parsed mutable-object semantics. Current measured client CPU is worse with these copies; this is a bandwidth design, not a proven latency improvement.

## Example exchange and version compatibility

Proposal only: new server accepts envelope versions **2 and 3**, each with an explicit parser/schema. Existing version-2 clients continue sending their exact HELLO / RECONNECT and receive only existing version-2 messages and snapshot-v1. No optional fields are injected into old-client messages. Existing exact-schema Action validation is reused unchanged after parsing the selected envelope version.

A new client can request version 3 at identity establishment (illustrative requestId):

```json
{
  "protocolVersion": 3,
  "messageType": "HELLO",
  "requestId": "hello-1",
  "payload": {
    "displayName": "Player",
    "snapshotFormats": ["snapshot-v2-inline-view", "snapshot-v1"]
  }
}
```

Version-3 RECONNECT analogously contains its existing opaque reconnect token and `snapshotFormats`; tokens remain unlogged. Version-3 WELCOME retains all existing identity fields and adds `snapshotFormat` with exactly one offered, server-enabled value. This choice belongs to the **connection**, not the room, seat or persistent identity. After reconnect it is negotiated again before any snapshot is sent; two controllers in one match may use different formats/versions.

Version-3 messages otherwise use existing business names and payloads. A representative snapshot envelope below is a **schema template**, not an actual serialized game view. `${FULL_AUTHORIZED_VIEW}` and `${FULL_MODEL_MINUS_THREE_FIELDS}` mean full JSON objects, not literal strings/references transmitted on the wire:

```text
{
  "protocolVersion": 3,
  "messageType": "PLAYER_VIEW_SNAPSHOT",
  "requestId": null,
  "payload": {
    "matchId": "match-example",
    "matchRevision": 10,
    "serverSequence": 24,
    "revision": 10,
    "format": "snapshot-v2-inline-view",
    "resync": false,
    "status": "ACTIVE",
    "canAct": true,
    "view": ${FULL_AUTHORIZED_VIEW},
    "model": ${FULL_MODEL_MINUS_THREE_FIELDS},
    "forcedAction": null,
    "events": []
  }
}
```

The offline byte estimates include version 3 and the longer format string; negotiation overhead is not included in per-deployment estimates. IDs in this template are illustrative, not production identifiers. Actual events/forcedAction/nulls follow the existing server result.

If no compact format is selected, version-3 connections can receive **full snapshot-v1** under the version-3 envelope. All version-3 clients must understand both formats. Unknown format or forbidden fields fail closed; clients never guess that a missing field means “unchanged”. The normal application adapter should normalize both into today's complete MatchSnapshot/BrowserRenderModel before LobbyClient stores them or NetworkPlayerSession checks sequence/applies state.

Old-server compatibility is limited to a deliberate **identity-handshake fallback**, not Action retries: if a version-3 HELLO/RECONNECT gets an explicit VERSION_MISMATCH *before WELCOME*, close that socket and establish version 2 using the existing identity path. Do not fallback on a generic timeout, do not send actions before WELCOME, and never resubmit an uncertain Action during this negotiation. A rollback to a version-2-only client/server retains the existing opaque token/identity store and reconnect semantics. This is a bounded format-negotiation addition, not an automatic reconnect redesign.

## Precise implementation scope for a later task

1. `protocol.ts` / `gameplayProtocol.ts`: add separate version-3 identity messages, WELCOME selection, and discriminated snapshot formats. Preserve version-2 definitions and strict Action schemas. Do not change gameplay Action union, revision or sequence semantics.
2. Server identity/transport: store protocol/format per connection; clear on close. Authorize via the same server controller assignment. Existing `queryModel` continues filtering legal/private UI state. Ensure the single snapshot builder's three aliases are identical by construction (use its authorized view), and cover this invariant in tests. A nonconforming future model must use full snapshot-v1, never discard different data.
3. Outbound transport: after viewer authorization and current assembly, select full or compact representation, stringify once, send in the same socket order. The ACK path, compression options and idempotency receipt are unchanged. The measured prototype assumes the proven alias invariant; it does not include the cost of runtime deep-comparison of all map data. Do not add such repeated validation without measuring it.
4. Client codec boundary: validate outer version/format, full authorized view and compact model shape; reject unexpected alias/Observer/full-state fields. Reconstruct all required fields from this packet, preserving object isolation. Then pass the complete normalized object into existing view/sequence/revision/pending handling. No renderer/Fog/terrain/model changes.
5. `MATCH_QUERY` is deliberately unchanged in this minimal design. It still carries its complete current authorized model. It is absent during MP-003 deployment and need not be redesigned for the deployment payload goal.
6. Add schema/negotiation/codec tests and real two-socket compatibility tests. No Core, FOW, scenario, renderer, region, hosting or database changes.

## Revision, sequence, idempotency and recovery

- Keep both revision fields, matchId and receiver-specific serverSequence. No sequence numbers are skipped to save bytes; stale/out-of-order messages are processed/rejected by the same state machine after decode.
- Every received compact packet is independently decodable. Losing one does not require a delta base; **the existing real-gap check still requests RESYNC_MATCH**. Do not apply a later self-contained packet across a detected gap merely because it can be decoded.
- RESYNC_MATCH keeps its existing request body, ownership and phase checks. During rollout, server answers it with full snapshot-v1 even for version-3 clients as an explicit recovery baseline, with current revision/sequence, current authorized decision context, and `events: []`. Client returns to compact format on subsequent updates once recovery completes. One bounded resync on codec failure; if full fallback also fails, report invalid server and stop instead of retrying indefinitely.
- Reconnect may negotiate compact again, but the first recovery packet is full snapshot-v1 (`resync: true`) for straightforward fallback. No animation replay, old draft/queued query restoration or Action replay is introduced. Match/controller identity decides view; the client cannot request Observer or another player.
- Action receipt cache, expectedRevision, rejected-action behavior and ACK timing are unchanged. An ACK still does not move/place a unit or unlock snapshot-dependent controls. Only the validated authorized snapshot advances the visible state.
- Changing active viewer/match/connection discards all local snapshot/model references through existing lifecycle paths. There is no new cache or base revision to persist across sessions.

## Privacy and failure boundaries

Always compress/deduplicate **after** server projection/filtering for a single receiver. Never deduplicate across both players by unioning fields, never compute a diff from canonical GameState on the client, never preserve an omitted enemy from an earlier snapshot. Full new view replaces the previous view atomically before the normal UI refresh. Observation loss, removal of contacts, null control, Last Known expiry and private combat options must remain explicit in the current full view/model.

The offline oracle checks original and reconstructed messages with existing `checkSnapshot`, includes all opposing hidden deployment roster IDs, and exercises hidden artillery plus knowledge/control changes. It proves equality for sampled DTOs, not correctness of a future production negotiation implementation. No authorization decisions are moved to the codec.

Final terrain pixels, model quality and PERF-004 refresh path do not depend on representation. Still require real-browser performance comparison after integration: deep-copy overhead may cost more on iPad than in the Node estimate. Do not claim expected bandwidth savings equal latency savings.

## Rollout and rollback (future authorization required)

1. Deploy dual-version server with compact selection disabled; verify old-client paths and new-client snapshot-v1.
2. Deploy new client with an opt-in candidate entry; select compact only when explicitly negotiated. Keep the normal WSS address and existing hosting configuration.
3. Verify same-sequence authorized equivalence and mixed version-2/version-3 seats, both deployment sides, combat decisions, illegal/duplicate actions, real message gap/resync, reload reconnect and observation loss.
4. Measure at least 10 paired deployments in the same browser/network/cache conditions: bytes, submit→ACK, ACK→snapshot, parse/decode/application and controls restored. Separately inspect ordinary movement/combat. Existing ACK timing must remain unchanged.
5. Rollback: server selects snapshot-v1 in WELCOME, or switches an existing version-3 connection to its required supported full format while preserving sequence/revision. Client rollback uses version 2 and existing token reclaim. No database migration, cache reset, irreversible snapshot base or match rules change is involved.

This task stops before steps 1–5. Only the independent audit/design checkpoint is published; production source-main, Pages and Render remain untouched.
