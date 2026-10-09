# Public startup handshake repair

Online reproduction on 2026-10-09 used the production transport Client against the public WSS service with an isolated test visitor (no user campaign edits). Observed wire order: STATE(full, version 1), then WELCOME(epoch 1). Client remained connected with view version 0. The server's 150ms push timer could emit before the client's HELLO completed its round trip. Client correctly rejected the unestablished epoch; the paused authority then had no change to trigger another snapshot.

Fix: gate state push until HELLO; enqueue WELCOME before first STATE; ignore duplicate HELLO rather than reset an established client stream. Authentication, authorization, eight-state window, receipts, gameplay and save format unchanged.

Validation: `node experiments/grand-release-tablet/handshake-check.mjs` runs the actual transport Client (Node HTTP/WS adapter, not browser UI), delays HELLO by 650ms, checks no premature state, decoded initial model, reconnect while paused, duplicate HELLO and durable SAVE. Old deployed source fails `Paused authority must not push STATE before HELLO` (1 != 0); repaired source passes. `public-check.mjs` also passes existing two-visitor isolation, Origin, forgery, duplicate, disconnect and save/restart checks. No user saves reset.

Browser control remains unavailable (30s tool timeout); do not claim graphical browser/tablet acceptance. Live rollout and post-rollout results will be recorded separately. Render build command is currently pinned to a88a697e1932556697bf1c1b66182c3efe9edf06 and must be updated before triggering the corrected deployment.

## Live rollout verification

Render deploy `dep-db46q0bncjis73c0nap0` became live at 2026-10-09 04:28:12 UTC with exact source `c46b99027b6bed494aecb7f01e3f273ae3b41d23`. The public actual Client test received WELCOME then STATE despite a 650ms artificial HELLO delay, decoded the authorized model in 6304ms, reconnected while paused, and completed a real SAVE. The isolated pre-existing test save remained at tick 7 and paused through deployment and verification. See `live/startup-fixed.json`. No graphical browser or physical tablet acceptance is claimed. Deployment branch stays pinned to the tested code; this commit only preserves evidence.
