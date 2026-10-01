# Exact publication plan — NOT EXECUTED

Visual baseline: `35e36314b61e157be016040d91d9d05eeaf39f5a`.
Prepared publication commit: `86241e5d24ed9457f54891056b90abe9772b25f3`.
Runtime tree: `35a2522c00d1a2dad0612721e14fcaf48b3e62bd`.
Target: `jnmbys/eastfront-web-preview`, **new** branch `art-map-preview-016`.
Existing Pages project: `eastfront-web-preview`.

Only `release/ART-PREVIEW-016/` becomes the publication root: 78 files,
3,999,290 raw bytes including manifest. Its contents are the standalone HTML/CSS,
entry and static module closure, five existing WebP assets, map JSON, manifest
and `_headers`. No source, evidence, node_modules, full game entry, backend
configuration or withdrawal page is included in that root.

This follows the existing runtime-only Git → Cloudflare preview process recorded
in ART-SLICE-PREVIEW-005 and ART-MAP-PREVIEW-006. It uses a new branch, leaving
`art-slice-preview-005`, `art-preview-001`, `main` and `source-main` untouched.
The new runtime commit is a root commit because the target branch did not exist.
It is deliberately not a source/evidence commit and does not carry the skip
marker; it must remain local until a separate publication instruction is given.
All remotely saved source/evidence commits carry `[CF-Pages-Skip]`.

Expected branch URL, **not created or verified**:
`https://art-map-preview-016.eastfront-web-preview.pages.dev/`.
The actual immutable deployment URL, current Pages branch inclusion settings and
CDN bytes can be confirmed only during authorized publication. No claim is made
that this expected URL currently serves 016.

## Future publication steps (require a later explicit publication instruction)

1. From the source/evidence checkout run `recover-release.mjs`; it verifies and
   restores exactly the SHA above without rebuilding.
2. Read the remote `refs/heads/art-map-preview-016`. It must still be absent. If
   it exists, stop and reconcile that checkpoint instead of overwriting it.
3. Confirm the existing Pages project permits this isolated preview branch and
   serves the runtime repository root. Do not change production branch/settings.
4. Only then publish that exact commit with an ordinary create/fast-forward push:

```sh
git push origin 86241e5d24ed9457f54891056b90abe9772b25f3:refs/heads/art-map-preview-016
```

5. Verify remote full SHA, completed deployment status and the actual assigned
   URL. Check index, module/assets/map/manifest HTTP responses and served hashes;
   open full, north, central, south and 014 comparison entries. Run user/device
   acceptance on that actual URL. This step was not performed in 016.

## Withdrawal / recovery (prepared, not executed)

Before publication, do not push the runtime ref; there is nothing remote to undo.
The source/evidence branch may be retained for review without deploying it.

After a future publication, to withdraw the branch preview without force-pushing:

1. Obtain a separate withdrawal instruction. Read and record the then-current
   remote `art-map-preview-016` SHA; never assume it still equals this candidate.
2. Use prepared withdrawn tree `83b6938299e798516aa6d892fa9085bb9109470c` from
   `release/ART-PREVIEW-016-WITHDRAWN`. It contains only an explanatory index and
   noindex/no-store headers, not the map.
3. Create a new commit with that withdrawn tree and the observed current remote
   SHA as parent. Use a clear withdrawal message. Then make a normal fast-forward
   push to **only** `art-map-preview-016` and verify the withdrawn page is live.
4. A branch withdrawal does not erase prior immutable Cloudflare deployment URLs.
   Removing those URLs would be a distinct explicitly authorized platform action.

No branch deletion, reset, force push, deployment removal, hook, PR, merge or
Cloudflare operation is included in this task. The original 014/015 source refs
and existing older preview remain available; see the README for isolated source
recovery. Raw release-commit bytes in `publication-commit.txt` plus the tracked
runtime subtree make the prepared SHA reproducible from the source branch.
