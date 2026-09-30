# ART-POLISH-008 handoff

Base fixed at `70fe526fd3738be8763ac5f95bdfe10b1374ad23`. User review: 007 color and details improved, repeated relief / isolated woods / sparse city still visible. This pass is a small composition candidate, not a claim of final art acceptance or Civilization VII fidelity. Management ref remains c7531c70fab4b7c7402cd2f7d927c2134adee228. Branch art-polish-008, commit message [CF-Pages-Skip]. No deployment, full-map rollout, rules/Core/production/interaction-contract changes, PR or Hook.

## Actual screenshots

`current007-near.jpg` ↔ `refined-near.jpg`: 1363×936, DPR1, X14 centered, zoom 500%, X14 selected. `current007-medium.jpg` ↔ `refined-medium.jpg`: same scene and selection, zoom 300%. Camera, counter SVG and hit polygons asserted equal in each pair. The baseline delegates directly to untouched 007 `paintPolish`, not 006. All are unmodified headless Chromium screenshots; no image-generation/concept background or postprocessing. They show full scene context; deliberate changes cover eight cells only.

Initial browser environment had no CJK font after workspace recovery. Host Noto Sans CJK SC Regular was restored from the official notofonts/noto-cjk repository for readable screenshots only (not shipped). A screenshot-only pass followed. Final review then found a nonlocal roof-family indexing risk: decreasing X14's building count shifted other cities' roof choices. The renderer now indexes original city sprite identities from the unchanged base list. One final focused build/semantic/browser run verified that corrected code; its four screenshots and two cold-context samples supersede earlier output. Pre-final cost retained in pre-final-cost.json. No performance optimization or broad baseline suite was added.

## Art / semantics

- X14: 16 small scattered buildings → 9 larger buildings in deliberate southern groups and two flank buildings, with distinct roof types and one existing church/civic asset. Warm shared courtyard ground replaces the impression of isolated grass-mounted miniatures. North tip stays open because neighboring counters and the real fork constrain it. City remains one CITY hex.
- W13/V13: overlapping canopy masses and forest-floor shadow, less disconnected scatter. Trees remain within original FOREST cells; river/rail clearances constrain their outlines. Broad damp-ground washes fade under the existing banks; no new river, bridge, road or track is drawn.
- W14/V14/Y15: different original hill/rough sprite proportions and centers, with broader light/shadow at the foot. W15/X15 retain PLAIN semantics and open ground; small-detail noise is removed. Eight-cell union clips all new ground washes. Original transport and bridge paint passes remain above new ground/relief.
- 007 tiny details 402 → 334 (−68), base terrain/building sprite count 1453 → 1439 (−14); no decoration DOM added. Finite asset reuse, limited building families and the larger map's repetition remain. This does not solve whole-map art.

## Necessary checks

Final TypeScript/static build passed. Four focused semantic groups passed: immutable map/edge/fixture data and eight-cell scope; identical placements outside scope; building/forest terrain ownership plus rectangle/corridor/counter clearance; fewer small decorations and deterministic placement. Seven browser checks passed: near and medium same-camera pairs, stack choice, forest click, city click, drag suppression, no page errors/external requests. Existing 007 broader evidence retained without rerunning it.

Early composition guards rejected V13/W13 canopy rectangles near banks and the X14 north building near counters. Those rejected positions were reduced/moved/removed before the final pass. One browser attempt started against the earlier rejected composition and timed out; it is not counted as a pass or cost sample. A build cleanup also failed with ENOTEMPTY in generated dist; moving that generated folder aside allowed the unchanged build script to complete. No source fallback or stale build accepted.

## Cost and limits

Final runtime 72 files / 3,345,767 bytes including manifest, versus 007 70 / 3,319,667: **+26,100 bytes**, **zero new image bytes**. The extra code includes both renderers for A/B review. DOM 2449 → 2449, canvas pixel buffer unchanged at 60,440,576 bytes by formula; decoded atlas and tint buffers unchanged. No measured RSS/VRAM/GPU or gesture-frame study.

Final code has only one local cold-context sample per variant (Linux headless Chromium, 1363×936 DPR1, no explicit CPU/network throttle): 007 decode+paint call **1227.6 ms**, 008 **711.6 ms**; navigation-to-ready flag **1576.7 → 1012.4 ms**. Longest reported task **1137 → 1139 ms**. These are noisy single samples, not a stable comparison, presented-frame timing or Huawei result. Pre-final code measured 1307.0 / 3176.4 ms, demonstrating substantial environmental/run variability; no overall performance improvement or device acceptance is claimed, and no performance project followed. Original 007 historical medians (~0.9 s candidate versus ~0.25 s 006) and its internal ~5 s → ~0.9 s tile optimization remain historical, not current acceptance. The 708 ms known startup issue stays open.

Pending: user's new visual judgment, Huawei / GPU / CDN, representative startup/drag performance, any full-map extension. Source and existing evidence saved for recovery; no publication arranged. Run instructions in experiments/art-polish-008/README.md.
