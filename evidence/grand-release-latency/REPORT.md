# Public command latency repair

Source baseline: c46b99027b6bed494aecb7f01e3f273ae3b41d23. User's 50s Harmony recording shows target preview waiting across 12–17s frames and later receipt waiting while game time advances. Recording was inspected as sequential frames; no device interaction claim. User video is not uploaded to Git.

Live test used only a pre-existing isolated test visitor, never user's save. Eight route queries during 1x runtime: 5.021–11.147 seconds; server command execution 14–20ms, outgoing state queue delays up to 2.511s. Raw snapshot 912KB, ordinary deltas approximately 8KB (not 912KB per push). Render CPU hit the existing 0.5-core limit during reported period. Capacity, authentication and storage unchanged.

Confirmed repairs:
- Diff traverses authorized JSON once instead of recursively re-serializing every subtree. Same patches and authorization; no larger queue or missing receipts.
- Bounded route search indexes the exact current authorized hexes/edges once per search. No retained path, hidden information, changed ordering, budget or game rule.
- Continuous client does not ask legacy phased-game projections on every selection/state refresh. Map selection uses authorized counters; explicit current-mode route/construction queries and all command generation checks stay in place. Legacy phased clients retain previous behavior.

Local fixed eight-step configuration: diff 108–128ms -> 4–7ms; simulation step 192–230ms -> 62–87ms. Desktop results do not stand in for public/tablet response. 48 identical fixed steps compare full saved campaign state including RNG exactly after excluding wall-clock measurement fields; same RNG 629817860. No balance/economy changes, free resources or altered simulation cadence.

Checks: latency-check.mjs compares complete patches with old algorithm on actual authorized views and deterministic nested mutations, patch reconstruction, continuous selection (zero legacy queries), and unchanged phased projection behavior. handshake-check.mjs rechecks delayed HELLO, paused reconnect and durable SAVE. Clean build passes. Live after-deployment measurements remain to be recorded; no tablet acceptance claimed.
