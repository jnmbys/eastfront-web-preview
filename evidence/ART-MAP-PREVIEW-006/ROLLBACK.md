# Rollback (prepared, not executed)

Previous release: 8ae9579b871520b3616619f0e67c060dc1db583f.
Previous runtime tree: ef731b263b2d9c48540b9dcf84723b621ea12dcc.
Previous immutable preview: https://4ffa913a.eastfront-web-preview.pages.dev/ .
New release: fabb559b757686c410164f8765277e383caf11ee, direct child of previous release.

To restore the branch without force-pushing: first read current art-slice-preview-005 SHA. Create a new commit with that current SHA as parent and the previous runtime tree above as its entire tree; message should identify restoration of ART-SLICE-005. Fast-forward update art-slice-preview-005 with force=false. Verify Cloudflare deployment success and its actual URL/resources. This is a new deployment, so only execute when rollback is requested/authorized.

Do not reset the branch ref backward, force push, change main/source-main, touch backend or change project settings. Existing old immutable URL remains the direct fallback. Branch restoration does not remove the new immutable deployment URL; deleting that deployment is a separate action if removal is requested.
