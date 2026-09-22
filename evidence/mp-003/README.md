# EASTFRONT MP-003 — Multiplayer Interaction Latency checkpoint

Deployment: **Not deployed.** Independent source branch: `mp-003-interaction-latency`.

## Verified source and deployment

Remote `source-main` was checked before editing and again before saving the checkpoint:

- Baseline commit: `32fc7dbe6dfa8bad0a3beac8e554f6bce34f9cb6`
- Baseline tree: `441a6fe29c8744cd8a333b6424479548af2cc1fc`
- Pages/static `main`: `8caee8e03d9a7ed8b06b8dd486606b0f616c0f8b`
- Pages workflow run `35681457633`: success.
- Public `app/multiplayer/client.js`, `networkSession.js`, and `render/terrainSurface.js` match the baseline build byte for byte. The deployed config points to `wss://eastfront-server.onrender.com/ws`.

See [source-verification.json](source-verification.json) for module SHA256 values and URLs. This establishes the relevant deployed client modules; it does not establish the backend's deployed commit.

The Safari terrain commit `a61484263cdde36242df333bfa3589001e40e6c5` is not integrated into remote `source-main`; that remote branch does not exist, and the public terrain module matches MP-002. Its separate local checkpoint remains intact. MP-003 does not merge or modify terrain loading. Neither remote branch was changed.

## Root cause: demonstrated defects and limits

1. Deployment roster selection unnecessarily sent `QUERY_MATCH`. The authorized snapshot already contains the complete own roster and deployment zones; the query projection is independent of that selected roster item.
2. `queryPending` / `interactive` disabled all side-panel controls and dynamic input binding during that read-only query. A local selection therefore blocked the next interaction for a full request round trip.
3. Each accepted deployment snapshot generated another query on **both** clients, including the non-acting viewer. Confirmation remained busy for the Action round trip **plus** a query round trip. Each redundant query response was about 156 KB in this fixture.
4. The query scheduler lacked request correlation. A→B→A could leave B queued; an obsolete result could replace the newer selection's model. A snapshot cleared query-pending state even when its original request was still in flight. An old query revision was handled as a stale authoritative update instead of consuming its sequence and discarding its obsolete presentation.
5. Lobby notification iterated its live subscriber set after invoking the lobby callback. A session constructed by that callback consumed the initial snapshot twice. The initial snapshot has `resync:true`; this was redundant processing, **not proof of a false RESYNC_MATCH request**.

The unchanged baseline fails three targeted scheduling assertions: old response replaces newer model, A→B→A sends the obsolete B query, and an old query following a newer snapshot enters recovery. The patched client passes these assertions. The latter is a controlled message-interleaving test, not a captured public incident.

**Unresolved attribution:** normal baseline loopback deployment produced zero `RESYNC_MATCH` requests. The user's iPad “state outdated” screenshot has not been reproduced on that device. We cannot claim that the tested stale-query interleaving caused it. The public diagnostic attempt timed out during WebSocket handshake, producing **zero operation samples**; see [public-baseline-probe.json](public-baseline-probe.json). This does not establish Safari, Render cold start, network latency, or a deployment-version mismatch as the cause.

## Minimal client changes

- Deployment selection and non-acting viewers use the existing authorized snapshot without a selection query.
- Outside deployment, hold at most one in-flight query and one latest unsent draft. Same-turn changes coalesce. Reverting to the in-flight draft cancels the intervening queued draft.
- Correlate replies with request ID, requested revision, and the current draft. Obsolete query payloads cannot overwrite selection or current options, but still consume their ordered server sequence.
- Preserve an in-flight query across unsolicited snapshots. Future query revisions, actual sequence gaps/out-of-order frames, stale Action rejection, and snapshot deadlines still require recovery. Ordered frames received during recovery advance sequence tracking. Older recovery snapshots cannot roll the session backwards.
- Local selection markers use only already authorized counters. Hide options belonging to an older draft while waiting. Action controls remain gated; no Action is coalesced, retried, or applied locally.
- Snapshot/ACK handling continues to adopt authoritative positions and revisions only from snapshots. An ACK alone cannot place a unit.
- Query rejection does not automatically retry the rejected draft. Controls are refreshed after Action rejection without enabling controls disabled by gameplay legality.
- Capture the subscriber list before the lobby callback; initialize presentation drafts directly from the initial authorized snapshot.

Production code changed only in `src/main.ts`, `src/multiplayer/client.ts`, `src/multiplayer/networkSession.ts`, and the local combat-selection gate in `src/multiplayer/networkIntents.ts`.

No server, protocol, wire version, Core, rules, map, Scenario, FOW, spotting, assets, camera, terrain-loading, rendering engine, or hosting configuration was changed. The three frozen hash manifests retain their assertions; only the explicitly reviewed `main.ts` digest and two dependent manifest digests changed. See [frozen-adapter-exceptions.json](frozen-adapter-exceptions.json) and [scope-audit.json](scope-audit.json).

## Interaction trace

| Step | Baseline | MP-003 |
| --- | --- | --- |
| Select deployment unit | Local roster intent → query send → controls disabled → server authorized projection → query response → dynamic refresh | Local roster intent → existing dynamic refresh; zero query |
| Select deployment position | Local deployment-touch preview; zero query, but control can be blocked by the preceding roster query | Local deployment-touch preview; zero query and no preceding roster-query barrier |
| Confirm deployment | Submit one Action → server validate/apply → ACK → both private snapshots → both query again → query responses unlock controls | Submit one Action → server validate/apply → ACK → both private snapshots unlock controls |
| Rapid movement/combat selections | Read-only query blocks controls; queued draft/reply can become stale | Immediate local selection; one in-flight query plus latest unsent draft; stale reply consumed but not presented |

The existing server emits sequence numbers per controller, not globally. `ACTION_ACCEPTED` consumes a sequence but does not advance the client's authoritative view revision; the following snapshot does. Queries do not advance match revision. The client uses the applied snapshot revision for submitted intent. No check or server validation was removed.

Query responses update the existing dynamic presentation. They do not rebuild VS2. Unchanged authorized observation keeps the existing PlayerView reference and Fog cache behavior. No duplicate unit-input binding was found; the existing WeakSet remains. The server does repeat projection work, but measured processing here is small compared with the simulated round-trip wait; no speculative server optimization was made.

## Before / after measurements

Final saved run: Linux x64 container, AMD EPYC 9V74, Node v24.19.0, production authority and two production client/session instances over **real loopback WebSockets**, with an explicit **150 ms delay in each direction**. Same host, workload and harness; runs were sequential with the test suite idle. Five samples per operation per version.

The renderer is the production DynamicMapRenderer operating on the repository's software DOM fixture. There is **no browser**, layout/paint timing, touchscreen, physical iPad, Safari, or public network in these measurements. “Controls ready” means the client session gate is ready after the synchronous software-DOM update; it is not a measured display frame. The side-panel browser layout is not benchmarked.

All values below are medians in milliseconds. `—` means no request, not a zero-latency network.

| Operation / metric | Before | After |
| --- | ---: | ---: |
| Select unit: local feedback / software-DOM update | 12.16 | 10.55 |
| Select unit: controls ready | 321.09 | 10.56 |
| Select unit: client queue to send | 0.076 | — |
| Select unit: query RTT | 306.22 | — |
| Select unit: server processing | 5.59 | — |
| Select unit: response apply + software-DOM update | 13.13 | — |
| Select position: local feedback | 9.94 | 11.02 |
| Select position: controls ready | 9.95 | 11.07 |
| Confirm deployment: local pending feedback | 10.42 | 10.44 |
| Confirm deployment: controls ready | 657.07 | 352.93 |
| Confirm deployment: client queue to send | 0.080 | 0.092 |
| Confirm deployment: Action ACK RTT | 330.70 | 331.01 |
| Confirm deployment: server Action processing | 29.25 | 29.96 |
| Confirm deployment: snapshot applied since input | 347.88 | 349.54 |
| Confirm deployment: per-snapshot apply + software-DOM update | 12.58 | 12.49 |
| Confirm deployment: extra query RTT | 305.93 | — |
| Confirm deployment: extra query server processing | 4.86 | — |
| Confirm deployment: extra query apply + software-DOM update | 12.46 | — |

The Action round trip and state-application time are essentially unchanged. The improvement is removal of a needless query barrier; this is not a claim that the network became faster. Position selection itself was already local and shows no improvement in this small sample.

| Requests across five samples | Before | After |
| --- | ---: | ---: |
| Unit-selection queries | 5 | 0 |
| Position-selection queries | 0 | 0 |
| Deployment Actions | 5 | 5 |
| Post-deployment queries, both viewers combined | 10 | 0 |
| Whole flow queries including initialization | 19 | 0 |
| Whole normal-flow RESYNC_MATCH requests | 0 | 0 |

Median snapshot size remains 230,247 bytes; baseline query responses were 156,434 bytes. Message sizes were not changed by changing the protocol.

[before.json](before.json) and [after.json](after.json) include all samples and minimal traces: message type, opaque request correlation, revision/sequence, byte count, send/receive timestamps and durations. They contain no game payloads, unit identities/positions/routes, tokens, or RNG state. RTT uses client-local monotonic timestamps; server processing uses server-local elapsed time. No client/server timestamp subtraction is used to infer one-way network latency.

## Validation

- `npm run typecheck`: PASS, both client and server.
- `npm run build`: PASS.
- `npm run server:build`: PASS.
- `node --test tests/*.test.mjs`: **537/537 PASS**, including MP-001, MP-002, local Scenario, Combat UX 2.1, FOW, camera, VS2, model/animation and Performance Pass 1 regressions. Logs are included alongside this report.
- 17 added MP-003 tests: 13 scheduling/UI-gating tests and four integrations using actual production clients and real loopback WebSocket connections.

| Required check | Evidence |
| --- | --- |
| Rapid selection does not build a backlog | Same-turn coalescing; one flight + latest unsent; A→B→A cancellation; deployment zero-query assertions |
| Old query cannot replace new selection | Correlation/draft tests, local selected counter remains current, PlayerView object retained |
| Normal deployment avoids stale/resync loop | Five measured deployments; four actual-client integration deployments; no QUERY_MATCH or RESYNC_MATCH after the fix |
| Each deployment executes at most once | Repeated submit gate and exact wire-request replay; one authoritative revision increment |
| Both clients agree | Real-client phase/revision comparisons and own placed coordinate checks; hidden opposing deployment intentionally absent |
| Query/Action/snapshot interleaving | In-flight snapshot test; ACK-before-snapshot test; unrelated and obsolete replies; pending-resync ordering |
| Genuine gap still recovers | Drop a real German snapshot, require exactly one RESYNC_MATCH, restore authorized current state, then continue deployment |
| Reconnect then continue | Terminate the Soviet socket, observe WAITING_FOR_RECONNECT with unchanged revision, reclaim token identity, clear drafts, then submit another deployment |
| Privacy | Private snapshot checks in new integrations; retained MP-002 hidden movement/artillery, CONTACT/Last Known, resync and complete Scenario E2E tests |
| Local/visual behavior | Retained local Scenario and frozen Core tests; unchanged Camera/VS2/Fog implementations; existing performance/animation tests |

Retained MP-002 E2E passes the complete production Scenario and a combat-decision fixture. It is automated WebSocket evidence, not a new physical-browser playtest.

Desktop browser, physical Safari/iPad/Huawei, and public before/after operation measurements: **pending**. Public handshake timeout yielded zero usable operation samples; no public-latency or device-performance PASS is claimed.

## Reproduce

```sh
npm ci
npm run typecheck
npm run build
npm run server:build
node --test tests/*.test.mjs
MP003_DELAY_MS=150 MP003_SAMPLES=5 node scripts/measure-mp003-latency.mjs /tmp/mp003-after.json
```

For the baseline comparison, build the verified MP-002 commit in a separate detached worktree, then point the **same** measurement script at that unmodified `dist/app` directory:

```sh
MP003_CLIENT_DIST=/absolute/path/to/baseline/dist/app MP003_DELAY_MS=150 MP003_SAMPLES=5 node scripts/measure-mp003-latency.mjs /tmp/mp003-before.json
```

The server and presentation fixture code are unchanged between these runs. The harness wraps timing and delivery only; it never changes protocol data or production hosting. Its output must not be interpreted as public network or browser paint timing.

## Remaining issues

- Reproduce the reported stale-state notice on the actual deployed Safari/iPad environment. The guarded interleaving defect is fixed, but the screenshot's exact cause is unproven.
- Public handshake and operation latency need a reachable public test path; the failed probe provides no hosting-root-cause evidence.
- Physical first-load terrain validation belongs to the separate, still-unintegrated Safari terrain checkpoint. MP-003 intentionally leaves that source untouched.
- Snapshot size and draft-dependent gameplay-query RTT remain. There is no protocol redesign, diff transport, server cache, or reduction in visual quality in this checkpoint.

No Core rule changes. No gameplay rule changes. No FOW privacy changes. No MP protocol changes. Server authority preserved.
