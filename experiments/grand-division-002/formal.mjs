import {changes,modelDemand} from './model-demand.mjs';
import {returnSurplus,validate} from './inventory.mjs';
import {validateDraft} from '../grand-division-001/templates.mjs';
const copy=structuredClone,fail=x=>{throw Error(x);};
export const POLICY=Object.freeze({id:'DIVISION-002-APPROVED-PROJECT-1',lineXP:5,supportXP:10,combatMinutesPerXP:60});
export function initializeFormal(s,initialTemplates){
 if(typeof s.id!=='string'||!s.id)fail('DIVISION_INSTANCE_REQUIRED');
 s.formal={policy:POLICY.id,templates:copy(initialTemplates),xp:{GERMAN:0,SOVIET:0},earnedMinutes:{GERMAN:0,SOVIET:0},lastExperienceTick:-1};
 validateFormal(s);
 return s;
}
/** Receives committed combat participants, never a client claim or future roll.
 * A minute with several battles still counts once for its side. Paused time earns 0.
 */
export function earnExperience(s,{tick,minutes,participantSides}){
 const f=s.formal;if(!Number.isSafeInteger(tick)||tick!==f.lastExperienceTick+1)fail('DIVISION_XP_TICK_SEQUENCE');
 if(!Number.isFinite(minutes)||minutes<0||minutes>60||participantSides.some(x=>!Object.hasOwn(f.xp,x)))fail('DIVISION_XP_EVENT_INVALID');
 const gained={GERMAN:0,SOVIET:0};
 for(const side of new Set(participantSides)){f.earnedMinutes[side]+=minutes;const n=Math.floor(f.earnedMinutes[side]/POLICY.combatMinutesPerXP);f.earnedMinutes[side]-=n*POLICY.combatMinutesPerXP;f.xp[side]+=n;gained[side]=n;}
 f.lastExperienceTick=tick;return gained;
}
export function quoteFormal(s,side,baseId,draft){
 draft=validateDraft(draft);
 const old=s.formal.templates[baseId];if(!old||old.side!==side)fail('DIVISION_FORMAL_NOT_OWNED');
 const diff=changes(old,draft,s.profile);return {baseId,baseVersion:old.version,changes:diff,cost:diff.reduce((sum,x)=>sum+(x.kind==='line'?POLICY.lineXP:POLICY.supportXP),0),policy:POLICY.id};
}
export function adopt(s,side,op,eligible){
 const u=s.units[op.unit],t=s.formal.templates[op.templateId];if(!u||u.side!==side||!t||t.side!==side)fail('DIVISION_NOT_OWNED');
 if(u.revision!==op.expectedUnitRevision||t.version!==op.expectedTemplateVersion)fail('DIVISION_CHANGED');
 eligible(u.id);
 if(u.templateId===t.id&&u.templateVersion===t.version)fail('DIVISION_ALREADY_ADOPTED');
 const returned=returnSurplus(s,u.id,modelDemand(t,s.profile));u.templateId=t.id;u.templateVersion=t.version;
 // Approved candidate return policy. No org gain or guessed training-experience loss.
 return {unitId:u.id,templateId:t.id,templateVersion:t.version,paidXP:0,returned};
}
/** Atomic formal edits. Preserves older immutable template versions and unit links. */
export function formalTransaction(s,req,side,eligible){
 if(typeof req.id!=='string'||!/^[-\w:]{8,96}$/.test(req.id))fail('REQUEST_ID_REQUIRED');
 const signature=JSON.stringify([side,req]),prior=s.requests?.[req.id];if(prior){if(prior.signature!==signature)fail('ID_REUSE_CONFLICT');return {state:s,receipt:copy(prior.receipt)};}
 if(req.version!==s.version)fail('STALE_VERSION');if(!Object.hasOwn(s.nations,side))fail('SIDE_NOT_AUTHORIZED');
 const next=copy(s),op=req.operation;let result;
 if(op.type==='FORMAL_SAVE'){
  if(Object.keys(next.formal.templates).length>=128)fail('DIVISION_FORMAL_LIMIT');
  const q=quoteFormal(next,side,op.baseId,op.draft);if(q.baseVersion!==op.expectedBaseVersion)fail('DIVISION_FORMAL_CHANGED');
  if(next.formal.xp[side]<q.cost)fail('DIVISION_XP_INSUFFICIENT');
  const id=next.id+':formal:'+(next.formal.serial??1);next.formal.serial=(next.formal.serial??1)+1;if(Object.hasOwn(next.formal.templates,id))fail('DIVISION_FORMAL_ID_COLLISION');
  const draft=validateDraft(op.draft),t={...draft,id,version:1,side,requirements:modelDemand(draft,next.profile),status:'FORMAL',derivedFrom:q.baseId};next.formal.templates[id]=t;next.formal.xp[side]-=q.cost;
  result={templateId:id,templateVersion:1,paidXP:q.cost,affectedUnits:[]};
 }else if(op.type==='FORMAL_ADOPT')result=adopt(next,side,op,eligible);
 else fail('DIVISION_FORMAL_OPERATION_UNKNOWN');
 next.version++;validate(next);validateFormal(next);const receipt={ok:true,version:next.version,...result};next.requests??={};next.requests[req.id]={signature,receipt:copy(receipt)};
 return {state:next,receipt};
}
export function validateFormal(s){
 const f=s.formal;if(!f||f.policy!==POLICY.id||!Number.isSafeInteger(f.lastExperienceTick)||f.lastExperienceTick< -1)fail('DIVISION_POLICY_VERSION');
 for(const side of ['GERMAN','SOVIET'])if(!Number.isSafeInteger(f.xp[side])||f.xp[side]<0||!Number.isFinite(f.earnedMinutes[side])||f.earnedMinutes[side]<0||f.earnedMinutes[side]>=60)fail('DIVISION_XP_SAVE_INVALID');
 for(const[id,t]of Object.entries(f.templates)){if(t.id!==id||t.status!=='FORMAL'||!s.nations[t.side]||!Number.isSafeInteger(t.version)||t.version<1)fail('DIVISION_FORMAL_SAVE_INVALID');validateDraft(t);modelDemand(t,s.profile);}
 for(const u of Object.values(s.units)){const t=f.templates[u.templateId];if(!t||t.side!==u.side||t.version!==u.templateVersion||JSON.stringify(modelDemand(t,s.profile))!==JSON.stringify(u.target))fail('DIVISION_FORMAL_UNIT_LINK');}
}
