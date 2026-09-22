# Safari + MP-003 integration validation

Verified baseline: source-main commit `32fc7dbe6dfa8bad0a3beac8e554f6bce34f9cb6`, tree `441a6fe29c8744cd8a333b6424479548af2cc1fc`.

Inputs were recovered from existing local Git objects, not reimplemented:

| Checkpoint | Commit | Tree |
| --- | --- | --- |
| Safari | a61484263cdde36242df333bfa3589001e40e6c5 | c0f344763c9da1a312cb09d28c64d39abcc930ba |
| MP-003 | 6fbed22133e38b5b5763965894646cd20e0fca81 | 7315584187ca2573a1f39d76a58bb8032e53eea5 |

Both inputs have the verified baseline as their sole parent. Remote source-main and Pages/static main were checked before integration. Pages main was `8caee8e03d9a7ed8b06b8dd486606b0f616c0f8b`; it is not the source branch.

## Integration changes

The five runtime files are byte-identical to their respective input checkpoints: Safari's `src/render/terrainSurface.ts`, and MP-003's `src/main.ts`, `src/multiplayer/client.ts`, `networkSession.ts`, and `networkIntents.ts`. There are no additional runtime changes.

There were no textual merge conflicts. Twelve explicit hash entries in six frozen manifests required dependency reconciliation: the exact Safari terrainSurface hash, three Safari-modified test files, and three nested manifest hashes. MP-003's main.ts hashes remain intact. Safari's performance and normalized startup loader hashes remain intact. The normalization-aware startup manifest was not blindly replaced with raw file hashes. See `frozen-hash-resolution.json` for each before/after entry. No assertion was removed or relaxed.

`scope-audit.json` records the exact runtime input hashes and unchanged protected paths. Core, rules, RNG, FOW, spotting, protocol, server, Scenario, maps, assets, camera, models, localization and hosting configuration remain unchanged.

## Final integrated validation

- Client/server typecheck: PASS.
- Client build: PASS, with `MULTIPLAYER_SERVER_URL=wss://eastfront-server.onrender.com/ws`.
- Server build: PASS.
- Full suite: **553/553 PASS**, 0 skipped, 0 cancelled.
- Included suites: Safari loader, VS2, Startup, Performance Pass 1, MP-001, MP-002, MP-003, local Scenario, combat, privacy, camera, animation/model and fresh-seed regressions.
- Production clients over actual loopback WebSockets: retained MP-003 deployment, duplicate request, dropped-message recovery and token reconnect tests PASS. Retained MP-002 complete Scenario and combat decision flows PASS.
- Predeployment real-browser local smoke: UNAVAILABLE. Cloud Chrome reports `net::ERR_BLOCKED_BY_CLIENT` for the local preview URL. This is an environment access limitation, not a product test failure. Public browser smoke is recorded separately after publication.
- Physical Safari/iPad: PENDING user acceptance.

The earlier MP-003 321→11 ms / 657→353 ms results used loopback WebSockets with simulated 150 ms delay per direction and a software DOM. They are not public-network or physical-device results and are not reused as deployment performance evidence.

## Publication traceability

Git CLI has no configured push credential in this workspace. The authorized GitHub connector has repository write permission. If used for publication, each original checkpoint is imported separately by its exact Git tree and parent baseline, with its original commit/tree recorded in the import commit message. A final integration merge joins the two imported histories and the current source-main. API-created commit identities differ from the local originals; the original commits remain in the local checkpoint and the input trees must match exactly. This preserves separate checkpoint provenance without rewriting remote history or collapsing the changes into a single import.

The published integration tree must equal the validated local integration tree. The formal published source commit, Pages commit/workflow, live module SHA256 values and browser/network results are recorded in the deployment report after publication. Source-main receives source only; existing main receives generated static files only. Every ref update is non-force. No new hosting workflow or Render configuration is introduced.

## Deferred work

Shared single-player/multiplayer post-deployment stutter, movement clicks on friendly-occupied hexes, and dice presentation remain separate tasks. Supply, HQ, Cavalry, AI and Industry are out of scope. Public network and physical-device results are only claimed when actually observed.

No Core rule changes. No gameplay rule changes. No FOW privacy changes. No MP protocol changes. Server authority preserved.
