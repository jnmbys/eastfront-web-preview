import fs from 'node:fs';
import * as combined from '../grand-division-003/catalog.mjs';
export const reference=JSON.parse(fs.readFileSync(new URL('./model-reference.json',import.meta.url),'utf8'));
export const modelIds=Object.freeze(Object.keys(reference.models));
export const mapping=Object.freeze({infantry_equipment:'infantry_equipment_1',support_equipment:'support_equipment_1'});
const fail=x=>{throw Error(x);};
export function referenceFor(s){const profile=typeof s==='string'?s:s?.profile;if(profile===combined.PROFILE)return combined.reference;if(profile)fail('MODEL_PROFILE_UNKNOWN');return reference;}
export function idsFor(s){return Object.keys(referenceFor(s).models);}
/** This is a model-specific demand, not a conversion of legacy inventory. */
export function modelDemand(template,profile){
 if(profile===combined.PROFILE)return combined.demand(template);if(profile)fail('MODEL_PROFILE_UNKNOWN');
 if(!Array.isArray(template.regiments)||template.regiments.length!==5||template.regiments.some(c=>!Array.isArray(c)||c.length!==5)||!Array.isArray(template.support)||template.support.length!==5)fail('MODEL_SLOT_SHAPE');
 if(template.regiments.some(c=>c[4]))fail('MODEL_FIFTH_ROW_UNVERIFIED');
 if(template.regiments.flat().some(k=>k!==null&&k!=='INFANTRY'))fail('MODEL_LINE_NOT_ENABLED');
 if(template.support.some(k=>k!==null&&!['ENGINEER','RECON'].includes(k)))fail('MODEL_SUPPORT_NOT_ENABLED');
 const supports=template.support.filter(Boolean);if(new Set(supports).size!==supports.length)fail('MODEL_DUPLICATE_SUPPORT');
 const line=template.regiments.flat().filter(Boolean);if(!line.length)fail('MODEL_LINE_REQUIRED');
 const equipment=Object.fromEntries(modelIds.map(k=>[k,0]));let manpower=0;
 for(const id of [...line,...supports]){const u=reference.units[id];manpower+=u.manpower;for(const[k,n]of Object.entries(u.need)){if(!mapping[k])fail('MODEL_MAPPING_MISSING');equipment[mapping[k]]+=n;}}
 return {manpower,equipment};
}
/** Slot differences only; pricing is deliberately a separately reviewed policy. */
export function changes(before,after,profile){
 modelDemand(before,profile);modelDemand(after,profile);
 const result=[];
 for(let c=0;c<5;c++)for(let r=0;r<4;r++)if(before.regiments[c][r]!==after.regiments[c][r])result.push({kind:'line',column:c,row:r,from:before.regiments[c][r],to:after.regiments[c][r]});
 // Approved project policy charges each changed slot, including a replacement.
 for(let row=0;row<5;row++)if(before.support[row]!==after.support[row])result.push({kind:'support',row,from:before.support[row],to:after.support[row]});
 return result;
}
