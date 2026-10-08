import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';import {gunzipSync} from 'node:zlib';import {Campaign} from '../grand-economy-002/authority.mjs';
import {districtFacilities,constructionTiming} from '../../.ai003-preview/src/playable/industryModel.js';
import {currentCityArtView} from '../../.ai003-preview/src/playable/cities.js';
import {facilityMarkup} from '../../.ai003-preview/src/render/cityArt.js';
const result={scope:'presentation mapping and bounded deterministic replay; no balance run'},c=new Campaign(),d=c.snapshot(),before=JSON.stringify(c.save()),view=currentCityArtView(d);
const own=view.cities.flatMap(c=>c.districts).filter(x=>x.control===d.viewer&&!x.hidden&&!x.unconfirmed);
assert.equal(own.flatMap(x=>x.facilities).filter(f=>f.status==='BUILT').length,d.modern.facilities.length);
for(const district of own){for(const f of district.facilities)assert(d.modern.facilities.some(x=>x.id===f.id));}
assert.equal(JSON.stringify(c.save()),before);result.authorizedPermanentIds=true;
const district=own.find(x=>x.facilities.length),original=d.cities.items.flatMap(c=>c.districts).find(x=>x.id===district.id),test=structuredClone(d),f=test.modern.facilities.find(x=>x.district===district.id);
f.damage=.4;let row=districtFacilities(test,original).find(x=>x.id===f.id);assert.equal(row.damage,.4);assert(facilityMarkup({...district,facilities:[row]},view.edges,'close').includes('厂房损坏'));
f.damage=0;const line=test.modern.lines.find(x=>x.factories.includes(f.id));if(line){line.missing=[{resource:'steel',need:2,got:0}];assert.equal(districtFacilities(test,original).find(x=>x.id===f.id).workState,'MISSING');line.missing=[];line.workDay=0;assert.equal(districtFacilities(test,original).find(x=>x.id===f.id).workState,'IDLE');}
for(const flags of [{hidden:true},{unconfirmed:true},{control:'SOVIET'}])assert.deepEqual(districtFacilities(test,{...original,...flags}),original.facilities);
result.directedDamageMissingIdleAndWithdrawal=true;
test.modern.queue.push({id:'art-directed',kind:'MIL',target:district.id,status:'BUILDING',progress:3,cost:30,priority:3,serial:100});assert.equal(districtFacilities(test,original).filter(x=>x.status==='BUILDING')[0].progressRatio,.1);
assert(constructionTiming(test.modern,test.modern.queue.at(-1)).includes('游戏小时'));
assert(constructionTiming(test.modern,{...test.modern.queue.at(-1),status:'OCCUPIED'}).includes('停工'));result.queueAndConditionalETA=true;
// Replay the same existing real mid-save in unmodified R1 and candidate authorities.
const {Campaign:Baseline}=await import('../../../grand-economy-002-r1-vehicle-demand/experiments/grand-economy-002/authority.mjs');
const save=JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-economy-002-r1/browser-mid.json.gz'))),a=new Baseline(),b=new Campaign();
const clean=x=>JSON.parse(JSON.stringify(x,(k,v)=>['metrics','networkTiming','ms','totalMs','maxMs','lastMs','lastDecisionMs'].includes(k)?undefined:v));
for(const x of[a,b]){x.restore(structuredClone(save));x.clock.paused=false;x.clock.autopause=false;for(let i=0;i<24;i++)x.tick();}
assert.deepEqual(clean(a.save()),clean(b.save()));result.replay={start:save.clock.tick,end:b.clock.tick,steps:24,authorityEconomyRNGIdentical:true,sha256:crypto.createHash('sha256').update(JSON.stringify(clean(b.save()))).digest('hex')};
fs.writeFileSync('evidence/grand-art-001/check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
