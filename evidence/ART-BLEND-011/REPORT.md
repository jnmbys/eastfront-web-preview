# ART-BLEND-011 review

Baseline: 5a4835e237594c8dfe8510f2611b18f7ebed96fb. Independent branch art-blend-011. No deployment. 010 unchanged.

Observed in all four actual screenshots: forest and hill clearance edges soften; town ground is less isolated. Overall 300% gain is modest; near view shows the blend more clearly. Some ridge mass is reduced near transport. Angular river geometry/regular water width remain visible. Preserve this bounded candidate for user judgment; no claim of a dramatic Civ VII match.

Validation: build/typecheck passed; four semantic groups passed; nine browser checks passed (same camera/selection/unit SVG/hit polygons at 300% and 500%; five natural terrain masks; label roof clearance; stacked unit pick; forest/city selection; drag guard; no JS errors/nonlocal requests). Additional canvas scope comparison: {"changedCanvasPixels": 90019, "outsideEightCellPixels": 0, "boundaryToleranceWorldPixels": 1.3, "canvas": [4096, 3689]}. Boundary tolerance covers antialiasing, not new terrain scope. No full match or device acceptance run.

Costs: runtime 3,975,534 B, 75 files including manifest; versus 010 +11,061 B. No new image. Main canvas 60,440,576 B; listed prepared and temporary canvas sum 67,812,840 B. Reused atlas decode 6,290,064 B, in addition to older unchanged image decodes. Estimates are not RSS/VRAM or peak memory.

One cold context each, Chromium 1363×936 DPR1, no throttling: 010 paint/decode 1551.9ms, navigation-to-ready 1981.6ms; 011 paint/decode 1698.5ms, ready 2069.3ms. No stable performance conclusion; this sample is slower. Ready is not presented-frame time. Historical 708ms startup problem remains open. No RAF/performance campaign.

Screenshots: current010-medium.jpg / refined-medium.jpg; current010-near.jpg / refined-near.jpg. Captured in the same loaded document at zoom3 panX−525.3515478145669, zoom5 panX−875.5859130242782; panY0 both. Existing fonts used, no downloads. All four images visually inspected.

Reference interpretation/provenance and reproduce commands: experiments/art-blend-011/README.md and ASSETS.md. No rule, Core, AI, supply, transport data, gameplay interaction or deployment changes.

Scope harness first lacked CSS/image MIME headers and timed out; fixed the local test server headers, then passed. This was not a product renderer change.
