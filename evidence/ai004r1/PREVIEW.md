# AI-004R1 isolated preview and actual browser acceptance

Status: isolated preview deployed; cloud browser scoped acceptance passed. No main/source-main/backend/PR/hook/platform change. Huawei, touch and performance remain unaccepted.

## Immutable provenance

- Runtime source: de683bb21b58d2788031ba2c095c514c803df149; tree8efea07f22837ab109a30b4bf02a19a103106550.
- Publication branch: ai-preview-001; release3531d33efce2eb7b0b51cd6ae5d30ee4e3174f41; tree2cce2f329276f0cb98a1f6bedd786b7130ed3f41.
- Previous release/rollback artifact:f8b1a1ff31a0d50d4e6dcd8d0837edb3b6506f70. Rollback by a new fast-forward commit restoring its tree, never force push; not performed.
- Cloudflare check success; deployment4ee9ffd6-2f76-4298-a6a4-508e5ae08e17.
- Actual browser URL:https://4ee9ffd6.eastfront-web-preview.pages.dev/
- Branch URL:https://ai-preview-001.eastfront-web-preview.pages.dev/
- Final protected refs read:main349369ad358b9b24fa0410735649de497a94b9ea; source-main5fe12513bca95c5b43c2ddc125021a117c5bcce4 (same as management state; not modified by this task).

The source/evidence branch has later documentation-only checkpoint(s); runtime stays at de683bb2. Git connector blob/tree SHA validation matched local objects; final release tree compared to independently built local release tree before updating only the preview ref. 480 payload files plus manifest=481. Seven paths differ from AI003 published preview: fair basicAgent addition, public-rule projection, campaign policy selection, build provenance and manifest. Complete manifest in PREVIEW-MANIFEST.json. All assets/UI/Core/Worker scheduling unchanged. The diagnostic evaluator and raw rejection data are not published in the player preview.

The initial precommit build recorded the old base SHA; caught during release diff review, rebuilt from de683bb2 before publishing. Unreferenced preparation commit b6360d35ba87835a9997ce6f9dbc674c86d92706 was superseded, never assigned to preview branch. Final publication is3531d33 only. Source terminal push failed due missing GitHub username; authenticated connector publication then succeeded. No secrets or alternate authentication attempted.

## Actual browser work

Cloud Chrome1363×936,DPR1. Only normal UI actions, real existing LocalAiClient/module Worker and real engine; no injected game state, callback, direct action dispatch, replay/attack script or test harness. Full campaign from original deployment; human Soviet, autonomous German. Purposeful weak forward human artillery provides contact opportunities; this is an interaction acceptance arrangement, not strategic balance or an ordinary competitive game claim.

Human deployed S-ART-01 at3,15; S-ART-02 at3,18; S-ART-03 at3,6. Remaining29 units deployed through UI in automatic roster order at20,r, r=floor(i/2)-7 for i0..28. All32 deployment Actions accepted. Normal complete-deployment button then gives German AI its own hidden deployment and movement/combat phases. Policy chooses every German attack.

| observed action | result |
|---|---|
| Full campaign autonomous German deployment/movement/attack | T1 accepted84/rejected0; B-000001 pending human defender reaction |
| First autonomous attack at3,18 | human pass reaction; dice2+6=8,D3R,4:1+,three own damage steps on S-ART-02; actual followup closed |
| Second autonomous attack at3,15 | human pass; dice4+6=10,D3R,4:1+,three own damage steps on S-ART-01; actual followup closed |
| Third autonomous attack at3,6 | human pass; dice2+4=6,D1R; S-ART-03 one damage step; UI retreat3,6→4,6,AI resolves optional followup; return to Soviet reinforcement/supply accepted96/rejected0 |
| Full campaign autonomous movement in next turn | human ends five ordinary Soviet phases; same visible G-PZ-04 data-hex was2,6 during T1 battle, becomes3,6 in T2; B-000004 starts without human attack command; accepted128/rejected0 |
| Fourth autonomous attack/followup | target4,6; human pass; dice1+6=7,DR,base4:1+,shift-2,final2:1; human retreats4,6→5,6; AI completes optional advance handling, return to Soviet T2 reinforcement/supply; accepted134/rejected0 |
| Authorized fog continuity | after retreat the previously visible G-PZ-04 disappears from Soviet identified-unit DOM; it reappears after actual approach on T2. No enemy-position readback or omniscient view |
| Exit → stop fixture | normal exit returns home, German chosen, existing explicitly labeled stop scenario pauses AGENT_STOP:NO_CANDIDATE at0/0 |
| Explicit takeover | native confirmation accepted; changes German view to Soviet, shows human-takeover mode,0/0; no automatic switch |
| Exit → new German campaign | fresh Worker, Soviet autonomous deployment accepted33/rejected0, German initial deployment, no old pause/battle/accepted counters; final exit returns home |

Browser full campaign was sampled throughT2 with4 autonomous attacks, not played to terminal in browser. Offline fixed-seed campaigns17/18/19 naturally terminated and original-seed replay agreed (REVIEW.md). Existing scripted stop scenario is only takeover regression, never counted as autonomous attack evidence. Actual retreat/optional followup observed; no autonomous breakthrough strategy claim (policy may legally pass it).

## Evidence and limitations

browser/ contains original DOM snapshots, visible movement coordinates and screenshots. campaign-complete-followup.jpg shows final closed B-000004 and returned Soviet T2 phase; campaign-retreat.jpg shows D1R real required retreat. Screenshots captured with live browser. Browser source/file URL inspection of ai003-build.json returned ERR_BLOCKED_BY_CLIENT. No retry/alternate route used for that blocked resource. Therefore direct live JSON/whole-site byte hash verification is NOT claimed; deployment check binds immutable URL to release commit, local/remote Git tree identity is verified, and actual runtime UI actions were executed.

The takeover click produced Input.dispatchMouseEvent timeout because the native confirmation dialog was open; getJsDialog observed confirm, then accepted once. No repeated takeover action or timeout change. A read attempt for G-PZ-04 after retreat timed out because it was no longer identified; fresh DOM confirmed fog correctly removed it. Before/after position evidence uses only the two moments it was actually identified. One early battle2 screenshot still paints the prior reaction card despite newer DOM; retained as asynchronous capture evidence, not used as final-state proof. The later stable followup screenshot is authoritative for the completed interaction.

Weak strategy remains one-step/single-unit with no detours, cooperation or training. Zero rejected actions in selected runs/browser segment is not a universal guarantee. Unchanged rejection cap and explicit stop/takeover remain. No save/load. Huawei, exact tablet viewport, touch and performance pending.
