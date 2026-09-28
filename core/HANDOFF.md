# Rule Worker handoff — CORE-FIX-001

Durable project branch: https://github.com/jnmbys/eastfront-web-preview/tree/core-fix-001

Start with `docs/corefix001/REVIEW.md` and `evidence/corefix001/RESULTS.json`.
Original source import commit: `1098967b239e65be1e7861d5930adc9a7e804aed`.
The original historical Git commit is UNKNOWN. Identify the original by the preserved ZIP SHA256 in ORIGIN.md, not by the new import commit.

Standalone package layout retains `core/`, `docs/`, `evidence/`. From its root:

```sh
npm ci --ignore-scripts --prefix core/source
npm run typecheck --prefix core/source
npm run build --prefix core/source
npm test --prefix core/source
npm exec --prefix core/source -- vitest run --root core/source tests/coreFix001.test.ts
node core/run-smokes.mjs
node core/verify-equivalence.mjs
```

Requirements: Node/npm (validated Node 24.19.0), Python 3 for archive comparison. Dependencies pinned in source/package-lock.json. Original 11 Vitest failures remain documented; do not silently rewrite rules to satisfy them. This is an unpublished candidate. No supply/endgame/art changes authorized by this handoff.
