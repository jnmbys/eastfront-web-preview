# MP-004.1 production compression verification

Baseline: `88b9536da78e799a0666f20736178e74d39abd5f`, tree `b6fd767ef48568e7540506fd385ec395b8acfd6b`.

This checkpoint adds missing observability, not speculative compression tuning.
Compression parameters, ACK timing, message format and contents remain unchanged.

- `/diagnostics/transport/` creates a fresh browser WebSocket, with no old MP004 subclass.
- `/?transportDiagnostics=1` observes the official game using actual browser socket objects. The normal URL does not load the observer.
- OPEN reports `extensions` and the implementation prototype getter independently. The native-code marker is informational, not proof of a direct network path.
- WELCOME connectionId correlates only the current live connection with an allowlisted-origin, no-store HTTP diagnostic endpoint. It conveys no controller authority. Invalid IDs, missing/disallowed origins and disconnected IDs fail closed. No list endpoint exists.
- The server records its received offer, generated acceptance header and actual ws.extensions. Only permessage-deflate syntax is echoed; no general request headers, cookies, tokens or game payloads are captured.
- At most 64 send records per explicitly observed live connection; close deletes the records. No detailed timing or byte counting on ordinary connections. No persistent database or log payloads.
- Byte counts are serialized/decompressed UTF-8, not compressed on-wire bytes. Compression CPU time and public frame capture are unavailable through these APIs. A send callback is local write completion, not client receipt.
- Client controlsSampleAt is a later timer observation, not exact apply completion or pixel presentation. No cross-clock subtraction is valid.

Local compression/fallback tests retain real frame inspection, authorized snapshot equality, per-socket ordering, at-most-once actions and reconnect. Added assertions validate production diagnostic headers, safe output and lifetime without weakening the original tests.

Public findings will be recorded after this diagnostic is deployed and tested on new connections. Physical Safari/iPad remains PENDING.
