import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,unit,host,G,defaultRules,microScenario,RulesEngine} from './helpers.mjs';
import {basicAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {createMoveScorer,ROUTE_PATH_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {makeEdge} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/edge.js';
const H=(q,r=0)=>({q,r}),both={GERMAN:basicAgent,SOVIET:basicAgent};
function setup({goal=H(5),rules=defaultRules,others=[],oos=false}={}){
 const state=fixture(17,[unit('g','G-INF','GERMAN','INFANTRY',H(0)),...others]);
 for(const h of Object.values(state.hexes))if(h.coord.r!==0||h.coord.q<0)h.terrain='LAKE';
 state.units.g.supplyState=oos?'OUT_OF_SUPPLY':'SUPPLIED';
 const scenario={...microScenario,capitalCoreHexes:[goal]};
 return {state,scenario,rules,getHost:()=>host(state,'move006',{rules,scenario})};
}
test('MOVE006 Core consumes phase eligibility once; one budgeted prefix moves three cells and replays exactly',()=>{
 const s=setup(),h=s.getHost(),copy=s.getHost(),input=h.observe(G),before=structuredClone(input),choice=basicAgent(input);
 assert.deepEqual(choice.intent.path,[H(1),H(2),H(3)]);assert(observationCandidates(input).some(a=>JSON.stringify(a)===JSON.stringify(choice.intent)));
 assert.equal(h.step(both).status,'ACCEPTED');assert.equal(copy.step(both).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient(),copy.auditOmniscient());
 assert.deepEqual(h.auditOmniscient().units.g.hex,H(3));assert(h.auditOmniscient().units.g.hasMoved);
 const attempt=new RulesEngine(s.rules,s.scenario).apply(h.auditOmniscient(),{type:'MOVE',controllerId:G,unitId:'g',path:[H(4)]});assert(!attempt.accepted);
 assert(attempt.issues.some(i=>i.code==='UNIT_ALREADY_MOVED'));assert.deepEqual(input,before);assert.deepEqual(basicAgent(input),choice);
});
test('MOVE006 cumulative MP, OOS, river and bridge costs agree with authoritative execution',()=>{
 for(const [kind,length] of [['plain',3],['oos',2],['forest',1],['river',1],['bridge',3]]){
  const s=setup({oos:kind==='oos'});
  if(kind==='forest')for(const h of Object.values(s.state.hexes))if(h.terrain==='PLAIN')h.terrain='FOREST';
  if(['river','bridge'].includes(kind)){const e=makeEdge(H(0),H(1),{road:true,river:'MAJOR',bridge:kind==='bridge'?{kind:'ROAD',destroyed:false}:null});s.state.edges[e.key]=e;}
  const h=s.getHost(),a=basicAgent(h.observe(G)).intent;assert.equal(a.path.length,length,kind);assert.equal(h.step(both).status,'ACCEPTED',kind);
 }
 const s=setup({oos:true});s.state.hexes['1,0'].terrain='FOREST';const e=makeEdge(H(0),H(1),{river:'MAJOR'});s.state.edges[e.key]=e;
 assert.equal(basicAgent(s.getHost().observe(G)).intent.type,'READY_FOR_PHASE_END');
});
test('MOVE006 stops at goals and identified adjacency; respects contact, risk and full friendly stacks',()=>{
 const short=setup({goal:H(2)});assert.equal(basicAgent(short.getHost().observe(G)).intent.path.length,2);
 const x=structuredClone(setup().getHost().observe(G));x.view.units.push({id:'known',side:'SOVIET',visibility:'IDENTIFIED',type:'ARTILLERY',hex:H(3),step:0,stats:{attack:0,defense:1,movement:2},supplyState:'SUPPLIED',entrenched:false});
 assert.deepEqual(basicAgent(x).intent.path,[H(1),H(2)]);
 x.view.units.at(-1).stats={attack:99,defense:99,movement:2};assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');x.view.units.pop();
 x.view.contacts=[{contactId:'opaque',side:'SOVIET',hex:H(2),status:'CURRENT'}];assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');x.view.contacts=[];
 const friend=structuredClone(x.view.units[0]);friend.id='friend';friend.hex=H(2);friend.friendly.hasMoved=true;x.view.units.push(friend);x.rules.stackingLimit=1;
 assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
});
test('MOVE006 road bonus belongs to entire path, never each step; search and path remain bounded',()=>{
 const rules=structuredClone(defaultRules);rules.road.wholeMoveBonusEnabled=true;
 const s=setup({rules});for(let q=0;q<3;q++){const e=makeEdge(H(q),H(q+1),{road:true});s.state.edges[e.key]=e;}
 assert.equal(basicAgent(s.getHost().observe(G)).intent.path.length,3);
 const e=makeEdge(H(3),H(4),{road:true});s.state.edges[e.key]=e;const h=s.getHost(),a=basicAgent(h.observe(G)).intent;
 assert.equal(a.path.length,4);assert(a.path.length<=ROUTE_PATH_LIMIT);assert.equal(h.step(both).status,'ACCEPTED');
});
test('MOVE006 hidden blockers and RNG cannot change candidates or choice; atomic rejection rests unit without prefix probes',()=>{
 const a=setup({others:[unit('secret','S-INF','SOVIET','INFANTRY',H(2))]}),b=setup({others:[unit('secret','S-INF','SOVIET','INFANTRY',H(5,5))]});
 b.state.hexes['5,5'].terrain='PLAIN';a.state.hexes['5,5'].terrain='PLAIN';b.state.random={seed:77,state:88,draws:0};
 const x=a.getHost(),y=b.getHost();assert.deepEqual(x.observe(G),y.observe(G));assert.deepEqual(observationCandidates(x.observe(G)),observationCandidates(y.observe(G)));
 const choice=basicAgent(x.observe(G));assert(choice.intent.path.length>1);assert.deepEqual(choice,basicAgent(y.observe(G)));
 const before=x.auditOmniscient();assert.equal(x.step(both).status,'REJECTED');assert.deepEqual(x.auditOmniscient(),before);assert.equal(y.step(both).status,'ACCEPTED');
 const after=structuredClone(x.observe(G));after.observationKey='unrelated';assert.equal(basicAgent(after).intent.type,'READY_FOR_PHASE_END');
 assert(!JSON.stringify(after).includes('ENEMY_OCCUPIED_HEX'));assert.equal(x.step(both).status,'ACCEPTED');
});
