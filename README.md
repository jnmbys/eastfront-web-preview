> Multiplayer gameplay now uses the MP-002 authoritative server and shared Local/Network UI adapter. See [MP-002 architecture, commands and validation](docs/MP-002.md). The earlier MP-001 notes below describe its original checkpoint.

# EASTFRONT Web Preview v0.0.10 — Task UI-009R2D2

Status: **RELEASE BLOCKED pending Huawei tablet real-device verification**.

UI-009R2D2 is a narrow loader/request-lifecycle hotfix on top of the cached Canvas terrain surface. It does not redesign the renderer.

Huawei Edge D1 evidence: `M01` / `marsh_wet` timed out in mandatory fetch, and the immediately-following direct `HTMLImageElement(url)` fallback also timed out, while opening the same PNG URL directly in a tab worked. D1 used `Promise.race(fetch, timeout)` without aborting the underlying fetch and used `cache:'force-cache'`.

D2 changes only the terrain image loader:

- direct `HTMLImageElement(url)` is the primary path; successful direct loading never calls fetch;
- fetch/blob/createImageBitmap is optional secondary fallback only;
- secondary fetch uses `AbortController`; timeout aborts the underlying request before fallback returns;
- `cache:'force-cache'` is removed;
- image timeouts clear handlers/request state;
- existing detailed asset/family/URL/stage diagnostics are preserved.

Cached Canvas architecture, Core, Geometry, Strategic Reset F, gameplay, P5R1 and VS2 remain frozen.
