import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fixture,unit,host,G,S,defaultRules,microScenario,RulesEngine} from './helpers.mjs';
import {basicAgent,observationCandidates,scoreIntent,CANDIDATE_LIMIT} from '../../.ai-dist/ai/fair/index.js';
import {ATTACK_GROUP_LIMIT,ATTACK_COMBINATION_LIMIT} from '../../.ai-dist/ai/fair/candidates.js';
import {validateAttackAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/combat.js';
import {getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {makeEdge} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/edge.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const H=(q,r=0)=>({q,r}),both={GERMAN:basicAgent,SOVIET:basicAgent};
const make=(defenders=[unit('d','S-TANK','SOVIET','TANK',H(0))],seed=8246)=>fixture(seed,[unit('g1','G-INF','GERMAN','INFANTRY',H(-1)),unit('g2','G-INF','GERMAN','INFANTRY',H(0,-1)),...defenders],'GERMAN_COMBAT');
const attacks=x=>observationCandidates(x).filter(a=>a.type==='ATTACK');

test('COMBAT009 solo fails unchanged threshold, joint passes real Core; participants spent once and forced flow replays',()=>{
 const state=make(),h=host(state,'combat009'),x=h.observe(G),a=attacks(x);
 assert.equal(a.filter(a=>a.attackerUnitIds.length===1).length,2);
 assert(a.filter(a=>a.attackerUnitIds.length===1).every(a=>scoreIntent(x,a)===-Infinity));
 const choice=basicAgent(x);assert.deepEqual(choice.intent.attackerUnitIds,['g1','g2']);assert(Number.isFinite(scoreIntent(x,choice.intent)));
 const trace=[{controllerId:G,choice,result:h.step(both)}];assert.equal(trace[0].result.status,'ACCEPTED');
 for(const id of ['g1','g2'])assert(h.auditOmniscient().units[id].hasAttacked);
 const afterDeclaration=h.auditOmniscient();
 assert(validateAttackAction(afterDeclaration,defaultRules,toCoreAction(choice.intent,G)).some(i=>i.code==='UNIT_ALREADY_ATTACKED'));
 assert(validateAttackAction(state,defaultRules,{...toCoreAction(choice.intent,G),attackerUnitIds:['g1','g1']}).some(i=>i.code==='DUPLICATE_ID'));
 const pendingKinds=[];
 for(let n=0;n<16&&h.auditOmniscient().pendingDecision;n++){
  const p=h.auditOmniscient().pendingDecision;pendingKinds.push(p.kind);const controllerId=p.decisionOwnerControllerId;
  const choice=basicAgent(h.observe(controllerId)),result=h.step(both);trace.push({controllerId,choice,result});assert.equal(result.status,'ACCEPTED');
 }
 assert.equal(h.auditOmniscient().pendingDecision,null);assert(pendingKinds.includes('DEFENDER_REACTION'));
 assert(pendingKinds.some(k=>['RETREAT','LOSS_ALLOCATION','ADVANCE_AFTER_COMBAT'].includes(k)));
 assert.equal(attacks(h.observe(G)).length,0);
 let replay=structuredClone(state);const engine=new RulesEngine(defaultRules,microScenario);
 for(const row of trace){const r=engine.apply(replay,toCoreAction(row.choice.intent,row.controllerId));assert(r.accepted);replay=r.state;}
 assert.deepEqual(replay,h.auditOmniscient());
 mkdirSync('evidence/ai-combat-009',{recursive:true});writeFileSync('evidence/ai-combat-009/joint-forced-flow.json',JSON.stringify({seed:8246,pendingKinds,trace,participantsAfterDeclaration:{g1:afterDeclaration.units.g1.hasAttacked,g2:afterDeclaration.units.g2.hasAttacked},replayMatches:true},null,2)+'\n');
});
test('COMBAT009 joint can remain unattractive; wait stays available and bounded refusal feedback is preserved',()=>{
 const x=host(make([unit('d','S-TANK','SOVIET','TANK',H(0)),unit('d2','S-TANK','SOVIET','TANK',H(0))])).observe(G);
 assert(attacks(x).some(a=>a.attackerUnitIds.length===2));assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
 const y=structuredClone(host(make()).observe(G)),joint=basicAgent(y).intent;
 y.history.push({observationKey:y.observationKey,intent:joint,outcome:'REJECTED'});
 assert.equal(basicAgent(y).intent.type,'READY_FOR_PHASE_END');
 while(y.history.length<3)y.history.push({...y.history[0]});assert.equal(basicAgent(y).intent.type,'READY_FOR_PHASE_END');
});
test('COMBAT009 only eligible owned adjacent direct attackers; movement does not spend attack eligibility',()=>{
 const x=structuredClone(host(make()).observe(G)),sample=x.view.units.find(u=>u.id==='g1');
 for(const [id,change] of [['spent',{hasAttacked:true}],['rail',{dedicatedRailRepair:true}],['dead',{alive:false}],['foreign',{controllerId:'OTHER'}]]){
  const u=structuredClone(sample);u.id=id;u.friendly={...u.friendly,...change,id};x.view.units.push(u);
 }
 const zero=structuredClone(sample);zero.id='zero';zero.stats.attack=0;x.view.units.push(zero);
 const distant=structuredClone(sample);distant.id='distant';distant.hex=H(-4);x.view.units.push(distant);
 sample.friendly.hasMoved=true;
 for(const a of attacks(x))assert(a.attackerUnitIds.every(id=>['g1','g2'].includes(id)));
 assert.deepEqual(basicAgent(x).intent.attackerUnitIds,['g1','g2']);
 x.view.units=x.view.units.filter(u=>u.side==='GERMAN');x.view.contacts=[{visibility:'CONTACT',contactId:'unknown',side:'SOVIET',hex:H(0),status:'CURRENT'}];
 assert.equal(attacks(x).length,0);assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
});
test('COMBAT009 original sum/OOS/worst-river score, no headcount or support bonus',()=>{
 const x=structuredClone(host(make()).observe(G)),g1=x.view.units.find(u=>u.id==='g1'),g2=x.view.units.find(u=>u.id==='g2');
 const single={type:'ATTACK',attackerUnitIds:['g1'],target:H(0)},joint={...single,attackerUnitIds:['g1','g2']};
 g1.stats.attack=8;const s=scoreIntent(x,single);g1.stats.attack=4;g2.stats.attack=4;assert.equal(scoreIntent(x,joint),s);
 g1.stats.attack=8;g2.stats.attack=1;x.view.edges.push(makeEdge(g2.hex,H(0),{river:'MAJOR'}));assert(scoreIntent(x,joint)<scoreIntent(x,single));
 x.view.edges=[];g1.stats.attack=3;g2.stats.attack=3;g1.supplyState='OUT_OF_SUPPLY';g2.supplyState='OUT_OF_SUPPLY';assert.equal(scoreIntent(x,joint),-Infinity);
 assert(attacks(x).every(a=>!('support' in a)));assert.equal(scoreIntent(x,{...joint,attackerUnitIds:['g1','g1']}),-Infinity);
});
test('COMBAT009 combinations have unique sorted IDs, deterministic target/size traversal and fixed budgets',()=>{
 const x=structuredClone(host(make()).observe(G)),sample=x.view.units.find(u=>u.id==='g1');x.view.units=x.view.units.filter(u=>u.side!=='GERMAN');
 for(let i=0;i<18;i++){const u=structuredClone(sample);u.id=`g${String(i).padStart(2,'0')}`;u.friendly.id=u.id;u.hex=getNeighbors(H(0))[Math.floor(i/3)];u.friendly.hex=u.hex;x.view.units.push(u);}
 const before=structuredClone(x),all=observationCandidates(x),joint=all.filter(a=>a.type==='ATTACK'&&a.attackerUnitIds.length>1);
 assert(all.length<=CANDIDATE_LIMIT);assert.equal(joint.length,ATTACK_COMBINATION_LIMIT);assert.deepEqual([...new Set(joint.map(a=>a.attackerUnitIds.length))].sort(),[2,3,ATTACK_GROUP_LIMIT]);
 assert.equal(new Set(all.map(a=>JSON.stringify(a))).size,all.length);
 for(const a of joint){assert.equal(new Set(a.attackerUnitIds).size,a.attackerUnitIds.length);assert.deepEqual(a.attackerUnitIds,[...a.attackerUnitIds].sort());}
 x.view.units.reverse();assert.deepEqual(observationCandidates(x),all);assert.deepEqual(observationCandidates(before),all);
 assert.equal(all[0].type,'READY_FOR_PHASE_END');assert.equal(all.filter(a=>a.type==='ATTACK'&&a.attackerUnitIds.length===1).length,18);
});
test('COMBAT009 hidden composition and future RNG cannot change joint proposals or selected intent',()=>{
 const a=make();a.units.secret=unit('secret','S-INF','SOVIET','INFANTRY',H(5,5));
 const b=structuredClone(a);b.units.secret=unit('secret','S-ARTY','SOVIET','ARTILLERY',H(4,5));b.random={seed:999,state:777,draws:3};
 const ha=host(a),hb=host(b),x=ha.observe(G),y=hb.observe(G);assert.deepEqual(x,y);
 assert.deepEqual(observationCandidates(x),observationCandidates(y));assert.deepEqual(basicAgent(x),basicAgent(y));assert.equal(basicAgent(x).intent.attackerUnitIds.length,2);
 assert.deepEqual(ha.auditOmniscient(),a);assert.deepEqual(hb.auditOmniscient(),b);
});
test('COMBAT009 joint attacker loss allocation completes through actual pending Actions',()=>{
 const state=make(undefined,17),h=host(state,'combat009-loss'),trace=[];
 assert.equal(basicAgent(h.observe(G)).intent.attackerUnitIds.length,2);
 for(let n=0;n<16;n++){
  const before=h.auditOmniscient(),p=before.pendingDecision,controllerId=p?.decisionOwnerControllerId??G;
  if(n&&!p)break;
  const choice=basicAgent(h.observe(controllerId)),result=h.step(both);
  trace.push({pending:p?.kind??null,controllerId,choice,result});assert.equal(result.status,'ACCEPTED');
 }
 assert(trace.some(t=>t.pending==='LOSS_ALLOCATION'&&t.controllerId===G));assert.equal(h.auditOmniscient().pendingDecision,null);
 assert(Object.values(h.auditOmniscient().units).some(u=>u.side==='GERMAN'&&u.step>0));
 let replay=structuredClone(state);const engine=new RulesEngine(defaultRules,microScenario);
 for(const row of trace){const r=engine.apply(replay,toCoreAction(row.choice.intent,row.controllerId));assert(r.accepted);replay=r.state;}
 assert.deepEqual(replay,h.auditOmniscient());writeFileSync('evidence/ai-combat-009/joint-loss-flow.json',JSON.stringify({seed:17,trace,replayMatches:true},null,2)+'\n');
});
