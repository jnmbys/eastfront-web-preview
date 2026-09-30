# ART-SCENE-012

Base: `art-blend-011`, `9751b0f3a326085142f38e10cfd8fde11cf6664b`.
Independent checkout/branch `art-scene-012`. No merge, deployment or PR.

## Run

With the existing Node/TypeScript dependencies:

```sh
node experiments/art-scene-012/build.mjs
node experiments/art-scene-012/validate.mjs
node experiments/art-scene-012/serve.cjs
```

Open http://127.0.0.1:44112. The variant button compares 011 with 012 in the same document. X14 restores the 500% camera; eight minus clicks produce 300%. Select G-03, then G-02 in the panel for the evidence fixture. The 012 builder compiles TypeScript and copies only the static import closure. Generated dist stays ignored. It avoids the old full-candidate builder's Windows absolute-path dynamic-import problem. On a fresh checkout, the existing lockfile supports `npm ci --prefix task-source/ART-PREVIEW-002`; no environment installation was required for this run.

## Implementation and scope

The existing 011 painter and viewer accept an opt-in scene flag. No second renderer or new texture atlas. `scene012Geometry.ts` computes bounded visual coordinates only. Water displacement <=1.45 world px and low-frequency half-width change <=0.6 px fade to zero before the outer eight-cell boundary and at existing bridge approaches. Original graph, segment endpoints, bridge deck geometry, transport gaps and water chain topology remain inputs. Road/rail displacement <=1.6 px; both rails and sleepers follow the same route, drawn inside the eight-cell clip. The former straight pass remains outside it. There are no new crossings.

X14 uses 11 smaller roof groups arranged around shared ground instead of seven large isolated stamps. All roof bounds pass original city, counter, transport and label clearance checks. Three original hill/rough envelopes and four canopy envelopes are retained; feather shoulders narrow from 9 to 3 px for relief, 6.5 to 3.7 px for forest, restoring mass without increasing global saturation. Ground uses the same existing material field. Static bake only; no live lighting or gesture-time painting.

Allowed cells: X14, W13, W14, V13, V14, W15, X15, Y15. Core, rules, RNG, AI, supply, map/edge data and click/gesture handlers are unchanged. Five semantic checks are in `validate.mjs`. Browser interaction evidence and limitations are in `evidence/ART-SCENE-012/REPORT.md`.

## References/assets

All five WebP assets are reused byte-for-byte. Provenance and existing official Civilization VII references remain in `experiments/art-terrain-010/ASSETS.md`, `experiments/art-polish-007/ASSETS.md`, and `experiments/art-blend-011/README.md`. No copied reference pixels, new generated image, font or remote runtime dependency. Existing assets were sufficient for this bounded candidate; no image-generation run or renewed research campaign.

## Recovery

The exact baseline commit and tree were reconstructed from authenticated GitHub connector reads after Git clone network failures. Each missing blob was SHA-1 verified; 829 blobs were reused from local files by exact hash and 321 fetched. `git write-tree` matched `2766e3e4d414c7a523ecd70c118777fff25f748a`; the raw commit matched the full baseline SHA. Local history is shallow at that commit. No AI/supply checkout was changed. Baseline has a local `art-blend-011` ref and remains on the remote. Recover in a new directory with `git worktree add --detach ../art-scene-012-recovery 9751b0f3a326085142f38e10cfd8fde11cf6664b`; do not reset another task's directory.

AGENTS.md, PROJECT_STATE and WORKER_PROTOCOL were absent from the complete pinned repository tree and applicable local parents. This absence is recorded, not an assertion that external project instructions were read.
