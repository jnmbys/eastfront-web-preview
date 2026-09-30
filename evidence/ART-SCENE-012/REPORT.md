# ART-SCENE-012 candidate review

Base `9751b0f3a326085142f38e10cfd8fde11cf6664b`; independent art-scene-012. One complete candidate, no deployment, merge or PR. No changes to main/source-main or other task directories.

## Visual result

Actual Windows Codex in-app browser screenshots: `011-medium.jpg` / `012-medium.jpg` at 300%; `011-near.jpg` / `012-near.jpg` at 500%. Same 1363 x 936 screenshot viewport, document, camera and selected G-02 fixture per pair. These are executable map views, not concept art. Historical 011 Linux screenshots are not used as this run's comparison pair.

Relief regains visible mass around W14/V14/Y15 and forest shoulders are less eroded. X14 ground is more continuous and smaller roof groups establish a broader southern block. Medium-view gain is modest: the town remains small and somewhat scattered, roads remain schematic, and the river still visibly follows angular map edges. The small bounded river/rail curvature should not be presented as a dramatic Civilization VII quality improvement. No further aesthetic iteration after this candidate.

## Verification

- TypeScript typecheck and dependency-closure build passed. Five static semantic groups passed: exact eight-cell set/frozen fixtures; town ownership and clearances; transport endpoint/displacement/bridge guards; river corridor and bridge guards; unchanged relief/canopy envelopes.
- Normal UI: G-03 selection then G-02 panel disambiguation passed (aria-pressed true); selection persists across 011/012 switching and both zooms. V13 reports forest; X14 reports city. Drag 65 x 30 screen px changes the map while keeping X14 selected (`drag-selection.jpg`). Button zoom and focus work. Screenshots show unobstructed X14 label and connected bridge/transport approaches.
- Source scope: only the existing art viewer/painter/layout, the bounded visual geometry helper, 012 build/verification files and evidence changed. No rule/Core/RNG/AI/supply/map data or interaction handler modifications. No live-game movement/combat acceptance or device acceptance.
- Full browser canvas pixel-diff and exact runtime camera/canvas sampling were NOT completed. Raw CDP inspection was rejected by browser security policy, reporting user-denied permission. No alternate browser, evaluator, headless runner or indirect runtime inspection was used to bypass this. Ordinary screenshots and clicks remained available.
- Same-condition startup data were NOT collected: runtime inspection was blocked. Historical 011's 1698.5 ms paint/decode and 2069.3 ms navigation-to-ready are historical Linux single samples only, not a Windows 012 comparison. Historical 708 ms startup issue remains open. No stable performance, Huawei or GPU acceptance claim.

## Cost and limitations

See `cost.json` and `runtime-manifest.json`. Zero new raster assets. Main canvas remains 4096 x 3689 = 60,440,576 RGBA bytes. The previous listed static/prepared/temporary canvas arithmetic remains 67,812,840 bytes because their dimensions and count are unchanged (derived from source and 011 evidence, NOT newly observed runtime memory). The reused 010 atlas decode is 6,290,064 bytes, in addition to other unchanged image decodes. These figures are not peak RSS/VRAM and exclude JS arrays, browser caches and GPU copies.

## Setup/repair evidence

Git clone attempts failed with connection reset/connect errors; partial official archive download was stopped. Exact baseline was recovered via connector blob hashes and local identical files. Build initially hit the old Windows dynamic-import URL issue; the scoped 012 builder avoids it. First 012 HTML entry had an incorrect renamed module URL and first roof layout violated a lower-city clearance; both were corrected before passing validation and capturing all final comparisons. No failed screenshot is represented as a finished scene.
