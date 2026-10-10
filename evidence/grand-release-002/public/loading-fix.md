# Publication loading repair, 2026-10-10

User Huawei report: indefinitely loading; earlier terrain error named moist_soil.webp.
Published 6752015 asset was authenticated HTTP 200, 460014 bytes; SHA256
3ff0734a6f0bc7d1ff2fb827d189aa1c297a50759bc1e59c1422200e12ae261b matched local artifact.
This excludes a missing/corrupt published file, not device/network/decode failure.

Confirmed delivery costs: main static dependency graph 148 modules / 1284209 bytes;
all authenticated assets previously no-store. Build now bundles 162 total inputs
(including deferred imports) into six ESM chunks. Shared startup singleton remains
shared through code splitting. Worker URL retains its original target.
Private cache revalidation follows visitor authentication; matching bytes return
304; changed code/images return 200; anonymous ETag requests remain 401.
No asset quality, game simulation, identity or save changes.

If an image has complete drawable pixels but no load event, the bounded timeout
now accepts those pixels on Android too. Broken zero-size images still fail.
Retries reset loader progress. Loading has a progress-preserving return action.

Validation: clean TypeScript build; 22 image-loader tests; targeted reset check;
release integration check including 200/304/401, both modes, persistence restart.
Local real browser new division game entered full map (loading-fix-local.jpg),
world paused at 1941-07-01 06:00; no error/warn console entries.
Legacy startup-progress full suite contains older VM DOM stubs and frozen-source
hash assertions that fail against current main/terrain source; not reported as
fully passing. Targeted new checks pass. No Huawei device success claimed.

Public Linux restart/read validation is still pending the corrective publication.
Original before/reconnect records preserved; independent test credential is ignored.

## Corrective publication

958ebcea1bb43d41f9608e4d3769bc587457adad is Live (dep-db4tljg473hc73945o70).
Linux startup logged RELEASE002_BACKUP_VERIFIED at 06:28:40 UTC before ready.
Public asset returned 200/460014 bytes, then authenticated conditional GET 304.
Public build hash matches local clean build:
84db3df92f7a193697ae646731f6b19155b67be753d25a31343b047944b48458.
Same service/1c-2g/disk; only source pin changed. No visitor credential/save mutation.

Post-restart independent test visitor read is NOT passed: service returned its
two-active-campaign BUSY/503 limit. Did not evict other players or increase limits.
Public browser inspection timed out; stopped retries. Local real-browser map
check is not Huawei evidence. Huawei user must receive the new page on refresh;
no cookie clearing, new campaign or save reset is required.
