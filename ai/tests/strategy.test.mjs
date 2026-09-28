import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fixture,unit,host,G,S,defaultRules,production} from './helpers.mjs';
import {basicAgent,scoreIntent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {minimalAgent} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {runFairGame} from '../../.ai-dist/ai/authority/FairHost.js';
const both={GERMAN:basicAgent,SOVIET:basicAgent};
const meet=()=>fixture(8246,[unit('g','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('e','S-INF','SOVIET','INFANTRY',{q:2,r:0})]);
const trace=h=>{const records=[];for(let i=0;i<20;i++){const s=h.auditOmniscient(),owner=s.pendingDecision?.decisionOwnerControllerId??(s.activeSide==='GERMAN'?G:S),decision=basicAgent(h.observe(owner)),result=h.step(both);records.push({phase:s.phase,pending:s.pendingDecision?.kind??null,decision,result});if(s.phase==='GERMAN_ENTRENCHMENT'||!['ACCEPTED','REJECTED'].includes(result.status))break;}return records;};
test('AI004 autonomous approach, visible attack and genuine battle followups replay exactly',()=>{
 const h=host(meet()),other=host(meet());const a=trace(h),b=trace(other);assert.deepEqual(a,b);assert.deepEqual(h.auditOmniscient(),other.auditOmniscient());
 assert.equal(a[0].decision.intent.type,'MOVE');assert(a.some(x=>x.decision.intent?.type==='ATTACK'));assert(a.some(x=>x.pending==='DEFENDER_REACTION'));assert(a.some(x=>x.pending==='ADVANCE_AFTER_COMBAT'));assert(a.every(x=>x.result.status==='ACCEPTED'));assert.equal(h.auditOmniscient().pendingDecision,null);
 mkdirSync('evidence/ai004',{recursive:true});writeFileSync('evidence/ai004/autonomous-trace.json',JSON.stringify(a,null,2)+'\n');
});
test('AI004 unfavorable visible attack is declined, terrain and entrenchment make it no better',()=>{
 const s=fixture(1,[unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:1,r:0})],'GERMAN_COMBAT');
 // Use a known production template, then stack another legal defender to create clear inferiority.
 s.units.d=unit('d','S-TANK','SOVIET','TANK',{q:1,r:0});s.units.d2=unit('d2','S-TANK','SOVIET','TANK',{q:1,r:0});
 const input=host(s).observe(G);assert.equal(basicAgent(input).intent.type,'READY_FOR_PHASE_END');
 const improved=structuredClone(input);improved.view.units.find(u=>u.id==='g').stats.attack=20;
 const attack=observationCandidates(improved).find(a=>a.type==='ATTACK');const plain=scoreIntent(improved,attack);
 improved.view.hexes.find(h=>h.coord.q===1&&h.coord.r===0).terrain='FOREST';improved.view.units.find(u=>u.id==='d').entrenched=true;
 assert(scoreIntent(improved,attack)<=plain);
});
test('AI004 no identified enemy advances toward public goal without consuming battle RNG',()=>{
 const s=fixture(),h=host(s),before=h.auditOmniscient();const input=h.observe(G);assert.equal(input.view.units.length,1);const choice=basicAgent(input);assert.equal(choice.intent.type,'MOVE');
 assert.equal(h.step(both).status,'ACCEPTED');assert.deepEqual(h.auditOmniscient().random,before.random);
 assert.equal(basicAgent(h.observe(G)).intent.type,'READY_FOR_PHASE_END');
});
test('AI004 hidden deployment/support/RNG variants have identical inputs and preexecution outputs',()=>{
 const a=fixture(),b=structuredClone(a);delete b.units['secret-enemy'];b.units['hidden-artillery']=unit('hidden-artillery','S-ARTY','SOVIET','ARTILLERY',{q:4,r:5});b.random={...b.random,seed:987654,state:987654};
 const x=host(a).observe(G),y=host(b).observe(G);assert.deepEqual(x,y);assert.deepEqual(observationCandidates(x),observationCandidates(y));assert.deepEqual(basicAgent(x),basicAgent(y));assert(!JSON.stringify(y).includes('hidden-artillery'));
 const dep=production(),other=structuredClone(dep);other.random={...other.random,seed:12345,state:12345};assert.deepEqual(host(dep).observe(S),host(other).observe(S));assert.deepEqual(basicAgent(host(dep).observe(S)),basicAgent(host(other).observe(S)));
});
test('AI004 rejects are not retried, three failures end safely; no rejected end loops',()=>{
 const input=structuredClone(host(meet()).observe(G));const first=basicAgent(input).intent;
 input.history.push({observationKey:input.observationKey,intent:first,outcome:'REJECTED'});assert.notDeepEqual(basicAgent(input).intent,first);
 while(input.history.length<3)input.history.push({...input.history[0]});assert.equal(basicAgent(input).intent.type,'READY_FOR_PHASE_END');
 input.history.push({observationKey:input.observationKey,intent:{type:'READY_FOR_PHASE_END'},outcome:'REJECTED'});assert.equal(basicAgent(input).kind,'STOP');
});
test('AI004 CONTACT and last-known remain uncertain; policy has no cross-seat or match memory',()=>{
 const s=fixture(17,[unit('r','G-RECON','GERMAN','RECON',{q:0,r:0}),unit('hidden','S-INF','SOVIET','INFANTRY',{q:3,r:0})]);const h=host(s),x=h.observe(G);assert(x.view.contacts.length);const d=basicAgent(x);assert.notEqual(d.intent?.type,'ATTACK');
 basicAgent(h.observe(S));assert.deepEqual(basicAgent(x),d);assert.deepEqual(basicAgent(host(s,'other-match').observe(G)),d);assert.deepEqual(h.observe(S).history,[]);
 const last=structuredClone(x);last.view.lastKnown=last.view.contacts.map(c=>({contactId:c.contactId,side:c.side,hex:c.hex,lastSeenTurn:1,status:'LAST_KNOWN',confidence:'UNCONFIRMED'}));last.view.contacts=[];assert.notEqual(basicAgent(last).intent?.type,'ATTACK');
});
test('AI004 agent seed only breaks ties; repeated scoring never changes host RNG',()=>{
 const h=host(meet()),before=h.auditOmniscient(),x=structuredClone(h.observe(G));for(let seed=0;seed<20;seed++){x.agentRandom.seed=seed;basicAgent(x);}assert.deepEqual(h.auditOmniscient(),before);
});
test('AI004 bounded full campaign finishes or preserves explicit stop with reproducible trace',()=>{
 const play=()=>{const h=host(production(),'ai004-campaign');const r=runFairGame(h,both,1500);return {termination:r.termination,accepted:r.steps.filter(x=>x.status==='ACCEPTED').length,rejected:r.steps.filter(x=>x.status==='REJECTED').length,actions:h.auditOmniscient().actionLog};};
 const a=play(),b=play();assert.deepEqual(a,b);assert.equal(a.termination.status,'GAME_OVER');assert(a.actions.some(e=>e.accepted&&e.action.type==='MOVE'));
 writeFileSync('evidence/ai004/campaign-trace.json',JSON.stringify(a,null,2)+'\n');
});
