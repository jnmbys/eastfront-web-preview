# UI-009R1 Safari Production Renderer Verification

## Compatibility changes

- dual SVG raster URL attributes: `href` + `xlink:href`;
- explicit SVG/XLink namespaces on production root;
- single canonical production clip definition per Hex;
- no changes to terrain assets, map topology, Geometry or gameplay.

## Automated proof

`tests/ui009r1-safari-renderer.test.mjs` verifies:

- XLink namespace exists on root;
- every production raster `<image>` has equal `href` and `xlink:href`;
- production clip IDs are unique;
- Strategic Reset F markup contains Forest, City, Marsh, Hill/Rough, River, Road, Railway and Bridge.

## Browser paint proof

Chromium compatibility paint evidence: `ui009r1-safari-compat-chromium.png` in the Leader Review Bundle. The production raster requests used for that proof completed without page errors.

## Remaining mandatory gate

Real iPad Safari must be checked after the redeploy. This document does not claim a real-device PASS until that occurs.
