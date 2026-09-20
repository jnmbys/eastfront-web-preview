import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {G,S,key,unit,ordinary,fixture} from './helpers/combat-fixture.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
import * as intents from '../dist/app/interaction/intents.js';
import * as flow from '../dist/app/interaction/combatFlow.js';
import {dispatchGameAction,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgDynamicMarkup} from '../dist/app/render/coreSvg.js';
import {combatAttackPanel} from '../dist/app/ui/combatAttackPanel.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {bindLanguageControl} from '../dist/app/localization/languageControl.js';
import {setLocale,t,getMissingKeys,clearMissingKeys} from '../dist/app/localization/index.js';
import {createFreshProductionSession,TERRAIN_VISUAL_SEED} from '../dist/app/web/preview.js';
import {getLegalRetreatStepOptions} from '../dist/app/core-adapter/core.js';
const draft=(s,p,attacker='g')=>{intents.selectCounter(s,p,attacker);intents.selectCounter(s,p,'d');};
function handoff(s,p){if(p.privacyGate)intents.confirmPrivacyGate(s,p);flow.continueCombatFlow(s,p);}
function begin(seed=2722,units=ordinary(),attacker='g'){const {s,p}=fixture(seed,units);draft(s,p,attacker);intents.attackAndContinue(s,p);return {s,p};}

// Count real main.ts event handlers, including the primary button's paint boundary.
test('UX2 actual counter → enemy → ATTACK bindings finish a simple battle in exactly three clicks',async()=>{
 setLocale('zh-CN');const {s,p}=fixture(),h=combatDom(s,p),camera=h.camera();let clicks=0;
 h.click('[data-unit-id="g"]');clicks++;
 h.click('[data-unit-id="d"]');clicks++;
 assert.match(h.html(),/战斗预览/);assert.match(h.html(),/战斗比/);
 const button=h.click('#attack-declare');clicks++;
 assert.equal(button.disabled,true);assert.equal(button.textContent,t('combat.submitting'));assert.equal(button.attrs['aria-busy'],'true');
 button.fire('click'); // Duplicate event cannot submit another combat.
 assert.equal(Object.keys(s.state.combatTransactions).length,0,'busy state paints before dispatch');
 await h.paint();
 assert.equal(clicks,3);assert.equal(Object.keys(s.state.combatTransactions).length,1);
 assert.equal(s.state.pendingDecision,null);assert.equal(Object.values(s.state.combatTransactions)[0].stage,'CLOSED');
 assert.equal(p.privacyGate,null);assert.equal(s.activeViewerControllerId,G);assert.equal(p.interactionMode,'SELECT');
 assert.deepEqual(p.attackUnitIds,[]);assert.equal(p.attackTarget,null);assert.deepEqual(p.retreatDrafts,{});
 assert.doesNotMatch(h.mapHtml(),/combat-battle-target|combat-attack-line|data-role="attack-target"/);
 assert.equal(h.camera(),camera);assert.equal(h.svg.style.transform,h.surface.style.transform);
 assert.equal(h.svg.style.transform,'translate(94px, -61px) scale(1.8)');
});

test('UX2 simple flow matches the baseline manual Core sequence, including RNG, for six seeds',()=>{
 for(const seed of [11,17,22,2722,5392,8246]){
  const a=fixture(seed),b=fixture(seed);draft(a.s,a.p);draft(b.s,b.p);
  intents.attackAndContinue(a.s,a.p);
  intents.declareAttack(b.s,b.p);intents.confirmPrivacyGate(b.s,b.p);intents.passCombatReaction(b.s,b.p);
  assert.deepEqual(a.s.state,b.s.state,`seed ${seed}`);
 }
});

test('UX2 no-choice reaction and unique losses progress without declare/resolve confirmations',()=>{
 const {s,p}=begin(22);assert.equal(s.state.units.g.step,1);assert.equal(s.state.pendingDecision,null);assert.equal(p.privacyGate,null);
 const panel=combatAttackPanel(deriveBrowserRenderModel(s,p),'');
 assert.doesNotMatch(panel,/id="(?:pass-reaction|attack-resolve|attack-confirm|retreat-commit)"/);
 const again=JSON.stringify(s.state);flow.continueCombatFlow(s,p);assert.equal(JSON.stringify(s.state),again);
});

test('UX2 artillery is a genuine choice; selecting it automatically resolves when no other reaction remains',()=>{
 const {s,p}=begin(2722,[...ordinary(),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})]);
 assert.equal(s.state.pendingDecision.kind,'DEFENDER_REACTION');assert.equal(p.privacyGate,null);assert.equal(s.activeViewerControllerId,S);
 assert.equal(s.state.combatTransactions[p.selectedBattleId].resolution,null);
 const before=JSON.stringify(s.state);flow.continueCombatFlow(s,p);assert.equal(JSON.stringify(s.state),before);
 handoff(s,p);const h=combatDom(s,p);h.click('[data-defender-artillery="sa"]');
 assert(s.state.combatTransactions[p.selectedBattleId].resolution);
 assert.equal(s.state.combatTransactions[p.selectedBattleId].context.modifiers.defenderArtilleryShift,-1);
 assert.notEqual(s.state.pendingDecision?.kind,'DEFENDER_REACTION');
});

test('UX2 HQ reaction is not silently passed after an artillery choice',()=>{
 const {s,p}=fixture(2722,[...ordinary(),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2}),unit('hq','S-HQ','SOVIET','HQ',{q:1,r:0})]);
 s.state.cp.SOVIET=3;draft(s,p);intents.attackAndContinue(s,p);
 assert(flow.reactionChoices(s).hq.includes('hq'));handoff(s,p);
 intents.useDefenderArtillery(s,p,'sa');flow.continueCombatFlow(s,p);
 assert.equal(s.state.pendingDecision.kind,'DEFENDER_REACTION');assert.deepEqual(flow.reactionChoices(s),{artillery:[],hq:['hq']});
 const h=combatDom(s,p);h.click('[data-defender-hq="hq"]');
 assert.notEqual(s.state.pendingDecision?.kind,'DEFENDER_REACTION');
 assert.equal(s.state.combatTransactions[p.selectedBattleId].defenderHQEffect.hqUnitId,'hq');
});

test('UX2 real loss choice stops; choosing the final loss submits without a second confirmation',()=>{
 const {s,p}=fixture(11,[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),unit('d','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0})]);
 draft(s,p);intents.toggleAttackUnit(s,p,'g2');intents.attackAndContinue(s,p);
 assert.equal(s.state.pendingDecision.kind,'LOSS_ALLOCATION');assert.equal(s.state.units.g.step,0);
 const h=combatDom(s,p);assert.doesNotMatch(h.html(),/id="loss-commit"/);h.click('[data-loss-unit="g"]');
 assert.equal(s.state.units.g.step,1);assert.notEqual(s.state.pendingDecision?.kind,'LOSS_ALLOCATION');
});

test('UX2 retreat is highlighted immediately; destination click applies retreat with no unit/list/confirm step',()=>{
 const {s,p}=begin(5392);assert.equal(s.state.pendingDecision.kind,'RETREAT');assert.equal(p.privacyGate,null);assert.equal(s.activeViewerControllerId,S);
 const plan=flow.retreatPlan(s,p);assert(plan.options.length>1,'real direction choice remains');
 const h=combatDom(s,p),destination=plan.options[0],camera=h.camera();
 assert.match(h.html(),/选择撤退位置/);assert.doesNotMatch(h.html(),/id="retreat-commit"|data-retreat-destination/);
 h.click(`[data-role="retreat-option"]`);
 assert.deepEqual(s.state.units.d.hex,destination);assert.equal(s.state.pendingDecision.kind,'ADVANCE_AFTER_COMBAT');assert.equal(h.camera(),camera);
 handoff(s,p);h.repaint();assert.match(h.mapHtml(),/data-role="advance-option"/);
 h.click('[data-role="advance-option"]');
 assert.deepEqual(s.state.units.g.hex,{q:0,r:0});assert.equal(s.state.pendingDecision,null);assert.equal(p.interactionMode,'SELECT');assert.equal(h.camera(),camera);
});

test('UX2 friendly counter covering a retreat highlight routes to the same destination action',()=>{
 const {s,p}=begin(5392);handoff(s,p);const target=flow.retreatPlan(s,p).options[0];
 s.state.units.friend=unit('friend','S-INF','SOVIET','INFANTRY',target);
 const h=combatDom(s,p);h.click('[data-unit-id="friend"]');
 assert.deepEqual(s.state.units.d.hex,target);assert.notEqual(s.state.pendingDecision?.kind,'RETREAT');
});

test('UX2 illegal retreat clicks and wrong-controller clicks never change authoritative state',()=>{
 const {s,p}=begin(5392),before=JSON.stringify(s.state);setActiveViewer(s,G);
 flow.chooseRetreatDestination(s,p,{q:1,r:0});assert.equal(JSON.stringify(s.state),before,'privacy/owner gate');
 handoff(s,p);flow.chooseRetreatDestination(s,p,{q:-1,r:0});assert.equal(JSON.stringify(s.state),before,'illegal destination');
});

test('UX2 blocked retreats auto-submit Core empty routes; impossible-retreat loss remains Core-owned',()=>{
 const blockers=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:1},{q:0,r:1}].map((h,i)=>unit(`b${i}`,'G-INF','GERMAN','INFANTRY',h));
 const {s,p}=begin(5392,[...ordinary(),...blockers]);
 const tx=s.state.combatTransactions[p.selectedBattleId];assert.equal(tx.retreatImpossibleExtraLossApplied,true);assert.notEqual(s.state.pendingDecision?.kind,'RETREAT');
});

test('UX2 multi-unit retreat uses ordered Core legality and preserves choice of first unit',()=>{
 const {s,p}=begin(8246,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),...ordinary().slice(1),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);
 assert.equal(s.state.pendingDecision.kind,'LOSS_ALLOCATION');handoff(s,p);intents.chooseLossAndContinue(s,p,'d');
 assert.equal(s.state.pendingDecision.kind,'RETREAT');assert.equal(s.state.pendingDecision.unitIds.length,2);
 flow.chooseRetreater(s,p,'d2');assert.equal(flow.retreatPlan(s,p).activeUnitId,'d2');
 let selections=0;while(s.state.pendingDecision?.kind==='RETREAT'&&selections<8){const plan=flow.retreatPlan(s,p);assert(plan.options.length);flow.chooseRetreatDestination(s,p,plan.options[0]);selections++;}
 assert.notEqual(s.state.pendingDecision?.kind,'RETREAT');assert(s.lastResult.accepted);assert.equal(s.state.combatTransactions[p.selectedBattleId].retreat.resolved,true);
});

function d2r(){return begin(8246,[unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})],'p');}
function reachBreakthrough(){const {s,p}=d2r();assert.equal(s.state.combatTransactions[p.selectedBattleId].resolution.crtResult,'D2R');handoff(s,p);let n=0;while(s.state.pendingDecision?.kind==='RETREAT'&&n++<4){const options=flow.retreatPlan(s,p).options;flow.chooseRetreatDestination(s,p,options.find(h=>key(h)!=='1,0')??options[0]);}handoff(s,p);flow.chooseAdvanceDestination(s,p,{q:0,r:0});assert.equal(s.state.pendingDecision.kind,'BREAKTHROUGH_OPTION');return {s,p};}

test('UX2 two-step retreat submits only after the final destination and retains breakthrough/Schwerpunkt decisions',()=>{
 const {s,p}=d2r();handoff(s,p);const before=JSON.stringify(s.state),first=flow.retreatPlan(s,p).options.find(h=>key(h)!=='1,0');flow.chooseRetreatDestination(s,p,first);
 assert.equal(JSON.stringify(s.state),before);assert.equal(p.retreatDrafts.d.length,1);assert.equal(s.state.pendingDecision.kind,'RETREAT');
 flow.undoRetreatDestination(p);assert.equal(p.retreatDrafts.d.length,0);
 const next=reachBreakthrough();const m=deriveBrowserRenderModel(next.s,next.p);assert(m.combat.breakthrough.options.some(o=>o.legal));
 const beforeChoice=JSON.stringify(next.s.state);flow.continueCombatFlow(next.s,next.p);assert.equal(JSON.stringify(next.s.state),beforeChoice);
 const option=m.combat.breakthrough.options.find(o=>o.legal&&key(o.hex)==='1,0');assert(option);
 intents.extendBreakthroughDraft(next.s,next.p,option.hex);intents.commitBreakthrough(next.s,next.p);flow.continueCombatFlow(next.s,next.p);
 assert.equal(next.s.state.pendingDecision.kind,'SCHWERPUNKT_OPTION');const choices=flow.schwerpunktChoices(next.s);assert(choices.length);
 const enemy=Object.values(next.s.state.units).find(u=>u.alive&&u.side==='SOVIET'&&key(u.hex)===key(choices[0].target));assert(flow.routeCombatDecisionCounter(next.s,next.p,enemy.id));assert.deepEqual(next.p.schwerpunktTarget,choices[0].target);intents.commitSchwerpunkt(next.s,next.p,choices[0].unitId);flow.continueCombatFlow(next.s,next.p);
 const child=next.s.state.combatTransactions[next.p.selectedBattleId];assert(child.sourceBattleId);assert(child.resolution,'child no-choice reaction auto-resolves too');
});

test('UX2 advance remains optional and requires a unit choice when several can advance',()=>{
 const {s,p}=fixture(5392,[...ordinary(),unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1})]);
 draft(s,p);intents.toggleAttackUnit(s,p,'g2');intents.attackAndContinue(s,p);handoff(s,p);
 while(s.state.pendingDecision?.kind==='RETREAT'){const plan=flow.retreatPlan(s,p);flow.chooseRetreatDestination(s,p,plan.options[0]);}
 handoff(s,p);assert.equal(s.state.pendingDecision.kind,'ADVANCE_AFTER_COMBAT');assert.equal(flow.advanceChoices(s).length,2);
 const before=JSON.stringify(s.state);flow.chooseAdvanceDestination(s,p,{q:0,r:0});assert.equal(JSON.stringify(s.state),before);
 flow.chooseAdvancer(s,p,'g2');flow.chooseAdvanceDestination(s,p,{q:0,r:0});assert.deepEqual(s.state.units.g2.hex,{q:0,r:0});
});

test('UX2 no legal advance is skipped using Core validation, not UI terrain/stacking rules',()=>{
 const {s,p}=begin(5392);handoff(s,p);flow.chooseRetreatDestination(s,p,flow.retreatPlan(s,p).options[0]);
 assert.equal(s.state.pendingDecision.kind,'ADVANCE_AFTER_COMBAT');
 s.state.units.g.hex={q:-3,r:0}; // Stale eligibility: Core must reject the now-nonadjacent unit.
 const snapshot=JSON.stringify(s.state);assert.deepEqual(flow.advanceChoices(s),[]);assert.equal(JSON.stringify(s.state),snapshot);
 flow.continueCombatFlow(s,p);assert.equal(s.state.pendingDecision,null);assert.equal(p.privacyGate,null);
});

test('UX2 language handler preserves an attack draft and a partial retreat, including RNG and camera',()=>{
 for(const pending of [false,true]){
  const {s,p}=pending?d2r():fixture();if(pending){handoff(s,p);flow.chooseRetreatDestination(s,p,flow.retreatPlan(s,p).options[0]);}else draft(s,p);
  const h=combatDom(s,p);const before=JSON.stringify({state:s.state,p,camera:h.camera()});
  const select={value:'en-US',addEventListener(_,fn){this.change=fn;},focus(){}};
  const root={querySelectorAll:q=>q==='[data-language-select]'?[select]:[],querySelector:q=>q==='[data-language-select]'?select:null};
  bindLanguageControl(root,()=>h.repaint());select.change();select.value='zh-CN';select.change();
  assert.equal(JSON.stringify({state:s.state,p,camera:h.camera()}),before);assert.match(h.html(),pending?/选择撤退位置/:/战斗预览/);
 }
});

test('UX2 new labels are bilingual, CRT data comes directly from Core, and queries never consume RNG',ctx=>{
 clearMissingKeys();const {s,p}=fixture();draft(s,p);const before=JSON.stringify(s.state);
 ctx.mock.method(globalThis.crypto,'getRandomValues',()=>{throw new Error('No entropy in combat UI queries');});
 for(const lang of ['en-US','zh-CN']){setLocale(lang);const m=deriveBrowserRenderModel(s,p),html=combatAttackPanel(m,'');assert.match(html,/<details class="combat-advanced">/);assert.doesNotMatch(html,/<details[^>]* open/);assert.deepEqual(m.combat.crt.table,s.rules.crt.table);assert.match(html,/D2R/);}
 assert.equal(JSON.stringify(s.state),before);assert.deepEqual(getMissingKeys(),[]);
});

test('UX2 retains fresh NEW GAME combat seeds while the visual seed stays fixed',ctx=>{
 const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));let seed=100000;
 ctx.mock.method(globalThis.crypto,'getRandomValues',array=>{array[0]=++seed;return array;});
 const a=createFreshProductionSession(raw),b=createFreshProductionSession(raw);assert.notEqual(a.state.random.seed,b.state.random.seed);assert.deepEqual(a.state.hexes,b.state.hexes);assert.equal(TERRAIN_VISUAL_SEED,17);
});

test('UX2 production 640-hex scenario closes an ordinary combat in three actual UI clicks with clean integrity',async()=>{
 const {productionFixture}=await import('./helpers/combat-fixture.mjs');const {s,p}=await productionFixture(17);const h=combatDom(s,p),camera=h.camera();
 h.click('[data-unit-id="G-PZ-01"]');h.click('[data-unit-id="S-I-01"]');
 assert.match(h.html(),/战斗预览/);h.click('#attack-declare');await h.paint();
 assert.equal(Object.values(s.state.combatTransactions)[0].stage,'CLOSED');assert.equal(s.state.pendingDecision,null);assert.equal(s.integrityIssues.length,0);assert.equal(h.camera(),camera);
});

test('UX2 an initially blocked retreater can wait while another unit frees its route',()=>{
 const {s,p}=begin(8246,[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),...ordinary().slice(1),unit('d2','S-INF','SOVIET','INFANTRY',{q:0,r:0})]);
 handoff(s,p);intents.chooseLossAndContinue(s,p,'d');assert.equal(s.state.pendingDecision.kind,'RETREAT');
 // A narrow corridor with a full friendly stack at its first exit.
 s.state.units.d2.hex={q:1,r:0};s.state.units.friend=unit('friend','S-INF','SOVIET','INFANTRY',{q:1,r:0});
 for(const h of Object.values(s.state.hexes))h.terrain=['0,0','1,0','2,0','-1,0'].includes(key(h.coord))?'PLAIN':'LAKE';
 assert.equal(getLegalRetreatStepOptions(s.state,s.rules,s.state.units.d).length,0);
 flow.chooseRetreater(s,p,'d2');flow.chooseRetreatDestination(s,p,{q:2,r:0});
 assert.equal(s.state.pendingDecision.kind,'RETREAT');assert.equal(flow.retreatPlan(s,p).activeUnitId,'d');
 assert(flow.retreatPlan(s,p).options.some(h=>key(h)==='1,0'));
 flow.chooseRetreatDestination(s,p,{q:1,r:0});
 assert.deepEqual(s.state.units.d.hex,{q:1,r:0});assert.equal(s.state.combatTransactions[p.selectedBattleId].retreatImpossibleExtraLossApplied,false);
});
