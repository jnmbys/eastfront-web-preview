import assert from 'node:assert/strict';import crypto from 'node:crypto';import fs from 'node:fs';
import {Campaign} from './authority.mjs';import {policy} from './config.mjs';import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
export const h=p=>{const m=p.match(/([A-Z]+)(\d+)/);return core.paperToAxial(m[1],+m[2]);};
export const tx=(c,action,operation)=>{c.viewer=c.owner();const q={id:crypto.randomUUID(),version:c.version,...(action?{action}:{operation})},r=c.transaction(q);return {q,r};};
export function until(c,t,p,trace=[]){for(let n=0;n<100;n++){if(c.state.turn===t&&c.state.phase===p)return;trace.push(tx(c,{type:'READY_FOR_PHASE_END'}));}throw Error('BOUND');}
export function moveEast(c,id,trace){const u=c.state.units[id],queue=[[]],found=[];for(let i=0;i<queue.length&&i<100;i++){const path=queue[i],at=path.at(-1)??u.hex;for(const to of core.getNeighbors(at)){if(to.q<=at.q||!c.state.hexes[core.hexKey(to)])continue;const next=[...path,to],a={type:'MOVE',unitId:id,path:next,controllerId:u.side},r=c.match.authoritative.engine.apply(c.state,a);if(r.accepted){found.push(a);if(next.length<3)queue.push(next);}}}found.sort((a,b)=>b.path.at(-1).q-a.path.at(-1).q);if(found[0])trace.push(tx(c,{type:'MOVE',unitId:id,path:found[0].path}));}
export function captureChain(c,trace=[]){
 until(c,1,'GERMAN_MOVEMENT',trace);trace.push(tx(c,{type:'MOVE',unitId:'G-026',path:[h('Z17')]}));const city=c.econ.cities.items[1];assert.equal(city.owner,'GERMAN');assert.equal(city.districts[3].control,'GERMAN');assert.equal(city.districts[1].control,'SOVIET');assert.equal(city.districts[2].control,'SOVIET');assert(!c.serviceAllowed(c.econ.warehouses['SOVIET-depot-3'],'GERMAN'));
 const held=structuredClone(city);until(c,1,'SOVIET_MOVEMENT',trace);for(let i=25;i<=36;i++)moveEast(c,'S-'+String(i).padStart(3,'0'),trace);
 const route=['AA17','AB16','AC17'];let cursor=0;
 for(let turn=2;turn<=5&&cursor<route.length;turn++){
  until(c,turn,'GERMAN_MOVEMENT',trace);let best=[];for(let n=1;n<=route.length-cursor;n++){const path=route.slice(cursor,cursor+n).map(h),r=c.match.authoritative.engine.apply(c.state,{type:'MOVE',controllerId:'GERMAN',unitId:'G-026',path});if(r.accepted)best=path;}
  if(best.length){trace.push(tx(c,{type:'MOVE',unitId:'G-026',path:best}));cursor+=best.length;}
  if(cursor<route.length){until(c,turn,'SOVIET_MOVEMENT',trace);for(let i=25;i<=36;i++)moveEast(c,'S-'+String(i).padStart(3,'0'),trace);}
 }
 assert.equal(city.districts[1].control,'GERMAN');assert(!c.serviceAllowed(c.econ.warehouses['SOVIET-depot-3'],'GERMAN'),'capture does not magically regauge railroad');
 until(c,c.state.turn+1,'GERMAN_SUPPLY_RAIL',trace);const edges=Object.values(c.state.edges).filter(e=>e.railway?.present&&e.railway.repairedBy!=='GERMAN'&&c.state.hexes[core.hexKey(e.a)].control==='GERMAN'&&c.state.hexes[core.hexKey(e.b)].control==='GERMAN').map(e=>e.key);
 trace.push(tx(c,{type:'RAIL_REPAIR',edgeKeys:edges}));assert(c.serviceAllowed(c.econ.warehouses['SOVIET-depot-3'],'GERMAN'));return {held,edges};
}
if(process.argv[1]?.endsWith('check.mjs')){
 const results=[],evidence={},check=(name,f)=>{f();results.push(name);console.log('PASS',name);};
 const c=new Campaign(),trace=[];
 check('real campaign: explicit safe district transfer, guarded station stays enemy, lawful withdrawal/capture/rail repair enables service',()=>{evidence.capture=captureChain(c,trace);});
 check('real factory construction/production/distribution: single I charge, two E, unique facility and typed material',()=>{
  const x=new Campaign(),b=tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'}),id=b.r.facility;assert.equal(x.econ.accounts.GERMAN.I,6);assert.deepEqual(x.transaction(b.q),b.r);assert.equal(x.econ.accounts.GERMAN.I,6);
  tx(x,null,{type:'PRODUCTION_LINE',warehouse:'GERMAN-industry-3',product:'RIFLE'});until(x,2,'GERMAN_SUPPLY_RAIL');assert.equal(x.econ.ux.facilities[id].status,'BUILDING');assert.equal(x.econ.ux.facilities[id].progress,1);
  until(x,4,'GERMAN_RECOVERY');assert.equal(x.econ.ux.facilities[id].status,'BUILT');assert.equal(x.econ.ux.lines['GERMAN-industry-3'].factories.length,2);assert.equal(x.econ.ux.lines['GERMAN-industry-3'].completed.RIFLE,10);assert(x.econ.shipments.some(s=>s.type==='RIFLE'));tx(x,{type:'REPAIR_UNIT',unitId:'G-059'});assert.equal(x.state.units['G-059'].step,0);
  const late=JSON.stringify([x.state,x.econ,x.version]);assert.deepEqual(x.transaction(b.q),b.r);assert.equal(JSON.stringify([x.state,x.econ,x.version]),late);
  evidence.industry={facility:x.econ.ux.facilities[id],account:x.econ.accounts.GERMAN,line:x.econ.ux.lines['GERMAN-industry-3'],shipments:x.econ.shipments,uses:x.econ.uses,ledger:x.econ.ledger};
 });
 check('synthetic boundaries: overlap uniqueness, no repeated VP/income, slots, duplicate/conflict/stale, build rollback',()=>{
  const x=new Campaign(),all=x.econ.cities.items.flatMap(c=>c.districts.map(d=>d.hex));assert.equal(new Set(all).size,all.length);assert.equal(x.nodes.reduce((n,v)=>n+v.vp,0),74);
  const root=()=>JSON.stringify([x.state,x.econ,x.nodes,x.version]),before=root();x.beforePublish=()=>{throw Error('PRECOMMIT');};assert.throws(()=>tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'}),/PRECOMMIT/);assert.equal(root(),before);delete x.beforePublish;
  const r=tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'});assert.throws(()=>x.transaction({...r.q,id:'stale-build-request'}),/STALE/);assert.throws(()=>x.transaction({...r.q,operation:{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D1'}}),/ID_REUSE/);assert.throws(()=>tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D1'}),/SLOTS/);
 });
 check('synthetic occupation retains building/stock/WIP custody; repeated capture gives no income or factory',()=>{
  const x=new Campaign(),d=x.econ.cities.items[0].districts[2],w=x.econ.warehouses['GERMAN-industry-3'],l=x.econ.ux.lines[w.id];w.lots.push({id:'SYNTHETIC-STOCK',type:'RIFLE',qty:2,availableTurn:1});l.progress.TRAIN=4;
  const count=Object.keys(x.econ.ux.facilities).length,accounts=structuredClone(x.econ.accounts);x.state.hexes[d.hex].control='SOVIET';x.transferDistrict(d,'SOVIET');x.transferDistrict(d,'SOVIET');assert.equal(Object.keys(x.econ.ux.facilities).length,count);assert.deepEqual(x.econ.accounts,accounts);assert.equal(w.lots[0].qty,2);assert.equal(x.available(w,'RIFLE'),0);assert.equal(l.progress.TRAIN,0);assert.equal(l.seizedWork[0].progress.TRAIN,4);assert.equal(l.product,'IDLE');
 });
 check('synthetic fault after physical capture rolls back control, facilities, stock and Core together',()=>{
  const x=new Campaign();until(x,1,'GERMAN_MOVEMENT');const before=JSON.stringify([x.state,x.econ,x.version]),capture=x.capture.bind(x);x.capture=a=>{capture(a);throw Error('CAPTURE_PRECOMMIT');};assert.throws(()=>tx(x,{type:'MOVE',unitId:'G-026',path:[h('Z17')]}),/PRECOMMIT/);assert.equal(JSON.stringify([x.state,x.econ,x.version]),before);
 });
 check('synthetic fault after factory completion at E rolls back work, output, supply and construction together',()=>{
  const x=new Campaign();tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'});until(x,2,'SOVIET_ENTRENCHMENT');const before=JSON.stringify([x.state,x.econ,x.version]),finish=x.finishEpoch.bind(x);x.finishEpoch=e=>{finish(e);throw Error('E_PRECOMMIT');};assert.throws(()=>tx(x,{type:'READY_FOR_PHASE_END'}),/PRECOMMIT/);assert.equal(JSON.stringify([x.state,x.econ,x.version]),before);
 });
 check('synthetic blocked district/pending and hidden enemy details not exposed; query immutable',()=>{
  const x=new Campaign(),root=JSON.stringify([x.state,x.econ,x.version]);const v=x.snapshot();assert.equal(JSON.stringify([x.state,x.econ,x.version]),root);assert(!JSON.stringify(v.cities).includes('S-030'));assert.equal(v.cities.items[1].districts[1].facilities.length,0);
  x.state.pendingDecision={kind:'SYNTHETIC_CONFLICT'};assert(!x.canControl(x.econ.cities.items[0].main,'GERMAN'));assert.throws(()=>tx(x,null,{type:'BUILD_FACTORY',district:'CITY-WEST-WORKS:D2'}),/SERVICE_WINDOW/);
 });
 fs.writeFileSync('evidence/city-001/checks.json',JSON.stringify({results,evidence,trace,policy},null,2));console.log(results.length+' city checks passed');
}
