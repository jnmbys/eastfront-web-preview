# Public command latency repair

Source baseline: c46b99027b6bed494aecb7f01e3f273ae3b41d23. User's 50s Harmony recording shows target preview waiting across 12–17s frames and later receipt waiting while game time advances. Recording was inspected as sequential frames; no device interaction claim. User video is not uploaded to Git.

Live test used only a pre-existing isolated test visitor, never user's save. Eight route queries during 1x runtime: 5.021–11.147 seconds; server command execution 14–20ms, outgoing state queue delays up to 2.511s. Raw snapshot 912KB, ordinary deltas approximately 8KB (not 912KB per push). Render CPU hit the existing 0.5-core limit during reported period. Capacity, authentication and storage unchanged.

Confirmed repairs:
- Diff traverses authorized JSON once instead of recursively re-serializing every subtree. Same patches and authorization; no larger queue or missing receipts.
- Bounded route search indexes the exact current authorized hexes/edges once per search. No retained path, hidden information, changed ordering, budget or game rule.
- Continuous client does not ask legacy phased-game projections on every selection/state refresh. Map selection uses authorized counters; explicit current-mode route/construction queries and all command generation checks stay in place. Legacy phased clients retain previous behavior.

Local fixed eight-step configuration: diff 108–128ms -> 4–7ms; simulation step 192–230ms -> 62–87ms. Desktop results do not stand in for public/tablet response. 48 identical fixed steps compare full saved campaign state including RNG exactly after excluding wall-clock measurement fields; same RNG 629817860. No balance/economy changes, free resources or altered simulation cadence.

Checks: latency-check.mjs compares complete patches with old algorithm on actual authorized views and deterministic nested mutations, patch reconstruction, continuous selection (zero legacy queries), and unchanged phased projection behavior. handshake-check.mjs rechecks delayed HELLO, paused reconnect and durable SAVE. Clean build passes. Live after-deployment measurements remain to be recorded; no tablet acceptance claimed.

## Public rollout (2026-10-09)

Deploy dep-db477360tbcc73dcp2sg is live, exact code 41717e84152902b2dd8dbf9e5b8ef5e8ef1f0cfc. Build pinned through RELEASE_SOURCE_SHA; disk, service tier, origin and visitor isolation unchanged.

The same eight-preview / 1x-clock protocol probe on the isolated test visitor measured preview min/median/max 364/957.5/2855ms, versus 5021/8759/11147ms before. CLOCK run/pause receipts 719/670ms versus 3156/9895ms. Maximum observed state send queue fell from 2511 to 609ms. These are consecutive live time windows on the same test campaign, not identical state or controlled Internet conditions; the deterministic 48-step local comparison separately checks simulation equivalence. No graphical tablet validation is claimed.

Separate online check: authorized route preview, accepted DIRECT movement intent (1215ms receipt), durable SAVE, and reconnect while paused retaining the exact intent; no reset or duplicate action. This checks acceptance/persistence, not a completed march while paused. Existing user saves were not accessed or modified by the probes. Residual preview peaks near 3s remain; do not claim universally smooth tablet performance.
