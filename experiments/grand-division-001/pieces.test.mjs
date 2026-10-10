import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {PieceFixture,emptyDraft} from './fixture.mjs';import {totals} from './pieces.mjs';import {Campaign} from '../grand-release-001/territory.mjs';import {ReleaseAdapter} from '../grand-release-001/persistence.mjs';
let serial=0;const req=(c,operation)=>({id:'piece-test-'+String(++serial).padStart(5,'0'),version:c.version,operation});
function draft(n=2,engineer=true){const d=emptyDraft();d.name='件数事务测试';for(let i=0;i<n;i++)d.regiments[0][i]='INFANTRY';if(engineer)d.support[0]='ENGINEER';return d;}
function save(c,d){return c.transaction(req(c,{type:'DIVISION_DRAFT_SAVE',draft:d}));}
function adopt(c,t){return req(c,{type:'DIVISION_ADOPT',unit:'G-013',expectedUnitRevision:c.clock.pieces?.units['G-013'].revision,templateId:t.templateId,expectedTemplateVersion:t.templateVersion});}
test('same unit expands, partially refills from stock, contracts and restarts without duplication',async()=>{
 const c=new PieceFixture(),initial=structuredClone(c.clock.pieces),oldEconomy=structuredClone(c.econ),links={corps:structuredClone(c.clock.corps),front:structuredClone(c.clock.frontDefense),unit:structuredClone(c.state.units['G-013'])};
 const t=save(c,draft()),r=adopt(c,t),first=c.transaction(r);assert.equal(first.paidXP,5);assert.deepEqual(c.transaction(r),first);
 let u=c.clock.pieces.units['G-013'];assert.equal(u.target.manpower,2300);assert.equal(u.personnel,1000);assert.equal(u.held.infantry_equipment,100);assert.equal(c.clock.pieces.nations.GERMAN.xp,25);
 const partialReq=req(c,{type:'DIVISION_REFILL_TEST_STEP'}),partial=c.transaction(partialReq);assert.deepEqual(c.transaction(partialReq),partial);u=c.clock.pieces.units['G-013'];assert.equal(u.personnel,1250);assert.equal(u.held.infantry_equipment,125);assert.equal(u.held.support_equipment,10);assert.equal(c.clock.pieces.nations.GERMAN.manpower,4750);
 for(let i=0;i<5;i++)c.transaction(req(c,{type:'DIVISION_REFILL_TEST_STEP'}));u=c.clock.pieces.units['G-013'];assert.equal(u.personnel,2300);assert.equal(u.held.infantry_equipment,210);assert.equal(u.held.support_equipment,30);
 const shrink=save(c,draft(1,false)),shrinkReq=adopt(c,shrink),returned=c.transaction(shrinkReq);assert.deepEqual(returned.returned,{personnel:1300,equipment:{infantry_equipment:110,support_equipment:30}});assert.deepEqual(c.transaction(shrinkReq),returned);
 assert.deepEqual(c.clock.pieces.nations.GERMAN,{...initial.nations.GERMAN,xp:20});assert.deepEqual(totals(c.clock.pieces),initial.initial);assert.equal(c.clock.pieces.units['G-013'].org,85);assert.equal(c.clock.pieces.units['G-013'].trainingExperience,.4);
 assert.deepEqual(c.econ,oldEconomy);assert.deepEqual(c.clock.corps,links.corps);assert.deepEqual(c.clock.frontDefense,links.front);assert.deepEqual(c.state.units['G-013'],links.unit);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'division-piece-restart-')),a=new ReleaseAdapter({CampaignClass:PieceFixture,saveFile:path.join(dir,'save.json')});a.c.restore(c.save());await a.saveFileNow();const b=new ReleaseAdapter({CampaignClass:PieceFixture,saveFile:a.saveFile});assert.deepEqual(b.c.clock.pieces,c.clock.pieces);assert.deepEqual(b.c.transaction(shrinkReq),returned);assert.equal(b.c.clock.paused,true);
 fs.mkdirSync('docs/grand-division-001/evidence',{recursive:true});fs.writeFileSync('docs/grand-division-001/evidence/piece-cycle.json',JSON.stringify({label:'explicit fixture, not natural campaign',initial,expanded:first,partial,returned,final:b.c.clock.pieces,saveFile:a.saveFile},null,2));
});
test('eligibility, quote funds, unknown types, stale competition and failure are atomic',()=>{
 const c=new PieceFixture(),t=save(c,draft());
 const denied=(operation,re)=>{const before=c.save();assert.throws(()=>c.transaction(req(c,operation)),re);assert.deepEqual(c.save(),before);};
 const op=adopt(c,t).operation;
 c.clock.units['G-013'].engaged='battle';denied(op,/IN_COMBAT/);c.clock.units['G-013'].engaged=null;
 c.clock.units['G-013'].march={};denied(op,/MOVING/);c.clock.units['G-013'].march=null;
 const row=c.econ.modern.net.GERMAN.rows['G-013'];c.econ.modern.net.GERMAN.rows['G-013']={};denied(op,/DISCONNECTED/);c.econ.modern.net.GERMAN.rows['G-013']=row;
 c.clock.pieces.nations.GERMAN.xp=0;denied(op,/XP_INSUFFICIENT/);c.clock.pieces.nations.GERMAN.xp=30;
 denied({...op,unit:'S-013'},/NOT_OWNED/);const d=draft();d.regiments[0][0]='MEDIUM_ARMOR';const unknown=save(c,d);denied(adopt(c,unknown).operation,/NOT_ENABLED/);
 c.clock.units['G-013'].org=37;c.clock.units['G-013'].trainingExperience=.22;
 const a=adopt(c,t),b=adopt(c,t);c.transaction(a);assert.equal(c.clock.units['G-013'].org,37);assert.equal(c.clock.units['G-013'].trainingExperience,.22);const unchanged=c.save();assert.throws(()=>c.transaction(b),/STALE_VERSION/);assert.deepEqual(c.save(),unchanged);denied(op,/UNIT_CHANGED/);denied({...op,expectedUnitRevision:c.clock.pieces.units['G-013'].revision},/ALREADY_ADOPTED/);
 const view=c.snapshot().divisions.pieceFixture;assert.equal(view.units.length,1);assert.equal(view.units[0].side,'GERMAN');assert(!JSON.stringify(view).includes('S-013'));
});
test('normal campaigns cannot import fixture saves or activate piece adoption; no fixture injection on normal start',()=>{
 const normal=new Campaign(),p=new PieceFixture(),before=normal.save();assert.equal(normal.clock.pieces,undefined);assert.throws(()=>normal.restore(p.save()),/PIECE_TEST_SAVE/);assert.deepEqual(normal.save(),before);assert.throws(()=>p.restore(before),/PIECE_TEST_SAVE_ONLY/);
 const t=save(normal,draft());assert.throws(()=>normal.transaction(adopt(normal,t)),/RULE_REVIEW_REQUIRED/);
 const malformed=p.save();malformed.clock.pieces.nations.GERMAN.stock.infantry_equipment++;assert.throws(()=>p.restore(malformed),/CONSERVATION/);
});
test('two wire clients compete on unit revision; only one pays; transport replay is stable',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'piece-wire-')),a=new ReleaseAdapter({CampaignClass:PieceFixture,saveFile:path.join(dir,'save.json')}),t=save(a.c,draft());
 const envelope=seat=>({instanceId:a.id,era:a.era,requestId:'piece-concurrent-'+seat,commandSeq:1,kind:'OPERATION',payload:adopt(a.c,t).operation,dependencies:{}}),ea=envelope('a'),eb=envelope('b');
 const [ra,rb]=await Promise.all([a.submit('a',ea),a.submit('b',eb)]);assert.equal(ra.status,'APPLIED');assert.equal(rb.status,'REJECTED');assert.equal(rb.reason,'PIECE_UNIT_CHANGED');assert.equal(a.c.clock.pieces.nations.GERMAN.xp,25);assert.deepEqual(await a.submit('a',ea),ra);
 const restarted=new ReleaseAdapter({CampaignClass:PieceFixture,saveFile:a.saveFile});assert.equal(restarted.c.clock.pieces.nations.GERMAN.xp,25);await assert.rejects(()=>restarted.submit('a',ea),/RESTORED_SESSION_REPLAN_REQUIRED/);
 await restarted.newGame({instanceId:restarted.id,revision:restarted.revision});assert.equal(restarted.c.save().format,'DIVISION-PIECES-TEST-1');assert.equal(restarted.c.clock.pieces.nations.GERMAN.xp,30);assert(fs.existsSync(a.saveFile+'.before-new'));
});
test('test refill budget is shared and independent personnel/support continue when rifles are empty',()=>{
 const c=new PieceFixture(),t=save(c,draft());c.transaction(adopt(c,t));const p=c.clock.pieces;
 const second=Object.values(c.state.units).find(u=>u.side==='GERMAN'&&u.id!=='G-013'&&(c.econ.modern.net.GERMAN.rows[u.id]?.routes?.length||c.econ.modern.net.GERMAN.rows[u.id]?.route));
 // Explicit extra fixture unit, never a normal-game operation or API.
 p.units[second.id]=structuredClone(p.units['G-013']);p.units[second.id].id=second.id;p.nations.GERMAN.stock.infantry_equipment=0;p.initial=totals(p);c.syncPieceUnits();
 const r=c.transaction(req(c,{type:'DIVISION_REFILL_TEST_STEP'}));assert.equal(r.sent.reduce((n,x)=>n+(x.personnel??0),0),250);assert.equal(r.sent.reduce((n,x)=>n+(x.equipment?.support_equipment??0),0),10);assert.equal(r.sent.reduce((n,x)=>n+(x.equipment?.infantry_equipment??0),0),0);assert.deepEqual(totals(c.clock.pieces),p.initial);
});
