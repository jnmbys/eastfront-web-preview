import assert from 'node:assert/strict';import fs from 'node:fs';import {Campaign} from '../city-001/authority.mjs';import {tx,until} from '../city-001/check.mjs';import * as assets from './assets.mjs';
const evidence=[],test=(name,fn)=>{fn();evidence.push({name,passed:true,kind:'synthetic boundary using real authoritative transactions'});console.log('PASS',name);};
const flip=(c,d,side)=>{c.state.hexes[d.hex].control=side;c.transferDistrict(d,side);};
test('inventory provenance, future availability, multiple flips, existing quarantine and expiry',()=>{
 const c=new Campaign(),d=c.econ.cities.items[0].districts[2],w=c.econ.warehouses['GERMAN-industry-3'];w.lots.push({id:'SYNTHETIC:FUTURE',type:'RIFLE',qty:3,availableTurn:4},{id:'SYNTHETIC:QUARANTINED',type:'P',qty:1,availableTurn:Number.MAX_SAFE_INTEGER},{id:'SYNTHETIC:EXPIRING',type:'P',qty:1,availableTurn:1,expiresAfterEpoch:1});const account=structuredClone(c.econ.accounts);
 for(let i=0;i<3;i++){flip(c,d,'SOVIET');assert.equal(c.available(w,'RIFLE'),0);assert(w.lots.every(l=>l.asset.owner==='GERMAN'));flip(c,d,'GERMAN');assert.equal(w.lots[0].availableTurn,4);assert.equal(c.available(w,'RIFLE'),0);}
 assert.deepEqual(c.econ.accounts,account);assert.equal(w.lots[1].availableTurn,Number.MAX_SAFE_INTEGER);c.econ.epoch=1;flip(c,d,'SOVIET');flip(c,d,'GERMAN');assert(w.lots[2].asset.reasons.includes('PERSONNEL_EXPIRED'));assert.equal(c.available(w,'P'),0);assert.equal(w.lots.reduce((n,l)=>n+l.qty,0),5);
});
test('building paid once, lost E supplies no progress, recapture resumes at subsequent legal E',()=>{
 const c=new Campaign(),id=tx(c,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'}).r.facility,d=c.econ.cities.items[0].districts[2];until(c,2,'GERMAN_SUPPLY_RAIL');assert.equal(c.econ.ux.facilities[id].progress,1);
 flip(c,d,'SOVIET');until(c,3,'GERMAN_SUPPLY_RAIL');assert.equal(c.econ.ux.facilities[id].progress,1);assert.equal(c.econ.ux.facilities[id].status,'SEIZED_CONSTRUCTION');flip(c,d,'GERMAN');assert.equal(c.econ.ux.facilities[id].status,'BUILDING');until(c,4,'GERMAN_SUPPLY_RAIL');assert.equal(c.econ.ux.facilities[id].status,'BUILT');assert.equal(c.econ.ux.facilities[id].progress,2);assert.equal(c.econ.cities.constructionSpentI.GERMAN,6);
});
test('WIP product/amount restored once; competing line leaves original WIP awaiting allocation',()=>{
 const c=new Campaign(),d=c.econ.cities.items[0].districts[2],warehouse='GERMAN-industry-3';tx(c,null,{type:'PRODUCTION_LINE',warehouse,product:'HEAVY'});const l=c.econ.ux.lines[warehouse];until(c,2,'GERMAN_SUPPLY_RAIL');assert.equal(l.progress.HEAVY,4);flip(c,d,'SOVIET');flip(c,d,'GERMAN');assert.equal(l.progress.HEAVY,4);assert.equal(l.product,'HEAVY');flip(c,d,'SOVIET');flip(c,d,'GERMAN');assert.equal(l.progress.HEAVY,4);until(c,3,'GERMAN_SUPPLY_RAIL');assert.equal(l.progress.HEAVY,8);assert.equal(l.completed.HEAVY,0);
 flip(c,d,'SOVIET');const other=Object.values(c.econ.ux.lines).find(x=>x.id!==l.id);other.factories.push('FACTORY:GERMAN-industry-3:1');flip(c,d,'GERMAN');assert.equal(l.product,'IDLE');assert.equal(l.progress.HEAVY,0);assert(l.seizedWork.some(w=>w.status==='WAITING_ALLOCATION'&&!w.restored));other.factories=other.factories.filter(id=>id!=='FACTORY:GERMAN-industry-3:1');assets.restoreWork(c,l,'GERMAN');assert.equal(l.progress.HEAVY,8);assets.restoreWork(c,l,'GERMAN');assert.equal(l.progress.HEAVY,8);
});
test('occupation does not waive ordinary personnel care; unpaid remains quarantined on recapture',()=>{
 const c=new Campaign(),d=c.econ.cities.items[0].districts[2],w=c.econ.warehouses['GERMAN-industry-3'];w.lots.push({id:'SYNTHETIC:CARE',type:'P',qty:1,availableTurn:1});flip(c,d,'SOVIET');c.econ.accounts.GERMAN.I=0;assets.afterEpoch(c);flip(c,d,'GERMAN');assert(w.lots[0].asset.reasons.includes('PERSONNEL_CARE_UNPAID'));assert.equal(c.available(w,'P'),0);
});
test('snapshot does not mutate authority, provenance never exposes hidden enemy work',()=>{
 const c=new Campaign();assets.remember(c);const before=JSON.stringify([c.state,c.econ,c.version,c.receipts]);c.snapshot();assert.equal(JSON.stringify([c.state,c.econ,c.version,c.receipts]),before);assert(!JSON.stringify(c.snapshot().cities).includes('S-030'));assert(c.snapshot().ux.lines.every(l=>l.completed&&typeof l.completed.HEAVY==='number'));
});
fs.writeFileSync('evidence/city-001-r1/asset-tests.json',JSON.stringify(evidence,null,2));
