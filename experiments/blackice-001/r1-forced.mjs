import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {attributes} from '../grand-division-002/combat.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';
import {PROFILE} from './catalog.mjs';
import {resolve} from './combat.mjs';
import {fuelAdjusted} from '../../src/playable/combinedAttributes.mjs';
export const seeds=[219031,219037,219047,219061,781283,914117];
export const scenarios=[['infantry',['INFANTRY'],['INFANTRY'],'PLAIN',1,true],['artillery',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',1,true],['armor',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'PLAIN',1,true],['anti-tank',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY','ANTI_TANK'],'PLAIN',1,true],['forest',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'FOREST',1,true],['no-fuel',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'PLAIN',1,false],['cut-supply',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',.15,true],['missing-guns',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',1,true,.25]];
export const template=ids=>{const t=emptyDraft();ids.forEach((id,i)=>t.regiments[i][0]=id);return t;};
export function forced(seed,scenario){
 const[name,left,right,land,supply,fuel,fill=1]=scenario;
 const forms={A:template(left),B:template(right)},actual={},org={},loss={A:0,B:0},start={},events=[],crossings={};
 for(const id of ['A','B']){const d=modelDemand(forms[id],PROFILE);actual[id]={personnel:d.manpower,held:{...d.equipment}};if(id==='A')actual[id].held.artillery_equipment_1=Math.floor(actual[id].held.artillery_equipment_1*fill);org[id]=attributes(forms[id],actual[id],PROFILE).paper.orgMax;start[id]={template:forms[id],actual:structuredClone(actual[id]),org:org[id],stats:attributes(forms[id],actual[id],PROFILE),supply:id==='A'?supply:1,fuel:id==='A'?fuel:true,terrain:land,fortification:0};}
 let x=seed;const random=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};
 const units={A:{side:'GERMAN',hex:{q:0,r:0}},B:{side:'SOVIET',hex:{q:1,r:0}}},debt={A:{},B:{}},cumulative={A:{hp:0,org:0},B:{hp:0,org:0}};
 const snapshot=tick=>({tick,hours:tick/12,units:Object.fromEntries(['A','B'].map(id=>[id,{...structuredClone(actual[id]),org:org[id],orgPercent:org[id]/start[id].org*100,cumulative:{...cumulative[id]},effective:attributes(forms[id],actual[id],PROFILE).effective}]))});events.push(snapshot(0));let ticks=0,end='OBSERVATION_BUDGET';
 for(;ticks<576;ticks++){
  const stats=Object.fromEntries(['A','B'].map(id=>[id,fuelAdjusted(attributes(forms[id],actual[id],PROFILE),id==='A'&&!fuel?0:1e6)]));
  for(const k of ['softAttack','hardAttack','defense','breakthrough'])stats.A.effective[k]*=.3+.7*supply;
  const r=resolve({contacts:[{hex:'1,0',units:['A','B'],initiators:['A']}],units,stats,random,ground:()=>({terrain:land}),tick:ticks});
  for(const id of ['A','B']){const d=modelDemand(forms[id],PROFILE),lost=Math.min(actual[id].personnel,(r.damage[id]??0)/stats[id].paper.hp*d.manpower);loss[id]+=lost;actual[id].personnel-=lost;org[id]=Math.max(0,org[id]-(r.orgDamage[id]??0));cumulative[id].hp+=r.damage[id]??0;cumulative[id].org+=r.orgDamage[id]??0;
   for(const[k,q]of Object.entries(d.equipment)){debt[id][k]=(debt[id][k]??0)+q*lost/d.manpower;const n=Math.min(actual[id].held[k],Math.floor(debt[id][k]));actual[id].held[k]-=n;debt[id][k]-=n;}
   for(const [kind,condition]of Object.entries({people60:actual[id].personnel/d.manpower<.6,people45:actual[id].personnel/d.manpower<.45,org44:org[id]/start[id].org*100<44,org18:org[id]/start[id].org*100<18,rawOrg5:org[id]<5,eliminated:actual[id].personnel<=0}))if(condition&&crossings[id+':'+kind]===undefined)crossings[id+':'+kind]={tick:ticks+1,people:actual[id].personnel,org:org[id],orgPercent:org[id]/start[id].org*100};
  }
  const dead=['A','B'].filter(id=>actual[id].personnel<=0),broken=['A','B'].filter(id=>org[id]<5);
  if((ticks+1)%72===0||dead.length||broken.length)events.push(snapshot(ticks+1));
  if(dead.length||broken.length){end=dead.length?'PERSONNEL_ZERO:'+dead.join(','):'RAW_ORG_BELOW_5:'+broken.join(',');break;}
 }
 const originalShape={hours:+(Math.min(ticks+1,576)/12).toFixed(2),stopped:ticks>=576?'48h observation budget; no game deadline':'organization/personnel threshold',casualties:Object.fromEntries(Object.entries(loss).map(([k,v])=>[k,Math.round(v)])),org:Object.fromEntries(Object.entries(org).map(([k,v])=>[k,+v.toFixed(2)]))};
 return {seed,scenario:name,heldout:seeds.slice(-2).includes(seed),start,originalShape,end,crossings,events,inCombatRecovery:0,withdrawal:'Not executed by original forced-contact harness',rng:x};
}
if(process.argv[1]?.endsWith('r1-forced.mjs')){
 const file='evidence/blackice-001/comparison.json',bytes=fs.readFileSync(file),prior=JSON.parse(bytes),rows=[];
 for(const s of scenarios)for(const seed of seeds){const r=forced(seed,s),before=prior.results.find(x=>x.scenario===s[0]).runs.find(x=>x.seed===seed).candidate;assert.deepEqual(r.originalShape,before);rows.push({...r,...(seed!==219031?{events:undefined,start:undefined}:{})});}
 fs.mkdirSync('evidence/blackice-001-r1',{recursive:true});fs.writeFileSync('evidence/blackice-001-r1/forced.json',JSON.stringify({baseline:'d151dd2db838df29c03837b5bb1763919c41f3c6',originalSHA256:createHash('sha256').update(bytes).digest('hex'),same48Results:true,noParameterTuning:true,rows},null,2));
 console.log(JSON.stringify(rows.filter(x=>x.seed===219031).map(x=>({scenario:x.scenario,result:x.originalShape,end:x.end,crossings:x.crossings})),null,2));
}
