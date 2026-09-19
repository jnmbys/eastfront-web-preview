# UI-007R1 Visual Closure

Status: **READY FOR LEADER REVIEW** — not Formal PASS.

UI-007R1 closes only the two visual items left open after UI-007 Formal Review: City S02 road-semantic cleanup and Marsh neighbor-aware continuity. Core, Hex Geometry, Strategic Reset F topology, terrain semantics, gameplay, deterministic asset selection and all previously accepted P5 families remain frozen.

## Final closure decisions

| Item | Decision | Evidence |
|---|---|---|
| City S02 | **FINAL ACCEPT** | P5R1 changes only `city/small/S02.png`. Runtime SHA is `914593e3fb5c28b412fd0aff47418728f9ff360fce19659f63b870352890c55e`; P5 baseline SHA was `548ab5333ab4d85d50b2e0317cd9394fddd5ffe38895b3603b96230c665ec5ae`. The P5R1 edit removes the strong outward dirt-path arms while preserving alpha and pixels outside the authorized edit mask. On real Strategic Reset F, `OUTER_CITY 29,-5` still has **no canonical Road** and **does have Railway**. The ordinary `city_small` selector still chooses S02 at seed 17; there is no S02-specific renderer code. |
| Marsh | **FINAL ACCEPT** | A deterministic Marsh-Marsh shared-edge continuity pass now bridges selected internal Marsh edges only. At production visual seed 17, the real map has 10 Marsh-Marsh adjacencies: 7 receive wet continuity and 3 intentionally remain dry, preserving fragmented wetland and dry internal structure. All 86 Marsh-Plain boundaries and all 7 Marsh-Forest boundaries receive zero continuity. The same edge decisions persist across Far/Medium/Close; only detail changes. |

## City S02 closure

P5R1 source ZIP SHA-256:

`4bd2b69fad62de8a63ffd8ea774b9be533891cd0a58ef63bbc06dac7e434e7a9`

P5 baseline source ZIP SHA-256:

`6bb5c62018f8e6c63c86d8bc1b9bf02b361519d85d9ed05fb8cad3c739abc862`

P5R1 provenance is narrow and verified:

- manifest byte-identical to P5, SHA-256 `5e2ac4521b889e92d9b77a75b47c87075c8aeab9f43acd112ef91de7e6b82936`;
- production raster path set unchanged at 123;
- exactly one production raster changed: `city/small/S02.png`;
- other 122 production rasters are byte-identical to P5;
- S02 alpha channel is byte-identical;
- pixels outside the authorized edit mask are byte-identical;
- no City renderer branch or canonical Road/Rail geometry was changed.

Real-map audit for `OUTER_CITY 29,-5`:

- terrain: `OUTER_CITY`;
- canonical Road incident: **false**;
- canonical Railway incident: **true**;
- deterministic city asset at seed 17: **S02**;
- the P5R1 sprite no longer presents the previous strong outward road-like arms.

Authoritative evidence:

- `screenshots/ui007r1/07-city-s02-before.svg`
- `screenshots/ui007r1/08-city-s02-after.svg`
- `screenshots/ui007r1/09-city-railway-close.svg`
- `screenshots/ui007r1/evidence-assets/S02-UI007-before.png`
- `docs/p5r1-handoff/P5R1_CHANGED_ASSETS.json`
- `docs/p5r1-handoff/P5R1_INTEGRITY_AUDIT.json`

## Marsh continuity closure

The continuity pass is presentation-only and derives only from real Core terrain neighbors plus an unordered edge visual seed.

Production seed-17 audit:

- Marsh-Marsh adjacencies: **10**;
- selected wet continuities: **7**;
- intentionally unconnected Marsh-Marsh edges: **3**;
- selected mud continuities: **1**;
- selected reed continuities: **2**;
- Marsh-Plain boundaries: **86**, continuity **0**;
- Marsh-Forest boundaries: **7**, continuity **0**.

Implementation constraints preserved:

- no `Math.random()`;
- no gameplay RNG consumption;
- no `GameState` mutation;
- no movement/combat/ZOC/supply change;
- no Geometry change;
- no terrain-semantic change;
- no continuity into Plain, Forest or City;
- continuity is clipped to the union of the two real Marsh Hex polygons;
- Far retains broad wetland mass without fine reeds;
- Medium renders wet/mud continuity with sparse reed continuity;
- Close retains the same edge decisions and allows stronger edge vegetation detail;
- Hex grid, tactical overlays and counters remain above the continuity layer.

This closes the prior isolated-Hex wetland attribution without repainting P5 Marsh assets.

Authoritative evidence:

- `screenshots/ui007r1/01-south-marsh-medium-r1.svg`
- `screenshots/ui007r1/02-south-marsh-close-r1.svg`
- `screenshots/ui007r1/03-full-far-r1.svg`
- `screenshots/ui007r1/04-turn1-counters-over-marsh-r1.svg`
- `screenshots/ui007r1/05-ab-marsh-ui007-baseline.svg`
- `screenshots/ui007r1/06-ab-marsh-ui007r1.svg`
- `docs/UI007R1_MAP_CLOSURE_AUDIT.json`

## Tactical readability

All prior UI-007 gameplay and renderer tests remain Green. The continuity layer is inside the production base, below the grid, deployment/action overlays and real counters. Existing movement, combat target, retreat, breakthrough, rail-repair, entrenchment, deployment and counter geometry remain unchanged.

## Closure

**City S02: FINAL ACCEPT**  
**Marsh: FINAL ACCEPT**

No further Painter repaint is required by the evidence in this task. If Leader formally passes UI-007R1, the visual phase should close and the next task should be UI-008 — Playable Web Preview / Deployment Build.
