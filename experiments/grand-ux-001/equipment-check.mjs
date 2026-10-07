import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {Campaign,config} from './authority.mjs';import * as gear from './equipment.mjs';
export const tx=(c,action,operation)=>{c.viewer=c.owner();return c.transaction({id:crypto.randomUUID(),version:c.version,...(action?{action}:{operation})});};
export const until=(c,t,p)=>{for(let n=0;n<100;n++){if(c.state.turn===t&&c.state.phase===p)return;tx(c,{type:'READY_FOR_PHASE_END'});}throw Error('BOUND');};
const configure=(c,n,product)=>tx(c,null,{type:'PRODUCTION_LINE',warehouse:`GERMAN-industry-${n}`,product});
const results=[],check=(name,f)=>{f();results.push(name);console.log('PASS',name);};
const c=new Campaign();configure(c,1,'RIFLE');configure(c,2,'GUN');configure(c,3,'TRAIN');configure(c,4,'TRUCK');configure(c,5,'RIFLE');
check('real map003 T1→T4: two combat products + both vehicles continuously produced, typed delivery and original Core recovery',()=>{
 until(c,4,'GERMAN_RECOVERY');for(const k of ['RIFLE','GUN','TRAIN','TRUCK'])assert(c.econ.ledger.flatMap(l=>l.production).some(p=>p.type===k));
 assert(c.econ.shipments.some(s=>s.type==='RIFLE'&&s.unit==='G-059'));
 assert(c.recoveryReady('G-059'));tx(c,{type:'REPAIR_UNIT',unitId:'G-059'});assert.equal(c.state.units['G-059'].step,0);assert.equal(c.state.rp.GERMAN,0);assert.equal(c.econ.gear.units['G-059'].held.RIFLE,6);
 assert.throws(()=>tx(c,{type:'REPAIR_UNIT',unitId:'G-059'}));
});
check('all deployed and dormant Core types mapped; no E2 in new holdings; finite finances/capacities',()=>{
 for(const t of Object.values(c.rules.unitTemplates))assert(gear.recipes[t.type]);
 for(const g of Object.values(c.econ.gear.units))assert(!('E2'in g.held));
 for(const a of Object.values(c.econ.accounts)){assert.equal(a.I,a.initialI+a.incomeI-a.spentI);assert.equal(a.reserve+a.personnelCommitted,48);}
 for(const l of c.econ.ledger)for(const t of l.transport){assert(t.trainUsed<=t.trainCapacity);assert(t.truckUsed<=t.truckCapacity);assert(Object.values(t.edges).every(q=>q<=config.railEdgeQ));assert.equal(t.trainUsed,t.deliveries.reduce((n,d)=>n+(d.load??d.qty)*d.path.length,0));}
});
check('synthetic shortage changes real Core template stats; damage does not double penalize establishment',()=>{
 const g=c.econ.gear.units['G-001'],u=c.state.units['G-001'],before=structuredClone(c.rules.unitTemplates[u.templateId].steps[0]);g.held.RIFLE=3;gear.sync(c);assert.equal(c.rules.unitTemplates[u.templateId].steps[0].attack,before.attack/2);
 const previous=structuredClone(c.state);u.step=1;gear.recordLoss(c,previous);assert.equal(g.held.RIFLE,3);assert.equal(g.ratio,.75);g.held.RIFLE=4;gear.sync(c);assert.equal(g.ratio,1);
});
check('factory overassignment, same ID retry/conflict, stale version, switch preserves model-specific WIP',()=>{
 const x=new Campaign(),line=x.econ.ux.lines['GERMAN-industry-1'];const r={id:'line-repeat-0001',version:0,operation:{type:'PRODUCTION_LINE',warehouse:line.id,product:'TRAIN'}};
 const a=x.transaction(r);assert.deepEqual(x.transaction(r),a);assert.throws(()=>x.transaction({...r,operation:{...r.operation,product:'GUN'}}),/ID_REUSE/);
 assert.throws(()=>x.transaction({...r,id:'new-stale-request'}),/STALE/);
 assert.throws(()=>tx(x,null,{...r.operation,factories:[...line.factories,...line.factories]}),/FACTORY/);
 until(x,2,'GERMAN_SUPPLY_RAIL');configure(x,1,'GUN');until(x,3,'GERMAN_SUPPLY_RAIL');assert.equal(x.econ.ux.lines[line.id].progress.TRAIN,4);assert.equal(x.econ.ux.lines[line.id].progress.GUN,4);
 configure(x,1,'TRAIN');until(x,4,'GERMAN_SUPPLY_RAIL');assert.equal(x.econ.ux.lines[line.id].completed.TRAIN,1);
});
check('whole E failure preserves state/equipment/accounts/random/version; retry commits once',()=>{
 const x=new Campaign();configure(x,1,'RIFLE');until(x,1,'SOVIET_ENTRENCHMENT');const root=()=>JSON.stringify([x.state,x.econ,x.version]),before=root(),finish=x.finishEpoch.bind(x);x.finishEpoch=e=>{finish(e);throw Error('TEST_FAILURE');};assert.throws(()=>tx(x,{type:'READY_FOR_PHASE_END'}),/TEST_FAILURE/);assert.equal(root(),before);x.finishEpoch=finish;tx(x,{type:'READY_FOR_PHASE_END'});assert.equal(x.econ.epoch,1);
});
check('read-only views preserve authority; pool vehicles absent from unit lot custody',()=>{
 const before=JSON.stringify([c.state,c.econ,c.version]);c.snapshot();c.snapshot();assert.equal(JSON.stringify([c.state,c.econ,c.version]),before);
 const pool=new Set(Object.values(c.econ.ux.vehicles).flat().map(l=>l.id.replace('POOL:','')));for(const g of Object.values(c.econ.gear.units))for(const l of g.staged)assert(!pool.has(l.origin));
});
fs.mkdirSync('evidence/grand-ux-001',{recursive:true});fs.writeFileSync('evidence/grand-ux-001/equipment-checks.json',JSON.stringify({results,mapSha:'706113ecf7ffd3864d744de1b4f18fd775d5c22b',products:gear.products,recipes:gear.recipes,ledger:c.econ.ledger,uses:c.econ.uses},null,2));
