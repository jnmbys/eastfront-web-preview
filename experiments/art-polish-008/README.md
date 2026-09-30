# ART-POLISH-008 — X14 settlement / woodland / bank composition

Parent: `70fe526fd3738be8763ac5f95bdfe10b1374ad23` (007 visually reviewed, not final art acceptance). Independent branch `art-polish-008`; no deployment or whole-map propagation.

```sh
npm ci --prefix task-source/ART-PREVIEW-002
node experiments/art-polish-008/build.mjs
node experiments/art-polish-008/validate.mjs
python -m http.server 8768 --directory experiments/art-polish-008/dist
# Browser checks require existing Playwright and a Chromium executable:
CHROMIUM_PATH=/path/to/chromium node experiments/art-polish-008/check.cjs
# Only recapture the four screenshots, without re-running cold-load/interaction checks:
SCREENSHOTS_ONLY=1 CHROMIUM_PATH=/path/to/chromium node experiments/art-polish-008/check.cjs
```

Open `http://localhost:8768/`. Current = 007 renderer at the pinned parent, refined = 008; `?variant=baseline` starts 007. Both use identical 640 cells, 257 edges, 58 display fixtures, X14 focus and click layers. Near 500%, medium 300%. This is an isolated visual fixture, not a playable match or multiplayer connection.

Only eight cells are composed: X14, W13, W14, V13, V14, W15, X15, Y15. The patch replaces X14's 16 small scattered building sprites with 9 larger, deliberately arranged roofs, including one civic accent from the existing building atlas. Shared courtyard earth, forest litter, broad damp-bank material and varied relief proportions replace reliance on tiny decoration scatter. Existing small-detail stamps inside these cells are removed: total 402 → 334. Forest canopy groups are reshaped and overlapped within actual FOREST cells; river and railway gaps remain real constraints. Forests do not spread into neighboring PLAIN cells. Roofs never leave X14 CITY.

No new image asset, AI generation, remote font, external CDN or asset license is introduced. The four existing WebP assets are copied unchanged from 005/007; provenance remains in their ASSETS.md files. Host Noto CJK font was restored for legible browser screenshots only; it is not shipped.

Implementation is three new experimental modules; the original 007 renderer, Core, data, geometry, unit renderer and gesture module remain unchanged. No main/source-main/preview branch update, PR or Hook. Detailed limits and measured cost: `../../evidence/ART-POLISH-008/REPORT.md`.
