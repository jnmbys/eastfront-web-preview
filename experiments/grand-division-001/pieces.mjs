// Integer-piece authority. No old-stock conversion and no combat attribute changes.
import {requirementsFor} from './templates.mjs';
export const PIECE_RULES='DIVISION-PIECES-TEST-1';
export const KINDS=['infantry_equipment','support_equipment'];
const copy=structuredClone,fail=s=>{throw Error(s);},integer=n=>Number.isSafeInteger(n)&&n>=0;
export function requirements(t){
 const ids=[...t.regiments.flat(),...t.support].filter(Boolean);
 if(!ids.length||ids.some(x=>!['INFANTRY','ENGINEER'].includes(x)))fail('PIECE_TYPE_NOT_ENABLED');
 if(t.regiments.some(c=>c[4]))fail('PIECE_SLOT_NOT_ENABLED');
 const d=requirementsFor(t);if(Object.keys(d.equipment).some(k=>!KINDS.includes(k)))fail('PIECE_MODEL_UNMAPPED');return d;
}
export function totals(p){const out={};for(const side of ['GERMAN','SOVIET']){const n=p.nations[side];out[side]={personnel:n.manpower,...n.stock};for(const u of Object.values(p.units).filter(u=>u.side===side)){out[side].personnel+=u.personnel;for(const k of KINDS)out[side][k]+=u.held[k];}}return out;}
export function validatePieces(p){
 if(!p||p.schema!==PIECE_RULES||p.fixture!==true||!integer(p.fixtureAdoptionFee)||!integer(p.tick)||!integer(p.refill.personnel)||KINDS.some(k=>!integer(p.refill[k])))fail('PIECE_SAVE_INVALID');
 for(const s of ['GERMAN','SOVIET']){const n=p.nations[s];if(!n||!integer(n.manpower)||!integer(n.xp)||KINDS.some(k=>!integer(n.stock[k])))fail('PIECE_POOL_INVALID');}
 for(const [id,u]of Object.entries(p.units)){if(u.id!==id||!integer(u.revision)||!p.nations[u.side]||!integer(u.personnel)||!integer(u.target.manpower)||!Number.isFinite(u.org)||!Number.isFinite(u.trainingExperience)||KINDS.some(k=>!integer(u.held[k])||!integer(u.target.equipment[k]??0)))fail('PIECE_UNIT_INVALID');}
 for(const [key,t]of Object.entries(p.formalTemplates??{})){if(key!==t.id+'@'+t.version||!integer(t.version)||t.version<1||!p.nations[t.side]||t.status!=='FORMAL_TEST'||JSON.stringify(requirements(t))!==JSON.stringify(t.requirements))fail('PIECE_FORMAL_TEMPLATE_INVALID');}
 for(const u of Object.values(p.units)){if(u.templateId){const t=p.formalTemplates?.[u.templateId+'@'+u.templateVersion];if(!t||t.side!==u.side||JSON.stringify(t.requirements)!==JSON.stringify(u.target))fail('PIECE_FORMAL_LINK_INVALID');}}
 if(JSON.stringify(totals(p))!==JSON.stringify(p.initial))fail('PIECE_CONSERVATION_FAILED');
}
export function eligible(c,id){const u=c.state.units[id],v=c.clock.units[id],r=c.econ.modern.net[u?.side]?.rows[id];
 if(!u?.alive)fail('PIECE_UNIT_UNAVAILABLE');if(v.engaged)fail('PIECE_IN_COMBAT');if(v.march||v.retreat||c.clock.tactical?.withdrawals?.[id])fail('PIECE_MOVING_OR_WITHDRAWING');
 if(!r?.route&&!r?.routes?.length)fail('PIECE_REAR_DISCONNECTED');
}
// Quotes are fixture inputs, never inferred HOI4 pricing. A binding draft version
// is required by the caller; requests cannot supply a price or pool injection.
export function applyAdoption(c,p,op){
 const u=p.units[op.unit],t=c.clock.divisions?.templates[op.templateId];
 if(!u||u.side!==c.viewer||c.state.units[u.id]?.side!==u.side)fail('PIECE_UNIT_NOT_OWNED');eligible(c,u.id);
 if(op.expectedUnitRevision!==u.revision)fail('PIECE_UNIT_CHANGED');
 if(!t||t.side!==c.viewer)fail('DIVISION_TEMPLATE_NOT_OWNED');if(t.version!==op.expectedTemplateVersion)fail('DIVISION_TEMPLATE_CHANGED');
 const target=requirements(t),n=p.nations[u.side],fee=p.fixtureAdoptionFee;
 if(!integer(fee)||n.xp<fee)fail('PIECE_XP_INSUFFICIENT');
 if(u.templateId===t.id&&u.templateVersion===t.version)fail('PIECE_ALREADY_ADOPTED');
 u.org=c.clock.units[u.id].org;u.trainingExperience=c.clock.units[u.id].trainingExperience??u.trainingExperience;
 const returned={personnel:Math.max(0,u.personnel-target.manpower),equipment:{}};
 n.xp-=fee;n.manpower+=returned.personnel;u.personnel-=returned.personnel;
 for(const k of KINDS){const q=Math.max(0,u.held[k]-(target.equipment[k]??0));u.held[k]-=q;n.stock[k]+=q;returned.equipment[k]=q;}
 Object.assign(u,{target,templateId:t.id,templateVersion:t.version,revision:u.revision+1});
 p.formalTemplates??={};p.formalTemplates[t.id+'@'+t.version]={id:t.id,version:t.version,side:t.side,name:t.name,status:'FORMAL_TEST',regiments:copy(t.regiments),support:copy(t.support),requirements:copy(target)};
 // Keep org and training experience exactly; aggregate org cap remains unimplemented.
 return {unitId:u.id,templateId:t.id,templateVersion:t.version,paidXP:fee,returned,actual:copy(u)};
}
export function refillStep(c,p){
 p.tick++;const sent=[];
 for(const side of ['GERMAN','SOVIET']){const n=p.nations[side],remaining=copy(p.refill);
  const us=Object.values(p.units).filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id));
  // Deterministic rotation prevents the same ID always receiving the shared test allowance.
  const offset=us.length?p.tick%us.length:0;
  for(const u of [...us.slice(offset),...us.slice(0,offset)]){let reason=null;try{eligible(c,u.id);}catch(e){reason=e.message;}if(reason){sent.push({unit:u.id,blocked:reason});continue;}
   const personnel=Math.min(remaining.personnel,n.manpower,Math.max(0,u.target.manpower-u.personnel)),equipment={};n.manpower-=personnel;u.personnel+=personnel;remaining.personnel-=personnel;
   for(const k of KINDS){const q=Math.min(remaining[k],n.stock[k],Math.max(0,(u.target.equipment[k]??0)-u.held[k]));n.stock[k]-=q;u.held[k]+=q;remaining[k]-=q;equipment[k]=q;}
   if(personnel||Object.values(equipment).some(Boolean))u.revision++;sent.push({unit:u.id,personnel,equipment});
  }
 }
 p.lastRefill=sent;return {tick:p.tick,sent};
}
