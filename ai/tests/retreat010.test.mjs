import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {fixture,unit,host,G,S,defaultRules,defaultScenario,microScenario,RulesEngine} from './helpers.mjs';
import {minimalAgent,basicAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {HISTORY_LIMIT,REJECTION_LIMIT} from '../../.ai-dist/ai/authority/FairHost.js';
import {validateGameStateIntegrity} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hash} from '../lab/common.mjs';
const dir='evidence/ai-retreat-010',both={GERMAN:basicAgent,SOVIET:basicAgent};
const save=(name,data)=>{mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${name}.json`,JSON.stringify(data,null,2)+'\n');};
const checkpoint=(id,kind)=>JSON.parse(gunzipSync(readFileSync(`${dir}/checkpoints/${id}-${kind}.json.gz`)));
for(const id of ['tune-17-SOVIET','tune-18-GERMAN'])test(`RETREAT010 ${id} archived decision restores actual Core forced flow within unchanged cap`,()=>{
 const initial=checkpoint(id,'state'),packet=checkpoint(id,'input'),h=host(initial,id),trace=[],original=structuredClone(packet),seen=new Set();
 assert.deepEqual(h.observe(G).view.units,packet.view.units);
 assert.deepEqual(observationCandidates(h.observe(G)),observationCandidates(packet));
 assert.equal(REJECTION_LIMIT,8);assert.equal(HISTORY_LIMIT,16);
 let accepted=false;
 for(let n=0;n<REJECTION_LIMIT;n++){
  const choice=basicAgent(packet);assert.equal(choice.kind,'INTENT');assert.equal(choice.intent.type,'RETREAT');
  const key=JSON.stringify(choice.intent);assert(!seen.has(key));seen.add(key);
  const result=h.step({...both,GERMAN:()=>choice});trace.push({controllerId:G,choice,result});
  if(result.status==='ACCEPTED'){accepted=true;break;}
  assert.equal(result.status,'REJECTED');assert.deepEqual(h.auditOmniscient(),initial);
  packet.history.push({observationKey:packet.observationKey,intent:choice.intent,outcome:'REJECTED'});packet.history=packet.history.slice(-HISTORY_LIMIT);
  packet.agentRandom.decisionIndex++;
 }
 assert(accepted);assert.notEqual(h.auditOmniscient().pendingDecision?.kind,'RETREAT');const attempts=trace.length;
 for(let n=0;n<16&&h.auditOmniscient().pendingDecision;n++){
  const p=h.auditOmniscient().pendingDecision,controllerId=p.decisionOwnerControllerId,choice=basicAgent(h.observe(controllerId)),result=h.step(both);
  trace.push({controllerId,choice,result});assert.equal(result.status,'ACCEPTED');
 }
 assert.equal(h.auditOmniscient().pendingDecision,null);
 assert.deepEqual(validateGameStateIntegrity(h.auditOmniscient(),defaultRules,defaultScenario),[]);
 let replay=structuredClone(initial);const engine=new RulesEngine(defaultRules,defaultScenario);
 for(const row of trace){const r=engine.apply(replay,toCoreAction(row.choice.intent,row.controllerId));assert.equal(r.accepted,row.result.status==='ACCEPTED');if(r.accepted)replay=r.state;}
 assert.deepEqual(replay,h.auditOmniscient());
 save(`${id}-recovery`,{originalInputHash:hash(original),initialStateHash:hash(initial),attempts,trace,finalHash:hash(replay),pending:replay.pendingDecision,replay:'PASS'});
});
function hidden(blocked){
 const units=[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0})];
 if(blocked)for(const [i,hex] of [{q:2,r:0},{q:0,r:2},{q:2,r:-2}].entries())units.push(unit('secret-'+i,'G-INF','GERMAN','INFANTRY',hex));
 const h=host(fixture(8246,units,'GERMAN_COMBAT'));
 assert.equal(h.step({...both,GERMAN:()=>({kind:'INTENT',intent:{type:'ATTACK',attackerUnitIds:['g'],target:{q:0,r:0}}})}).status,'ACCEPTED');
 assert.equal(h.step(both).status,'ACCEPTED');assert.equal(h.observe(S).view.pendingDecision.kind,'RETREAT');return h;
}
test('RETREAT010 hidden blockers, unknown RNG and no-route loss remain Core-owned, no invented success',()=>{
 const open=hidden(false),sealed=hidden(true),a=open.observe(S),b=sealed.observe(S);assert.deepEqual(a,b);
 const state=sealed.auditOmniscient(),other=structuredClone(state);other.random={seed:999,state:777,draws:3};
 assert.deepEqual(observationCandidates(host(state).observe(S)),observationCandidates(host(other).observe(S)));
 assert.deepEqual(observationCandidates(a),observationCandidates(b));assert.deepEqual(basicAgent(a),basicAgent(b));
 assert.equal(open.step(both).status,'ACCEPTED');const trace=[];
 for(let n=0;n<8;n++){
  const input=sealed.observe(S),choice=basicAgent(input),result=sealed.step(both);trace.push({choice,result});
  assert(!/secret-|maximumLegalSteps|ENEMY_ZOC_STOP/.test(JSON.stringify(input)));
  if(result.status==='ACCEPTED')break;assert.equal(result.status,'REJECTED');assert.deepEqual(sealed.auditOmniscient(),state);
 }
 assert(trace.length<=3);assert.equal(trace.at(-1).result.status,'ACCEPTED');assert.deepEqual(trace.at(-1).choice.intent.retreats[0].path,[]);
 const tx=Object.values(sealed.auditOmniscient().combatTransactions)[0];assert(tx.retreat.impossible);assert(tx.retreatImpossibleExtraLossApplied);
 assert.deepEqual(validateGameStateIntegrity(sealed.auditOmniscient(),defaultRules,microScenario),[]);save('hidden-no-route',{trace,extraLossApplied:true});
});
test('RETREAT010 empty path cannot bypass an available route; repeated invalid intent still hits 8',()=>{
 const h=hidden(false),state=h.auditOmniscient(),input=h.observe(S),empty=observationCandidates(input).find(a=>a.retreats?.every(r=>!r.path.length));assert(empty);
 assert.equal(h.step({...both,SOVIET:()=>({kind:'INTENT',intent:empty})}).status,'REJECTED');assert.deepEqual(h.auditOmniscient(),state);
 assert.equal(h.step(both).status,'ACCEPTED');
 const stuck=host(state);for(let n=1;n<=8;n++)assert.equal(stuck.step({...both,SOVIET:()=>({kind:'INTENT',intent:empty})}).status,n===8?'REJECTION_LIMIT':'REJECTED');
 assert.deepEqual(stuck.auditOmniscient(),state);
});
test('RETREAT010 candidates deterministic, bounded, ordered stacking retained, generic rejected tuples filtered',()=>{
 const input=checkpoint('tune-18-GERMAN','input'),before=structuredClone(input),a=observationCandidates(input);
 assert(a.length<=128);assert.equal(new Set(a.map(JSON.stringify)).size,a.length);
 for(const intent of a){const positions=new Map(input.view.units.filter(u=>u.side==='GERMAN').map(u=>[u.id,u.hex]));
  assert.deepEqual(intent.retreats.map(r=>r.unitId),[...input.view.pendingDecision.unitIds].sort());
  for(const r of intent.retreats){for(const h of r.path)assert([...positions].filter(([id,x])=>id!==r.unitId&&x.q===h.q&&x.r===h.r).length<input.rules.stackingLimit);positions.set(r.unitId,r.path.at(-1)??positions.get(r.unitId));}
 }
 assert.deepEqual(input,before);input.view.units.reverse();assert.deepEqual(observationCandidates(input),a);
 input.history.push({observationKey:input.observationKey,intent:a[0],outcome:'REJECTED'});assert.notDeepEqual(minimalAgent(input).intent,a[0]);
 input.history=a.map(intent=>({observationKey:input.observationKey,intent,outcome:'REJECTED'}));assert.equal(minimalAgent(input).kind,'STOP');
 const contact=structuredClone(before);contact.view.contacts.push({visibility:'CONTACT',contactId:'test',side:'SOVIET',hex:{q:11,r:4},status:'CURRENT'});assert.deepEqual(observationCandidates(contact),a);
});
