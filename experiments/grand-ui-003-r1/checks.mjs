import fs from 'node:fs';import zlib from 'node:zlib';import assert from 'node:assert/strict';
import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
import {Campaign} from '../grand-release-001/territory.mjs';
import {Campaign as Before} from '../../../grand-ui-003-tablet-command/experiments/grand-release-001/territory.mjs';
import {makeDirectDraft,directIssue} from '../../.release-territory-preview/src/playable/directCommand.js';
import {directPreview} from '../grand-ui-003/preview.mjs';
import {battleReadout} from '../../.release-territory-preview/src/playable/battleReadout.js';
const seed=JSON.parse(zlib.gunzipSync(fs.readFileSync('evidence/grand-ui-003/normal-start.json.gz')));
const make=C=>{class Seeded extends C{constructor(){super();this.restore(seed,false);}}return new CampaignAdapter({CampaignClass:Seeded,restore:false});};
const a=make(Campaign),b=make(Before),id='G-013';
const snap=a.c.snapshot(),p={data:snap,locked:false,directPreview:{version:snap.version,path:[]}};
const draft=makeDirectDraft(p,id,'ADVANCE',{q:21,r:2});p.data.version+=5;assert.equal(directIssue(p,draft),'');
const op={type:'DIRECT',unit:id,mapIntent:{version:1,unitGeneration:draft.generation,groupId:draft.groupId,groupGeneration:draft.groupGeneration},order:{kind:'ADVANCE',target:draft.target,risk:'NORMAL',paused:false}};
const envelope=(a,seq,op,gen=a.c.clock.units[id].commandGeneration)=>({instanceId:a.id,era:a.era,commandSeq:seq,requestId:'map-r1-test-'+seq,kind:'OPERATION',payload:op,dependencies:{unitGeneration:gen}});
for(const x of [a,b]){x.c.clock.paused=false;x.c.clock.autopause=false;for(let i=0;i<3;i++)await x.step();}
const ea=envelope(a,1,op),eb=envelope(b,1,(({mapIntent,...rest})=>rest)(op));assert.equal((await a.submit('a',ea)).status,'APPLIED');assert.equal((await b.submit('a',eb)).status,'APPLIED');
const beforeRetry=a.c.save();await a.submit('a',ea);assert.deepEqual(a.c.save(),beforeRetry);
for(let i=0;i<24;i++){await a.step();await b.step();}
const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>['ms','maxMs','totalMs'].includes(k)?undefined:v));
for(const key of ['state','econ'])assert.deepEqual(clean(a.c.save()[key]),clean(b.c.save()[key]));
for(const key of ['units','battles','rng'])assert.deepEqual(a.c.clock[key],b.c.clock[key]);
const late=await a.submit('a',envelope(a,2,op,draft.generation));assert.equal(late.status,'REJECTED');assert.equal(late.reason,'UNIT_COMMAND_CHANGED');
const c=make(Campaign),enemy=c.c.state.units['S-020'];enemy.hex={q:21,r:2};const r=await c.submit('a',envelope(c,1,op));assert.equal(r.status,'REJECTED');assert.match(r.reason,/敌军/);assert.equal(c.c.clock.units[id].direct,null);
const d=make(Campaign);d.c.clock.corps.find(g=>g.members.includes(id)).commandGeneration++;const owner=await d.submit('a',envelope(d,1,op));assert.equal(owner.status,'REJECTED');assert.match(owner.reason,/军团/);
const fair=a.c.fair('GERMAN').view,cap=a.c.capability(id),mock={fair:()=>({view:structuredClone(fair)}),capability:()=>structuredClone(cap),viewer:'GERMAN',version:a.c.version};assert.deepEqual(directPreview({...mock,state:{hidden:1}},{unit:id,kind:'ADVANCE',target:{q:21,r:2}}),directPreview({...mock,state:{hidden:999}},{unit:id,kind:'ADVANCE',target:{q:21,r:2}}));
const saved=a.c.save(),restored=make(Campaign);restored.c.restore(saved);assert.equal(restored.c.clock.paused,true);assert.equal(restored.c.clock.units[id].commandGeneration,a.c.clock.units[id].commandGeneration);assert.deepEqual(restored.c.state,a.c.state);
assert.equal(battleReadout({outlook:'FAVORABLE',participants:[{org:99}]},'GERMAN').text,'可维持');assert.equal(battleReadout({outlook:'STRAINED'},'GERMAN').text,'承压');assert.equal(battleReadout({outlook:'NEUTRAL'},'GERMAN').text,'评估中');
fs.mkdirSync('evidence/grand-ui-003-r1',{recursive:true});fs.writeFileSync('evidence/grand-ui-003-r1/checks.json',JSON.stringify({baseline:'1d3e50b5bcd5a972bc3427713041d66d22da9e1a',unrelatedRevisionDoesNotInvalidatePreview:true,commandAcceptedAfterThreeRealSteps:true,duplicateNoStateChange:true,twentyFourStepsSameStateEconomyUnitsBattlesRng:true,materialTargetChangeRejected:r.reason,controlChangeRejected:late.reason,groupOrderChangeRejected:owner.reason,saveRestoreStateAndGeneration:true,noBattleNumber:true,sameFairViewHiddenPair:true,directedTargetChange:'Test-only enemy position, not natural campaign evidence'},null,2));console.log('R1 current-state intent, competition, replay and display checks passed');
