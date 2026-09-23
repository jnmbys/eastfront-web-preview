# MP-006 — Self-contained Map Encoding

## Result and release gate

Volume optimization validated locally. Latency improvement **NOT PROVEN**. Physical iPad/Safari acceptance **PENDING**. No cloud-browser or same-environment 10+10 latency samples were generated. See DEVICE-ACCEPTANCE.md for the formal-entry one-time ABBA procedure, per-format links and safe export.

Baseline source-main verified remotely at `6c2c9c6ec3ba36f031802cabf17b27c95dc32734`, tree `65fc62d4c726d01d5644ac5b8ec5774ee39a5334`; Pages main at `ff94c593b97fb5649ef0657ddb20d418930746d5`. Independent work branch: `mp-006-self-contained-map`. No subsequent source/Pages commits were present at pre-release remote check. Exact release SHAs/status are recorded separately after publishing.

## Encoding and compatibility

One scheme only: per-message field tables plus ordered rows for authorized `view.hexes` and `view.edges`. Each row begins with a presence bitmask followed by present values in field-table order. This preserves absent versus null, record/array order, numeric values and nested map state; field names/values come from the current server projection. No preinstalled map, rule-derived values, cross-revision cache, dictionary history or shared player state. The existing v2 alias elimination remains intact. Independent copies are restored for view, model.playerView, model.hexes and model.edges.

Format: `snapshot-v3-map-table`. Capability is explicitly selected per connection through existing SET_SNAPSHOT_FORMAT. Default remains **v2** pending device comparison; `snapshotFormat=snapshot-v3-map-table` opts into v3. Pinned v2 servers reject the new enum with correlated BAD_MESSAGE; the client attempts v2 once. Pinned v1 servers return UNSUPPORTED_MESSAGE and the bounded chain ends in v1. Other errors fail closed. Reconnection negotiates anew. Initial/resync snapshots keep v1. A malformed snapshot is never applied; one full recovery is allowed, persistent invalid data terminates. Existing sequence/revision/ACK/dedup and authority rules are unchanged.

Rollback: use `?snapshotFormat=snapshot-v2-inline-view` on a new connection; v1 remains available. No backend rollback is required to serve existing clients. Ordinary history-preserving revert may be used if needed; never reset/force-push over later work.

## Cost gate

142 existing MP-005A both-view/cross-phase samples: 136 normal snapshots and 6 v1 recovery snapshots. Three warmup passes then five measured passes in alternating order. Each normal-format group has 680 measurements. Local Node only, not device/browser/network. Complete UTF-8 JSON envelope+payload bytes, not WS/TLS wire size. Samples include full deployment, turn/phase transitions, movement, multi-attacker combat, reactions, hidden artillery, CONTACT / Last Known and observation loss.

| Normal snapshot metric (median) | v2 | v3 |
|---|---:|---:|
| Complete JSON bytes | 92,773 | 64,939 |
| Map value JSON bytes | 73,420 | 45,588 |
| Server encode ms | 0.0026 | 0.1943 |
| Server serialize ms | 0.2451 | 0.2117 |
| Parse ms | 0.5712 | 0.4707 |
| Validation ms | 0.6573 | 0.6010 |
| Reconstruction ms | 1.7342 | 2.4546 |
| Total client codec ms | 3.0306 | 3.5931 |
| Total client codec p95 ms | 3.9429 | 4.6747 |

Production-codec raw measurements: `production-codec.json`; initial pre-integration candidate: `offline.json`. `mapRebuildMs` in the production JSON means all reconstruction including the existing independent-copy restoration; `validateRebuildMs` means the remaining validation time. Reconstruction includes bounded table-structure checks. Medians are independent and need not sum. Complete-message median declines 30.00%; map values decline 37.91%. Typical large-map messages save 27,834 B including format-label difference. Recovery deliberately retains v1 and has no volume improvement. Small synthetic maps have different benefits; raw per-sample rows are retained.

Additional median encode/serialization CPU is about 0.16 ms, total client codec increases about 0.56 ms. The volume reduction is material and local cost does not by itself block integration; this is **not** a claim that network wait improves. No CPU improvement claimed. Diagnostic timings add overhead and are opt-in in both comparison groups. Application/render/paint are not included in local codec measurements.

## Verification

- Client and server typecheck PASS; client and server build PASS.
- Complete project suite **595/595 PASS**, including frozen Core/Geometry/asset/visual checks; no frozen assertion weakened.
- Production v3 codec roundtrip across all 142 authorized samples, independent-copy isolation, malformed mask/field/row/nested map rejection, missing/null/precision/order checks PASS.
- Pinned v1 and v2 old endpoints; mixed v2/v3 recipients; actual sequence gap/full recovery; v3 reconnect negotiation; bounded malformed recovery and persistent-error termination PASS.
- Existing full/v2 ACK no-placement, duplicate Action, forced-decision, privacy and cross-phase tests remain passing.
- Existing MP-005C diagnostic event fields retained exactly. Separate safe event reports codec validation/reconstruction; exports add actual format and LOD completion. No tokens/full DTOs exported.
- Core, Gameplay, CRT, RNG, FOW, terrain, models, camera and visual rendering implementation untouched.

Physical acceptance is pending. The historical three iPad samples were read and verified but never mixed into candidate statistics. confirmAt null means click→send remains unknown. Controls restored is not pixel presentation. No attribution to network/proxy/browser scheduling is made. Stop additional encoding work if the planned comparison does not improve waiting.
