# EASTFRONT FOW-001 — Player View / Fog of War Foundation

Baseline commit: `a40c07d5660fd4ec597ee4cc564dcd03fb39efa4`  
Baseline tree: `2a0e0385868f690118d2c145953a3fc8e53a45cc`

## Architecture

`Authoritative GameState → derivePlayerView(state, viewer, rules, knowledge) → detached PlayerViewState → BrowserRenderModel → SVG / Counter / Unit Presence`

The projection is deterministic, pure, serializable and has no DOM, Camera, animation or randomness dependency. The existing local session remains the trusted rules host. It keeps complete state locally for rule evaluation; the map/render inputs contain only the projected information. This is an information boundary, **not client-side anti-cheat**. A future server must retain state and authorize the viewer before transmitting a player DTO. This task adds no networking, persistence/reconnect service or AI planner.

`src/core-adapter/browserProjection.ts` retains the canonical command queries formerly located in `render/coreModel.ts`; that file is now a compatibility export. Command legality and combat previews still come from the unchanged Core. Published battle summaries omit full transactions, enemy private reaction options and undisclosed support identities. Identified units use an explicit field allow-list; no enemy template/activation/controller internals are exported. Renderer models are detached clones. Hidden map ownership is withheld; all terrain and infrastructure remain available.

## Visibility / spotting

- Friendly: always IDENTIFIED while alive; complete detached friendly state plus display stats.
- Enemy IDENTIFIED: id, side, type, step, hex, display stats, supply, entrenchment and visibility only.
- CONTACT: per-hex generic marker, side, position, status and contact id. No unit id/template, exact stats, damage, supply, count or private decision state.
- HIDDEN: no active formation object.
- OBSERVER: explicit privileged view, with a detached complete authoritative snapshot. Normal hotseat does not offer this capability.

Initial experimental policy is centralized in `SPOTTING`: ordinary identification/contact radius 1; Recon identification radius 2 and generic contact radius 3, using Core's existing hex-neighbour query. No terrain occlusion, decay, weather or combat modifiers are introduced. Combat participants in the current accepted pending battle are disclosed for necessary combat operation; completed battle history does not track their later positions.

## Deployment and viewer switching

Deployment explicitly suppresses every opposing formation and contact, including adjacent units. Existing ready/handoff flow is retained. The old 'full board revealed' text now explains player visibility.

Development-only German/Soviet/Observer inspection is available through the existing localhost `dev=1` + Debug controls. Inspection does not change controller authority, GameState, RNG, Camera, selection or drafts; a different-side or observer view is read-only. Normal hotseat viewer changes remain behind the existing privacy gate, which clears inspection overrides.

## Last-known intelligence

Knowledge lives beside the session, never in Core. `rememberPlayerView` accepts only disclosed facts and records generic per-hex sightings with last-seen turn and UNCONFIRMED status. It cannot track hidden movement/destruction. Returning to an observed empty hex clears the stale marker. Different viewers' memory is rejected. Current contact and last-known markers use distinct solid/dashed shapes and localized accessible labels; neither has a gameplay target or Presence identity.

## Animation privacy

`accepted ActionResult → existing UA event derivation → filterPresentationEvents(beforeView, afterView) → existing queue/renderer`.

Hidden move, fire, hit, destroyed and artillery-support facts are removed before publication to UI observers. Enemy travel requires both disclosed endpoints and every path waypoint inside disclosed identification hexes; otherwise it settles without revealing its route. The runtime binds only projected identities. Viewer changes or loss of visibility interrupt and clear the existing playback, preventing old ghosts/effects from persisting into a new view. This intentionally conservative interruption can also settle otherwise visible queued animation in the same batch.

No timing, motion profiles, miniature scale/grounding, recoil, SVG unit mechanics or Core presentation-event derivation changed. Normal/Fast/Instant/Skip/reduced-motion continue through the same runtime.

## Validation

- Baseline clean commit/tree matched; typecheck PASS; build PASS; 365/365 baseline tests PASS.
- Final typecheck PASS; build PASS; **394/394 tests PASS** (365 retained + 29 FOW tests).
- New coverage includes both sides' hidden information, setup privacy, contact/public-field allow-lists, observer access, friendly facts, memory, JSON/determinism, viewer/draft/Camera invariance, hidden animation filtering, queue cleanup, real UI three-click combat bindings, languages, fresh seed and terrain stability.
- Existing animation tests explicitly use Observer for omniscient full-roster visual assertions; interactive tests use the player view. The old post-deployment 58-counter assertion now checks filtered player output and 58 Observer counters. No old test was deleted or skipped.
- Legacy whole-file fingerprint manifests were refreshed only for the authorized FOW integration files and these fixture updates. A separate FOW baseline manifest independently locks all frozen files to the authoritative UA-003R1 bytes.
- Browser manual validation pending. No real browser or Huawei PASS is claimed for this checkpoint. Software DOM tests execute built production markup and event bindings, not browser layout/touch simulation.

## Frozen scope

315 baseline files are checked by `tests/fixtures/fow001-frozen-sha256.json`: Core/vendor, canonical map, geometry, terrain/assets, Camera mechanics, startup/loader, UA timing/queue/events/motion/Counter placement and Unit Presence art/mechanics. `coreSvg.ts` changes only the new intelligence-layer call/import; Counter rendering functions are unchanged. `main.ts` changes view wiring, read-only inspection and resource/privacy text wiring, not Camera methods or startup milestones.

No Core combat changes. No gameplay RNG changes. No Camera changes. No supply/victory/stat/map changes. No VS2 changes. No startup loader strategy changes. No multiplayer or AI implementation.

## Known limits / next review

Initial spotting radii require scenario balancing; no line-of-sight/decay model. Last-known is a generic area sighting, not individual formation tracking. Observer authorization is a trusted-host capability, not a production-player toggle. Future transport must serialize only an authorized player DTO and retain knowledge on the trusted host. Long path validation still uses authoritative command legality; it is not an AI planner or a network command protocol. Real browser/hotseat/tablet verification remains pending. No deployment was performed.

READY FOR LEADER REVIEW
