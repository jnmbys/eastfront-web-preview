import fs from 'node:fs';
import {emptyDraft} from '../grand-division-001/templates.mjs';import {attributes,resolveContacts} from '../grand-division-002/combat.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';import {PROFILE} from './catalog.mjs';import {PROFILE as OLD} from '../grand-division-003/catalog.mjs';import {resolve} from './combat.mjs';import {fuelAdjusted} from '../../src/playable/combinedAttributes.mjs';
const seeds=[219031,219037,219047,219061,781283,914117],heldout=new Set(seeds.slice(-2));
const scenarios=[['infantry',['INFANTRY'],['INFANTRY'],'PLAIN',1,true],['artillery',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',1,true],['armor',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'PLAIN',1,true],['anti-tank',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY','ANTI_TANK'],'PLAIN',1,true],['forest',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'FOREST',1,true],['no-fuel',['MOTORIZED','LIGHT_ARMOR'],['INFANTRY'],'PLAIN',1,false],['cut-supply',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',.15,true],['missing-guns',['INFANTRY','ARTILLERY'],['INFANTRY'],'PLAIN',1,true,.25]];
const template=ids=>{const t=emptyDraft();ids.forEach((id,i)=>t.regiments[i][0]=id);return t;};
function run(profile,seed,scenario){const[name,left,right,land,supply,fuel,fill=1]=scenario;if(profile===OLD&&right.includes('ANTI_TANK'))return {unsupported:'previous candidate has no AT formation'};
 const forms={A:template(left),B:template(right)},actual={},org={},loss={A:0,B:0};
 for(const id of ['A','B']){const d=modelDemand(forms[id],profile);actual[id]={personnel:d.manpower,held:{...d.equipment}};if(id==='A')for(const k of Object.keys(actual[id].held))if(k==='artillery_equipment_1')actual[id].held[k]=Math.floor(actual[id].held[k]*fill);org[id]=attributes(forms[id],actual[id],profile).paper.orgMax;}
 let x=seed;const random=()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;},units={A:{side:'GERMAN',hex:{q:0,r:0}},B:{side:'SOVIET',hex:{q:1,r:0}}},debt={A:{},B:{}};let ticks=0;
 for(;ticks<576;ticks++){
  const stats=Object.fromEntries(['A','B'].map(id=>[id,fuelAdjusted(attributes(forms[id],actual[id],profile),id==='A'&&!fuel?0:1e6)]));
  for(const k of ['softAttack','hardAttack','defense','breakthrough'])stats.A.effective[k]*=.3+.7*supply;
  const contacts=[{hex:'1,0',units:['A','B'],initiators:['A']}],r=profile===OLD?resolveContacts({contacts,units,stats,random,combined:true,damageScale:24,terrainFor:()=>land,tick:ticks}):resolve({contacts,units,stats,random,ground:()=>({terrain:land}),tick:ticks});
  for(const id of ['A','B']){const d=modelDemand(forms[id],profile),lost=Math.min(actual[id].personnel,(r.damage[id]??0)/stats[id].paper.hp*d.manpower);loss[id]+=lost;actual[id].personnel-=lost;org[id]=Math.max(0,org[id]-(r.orgDamage[id]??0));for(const[k,q]of Object.entries(d.equipment)){debt[id][k]=(debt[id][k]??0)+q*lost/d.manpower;const n=Math.min(actual[id].held[k],Math.floor(debt[id][k]));actual[id].held[k]-=n;debt[id][k]-=n;}}
  if(['A','B'].some(id=>org[id]<5||actual[id].personnel<=0))break;
 }
 return {hours:+(Math.min(ticks+1,576)/12).toFixed(2),stopped:ticks>=576?'48h observation budget; no game deadline':'organization/personnel threshold',casualties:Object.fromEntries(Object.entries(loss).map(([k,v])=>[k,Math.round(v)])),org:Object.fromEntries(Object.entries(org).map(([k,v])=>[k,+v.toFixed(2)]))};
}
const results=scenarios.map(s=>({scenario:s[0],runs:seeds.map(seed=>({seed,heldout:heldout.has(seed),old:run(OLD,seed,s),candidate:run(PROFILE,seed,s)}))}));
fs.mkdirSync('evidence/blackice-001',{recursive:true});fs.writeFileSync('evidence/blackice-001/comparison.json',JSON.stringify({description:'Fixed directed combat contacts, no live-campaign victory claim. No seed search or parameter fitting.',seeds,results},null,2));
console.log(JSON.stringify(results.map(x=>({scenario:x.scenario,old:x.runs[0].old,new:x.runs[0].candidate})),null,2));
