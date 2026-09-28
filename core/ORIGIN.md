# Core source archive handoff

Original historical Git commit: **UNKNOWN**. This import is a new source checkpoint, not a recovered historical commit.

Original archive: `archives/eastfront-digital-core-v0.2.25-task002G-3R1.zip`
SHA256: `b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609`
Source: existing project Library file `libfile_29c7e4ba06548191aea0df5c26858392`.
Archive remains byte-for-byte unchanged. `source/` contains its editable project; generated dist is omitted from Git because it is reproducible.

Original dependency ranges: TypeScript ^5.7.2, Vitest ^2.1.8, @types/node ^22.10.0.
New package-lock.json pins the resolved validation environment: Node 24.19.0; TypeScript 5.9.3; Vitest 2.1.9; @types/node 22.20.4. This lockfile is newly generated, not historical.

From source/: `npm ci --ignore-scripts`, `npm run typecheck`, `npm run build`, `npm test`.
Original unmodified rebuild: 76/76 files equal the existing vendor, per evidence/corefix001/baseline-artifacts.json.
Original Vitest baseline: 60 PASS / 11 FAIL, 13 files. Full output is retained; no original assertions were relaxed.
