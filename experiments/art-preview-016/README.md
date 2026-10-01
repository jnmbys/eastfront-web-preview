# ART-PREVIEW-016 — prepared, not published

Fixed visual source: `art-map-015` at
`35e36314b61e157be016040d91d9d05eeaf39f5a`.
Source/evidence branch: `art-preview-016` (commits use `[CF-Pages-Skip]`).
Prepared runtime branch: `art-map-preview-016` (local only).

## Open and operate

The local preview prepared in this run is http://127.0.0.1:44116/?view=full .
It opens the complete 015 map at 100%. Drag, wheel, plus/minus, unit selection,
same-cell unit choice and grid controls retain the 015 interaction contract.
`查看014` / `查看015` changes only the terrain variant, preserving camera and
selection. North, central and south buttons focus W2, R10 and W16 at 300%.
X14 keeps the 500% reference view. AC10 has a separate 500% inspection entry.
Location buttons change the camera only; the current selected unit stays selected.

Direct entries, relative to the preview root:

- `?view=full`: full map, 100% (also the default).
- `?view=north`: northern woodland W2, 300%.
- `?view=central`: central town R10, 300%.
- `?view=south`: southern river network W16, 300%.
- `?view=x14`: accepted X14 reference, 500%.
- `?view=ac10`: main city identification check, 500%.
- Add `&variant=baseline` for 014, otherwise 015 is shown.
- `/index.html` also works. Unknown view values fall back to full map.

Use HTTP(S); opening `index.html` as a filesystem `file:` URL is not supported
by the browser's module/fetch rules. No new installation is needed in the current
environment. The temporary local server is intentionally left available to the
user; it is not a Cloudflare publication and is not accessible on other devices.

## Build / verify / recover

```sh
node experiments/art-preview-016/build.mjs
node experiments/art-preview-016/serve.cjs
```

With that local server running, in a second terminal:

```sh
node experiments/art-preview-016/validate.mjs
```

Reuses the existing strict TypeScript builder and static-import dependency
closure; no game bootstrap, backend URL or additional rules/AI behavior is
connected. Existing self-only CSP and noindex headers remain; the 016 entry
also reuses the established production-host block for the production Pages
hostname and GitHub Pages hostname. No host/project settings are changed.

`prepare-release.mjs` records the exact runtime tree and commit locally, copies
the exact files into tracked `release/ART-PREVIEW-016`, and prepares a withdrawn
landing page. It makes no network write. It refuses to replace a fixed release
with different bytes. Publication is not part of build, validation or recovery.

The prepared release commit is reconstructible from the remote source/evidence
checkout without rebuilding or downloading an archive:

```sh
node experiments/art-preview-016/recover-release.mjs
```

This verifies `HEAD:release/ART-PREVIEW-016`, restores the recorded raw Git commit
and creates the local publication ref only if absent. It does not push.
All runtime objects are reachable in the source branch; only the prepared
publication commit itself is kept off the remote until publication is authorized.

To return to 015 source safely, create a separate checkout:

```sh
git worktree add --detach ../art-016-recovery 35e36314b61e157be016040d91d9d05eeaf39f5a
```

The original 015 worktree remains clean and untouched. No applicable AGENTS.md,
PROJECT_STATE or WORKER_PROTOCOL was present in the pinned tree/local parents.
No existing 016 checkpoint was found before creating this independent worktree.

See `evidence/ART-PREVIEW-016/PUBLISH.md` for the exact future scope and withdrawal
steps, and `REPORT.md` for entry checks and the AC10 recognition limitation.
