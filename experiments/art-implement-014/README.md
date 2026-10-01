# ART-IMPLEMENT-014

Single bounded candidate on `art-implement-014`, based on `art-scene-012` at
`ad359de4e78ce28e3e9aafcb2d14e0a0f003f20b`. No deployment, merge or PR.

## Build and inspect

Use the existing Node/TypeScript environment (dependencies reused in this run):

```sh
node experiments/art-implement-014/build.mjs
node experiments/art-implement-014/validate.mjs
node experiments/art-implement-014/serve.cjs
```

Open http://127.0.0.1:44114. The existing variant control compares 012 with 014
without changing the map, camera or selected unit. X14 restores 500%; eight minus
clicks give 300%. Click G-03 on X13, then choose G-02 in the side panel to reproduce
the screenshots. Viewport: 1363 × 936. Generated `dist` is ignored; the builder
copies the static import closure only. A fresh machine may use the existing
`task-source/ART-PREVIEW-002/package-lock.json`; no reinstall was required here.

## Implementation

The original painter accepts the opt-in `'014'` scene value. Boolean `true` still
produces 012, checked against the committed 012 placement golden. There is no
second renderer, added atlas, live lighting, animation or gesture-time repaint.

X14 replaces 11 small scattered roofs with eight roof ranges, six forming stepped
wings around a shared south court and two flanking the northern approach. Roof
envelopes shrink to preserve original road/rail/counter clearance. Cropping and
local color adjustment reuse the same baked building tiles. The shared ground
uses the existing material field. Seven existing natural mass stamps receive
rebalanced envelopes, less muted relief, broader soil/litter shoulders and static
contact shading. Trees retain the atlas's upper-left light; no rotation is added.

Only X14, W13, W14, V13, V14, W15, X15, Y15 receive visual changes. Each terrain
stamp and its shadow stays clipped to its actual hex, transport and unit spaces;
the material field is clipped to the eight-cell union. Road/rail/river geometry,
bridge placement, gap logic, map, unit fixtures, Core, RNG, AI, supply and gesture
handlers are unchanged. Header/version/export task labels change outside the map
as necessary to distinguish this experiment. No outside-map-cell art change was
intended or observed; exact pixel identity was not measured.

## Direction and assets

Approved 013 medium and near originals were recovered from the existing local
artwork and verified against chat **美术worker2**, thread
`6abca0b8-bbc0-83ee-b374-5cc618b08192`. They are retained under
`evidence/ART-IMPLEMENT-014/references/` as concept references only. Their labels,
layouts and terrain drift were not used as map data. No new direction images
were generated. Current atlases suffice for this one implementation candidate.

Runtime assets are reused byte-for-byte from 005, 007 and 010. Their source
records remain in `experiments/art-slice-005/ASSETS.md`,
`experiments/art-polish-007/ASSETS.md`, and
`experiments/art-terrain-010/ASSETS.md`. They are original AI-generated art, not
extracted Civilization VII assets. No new ownership/license claim is made.
`evidence/ART-IMPLEMENT-014/asset-provenance.json` records exact SHA-256 hashes.

## Recovery and isolation

This worktree is `C:/Users/jinyibo/eastfront/art-implement-014`; the 012 worktree
and AI/supply worker directories remain separate. No 014 checkpoint existed at
start. No applicable AGENTS.md, PROJECT_STATE or WORKER_PROTOCOL was found in the
pinned repository tree or applicable local parent paths; absence is recorded
rather than claiming those unavailable documents were read.

Recover the unchanged base in a new directory, without resetting any worker:

```sh
git worktree add --detach ../art-014-recovery ad359de4e78ce28e3e9aafcb2d14e0a0f003f20b
```

Run the base's `experiments/art-scene-012/build.mjs` and `serve.cjs` there for the
original 012 experiment. The original remote `art-scene-012` ref is retained.
This checkout has shallow inherited history; the specified base exists locally.

For screenshots, scope checks, costs and candid limitations see
`evidence/ART-IMPLEMENT-014/REPORT.md`.
