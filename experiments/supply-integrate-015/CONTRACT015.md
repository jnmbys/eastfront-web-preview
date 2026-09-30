# SUPPLY-INTEGRATE-015 — experimental main-game adapter

## Baselines and scope

- Branch parent/deployment evidence: `b888514ea9886bff63cfd06dd75909cec707faab`.
- Frozen sandbox runtime: `aca1f4b9801ab7b7c7073ac7973bb028cd6df435`.
- Main frontend inherited unchanged from that parent; latest frontend change on its lineage is `140cd34510a9149d79d870f9290450fc1da78d54` (recipient result-close fix).
- Read-only upstream verification on 2026-09-30: `source-main=5fe12513bca95c5b43c2ddc125021a117c5bcce4`; main is built-site branch `349369ad358b9b24fa0410735649de497a94b9ea`. Compared with source-main, the inherited relevant changes are the already-delivered result-close fix and Core integrity fix. Neither upstream branch is modified or merged.
- SAVE-014 was paused while still read-only. No SAVE implementation or uncommitted SAVE edits existed to discard. No save dependency is introduced.
- Hotseat only. Old local entry remains default. The experimental URL is `/?supply=experiment`, with explicit new/old creation buttons. No AI or multiplayer entry in this surface; never silently falls back to the local engine. Defensive reaction, loss, retreat, advance, breakthrough and phase progression reuse the main controls. Optional attacker-artillery **support selection** is disabled and labelled because the frozen `live.execute` contract has no `support` field. Artillery as ordinary attacking units and existing defensive artillery reaction remain available.

## Authority and data boundary

Browser `SupplyClient` implements the existing `NetworkPlayerSession` transport interface using **same-origin HTTP**. Normal production renderer, deployment touch controls, counter selection, movement drafts, combat choices and phase controls are reused. The browser receives authorized PlayerView/BrowserRenderModel and own supply fields only. It does not receive GameState, RNG, journal, dedup map, hidden enemy IDs or enemy inventory and cannot execute the Python optimizer.

`service.py` is a separate opt-in entry, not imported by sandbox `online.py` or production server. It holds each session's full `{core, logistics, mode, clip, revision, seen, journal}` bundle. Every accepted Action calls the **unchanged** `live.execute`. No second supply algorithm. Core RNG, experimental formulas, config and victory rule are unchanged; expSupply prevents old penalties being applied again.

The private Node projection subprocess imports **the existing** main `queryModel`, `playerSnapshot`, `validateIntent`, `forcedAction` and presentation-event filters. Build copies the existing sandbox experimental Core into `.integrate-dist/vendor/…` only. Root/browser vendor remains unchanged. Queries use a detached copy, remove invisible enemies before movement queries, restrict draft IDs and combat history through the existing filtering boundary. Actual Actions always execute against full server state. Query-only Core probes never commit RNG. No server-side projection process is reachable directly from HTTP.

`projection.mjs` returns private observation memory to Python; Python strips it before sending the public packet. Battle disclosures are recorded only through filtered events or an owned pending decision. Own supply display reuses `player_display`, including withholding hidden transport routes.

## HTTP contract

All POSTs go to `/experiment`; JSON, matching Origin, maximum 20,000 bytes. Exact operation-field allowlists; required `version: "SUPPLY-INTEGRATE-015-v1"`. Dedicated HttpOnly/SameSite=Strict cookie `ef_supply015`, Secure by default. No production identities, Secrets or WSS. HTTPS is terminated by the existing platform when approved; `PUBLIC_ORIGIN` is mandatory in secure mode.

| Operation | Fields in addition to version/op | Effect |
| --- | --- | --- |
| open | mode=new or old for first creation; omitted to resync | Creates seed-17 full campaign only if no session; otherwise resumes fixed mode. Different mode rejected. |
| query | revision, id (optional correlation), draft | Authorized options; no state mutation. Stale revision rejected. |
| action | revision, id, action (without controllerId/actionId) | Server supplies current seat controller, calls frozen executor. Exact successful retries preserve dedup ID and are no-ops. |
| switch | viewer=GERMAN or SOVIET | Explicit hotseat handoff; recomputes authorized view and clears client drafts/results. No Core/RNG/inventory mutation; not a multiplayer credential. |
| close | none | Ends this disposable in-memory match. UI awaits acknowledgment. |

Public response: `version`, `matchRevision`, `view`, `model`, `canAct`, `status`, `forcedAction`, filtered `events`, and `supply`. Supply identifies frozen source/profile/mode, own stock/target reserve/debt/effects, actual before/after changes, action costs, settlement occurrence, own actual ledger and elapsed transaction time. No route prediction. Whole-group transport sequencing is client-local correlation; authoritative revision/dedup remain on Python.

## Commit/fault boundary

Single process, single nonblocking gate, four sessions, 30-minute idle expiration and fixed 30-minute cookie, 1,000 campaign Actions, existing 6 MiB state-growth cutoff, existing bounded eight HTTP workers. Busy returns 503 without queueing a solve. No new database, paid resource or background service. Deployment/service restart loses these in-memory sessions; saves remain deferred.

For a new Action: validate ownership/intent → execute on copied bundle → build candidate authorized projection/receipt → check **total 3-second deadline** → atomically replace slot. Projection failure/timeout also rolls back. Original Core/RNG/stock/debt/seen/journal/observation memory/receipt remain unchanged. Limits are checked before new actions; successful duplicate IDs remain replayable even at the limit. Client keeps identical ID/revision/Action for explicit retry; a lost HTTP response is reported as uncertain and blocks fresh Actions until retry or resync. No automatic upgrade, larger budget, retries with new IDs, or old-rule fallback.

The bridge preserves sandbox Action key order (`type`, `controllerId`, remaining fields), because the existing frame's `core_state_hash` hashes JSON bytes. This fixed an adapter-only mismatch; no frozen hashing implementation was changed.

## Operator start / proposed preview boundary

Not instructions for the tablet user. On an execution host with the existing Node/Python toolchain, from repository root:

```sh
npm ci
python -m pip install -r experiments/supply-exp-005/requirements.txt
python experiments/supply-exp-005/restore-fixtures.py
node experiments/supply-integrate-015/build.mjs
COOKIE_SECURE=0 BIND_HOST=127.0.0.1 PORT=8765 python experiments/supply-integrate-015/service.py
```

Then open `http://127.0.0.1:8765/?supply=experiment`. For HTTPS use COOKIE_SECURE=1, the exact PUBLIC_ORIGIN, and the existing platform port. Do not use development cookie settings on a public host.

A repository-root-context Docker candidate is supplied here; it reuses the Node/Python image family and Python requirements of the current sandbox. **Not Docker-built or Render-tested in this task.** The current sandbox Docker context is only `experiments/supply-exp-005`; it cannot build this frontend. Future approved preview would use repository-root context, `experiments/supply-integrate-015/Dockerfile`, the new CMD, one instance, same 0.5 CPU/512 MiB, auto-deploy off, same isolated service and no production connection. Before replacing that service: fixed-SHA build/resource check, then browser/tablet acceptance. This task neither changes the service nor creates resources. Rollback remains the existing sandbox image/entry at aca1f4b9; both direction changes clear sessions.

Tablet flow after an approved preview exists: open link → “创建新补给实验对局” → use normal deployment/map/combat controls; “交给…／切换观察方” hands the device to the other side. No terminal, install or source download should be required of the player.
