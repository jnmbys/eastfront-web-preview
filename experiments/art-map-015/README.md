# ART-MAP-015

Single full-map candidate on independent branch `art-map-015`. Base:
`art-implement-014`, `1a33de2bf90fa3e97579482a0e534db8ff41927d`.
No merge, PR, deployment, Core/rules/RNG/AI/supply changes.

## Reproduce

Use the existing Node/TypeScript dependencies:

```sh
node experiments/art-map-015/build.mjs
node experiments/art-map-015/validate.mjs
node experiments/art-map-015/serve.cjs
```

Open http://127.0.0.1:44115. The shared viewer compares 014/015 without moving
the camera or selection. `?variant=baseline` starts 014. The builder typechecks
the existing source and bundles only the static import closure. `dist` is ignored.
No new package or environment installation was needed. Dependencies were copied
from the clean 014 worktree; the existing source lockfile remains authoritative.

## Rules and limits

`map015Layout.ts` is a layout/material module called by the existing
`blend011Terrain.ts` painter, not another renderer. Coordinate-derived choices
are deterministic art variations; the game RNG and map data remain untouched.

- X14 and the original seven surrounding cells keep the exact approved 014
  placements and material processing. They remain the reference composition.
- Every other forest gets a bounded dense core and edge canopy. True adjacent
  forest determines the direction and density. Hills and rough terrain use the
  010 relief atlas with coordinate/adjacency-based scale, position and aspect.
  No sprites are placed on plain, marsh or lake cells.
- Cities start with related U, L or paired-yard motifs. Candidate orientations
  are scored for usable area after real corridor, unit and label exclusions.
  Surviving wings extend into nearby free pockets with bounded candidate and
  roof counts. Only footprint centers turn; the lit atlas pixels are never
  rotated or mirrored. 9–12 is an upper budget, not a target to fill by force.
- Shared soil/litter shoulders derive from actual neighboring terrain. Bank
  moisture is painted underneath existing river geometry, with separate marsh
  strength. Open plain approaches remain free of tree/building symbols.
- Main city AC10 is occupied by F-49. Its 68 × 68 fixture clearance leaves no
  safe roof footprint, so it retains city ground and label without roofs. This
  exception is visible and recorded; no unit or label was moved to hide it.
- The old outside-X14 scattered terrain/building and 007 decoration passes are
  replaced in 015. No extra decoration layer or global saturation pass is added.
  The 014 branch of the same painter retains the previous behavior.

## Rendering and memory

One existing full-map canvas, SVG units/hit targets/labels and all five existing
WebP assets are reused. Material washes draw directly into that canvas. Seven
small 014 reference tiles remain cached as before; **one** reusable small scratch
canvas bakes every other natural stamp sequentially at 2 px/world unit. Its peak
backing is 72,864 B (under 144 × 144 × 4). No per-cell large canvas collection or
live lighting/gesture-time terrain pass is introduced. Existing atlas preparations
remain constant-sized and shared. 015 draws 239 natural and 51 roof stamps, zero
007 decorative stamps; baseline rendering remains available for comparison.

`validate.mjs` checks frozen map and source contracts, eight-cell golden,
adjacency, terrain ownership, town clearance, bounded/varied layouts, real alpha
mask logic with opaque synthetic inputs, transport and interaction preservation.
Synthetic mask inputs are tests only; they are never presented as game captures.

## Assets and evidence

No new runtime images. Byte-identical source art and provenance remain in
`experiments/art-slice-005/ASSETS.md`, `experiments/art-polish-007/ASSETS.md`,
`experiments/art-terrain-010/ASSETS.md`, and the 014 asset-provenance record.
No Civilization assets were extracted or new reference research undertaken.
Actual captures, costs and limitations are in `evidence/ART-MAP-015/REPORT.md`.

## Recovery and isolation

The 014 worktree was clean at start and remains separate. No existing local or
remote `art-map-015` checkpoint was found (remote connector returned no matching
commit after ordinary Git query timed out). No applicable AGENTS.md,
PROJECT_STATE or WORKER_PROTOCOL was found in the complete pinned tree or local
parents. AI and supply directories were not modified.

Recover 014 in a fresh directory without resetting any worker:

```sh
git worktree add --detach ../art-015-recovery 1a33de2bf90fa3e97579482a0e534db8ff41927d
```

Then use `experiments/art-implement-014/build.mjs` and `serve.cjs` there. The
remote 014 branch is retained. The inherited repository history is shallow.
