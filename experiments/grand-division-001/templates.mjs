import fs from 'node:fs';
const demandReference=JSON.parse(fs.readFileSync(new URL('./demand-reference.json',import.meta.url),'utf8'));
const profile=JSON.parse(fs.readFileSync(new URL('./reference-profile.json',import.meta.url),'utf8'));
// Persistent design drafts, deliberately distinct from adopted unit establishments.
// No unverified HOI4 statistic, exchange rate or experience price is executable here.
export const SCHEMA='DIVISION-DRAFT-1';
export const catalog=Object.freeze({
 INFANTRY:{label:'步兵营',role:'line',family:'infantry',symbol:'×'},
 MOTORIZED:{label:'摩托化步兵营',role:'line',family:'mobile',symbol:'⊗'},
 ARTILLERY:{label:'炮兵营',role:'line',family:'combat_support',symbol:'●'},
 ANTI_TANK:{label:'反坦克营',role:'line',family:'combat_support',symbol:'△'},
 LIGHT_ARMOR:{label:'轻型坦克营（LT-0）',role:'line',family:'armor',symbol:'▱'},
 MEDIUM_ARMOR:{label:'中型装甲营',role:'line',family:'armor',symbol:'▱'},
 HEAVY_ARMOR:{label:'重型装甲营',role:'line',family:'armor',symbol:'▰'},
 ENGINEER:{label:'工兵支援连',role:'support',symbol:'工'},
 RECON:{label:'侦察支援连',role:'support',symbol:'⌕'},
 SUPPORT_ARTILLERY:{label:'支援炮兵连',role:'support',symbol:'●'},
 SUPPORT_AT:{label:'支援反坦克连',role:'support',symbol:'△'},
 SIGNAL:{label:'通信支援连',role:'support',symbol:'⌁'},
 LOGISTICS:{label:'后勤支援连',role:'support',symbol:'▣'},
 MAINTENANCE:{label:'维修支援连',role:'support',symbol:'⚒'},
 HOSPITAL:{label:'野战医院',role:'support',symbol:'＋'}
});
for(const entry of Object.values(catalog))Object.freeze(entry);
const fail=x=>{throw Error(x);},copy=structuredClone;
export const emptyDraft=()=>({name:'新编制草案',regiments:Array.from({length:profile.columns},()=>Array(profile.rows).fill(null)),support:Array(profile.supportSlots).fill(null)});
export function validateDraft(x){
 if(!x||typeof x.name!=='string'||!x.name.trim()||x.name.trim().length>48)fail('DIVISION_NAME_REQUIRED');
 if(!Array.isArray(x.regiments)||x.regiments.length!==profile.columns||!Array.isArray(x.support)||x.support.length!==profile.supportSlots)fail('DIVISION_SLOT_SHAPE');
 for(const column of x.regiments){if(!Array.isArray(column)||column.length!==profile.rows)fail('DIVISION_SLOT_SHAPE');for(const id of column)if(id!==null&&(typeof id!=='string'||!Object.hasOwn(catalog,id)||catalog[id].role!=='line'))fail('DIVISION_BATTALION_UNKNOWN');}
 for(const id of x.support)if(id!==null&&(typeof id!=='string'||!Object.hasOwn(catalog,id)||catalog[id].role!=='support'))fail('DIVISION_SUPPORT_UNKNOWN');
 const support=x.support.filter(Boolean);if(new Set(support).size!==support.length)fail('DIVISION_DUPLICATE_SUPPORT');
 return {name:x.name.trim(),regiments:copy(x.regiments),support:copy(x.support)};
}
export function requirementsFor(draft){
 const d=validateDraft(draft),equipment={};let manpower=0;
 for(const id of [...d.regiments.flat(),...d.support]){if(!id)continue;const unit=demandReference.units[id];if(!unit)fail('DIVISION_DEMAND_REFERENCE_MISSING');manpower+=unit.manpower;for(const [kind,count]of Object.entries(unit.equipment))equipment[kind]=(equipment[kind]??0)+count;}
 return {manpower,equipment:Object.fromEntries(Object.entries(equipment).sort(([a],[b])=>a.localeCompare(b)))};
}
export function validateStore(s){
 if(!s)return;
 if(s.schema!==SCHEMA||!Number.isSafeInteger(s.next)||s.next<1||!s.templates||typeof s.templates!=='object'||Array.isArray(s.templates)||Object.keys(s.templates).length>128)fail('DIVISION_SAVE_UNSUPPORTED');
 for(const [id,t]of Object.entries(s.templates)){if(!t||t.id!==id||!['GERMAN','SOVIET'].includes(t.side)||!Number.isSafeInteger(t.version)||t.version<1||t.status!=='DRAFT')fail('DIVISION_SAVE_INVALID');validateDraft(t);if(t.requirements&&JSON.stringify(t.requirements)!==JSON.stringify(requirementsFor(t)))fail('DIVISION_SAVED_DEMAND_MISMATCH');}
 if(s.plans){if(typeof s.plans!=='object'||Array.isArray(s.plans)||Object.keys(s.plans).length>512)fail('DIVISION_PLAN_INVALID');for(const [unit,p]of Object.entries(s.plans)){if(!p||p.unit!==unit||!['GERMAN','SOVIET'].includes(p.side)||p.status!=='PLANNED'||!Number.isSafeInteger(p.templateVersion)||p.templateVersion<1||!Object.hasOwn(s.templates,p.templateId)||s.templates[p.templateId]?.side!==p.side||p.templateVersion>s.templates[p.templateId].version||!Number.isSafeInteger(p.updatedTick)||p.updatedTick<0)fail('DIVISION_PLAN_INVALID');}}
}
export function divisionView(c){return {profile:copy(profile),schema:SCHEMA,adoptionEnabled:false,referenceVerified:false,demandReference:copy(demandReference),templates:copy(Object.values(c.clock.divisions?.templates??{}).filter(t=>t.side===c.viewer)),catalog,blockers:['正常换编费用、返还与训练经验仍待裁决；已观察的具体编辑费用不作通用公式','装备件数与现有库存单位尚未完成映射；战斗属性未接入'],usage:copy(Object.values(c.clock.divisions?.plans??{}).filter(p=>p.side===c.viewer)),units:Object.values(c.state.units).filter(u=>u.alive&&u.side===c.viewer).map(u=>{const v=c.clock.units[u.id],e=c.econ.modern,g=c.econ.gear.units[u.id],row=e.net[c.viewer]?.rows[u.id];return {id:u.id,personnel:v.personnel,personnelTarget:v.max,org:v.org,held:copy(g.held),equipmentTarget:copy(e.establishment[u.id]),routeAvailable:!!row?.routes?.length||!!row?.route,engaged:!!v.engaged,marching:!!v.march};})};}
export function transaction(c,req){
 const signature=JSON.stringify(req),prior=c.receipts.get(req.id);
 if(prior){if(prior.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(prior.result);}
 if(typeof req.id!=='string'||!/^[-\w:]{8,96}$/.test(req.id))fail('REQUEST_ID_REQUIRED');
 if(req.version!==c.version)fail('STALE_VERSION');if(c.clock.ended)fail('CAMPAIGN_FINISHED');
 if(!['GERMAN','SOVIET'].includes(c.viewer))fail('DIVISION_SIDE_NOT_AUTHORIZED');
 const op=req.operation;if(op.type==='DIVISION_ADOPT')fail('DIVISION_RULE_REVIEW_REQUIRED');
 if(op.type==='DIVISION_PLAN_SET'||op.type==='DIVISION_PLAN_CLEAR'){
  const u=c.state.units[op.unit];if(!u||!u.alive||u.side!==c.viewer)fail('DIVISION_UNIT_NOT_OWNED');
  const store=copy(c.clock.divisions??{schema:SCHEMA,next:1,templates:{}});store.plans??={};
  if(op.type==='DIVISION_PLAN_SET'){const t=store.templates[op.templateId];if(!t||t.side!==c.viewer)fail('DIVISION_TEMPLATE_NOT_OWNED');if(t.version!==op.expectedTemplateVersion)fail('DIVISION_TEMPLATE_CHANGED');store.plans[u.id]={unit:u.id,side:c.viewer,templateId:t.id,templateVersion:t.version,status:'PLANNED',updatedTick:c.clock.tick};}
  else delete store.plans[u.id];
  validateStore(store);c.clock.divisions=store;c.version++;c.match.matchRevision=c.version;
  const result={ok:true,version:c.version,unitId:u.id,plan:copy(store.plans[u.id]??null)};c.receipts.set(req.id,{signature,result});return copy(result);
 }
 if(op.type!=='DIVISION_DRAFT_SAVE')fail('DIVISION_OPERATION_UNSUPPORTED');
 if(op.referenceProfileId!==undefined&&op.referenceProfileId!==profile.id)fail('DIVISION_REFERENCE_CHANGED');
 const draft=validateDraft(op.draft),oldStore=c.clock.divisions??{schema:SCHEMA,next:1,templates:{}},store=copy(oldStore);
 let id=op.templateId,version=1;
 if(id){if(typeof id!=='string')fail('DIVISION_TEMPLATE_NOT_OWNED');const old=Object.hasOwn(store.templates,id)?store.templates[id]:null;if(!old||old.side!==c.viewer)fail('DIVISION_TEMPLATE_NOT_OWNED');if(op.expectedTemplateVersion!==old.version)fail('DIVISION_TEMPLATE_CHANGED');version=old.version+1;}
 else {if(Object.keys(store.templates).length>=128)fail('DIVISION_TEMPLATE_LIMIT');id=c.id+':division:'+store.next++;if(Object.hasOwn(store.templates,id))fail('DIVISION_SAVE_INVALID');}
 for(let column=0;column<profile.columns;column++)for(let row=profile.draftEditableRows;row<profile.rows;row++){const value=draft.regiments[column][row];if(value!==null&&value!==oldStore.templates[op.templateId]?.regiments[column][row])fail('DIVISION_SLOT_UNLOCK_UNVERIFIED');}
 const template={...draft,requirements:requirementsFor(draft),referenceProfileId:profile.id,id,side:c.viewer,version,status:'DRAFT',updatedTick:c.clock.tick};store.templates[id]=template;
 // Commit after all validation. Draft saving is not a free formal template adoption.
 c.clock.divisions=store;c.version++;c.match.matchRevision=c.version;
 const result={ok:true,version:c.version,templateId:id,templateVersion:version};c.receipts.set(req.id,{signature,result});return copy(result);
}
