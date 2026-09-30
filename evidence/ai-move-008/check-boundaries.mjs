// Two saved decisions plus controlled view counterexamples; no match simulation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {search,cleanup} from './search.mjs';
import {defaultRules} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {derivePlayerView,rememberPlayerView} from '../../.ai-dist/src/player-view/playerView.js';
import {fairView} from '../../.ai-dist/ai/authority/projection.js';
import {hash} from '../../ai/lab/common.mjs';
const results=[];
for(const seed of [17,18]){
 const input=JSON.parse(gunzipSync(readFileSync(`evidence/ai-move-007/seed-${seed}-input.json.gz`)));
 const original=search(input),state=JSON.parse(readFileSync(`.ai-dist/move007-state-${seed}.json`));
 const before=JSON.parse(readFileSync(`evidence/ai-move-007/seed-${seed}-before.json`));assert.equal(hash(state),before.stateHash);
 const changed=structuredClone(state),known=new Set(input.view.units.map(u=>u.id));
 const hidden=Object.values(changed.units).find(u=>u.alive&&u.side==='SOVIET'&&!known.has(u.id)&&defaultRules.unitTemplates[u.templateId].maxDamageSteps>1);
 assert(hidden);hidden.step=hidden.step===0?1:0;changed.random={seed:123456,state:789012,draws:99};
 const prior=rememberPlayerView(input.view),a=fairView(derivePlayerView(state,'GERMAN',defaultRules,prior),'GERMAN'),b=fairView(derivePlayerView(changed,'GERMAN',defaultRules,prior),'GERMAN');
 assert.deepEqual(a,input.view);assert.deepEqual(a,b);
 assert.deepEqual(search({...input,view:a}),search({...input,view:b}));
 assert.equal(hash(state),before.stateHash);
 // Public CONTACT at the only view-allowed retreat exit must stop that unit's search.
 const x=structuredClone(input),u=original.results[0],exit=u.firstSteps[0].hex;
 x.view.contacts.push({visibility:'CONTACT',contactId:'controlled-blocker',side:'SOVIET',hex:exit,status:'CURRENT'});
 assert.equal(search(x).results.find(r=>r.unitId===u.unitId).prefixes.length,0);
 results.push({seed,hiddenStepAndFutureRandomChanged:true,originalAuthorizedViewMatched:true,equalAuthorizedViews:true,equalSearchResults:true,publicContactExitBlocked:true,deterministic:true,limitsRespected:original.results.every(u=>!u.metrics.exhausted&&!u.metrics.pathLimitHit),authorityInputUnchanged:true});
}
// Known ZOC-to-ZOC negative on the saved seed-18 view. Explicit diagnostic fixture.
const x=JSON.parse(gunzipSync(readFileSync('evidence/ai-move-007/seed-18-input.json.gz')));
x.view.units.push({...structuredClone(x.view.units.find(u=>u.id==='S-TK-03')),id:'controlled-zoc',hex:{q:11,r:0}});
for(const u of search(x).results)assert.equal(u.prefixes.length,0);
writeFileSync('evidence/ai-move-008/boundary-checks.json',JSON.stringify({checkpoints:results,controlledKnownZocExitBlocked:true,newGames:0,policyChanges:0},null,2)+'\n');
cleanup();console.log('PASS: both checkpoint views unchanged under hidden step/RNG variation; equal bounded search; CONTACT and known-ZOC exit negatives blocked.');
