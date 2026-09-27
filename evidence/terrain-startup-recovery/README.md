# Terrain startup recovery — 2026-09-27

MP-006 device comparison paused. User reports VS2_GROUND_GRASS direct-image and fetch timeouts persisting after reload.

## Evidence and limits

- Production baseline: source 123e87e31a703c49fbc47933cb31d049ce214c8e, Pages 0a7468245439f551e20ea0c01bf28eca6833c8cd.
- All 79 VS2 manifest resources downloaded over HTTPS and matched the local published bytes. Full results in assets-audit.json.
- grass.webp: HTTP 200, 450290 bytes, SHA-256 f673fe1a7e59847c3752ab5a4d0261b3fa0b397671c6159ad3e07f48e3e399cf.
- Cloud Chrome baseline reached the interactive deployment map and completed all LODs. User-device timeout was not reproduced here. This does not establish reachability from the user's network.
- Source inspection: the fallback repeated the direct-image URL using default fetch caching. A page reload restarts the same sequence. Both non-WebKit network deadlines were 15 seconds. There was no separate recovery cache key.
- Exact cause of user-network timeouts remains unproven; stale cache/coalesced request is a possible failure mechanism, not an established diagnosis.

## Minimal change

Only terrainSurface.ts runtime code changes. Direct-image success retains existing loading, decoding and rendering. The single fallback fetch uses the same origin/path with a unique recovery query and cache:reload. A preceding direct-image timeout gives that fetch a 60-second budget. Fetch abort, HTTP errors, blob/bitmap fallbacks, bounded Safari queue and original asset diagnostics remain. There is no automatic retry loop. Total network attempts remain one direct image plus one fetch. A new page attempt gets a fresh recovery key. Persistent connectivity failure still produces an explicit error.

No new asset/quality/LOD, gameplay, transport, default-v2 or explicit-v3 changes. No server implementation changes.

## Validation

Added deterministic failure injection for direct timeout then slow successful recovery; both paths timeout and abort; fresh subsequent attempt; query/origin/path preservation; exactly-once progress and disposal. Existing loader, progressive startup, visual and protocol regression tests retained.

Hash fixtures retain exact assertions. Only terrainSurface.ts hashes are updated for the explicitly authorized loader change; before/after entries recorded in hash-review.json. No Core, geometry or image hash rebaselining.

Deployment verification must compare the live loader bytes and use the actual browser entry to start the map; workflow status alone is insufficient. Cloud verification is not iPad acceptance. Device latency comparison remains paused.

Validation result: client/server typecheck and build PASS. Full run: 597 tests, 596 passed with one nested fixture-hash mismatch; after updating only the hashes of changed hash-fixtures, the affected UA003R1 file rerun passed all 9 tests. No behavioral test failed. This is full-suite coverage plus a targeted gate rerun, not a claim of a second full run. Exact hash gates remain enabled.
