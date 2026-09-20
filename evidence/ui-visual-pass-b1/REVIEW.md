# UI Visual Pass B1 — Deployment & Touch

Parent: 27a7fe231cae95c21233aee2911472304ceb1297.

Deployment now selects a destination before confirmation. Terrain cards, highlighted map polygons and visible counters within the projected deployment zone share the presentation target selector. The confirmation adapter calls the existing deploySelectedUnit function. Core remains responsible for action validation and stacking. Successful deployment retains the existing automatic next-reserve selection. Changing unit clears the draft; privacy handoff, new game and Ready clear transient feedback.

Cards show actual terrain, visible occupancy and secondary coordinates. No place names, supply availability or rail distances are invented. The count is labelled zone positions, not valid locations: some positions may be rejected by Core depending on the selected unit and stacking. Unit rows show category, decorative symbol, short formation description, stats and identity.

Selected cards have brass borders, a brief scale-in animation and pressed depression. Feedback states distinguish selected, deployed and Core rejection (alert); reduced-motion users get no animation. Confirmation disables its button and sets DEPLOYING text before synchronous dispatch; browsers may paint only the final result because the action is synchronous. No artificial delay is added.

Tablet panels use reserved layout space and the existing collapse control. At <=760px the open panel occupies the lower portion of the workspace, with the map above, rather than an overlay. The sheet remains scrollable and can be collapsed through PANEL. Target selection scrolls the confirmation control into view. No draggable sheet behavior was added.

Validation: typecheck PASS, build PASS, 45/45 targeted tests PASS. New tests cover nonmutating target selection, confirmation through DEPLOY_INITIAL_UNIT, automatic next reserve, same-hex repeated placement and stacking rejection, unchanged state on rejection, stale selection guard and inactive-view suppression. Existing frozen Core/Geometry/P5R1 and loader/interaction checks pass. No Core, Geometry, scenario, combat, unit-rule, renderer or terrain files changed.

Visual evidence: DEPLOYMENT.html is a static production-deployment-markup fixture with selected card and fixed D map evidence. It is not interactive gameplay or a browser screenshot. Physical Huawei/iPad testing and actual browser layout remain unverified. Coordinates remain as secondary orientation; no spatial region names are available. Full deployment-zone lists can be long. Clicking a visible counter during active reserve placement selects its location; unit inspection resumes when no unplaced reserve is selected. Core rejection messages remain their existing technical wording. No claim of final device UX acceptance.
