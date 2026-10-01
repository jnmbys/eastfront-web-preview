import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {host,G} from './helpers.mjs';
import {basicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {chooseCombatAdvance} from '../../.ai-dist/ai/fair/advance.js';
import {chooseCombatAdvance as original} from '../../.evaluation/original/.ai-dist/ai/fair/advance.js';
import {observationCandidates} from '../../.ai-dist/ai/fair/candidates.js';
import {hash} from '../lab/common.mjs';
const archive=JSON.parse(gunzipSync(readFileSync('evidence/ai-advance-audit-013/full-records.json.gz')));
const load=kind=>JSON.parse(archive.find(e=>e.path===`nodes/candidate-n156-${kind}.json`).content);
const example=(positions,ids=['G-MOT-03'])=>{
 const input=load('input'),enemy=input.view.units.find(u=>u.side==='SOVIET');
 input.view.units=input.view.units.filter(u=>u.side==='GERMAN');
 positions.forEach((hex,i)=>input.view.units.push({...structuredClone(enemy),id:'seen-'+i,hex,stats:{attack:0,defense:1,movement:2}}));
 input.view.pendingDecision.eligibleUnitIds=ids;return input;
};
const advance=x=>{const before=structuredClone(x),a=chooseCombatAdvance(x);assert(a);assert(observationCandidates(x).some(c=>JSON.stringify(c)===JSON.stringify(a)));assert.deepEqual(x,before);return a;};
test('ADVANCE014 actual C156 excludes new ART adjacency and falls back to existing PASS',()=>{
 const input=load('input'),before=structuredClone(input);assert.equal(original(input).unitId,'G-MOT-03');assert.equal(chooseCombatAdvance(input),null);
 const choice=basicAgent(input);assert.equal(choice.intent.type,'PASS_ADVANCE');assert.deepEqual(input,before);
 const h=host(load('state')),result=h.step({GERMAN:()=>choice,SOVIET:basicAgent});assert.equal(result.status,'ACCEPTED');assert.deepEqual(h.auditOmniscient().random,load('state').random);
 writeFileSync('evidence/ai-advance-014/c156.json',JSON.stringify({source:'92805a8550ddfb314fa77828d6c83b5a2f7f5e27',inputHash:hash(input),original:original(input),experiment:choice,result,randomUnchanged:true},null,2)+'\n');
});
test('ADVANCE014 empty adjacency sets preserve forward advance',()=>{assert.equal(advance(example([])).unitId,'G-MOT-03');});
test('ADVANCE014 same existing neighbor or subset is allowed; adjacency alone is not a veto',()=>{
 assert.equal(advance(example([{q:11,r:0}])).unitId,'G-MOT-03');
 assert.equal(advance(example([{q:10,r:0},{q:11,r:0}])).unitId,'G-MOT-03');
});
test('ADVANCE014 equal counts with a different enemy identity are new adjacency',()=>{
 const x=example([{q:10,r:0},{q:12,r:1}]);assert(original(x));assert.equal(chooseCombatAdvance(x),null);
});
test('ADVANCE014 existing adjacency does not exempt an additional visible enemy',()=>{
 const x=example([{q:11,r:0},{q:12,r:1}]);assert(original(x));assert.equal(chooseCombatAdvance(x),null);
});
test('ADVANCE014 skip blocked preferred options and evaluate remaining unit',()=>{
 const x=example([{q:11,r:2}],['G-MOT-03','G-PZ-04','G-REC-02']);assert.equal(original(x).unitId,'G-MOT-03');assert.equal(advance(x).unitId,'G-REC-02');
 const expected=basicAgent(x);x.view.units.reverse();x.view.pendingDecision.eligibleUnitIds.reverse();assert.deepEqual(basicAgent(x),expected);
});
test('ADVANCE014 hidden enemy and future RNG mutations leave the same authorized view and choice',()=>{
 const state=load('state'),other=structuredClone(state),a=host(state),seen=a.observe(G),hidden=Object.values(other.units).find(u=>u.alive&&u.side==='SOVIET'&&!seen.view.units.some(v=>v.id===u.id));assert(hidden);
 hidden.templateId='S-ARTY';hidden.type='ARTILLERY';other.random={seed:123,state:456,draws:77};
 const x=structuredClone(a.observe(G)),y=structuredClone(host(other).observe(G));assert.deepEqual(x,y);x.history=load('input').history;y.history=load('input').history;
 assert.deepEqual(basicAgent(x),basicAgent(y));assert.equal(basicAgent(x).intent.type,'PASS_ADVANCE');assert.deepEqual(a.auditOmniscient(),state);
});
test('ADVANCE014 existing destination/risk/receipt/rejection/Soviet guards remain',()=>{
 const changes=[x=>{x.view.identifiedHexKeys=[];},x=>{x.view.contacts.push({visibility:'CONTACT',contactId:'unresolved',side:'SOVIET',hex:{q:11,r:1},status:'CURRENT'});},x=>{x.history=[];},x=>{x.rules.objectives=[{q:10,r:1}];},x=>{x.view.viewer='SOVIET';},x=>{x.history.push({observationKey:x.observationKey,intent:original(x),outcome:'REJECTED'});}];
 for(const fn of changes){const x=example([]);fn(x);assert.equal(chooseCombatAdvance(x),null);}
 const risky=example([{q:11,r:0}]);risky.view.units.find(u=>u.side==='SOVIET').stats.attack=999;assert.equal(chooseCombatAdvance(risky),null);
});
