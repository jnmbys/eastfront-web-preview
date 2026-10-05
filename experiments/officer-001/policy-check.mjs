import fs from'node:fs';import assert from'node:assert/strict';import{gzipSync,gunzipSync}from'node:zlib';
import{FairHost}from'../../.logistics-dist/ai/authority/FairHost.js';
import{defaultRules,defaultScenario,RulesEngine}from'../../.logistics-dist/src/core-adapter/core.js';
import{officerDecision,intentUnits}from'../../.logistics-dist/ai/fair/officer.js';
import{prepareLocalScenario}from'../../.ai003-preview/ai/local/scenarios.js';
import{basicAgent}from'../../.logistics-dist/ai/fair/basicAgent.js';
const cores=JSON.parse(gunzipSync(fs.readFileSync('evidence/officer-001/policy-inputs.json.gz'))).cores,checks=[];
const observe=c=>new FairHost({matchId:'officer-policy-check',initialState:c,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}}).observe('G-HUMAN-1');
const base=observe(cores["(8, 'GERMAN_MOVEMENT')"]),ids=['G-PZ-03','G-PZ-04'],order={kind:'ATTACK',target:{q:5,r:6}};
function record(name,run){const value=run();checks.push({name,...value});}
record('ownership_goals_budget_determinism',()=>{const before=JSON.stringify(base),d=officerDecision(base,ids,order,0);assert(d.intent);assert(intentUnits(d.intent).every(x=>ids.includes(x)));assert(d.metrics.expanded<=32768);assert.equal(JSON.stringify(base),before);assert.deepEqual(d,officerDecision(base,ids,order,0));return{decision:d};});
record('hidden_authority_pair',()=>{const c=structuredClone(cores["(8, 'GERMAN_MOVEMENT')"]),known=new Set(base.view.units.map(u=>u.id));let n=0;for(const u of Object.values(c.units))if(u.side==='SOVIET'&&!known.has(u.id)){u.step=(u.step+1)%2;n++;}c.random={...c.random,state:123456};const other=observe(c);assert.deepEqual(base.view,other.view);assert.deepEqual(officerDecision(base,ids,order,0),officerDecision(other,ids,order,0));return{hiddenUnits:n};});
record('logistics_personality_changes_candidate_same_authorized_view',()=>{const v=structuredClone(base);for(const u of v.view.units)if(ids.includes(u.id)){u.supplyState='OUT_OF_SUPPLY';u.friendly.supplyState='OUT_OF_SUPPLY';}const decisions=[0,1,2].map(p=>officerDecision(v,ids,order,p));assert(decisions[0].intent);assert.equal(decisions[1].intent,null);return{decisions};});
record('invalid_order_direct_pending_stop',()=>{assert.equal(officerDecision(base,ids,{kind:'DEFEND',target:{q:999,r:999}},0).intent,null);const v=structuredClone(base);v.view.pendingDecision={kind:'LOSS_ALLOCATION',side:'GERMAN',decisionOwnerControllerId:v.scope.controllerId,eligibleControllerIds:[v.scope.controllerId],battleId:'mixed',lossSteps:1,eligibleUnitIds:[ids[0],'G-I-01']};assert.equal(officerDecision(v,ids,order,0).intent,null);return{ok:true};});
record('authored_public_road_scene_concentration_not_attack_threshold',()=>{
 const v=structuredClone(base),troops=v.view.units.filter(u=>ids.includes(u.id));v.view.units=troops;v.view.contacts=[];
 v.view.hexes=Array.from({length:11},(_,q)=>({...v.view.hexes[0],coord:{q,r:0},terrain:'PLAIN'}));v.view.hexes.push({...v.view.hexes[0],coord:{q:0,r:1}});
 v.view.edges=Array.from({length:10},(_,q)=>({key:`${q},0|${q+1},0`,a:{q,r:0},b:{q:q+1,r:0},road:true,river:null,railway:null,bridge:null}));
 troops[0].hex=troops[0].friendly.hex={q:0,r:0};troops[1].hex=troops[1].friendly.hex={q:0,r:1};troops[1].friendly.hasMoved=true;
 const decisions=[0,1,2].map(p=>officerDecision(v,ids,{kind:'ATTACK',target:{q:8,r:0}},p));
 assert(decisions.every(d=>d.intent?.type==='MOVE'));return{sameClearRouteAcceptedByAll:true,scene:'synthetic authorized policy fixture, not a natural campaign',decisions};
});
// Newly authored validation-only scene; no candidate tuning follows its results.
record('fresh_untuned_scene_legal_attack_pending_takeover',()=>{
 const {session}=prepareLocalScenario({map:JSON.parse(fs.readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','utf8')),seed:73261,humanSide:'GERMAN',scenario:'human-attack'});
 const controller=Object.values(session.state.controllers).find(c=>c.side==='GERMAN').id;
 const host=new FairHost({matchId:'unseen-officer-fixture',initialState:session.state,rules:session.rules,scenario:session.scenario,agentSeeds:{GERMAN:101,SOVIET:202}});
 const v=host.observe(controller),target=v.view.units.find(u=>u.side==='SOVIET').hex;
 const decisions=[0,1,2].map(p=>officerDecision(v,['attacker'],{kind:'ATTACK',target},p));
 const intent=decisions[0].intent;assert(intent&&intent.type==='ATTACK');assert(host.submitHuman(controller,intent));const after=host.auditOmniscient();assert(after.pendingDecision);
 const actions=[intent];let takenOver=false;
 for(let n=0;n<16;n++){
  const state=host.auditOmniscient(),p=state.pendingDecision;if(!p)break;
  const input=host.observe(p.decisionOwnerControllerId);
  const automatic=officerDecision(input,['attacker'],{kind:'ATTACK',target},0);
  if(p.side==='GERMAN'&&automatic.intent)assert(session.engine.apply(state,{...automatic.intent,controllerId:p.decisionOwnerControllerId}).accepted,'offline-only postcombat legality');
  // Pause at the first own pending node: the original human policy finishes it.
  if(p.side==='GERMAN')takenOver=true;
  const d=basicAgent(input);assert(d.kind==='INTENT');assert(host.submitHuman(p.decisionOwnerControllerId,d.intent));actions.push(d.intent);
 }
 assert.equal(host.auditOmniscient().pendingDecision,null);assert(takenOver);
 return{decisions,initialPending:after.pendingDecision,actions,takenOver,finalRandom:host.auditOmniscient().random,accepted:true};
});
fs.writeFileSync('evidence/officer-001/policy-check.json',JSON.stringify({checks},null,2));
fs.writeFileSync('evidence/officer-001/policy-inputs.json.gz',gzipSync(JSON.stringify({base,cores})));
console.log(JSON.stringify(checks));
