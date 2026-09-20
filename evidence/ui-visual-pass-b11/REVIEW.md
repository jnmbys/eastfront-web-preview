# UI Visual Pass B1.1 — Tablet Final Polish

Parent: 5509ca42277c328f698a59de6d4352628861d742.

The confirmation dock is a sibling of the scrolling command content, so scrolling roster/cards no longer moves Confirm out of the panel. The 761–1366px tablet layout reserves 310px for the collapsible panel. Narrow layouts retain a bottom panel with safe-area padding. Major touch controls have a 44px minimum. These are implementation constraints, not a physical device certification.

Deployment cards show the selected unit category, actual terrain, visible occupancy and secondary position. They do not claim supply, railway distance, names or guaranteed availability. Choosing a card or map/counter target draws a noninteractive SVG highlight using the existing canonical hexPolygon function. The highlight shares the live SVG transform with the map, pulses twice and respects reduced-motion preference. No camera motion or terrain changes. Stale selections, inactive viewers and completed deployments remove the highlight.

A UI-only translation function maps known deployment rejection codes to readable guidance and provides a safe fallback for unknown codes. Original Core issues and presentation.message remain untouched and are available through existing developer diagnostics. Player order reports use translated text; confirmation rejection remains in the dock. Confirmation and Core dispatch remain synchronous: DEPLOYING may not paint before the final result; pressed, selected and final status feedback remain available without an artificial delay.

Validation: typecheck PASS, build PASS, 48/48 targeted tests PASS. New tests verify canonical highlight points, noninteractive overlay, stale/private suppression, rejection mapping without source mutation, button enablement and tablet CSS/dock structural contracts. Updated one prior UI test to look for confirmation in its new dock; no gameplay test changes. Frozen directories src/geometry, src/render, vendor and public have zero diff.

Evidence: DEPLOYMENT.html is a static production-markup fixture with the new confirmation dock and a fixed D terrain image. It does not execute game actions or demonstrate the live map highlight/pulse. It is not a screenshot. Reproduction: npm run build; node evidence/ui-visual-pass-b11/create-review.mjs.

Known issues: actual browser layout and Huawei/iPad landscape touch testing remain unverified; prior supported-browser local-service access was blocked. CSS breakpoint tests cannot prove clipping or real touch usability. Long card lists remain scrollable. Offscreen destinations are highlighted but not automatically centred; the player may need to pan or Fit. Unknown Core codes get generic guidance. No final device-acceptance claim.

No Core / Geometry / VS2 changes. No Scenario, Combat, Unit rules or Terrain generation changes.
