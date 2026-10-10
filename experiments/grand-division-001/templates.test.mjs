import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Campaign} from '../grand-release-001/territory.mjs';
import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';
import {emptyDraft,validateDraft,validateStore,divisionView,requirementsFor} from './templates.mjs';
const copy=structuredClone;

test('unit plans bind IDs and versions, survive restore, remain private and never adopt or spend',()=>{
 const c=new Campaign(),own=Object.values(c.state.units).find(u=>u.alive&&u.side===c.viewer),enemy=Object.values(c.state.units).find(u=>u.alive&&u.side!==c.viewer);
 const draft=emptyDraft();draft.regiments[0][0]='INFANTRY';
 const t=c.transaction({id:'plan-template-create',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',draft}}),before=c.save();
 const request={id:'plan-unit-set-0001',version:c.version,operation:{type:'DIVISION_PLAN_SET',unit:own.id,templateId:t.templateId,expectedTemplateVersion:t.templateVersion}};
 const result=c.transaction(request);assert.equal(result.plan.templateId,t.templateId);assert.deepEqual(c.transaction(request),result);
 const after=c.save();assert.deepEqual(after.state,before.state);assert.deepEqual(after.econ,before.econ);assert.deepEqual(after.clock.units,before.clock.units);
 const restored=new Campaign();restored.restore(after);assert.deepEqual(restored.clock.divisions,c.clock.divisions);assert.deepEqual(restored.transaction(request),result);
 const view=divisionView(c);assert(view.units.some(u=>u.id===own.id));assert(!view.units.some(u=>u.id===enemy.id));assert.equal(view.usage.length,1);
 assert.throws(()=>c.transaction({id:'plan-enemy-set-0001',version:c.version,operation:{...request.operation,unit:enemy.id}}),/UNIT_NOT_OWNED/);
 c.transaction({id:'plan-template-edit',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',templateId:t.templateId,expectedTemplateVersion:1,draft:{...draft,name:'更新'}}});
 assert.equal(c.clock.divisions.plans[own.id].templateVersion,1);
 assert.throws(()=>c.transaction({id:'plan-stale-template',version:c.version,operation:request.operation}),/TEMPLATE_CHANGED/);
 c.viewer=enemy.side;assert.equal(divisionView(c).usage.length,0);assert(!divisionView(c).units.some(u=>u.id===own.id));c.viewer=own.side;
 const bad=c.save();bad.clock.divisions.plans[own.id].templateVersion=999;const unchanged=c.save();assert.throws(()=>c.restore(bad),/PLAN_INVALID/);assert.deepEqual(c.save(),unchanged);
 c.transaction({id:'plan-unit-clear-0001',version:c.version,operation:{type:'DIVISION_PLAN_CLEAR',unit:own.id}});assert.equal(divisionView(c).usage.length,0);assert.deepEqual(c.econ,before.econ);assert.deepEqual(c.clock.units,before.clock.units);
});
test('normal campaign draft lifecycle, replay, conflicts and exact no-resource-change',()=>{
 const c=new Campaign(),before=c.save(),draft=emptyDraft();draft.name='中央步兵';draft.regiments[0][0]='INFANTRY';draft.support[0]='ENGINEER';
 const request={id:'division-create-0001',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',draft}};
 const r=c.transaction(request);assert.deepEqual(c.transaction(request),r);assert.equal(Object.keys(c.clock.divisions.templates).length,1);
 assert.throws(()=>c.transaction({...request,operation:{...request.operation,draft:{...draft,name:'冲突'}}}),/ID_REUSE_CONFLICT/);
 const edit={id:'division-edit-0001',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',templateId:r.templateId,expectedTemplateVersion:1,draft:{...draft,name:'中央步兵修订'}}};
 c.transaction(edit);assert.equal(c.clock.divisions.templates[r.templateId].version,2);
 assert.throws(()=>c.transaction({...edit,id:'division-stale-0001',version:c.version}),/DIVISION_TEMPLATE_CHANGED/);
 c.transaction({id:'division-copy-0001',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',draft}});
 assert.equal(Object.keys(c.clock.divisions.templates).length,2);assert.notEqual(Object.keys(c.clock.divisions.templates)[0],Object.keys(c.clock.divisions.templates)[1]);
 const after=c.save();assert.deepEqual(after.state,before.state);assert.deepEqual(after.econ,before.econ);
 delete after.clock.divisions;assert.deepEqual(after.clock,before.clock);
 const unchanged=c.save();assert.throws(()=>c.transaction({id:'division-adopt-0001',version:c.version,operation:{type:'DIVISION_ADOPT',unit:'G-001',templateId:r.templateId}}),/DIVISION_RULE_REVIEW_REQUIRED/);assert.deepEqual(c.save(),unchanged);
 c.viewer='SOVIET';assert.equal(divisionView(c).templates.length,0);assert.throws(()=>c.transaction({...edit,id:'division-enemy-0001',version:c.version}),/DIVISION_TEMPLATE_NOT_OWNED/);
});
test('invalid draft and save reject before commit; preview references cannot mutate authority',()=>{
 const c=new Campaign(),before=c.save(),d=emptyDraft();d.support[0]=d.support[1]='ENGINEER';assert.throws(()=>validateDraft(d),/DUPLICATE_SUPPORT/);
 d.support[1]=null;d.regiments[0][0]='__proto__';assert.throws(()=>validateDraft(d),/BATTALION_UNKNOWN/);
 assert.throws(()=>validateStore({schema:'future'}),/SAVE_UNSUPPORTED/);
 const invalid=copy(before);invalid.clock.divisions={schema:'future'};assert.throws(()=>c.restore(invalid),/SAVE_UNSUPPORTED/);assert.deepEqual(c.save(),before);
 const good=emptyDraft();c.transaction({id:'division-isolation',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',draft:good}});const v=divisionView(c);v.templates[0].name='wrong';assert.notEqual(divisionView(c).templates[0].name,'wrong');
});
test('real persistent save/restart retains drafts and idempotent transport receipts',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'eastfront-division-')),saveFile=path.join(root,'campaign.json');
 const a=new ReleaseAdapter({saveFile,restore:false,CampaignClass:Campaign}),draft=emptyDraft();draft.regiments[0][0]='INFANTRY';
 const env={instanceId:a.id,era:a.era,requestId:'division-wire-0001',commandSeq:1,kind:'OPERATION',payload:{type:'DIVISION_DRAFT_SAVE',draft},dependencies:{}};
 const first=await a.submit('a',env);assert.equal(first.status,'APPLIED');assert.deepEqual(await a.submit('a',env),first);await a.saveFileNow();
 const b=new ReleaseAdapter({saveFile,CampaignClass:Campaign});assert.deepEqual(b.c.clock.divisions,a.c.clock.divisions);assert.equal(b.c.clock.paused,true);assert.equal(b.c.transport.next.a,2);assert.equal(b.c.receipts.get(env.requestId).transport.result.status,'APPLIED');
 await assert.rejects(()=>b.submit('a',env),/RESTORED_SESSION_REPLAN_REQUIRED/);assert.deepEqual(b.c.econ,a.c.econ);
 // Temporary evidence is deliberately kept for inspection rather than deleting saves.
 console.log('isolated restart save:',saveFile);
});

 test('editing drafts cannot alter identical accepted simulation steps',()=>{
 const control=new Campaign(),edited=new Campaign();
 edited.restore(control.save());
 const draft=emptyDraft();draft.regiments[0][0]='INFANTRY';
 edited.transaction({id:'division-flow-0001',version:edited.version,operation:{type:'DIVISION_DRAFT_SAVE',draft}});
 for(let i=0;i<12;i++){control.advance();edited.advance();}
 const a=control.save(),b=edited.save();
 for(const save of [a,b]){for(const part of [save.clock,save.clock.frontDefense,save.clock.objectives,save.clock.tactical]){for(const key of ['lastMs','maxMs','totalMs'])if(part?.metrics)delete part.metrics[key];if(part?.metrics?.last)for(const key of ['objectiveMs','totalMs'])delete part.metrics.last[key];}delete save.econ.modern.networkTiming;for(const manager of Object.values(save.econ.modern.management??{}))for(const key of ['ms','maxMs','totalMs'])delete manager[key];}
 assert.deepEqual(b.state,a.state);assert.deepEqual(b.econ,a.econ);
 delete b.clock.divisions;assert.deepEqual(b.clock,a.clock);
 });

test('two cooperating clients create the same name: each receipt identifies exactly its own template',async()=>{
 const a=new ReleaseAdapter({restore:false,CampaignClass:Campaign}),draft=emptyDraft();draft.name='同名模板';
 const envelope=(seat)=>({instanceId:a.id,era:a.era,requestId:'division-concurrent-'+seat,commandSeq:1,kind:'OPERATION',payload:{type:'DIVISION_DRAFT_SAVE',draft},dependencies:{}});
 const ea=envelope('a'),eb=envelope('b');
 const [ra,rb]=await Promise.all([a.submit('a',ea),a.submit('b',eb)]);
 assert.equal(ra.status,'APPLIED');assert.equal(rb.status,'APPLIED');
 assert.notEqual(ra.division.templateId,rb.division.templateId);
 for(const r of [ra,rb]){assert.equal(r.division.templateVersion,1);assert.equal(a.c.clock.divisions.templates[r.division.templateId].name,draft.name);}
 assert.deepEqual(await a.submit('a',ea),ra);assert.equal(Object.keys(a.c.clock.divisions.templates).length,2);
 const edit={...ea,requestId:'division-concurrent-edit-a',commandSeq:2,payload:{type:'DIVISION_DRAFT_SAVE',templateId:ra.division.templateId,expectedTemplateVersion:1,draft:{...draft,name:'A修订'}}};
 const re=await a.submit('a',edit);assert.equal(re.division.templateId,ra.division.templateId);assert.equal(re.division.templateVersion,2);
 assert.equal(a.c.clock.divisions.templates[rb.division.templateId].name,'同名模板');
});

test('unverified fifth-row eligibility cannot be granted by a new draft; old drafts remain readable',()=>{
 const c=new Campaign(),d=emptyDraft();d.regiments[0][4]='INFANTRY';
 assert.equal(divisionView(c).profile.fifthRow.status,'UNVERIFIED');
 const before=c.save();assert.throws(()=>c.transaction({id:'division-row-five-1',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',draft:d}}),/SLOT_UNLOCK_UNVERIFIED/);assert.deepEqual(c.save(),before);
 const old={schema:'DIVISION-DRAFT-1',next:2,templates:{legacy:{...d,id:'legacy',side:'GERMAN',version:1,status:'DRAFT'}}};validateStore(old);c.clock.divisions=old;
 d.regiments[0][4]=null;c.transaction({id:'division-row-five-2',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',templateId:'legacy',expectedTemplateVersion:1,draft:d}});assert.equal(c.clock.divisions.templates.legacy.regiments[0][4],null);
});

test('source-backed demand is authoritative, reference conflicts and forged saved demand fail atomically',()=>{
 const c=new Campaign(),d=emptyDraft();d.regiments[0][0]='INFANTRY';d.support[0]='ENGINEER';
 const expected={manpower:1300,equipment:{infantry_equipment:110,support_equipment:30}};
 assert.deepEqual(requirementsFor(d),expected);
 const profile=divisionView(c).profile.id,before=c.save();
 assert.throws(()=>c.transaction({id:'division-reference-old',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',referenceProfileId:'wrong',draft:d}}),/REFERENCE_CHANGED/);assert.deepEqual(c.save(),before);
 const r=c.transaction({id:'division-reference-new',version:c.version,operation:{type:'DIVISION_DRAFT_SAVE',referenceProfileId:profile,draft:d,requirements:{manpower:999999}}});
 assert.deepEqual(c.clock.divisions.templates[r.templateId].requirements,expected);
 const saved=c.save(),bad=copy(saved);bad.clock.divisions.templates[r.templateId].requirements.manpower++;
 assert.throws(()=>c.restore(bad),/SAVED_DEMAND_MISMATCH/);assert.deepEqual(c.save(),saved);
 const v=divisionView(c);assert.equal(v.demandReference.units.INFANTRY.baseAttributes.max_organisation,60);assert.equal(v.demandReference.units.ENGINEER.baseAttributes.max_organisation,20);
 assert(v.demandReference.units.INFANTRY.unlockSources.some(x=>x.technology==='infantry_weapons'));assert.equal(v.demandReference.columnSizeEffects.length,4);assert.equal(v.adoptionEnabled,false);
});
