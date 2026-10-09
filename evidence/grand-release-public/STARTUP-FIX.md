# Public startup handshake repair

Online reproduction on 2026-10-09 used the production transport Client against the public WSS service with an isolated test visitor (no user campaign edits). Observed wire order: STATE(full, version 1), then WELCOME(epoch 1). Client remained connected with view version 0. The server's 150ms push timer could emit before the client's HELLO completed its round trip. Client correctly rejected the unestablished epoch; the paused authority then had no change to trigger another snapshot.

Fix: gate state push until HELLO; enqueue WELCOME before first STATE; ignore duplicate HELLO rather than reset an established client stream. Authentication, authorization, eight-state window, receipts, gameplay and save format unchanged.

Validation: `node experiments/grand-release-tablet/handshake-check.mjs` runs the actual transport Client (Node HTTP/WS adapter, not browser UI), delays HELLO by 650ms, checks no premature state, decoded initial model, reconnect while paused, duplicate HELLO and durable SAVE. Old deployed source fails `Paused authority must not push STATE before HELLO` (1 != 0); repaired source passes. `public-check.mjs` also passes existing two-visitor isolation, Origin, forgery, duplicate, disconnect and save/restart checks. No user saves reset.

Browser control remains unavailable (30s tool timeout); do not claim graphical browser/tablet acceptance. Live rollout and post-rollout results will be recorded separately. Render build command is currently pinned to a88a697e1932556697bf1c1b66182c3efe9edf06 and must be updated before triggering the corrected deployment.
