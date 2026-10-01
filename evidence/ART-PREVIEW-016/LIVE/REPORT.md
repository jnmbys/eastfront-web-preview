# ART-PREVIEW-016 — published, live interaction acceptance blocked

Published on 2026-10-01 after explicit user authorization. This record supersedes
the earlier preparation-only status; the fixed runtime has not changed.

- Branch: `art-map-preview-016`, repository `jnmbys/eastfront-web-preview`.
- Publication SHA: `86241e5d24ed9457f54891056b90abe9772b25f3`.
- Runtime tree: `35a2522c00d1a2dad0612721e14fcaf48b3e62bd`.
- [Actual branch preview](https://art-map-preview-016.eastfront-web-preview.pages.dev/?view=full).
- [Immutable deployment](https://4284b83b.eastfront-web-preview.pages.dev/).
- [Cloudflare success check](https://github.com/jnmbys/eastfront-web-preview/runs/110294254689).
- Scope: exactly 78 files, 3,999,290 raw bytes; no rebuild or art changes.

## Passed

`prepublish.json` records exact file counts, every manifest hash, identical
publication/source-subtree trees, and 97 reachable Git objects with none missing.
The release commit was recovered from tracked raw commit bytes plus the complete
runtime tree before pushing. It is now also reachable from the remote publication
branch. The sole publication push created that branch with the authorized SHA.

Cloudflare reported completed/success for that full SHA. `http-hashes.json`
records HTTP 200 and exact bytes/SHA256 for all 77 public resources, including
manifest, entry HTML, modules, map and images. `/index.html` first returned 308
to `/`; following that canonical redirect returned the exact expected HTML.
`_headers` is the 78th file, a Cloudflare configuration file verified in Git,
not a public resource. No 403 occurred, and no failed resource was retried.

The previous targeted build, entry and local interaction checks are retained in
the parent evidence directory. They were not rerun and are not labelled online
acceptance. HTTP identity does not prove rendered behavior or startup speed.

## Online acceptance still required

Browser automation created an HTTPS tab with the expected page title and URL,
but initial page observation timed out after 30.0499 s. Inventory confirmed that
tab exists. Binding it for observation also timed out after 30.0310 s. After
reading documented troubleshooting, the supported direct screenshot route
timed out after 10.0327 s. No DOM state, interactive result or online screenshot
was recovered. No raw CDP, export workaround or alternate browser was attempted.
These are automation timeouts, not measured application startup durations.

| Item | Status |
| --- | --- |
| 014/015 toggle with camera and selection preserved | UNVERIFIED online |
| North/central/south camera presets | UNVERIFIED online |
| Drag and zoom | UNVERIFIED online |
| Unit selection and stacked-unit disambiguation | UNVERIFIED online |
| Rendered online screenshot / visual acceptance | UNVERIFIED |
| Comparable startup measurement | UNVERIFIED; no usable measurement channel |
| GPU acceptance | UNVERIFIED; no GPU profiling performed |
| Huawei device / touch acceptance | UNVERIFIED; no device run performed |

The historical 708 ms startup issue remains open separately. AC10's weak
unselected city recognition remains accepted as nonblocking for this comparison
preview. No performance improvement or device pass is claimed.

Direct user checks: open the branch URL, choose 查看014 then 查看015; use 北部林地,
中央城镇 and 南部河网; at X14 select the stacked counter and choose G-02; drag,
zoom and confirm selection persists. Labels here describe intended checks,
not observed online outcomes.

## Withdrawal and recovery

Not executed. After withdrawal authorization, read the then-current remote
`art-map-preview-016` SHA. Create a new forward commit with that SHA as parent
and prepared withdrawn tree `83b6938299e798516aa6d892fa9085bb9109470c`.
Push only that new commit to `art-map-preview-016` without force, then verify
the branch serves the withdrawn landing page. The immutable deployment URL
continues to exist; deleting it requires separate platform authorization.
See [the prepared withdrawal procedure](../PUBLISH.md#withdrawal--recovery-prepared-not-executed).

To recover the candidate, retain the publication SHA and source/evidence branch;
`node experiments/art-preview-016/recover-release.mjs` reconstructs its commit
from Git-tracked bytes in a compatible source checkout, without rebuilding or
publishing. It refuses to overwrite a differing local release ref.

No main/source-main update, PR, merge, Hook, backend/configuration change or
additional art work was performed. Evidence is saved separately on
`art-preview-016` with `[CF-Pages-Skip]`.
