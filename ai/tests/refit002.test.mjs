import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fixture,unit,host,G,S,defaultRules,microScenario} from './helpers.mjs';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {basicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {minimalAgent} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {refitOptions,estimatedRecoveryBases} from '../../.ai-dist/ai/fair/refit.js';
import {observationCandidates,CANDIDATE_LIMIT} from '../../.ai-dist/ai/fair/candidates.js';
const both={GERMAN:basicAgent,SOVIET:basicAgent},evidence=[];
function setup(side='GERMAN',extras=[]){
 const u=unit('damaged',side==='GERMAN'?'G-INF':'S-INF',side,'INFANTRY',side==='GERMAN'?{q:0,r:0}:{q:4,r:0});u.step=1;
 const state=fixture(70021,[u,...extras],side+'_RECOVERY');state.rp[side]=8;
 for(let q=-5;q<1;q++){const a={q,r:0},b={q:q+1,r:0},key=[`${q},0`,`${q+1},0`].sort().join('|');state.edges[key]={key,a,b,road:false,river:null,railway:{present:true,repairedBy:'GERMAN',destroyed:false},bridge:null};}
 return state;
}
function run(h,label){const before=h.auditOmniscient(),owner=before.activeSide==='GERMAN'?G:S,input=h.observe(owner),options=refitOptions(input),decision=basicAgent(input),result=h.step(both),after=h.auditOmniscient();evidence.push({label,input,options,decision,result,before,after});return {before,after,result,decision};}
test('refit: actual German and Soviet repair charges original RP and one step, then observes quota',()=>{
 for(const side of ['GERMAN','SOVIET']){
  const h=host(setup(side),'repair-'+side),r=run(h,'one-repair-'+side);assert.equal(r.result.status,'ACCEPTED');assert.equal(r.after.units.damaged.step,0);assert.equal(r.after.rp[side],7);assert.deepEqual(r.after.random,r.before.random);
  assert.deepEqual(h.observe(side==='GERMAN'?G:S).refit.recoveredUnitIds,['damaged']);assert.equal(basicAgent(h.observe(side==='GERMAN'?G:S)).intent.type,'READY_FOR_PHASE_END');
 }
});
test('refit: priority is damage, then cost, then ID; actual second read respects one-per-unit and phase receipts even from human action',()=>{
 const a=unit('heavy','S-TANK','SOVIET','TANK',{q:4,r:0});a.step=1;
 const b=unit('worse','S-INF','SOVIET','INFANTRY',{q:4,r:1});b.step=2;
 const state=setup('SOVIET',[a,b]);state.turn=5;
 const h=host(state,'priority');let r=run(h,'priority-most-damaged');assert.equal(r.decision.intent.unitId,'worse');assert.equal(r.after.units.worse.step,1);
 const opts=refitOptions(h.observe(S));assert(!opts.some(o=>o.intent.unitId==='worse'));assert.equal(opts[0].intent.unitId,'damaged');assert.equal(opts[0].cost,1);
 assert(h.submitHuman(S,opts[0].intent));assert.equal(h.observe(S).refit.recoveredUnitIds.length,2);assert.equal(basicAgent(h.observe(S)).intent.type,'READY_FOR_PHASE_END');
 const restored=host(h.auditOmniscient(),'restored');assert.equal(basicAgent(restored.observe(S)).intent.type,'READY_FOR_PHASE_END');
});
test('refit: no repair for budget/phase/own eligibility failures; no resource grant',()=>{
 for(const [name,change] of [
  ['budget',s=>s.rp.GERMAN=0],['moved',s=>s.units.damaged.hasMoved=true],['attacked',s=>s.units.damaged.hasAttacked=true],
  ['artillery-used',s=>s.units.damaged.artillerySupportUsed=true],['rail-dedicated',s=>s.units.damaged.dedicatedRailRepair=true],
  ['out-of-supply',s=>s.units.damaged.supplyState='OUT_OF_SUPPLY'],['full-strength',s=>s.units.damaged.step=0],
  ['no-rail-base',s=>s.edges={}],['visible-enemy',s=>s.units.visible=unit('visible','S-INF','SOVIET','INFANTRY',{q:1,r:0})],
 ]){const state=setup();change(state);const h=host(state,name);assert.equal(basicAgent(h.observe(G)).intent.type,'READY_FOR_PHASE_END',name);assert.equal(refitOptions(h.observe(G)).length,0,name);
  const r=run(h,'ineligible-end-'+name);assert.equal(r.result.status,'ACCEPTED');assert.equal(r.after.phase,'GERMAN_ENTRENCHMENT');assert.deepEqual(r.after.rp,r.before.rp);assert.equal(r.after.units.damaged.step,r.before.units.damaged.step);
 }
 const h=host(setup(),'wrong-phase'),dto=structuredClone(h.observe(G));dto.view.phase='GERMAN_MOVEMENT';assert.equal(refitOptions(dto).length,0);
});
test('refit: hidden rail occupation and RNG give identical proposals; Core rejection stops phase probes with unchanged RP/state',()=>{
 const a=setup(),b=structuredClone(a);a.units.secret=unit('secret','S-INF','SOVIET','INFANTRY',{q:-3,r:0});b.units.secret=unit('secret','S-INF','SOVIET','INFANTRY',{q:-4,r:4});b.random.state=1234;
 const x=host(a,'same'),y=host(b,'same');assert.deepEqual(x.observe(G),y.observe(G));assert.deepEqual(refitOptions(x.observe(G)),refitOptions(y.observe(G)));assert.deepEqual(basicAgent(x.observe(G)),basicAgent(y.observe(G)));
 assert(estimatedRecoveryBases(x.observe(G)).has('1,0'));
 const rejected=run(x,'hidden-base-rejected'),accepted=run(y,'hidden-base-open');assert.equal(rejected.result.status,'REJECTED');assert.deepEqual(rejected.after,rejected.before);assert.equal(accepted.result.status,'ACCEPTED');
 assert.equal(x.observe(G).refit.rejected,true);assert(!JSON.stringify(x.observe(G)).includes('RECOVERY_BASE_TOO_FAR'));assert.equal(basicAgent(x.observe(G)).intent.type,'READY_FOR_PHASE_END');
 const end=run(x,'no-second-probe');assert.equal(end.result.status,'ACCEPTED');assert.equal(end.after.phase,'GERMAN_ENTRENCHMENT');assert.equal(x.observe(G).refit.rejected,false);
});
test('refit: real entrenchment, already-entrenched avoidance, public capital/type/movement guards, phase completion',()=>{
 const s=setup();s.phase='GERMAN_ENTRENCHMENT';const h=host(s,'entrench');let r=run(h,'entrench-actual');assert.equal(r.decision.intent.type,'ENTRENCH');assert.equal(r.result.status,'ACCEPTED');assert.equal(r.after.units.damaged.entrenched,true);assert.deepEqual(r.after.rp,r.before.rp);assert.deepEqual(r.after.random,r.before.random);
 r=run(h,'entrench-complete');assert.equal(r.decision.intent.type,'READY_FOR_PHASE_END');assert.equal(r.result.status,'ACCEPTED');assert.notEqual(r.after.phase,'GERMAN_ENTRENCHMENT');
 for(const [name,change] of [['already',s=>s.units.damaged.entrenched=true],['moved',s=>s.units.damaged.hasMoved=true],['rail',s=>s.units.damaged.dedicatedRailRepair=true],['capital',s=>s.units.damaged.hex={...microScenario.capitalCoreHexes[0]}],['armor',s=>{s.units.damaged.templateId='G-PANZER';s.units.damaged.type='PANZER';}]]){
  const s=setup();s.phase='GERMAN_ENTRENCHMENT';change(s);assert.equal(basicAgent(host(s,name).observe(G)).intent.type,'READY_FOR_PHASE_END',name);
 }
 const attacked=setup();attacked.phase='GERMAN_ENTRENCHMENT';attacked.units.damaged.hasAttacked=true;assert.equal(run(host(attacked),'attacked-infantry-may-entrench').result.status,'ACCEPTED');
});
test('refit: fail closed on missing authorization, seat isolation, caps and replayed latest state',()=>{
 const h=host(setup(),'bounded'),input=structuredClone(h.observe(G));delete input.refit;assert.deepEqual(refitOptions(input),[]);
 assert.equal(refitOptions(h.observe(S)).length,0);assert(!h.observe(S).refit);
 assert(observationCandidates(h.observe(G)).length<=CANDIDATE_LIMIT);
 const start=performance.now();for(let i=0;i<100;i++)refitOptions(h.observe(G));evidence.push({label:'100-maintenance-proposals',elapsedMs:performance.now()-start,notGame:true});
 // Legacy passive policy stays passive even though maintenance candidates exist.
 assert.equal(minimalAgent(h.observe(G)).intent.type,'READY_FOR_PHASE_END');
});
test.after(()=>{mkdirSync('evidence/ai-playtest-002',{recursive:true});writeFileSync('evidence/ai-playtest-002/targeted.json',JSON.stringify({explicitMicroFixtures:true,evidence},null,2));});
