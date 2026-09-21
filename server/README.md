# EASTFRONT MP-001

Server-authoritative room / lobby / controller / match-session foundation for Scenario Mode v1.0.

## Run locally

Requires Node 22+ and npm. From the repository root:

```sh
npm ci
npm run server
```

In a second terminal:

```sh
MULTIPLAYER_SERVER_URL=ws://127.0.0.1:8787/ws npm run build
npm run preview
```

Open http://127.0.0.1:4173 in two independent browser profiles (or on two devices with an explicitly configured LAN host/origin). Choose Multiplayer, enter a nickname, Connect, then Create Room / Join Room. Select opposite sides and Ready. No backend is needed for the local New Game button.

The build copies a centralized `multiplayer-config.json` to the static client. `MULTIPLAYER_SERVER_URL` is the build-time source of its `serverUrl`. With no setting it is empty: the UI explains that multiplayer is not configured. A host may replace this public JSON as runtime configuration. It contains no secret. HTTPS clients require `wss:`; credentials, query strings and fragments are rejected. There is no public-client localhost fallback.

`npm run server:build` independently compiles server TypeScript and its existing shared imports into `.server-dist/`. It copies the frozen Core and canonical map into that runtime. `node .server-dist/server/index.js` starts it. The server does not require client `dist/`, DOM, terrain assets, or a browser. The root dependency installation provides `ws` and the compiler; `ws` is never imported into browser code.

## Hosting architecture

- Client: existing static build; compatible with GitHub Pages, including repository-relative asset/config paths.
- Server: separate Node process, WebSocket `/ws`, minimal `/health`. Put TLS in front of it for public `wss:` usage. No server source, matches, tokens or private state is served over HTTP.
- This checkpoint deploys neither a backend nor a new public client.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `8787` | Node listening port |
| `HOST` | `127.0.0.1` | Bind address; explicitly set for LAN/container hosting |
| `ALLOWED_ORIGINS` | `http://localhost:4173,http://127.0.0.1:4173` | Comma-separated exact browser origins; missing/unlisted Origin rejected |
| `RECONNECT_GRACE_MS` | `60000` | Time to reclaim a disconnected identity |
| `EMPTY_ROOM_TIMEOUT_MS` | `120000` | Cleanup delay after the room has no members |
| `ROOM_TIMEOUT_MS` | `7200000` | Room idle expiration, including abandoned IN_GAME sessions |
| `MULTIPLAYER_SERVER_URL` | empty | Client build setting, not a server secret |

Other transport/resource limits live in `server/config.ts`: 4 KiB inbound frames, 1 MiB send-buffer cutoff, 15-second ping heartbeat, 10-second identity handshake deadline, 40 messages per 10-second connection window, 200 rooms and 500 simultaneous connections. Native WebSocket ping/pong has no lobby DOM or renderer path. Tests can inject a clock and limits without changing production defaults.

## Authority and ordering

`RoomAuthority` owns private room, connection, identity and match maps. Every room mutation, disconnect and sweep passes through this one synchronous authority object. No await occurs between validation and commit. Two simultaneous claims are ordered by Node's event loop; only the first can claim the seat. A failed switch preserves the old seat/Ready. A successful change emits one complete room revision, clears the old seat and invalidates both Ready confirmations. There is no privileged host role.

Room members are capped at two, including disconnected reserved identities. Seat schema supports `EMPTY`, `HUMAN_REMOTE`, `AI`; only `HUMAN_REMOTE` can be assigned. No AI planner exists. Germany's protocol seat name is `GERMANY`, mapped explicitly to Core side `GERMAN`; Soviet maps to `SOVIET`.

Room state: roomId, short roomCode, LOBBY/STARTING/IN_GAME/CLOSED, createdAt, revision, both seat/controller/ready records, client metadata and connection status, optional matchId. The DTO contains neither bearer tokens nor authoritative state.

## Protocol v1

All text JSON envelopes have exactly:

```json
{"protocolVersion":1,"messageType":"SELECT_SEAT","requestId":"unique-request-id","payload":{"seat":"GERMANY"}}
```

Client request IDs are strings (1–64 alphanumeric/underscore/hyphen characters). Responses echo the request ID; unsolicited events use null. Room revisions order confirmed lobby states. Duplicate recent request IDs are rejected; this checkpoint does not queue/replay offline mutations.

Client allowlist:

| Type | Exact payload |
| --- | --- |
| HELLO | displayName, 1–32 characters, presentation only |
| RECONNECT | server-issued opaque reconnectToken |
| CREATE_ROOM | empty object |
| JOIN_ROOM | six-character roomCode; case-insensitive |
| SELECT_SEAT | GERMANY or SOVIET |
| SET_READY | boolean ready |
| LEAVE_ROOM | empty object |

Server messages: WELCOME, ROOM_CREATED, ROOM_STATE, ROOM_ERROR, MATCH_STARTING, MATCH_CREATED, PLAYER_VIEW_SNAPSHOT, CONNECTION_STATE. Shared TypeScript unions and exact inbound runtime validation live in `src/multiplayer/protocol.ts`. No client GameState, viewer, seed, die result, force-start or gameplay action endpoint exists. Extra envelope/payload keys are rejected, including viewer=OBSERVER. Malformed input returns a safe error; oversized/binary frames close the offending connection.

## Match and PlayerView boundary

Both connected HUMAN_REMOTE seats must be Ready. The server publishes STARTING, then calls the existing `createFreshProductionSession` → `createLocalGameSession` → `createDeploymentGameState` path with the canonical Strategic Reset F map and default production Scenario. The existing fresh nonzero secure gameplay seed policy is unchanged. Room codes/UUIDs/tokens use Node crypto separately and never consume gameplay state.

The private `MatchSession` stores matchId, scenarioId, createdAt, the authoritative session/RulesEngine, and controller/viewer assignments. Remote controller IDs map to the unchanged Core controller IDs; future MP-002 actions can use the same RulesEngine. No Core or rule implementation is copied.

Only server-derived assignments reach `derivePlayerView`. `playerSnapshot` returns an explicit allowlist of authorized projection fields. Full GameState, RNG, action logs, opponent reserves and observer state are never serialized. The server precomputes both projections before announcing success; a failure restores LOBBY, clears readiness and publishes MATCH_FAILED. Each player gets their own MATCH_CREATED metadata and initial PLAYER_VIEW_SNAPSHOT. The client stores only these DTOs and displays match creation confirmation; it never constructs an authoritative multiplayer session.

## Reconnect and lifecycle

Each connection has a fresh connectionId. HELLO creates a random controllerId and 256-bit bearer token; only the originating connection receives that token. Server token lookup stores its SHA-256 hash. The browser stores the token in sessionStorage scoped by server URL, with an in-memory fallback. A nickname or room code grants no reconnect authority.

On disconnect, Ready clears and identity/seat remain reserved for 60 seconds. A valid token on a new connection reclaims the same controller; an already-live identity rejects takeover. An expired token rejects and the client requires an explicit fresh connection. Reconnect never falls back to nickname matching.

After grace, LOBBY membership/seat is released. Empty rooms expire; idle rooms close. An IN_GAME leave or expired player closes this foundation session rather than inventing gameplay resignation rules. Closed room codes cannot join. IN_GAME rejects third-player joining and seat/Ready changes. Identity reconnect to an active foundation session returns assignment metadata only; recovery of a playable active battle / retransmission history is intentionally MP-002/003 work.

## UI and preserved behavior

HOME now offers Multiplayer. HOME/lobby create no battlefield or VS2 cache; the existing Startup Loading UX1 runs when entering local New Game. Local combat/Camera/FOW/UA/VS2 code is unchanged. Existing input routing, dynamic renderer, seed logic, translated local UI and terrain caching remain covered by the baseline tests.

The lobby has isolated rendering, zh-CN default/en-US, large touch controls, copyable room code, explicit connection and Ready indicators, disabled mutations until server confirmation, no hover/right-click requirement, no offline action queue. Match creation shows an honest foundation completion state: online MOVE/Combat/deployment actions are not implemented yet.

## Validate

```sh
npm run typecheck
npm test
npm run test:multiplayer
```

`tests/mp001-network.test.mjs` opens real independent WebSocket clients, records sanitized evidence, and covers production start, an additional nonempty hidden-deployment challenge through official Core actions, seat contention, reconnect, malformed/unauthorized protocol, Origin and oversized frame rejection. `evidence/mp-001/network-evidence.json` contains no reconnect tokens or enemy snapshots.

Optional browser evidence (install Playwright plus Chromium in a development environment):

```sh
node scripts/verify-mp001-browser.mjs
```

This uses temporary loopback runtime configuration, restores the original config, exercises tablet/desktop/mobile UI and local play with the backend stopped, and saves screenshots. `MP_CHROMIUM_EXECUTABLE` may select an existing Chromium binary.

The three historical UA frozen manifests have narrow, recorded updates for `src/main.ts` (mode entry only) and `package.json` (server runtime commands/dependencies). `evidence/mp-001/frozen-fixture-updates.json` preserves before/after hashes. The Performance Pass 1 frozen manifest and every file it protects are unchanged.

## MP-001 limits

In-memory, single-process rooms/identities/matches do not survive server restart. There are no accounts, spectators, matchmaking, AI, online action sync, or playable active-battle recovery. Real hardware Huawei testing and a separately hosted WSS deployment remain later review/deployment work.

Transport implementation follows the maintained [ws documentation](https://github.com/websockets/ws) for the Node server and browser-native WebSocket clients.
