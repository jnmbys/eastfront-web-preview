// Read the recorded games; do not rerun or enlarge the sample.
import fs from 'node:fs';import assert from 'node:assert/strict';import {Campaign} from './authority.mjs';
const root=new URL('../../evidence/grand-play-001/',import.meta.url),balances=[];
for(const f of [1,2,3]){const {save:s}=JSON.parse(fs.readFileSync(new URL(`${f}-replay.json`,root)));
 for(const k of ['RIFLE','GUN','AT','TANK','HEAVY','TRUCK','TRAIN','KIT','SCOUT']){
  const initial=s.econ.gear.ledger.filter(l=>l.kind==='SCENARIO_INITIAL').reduce((n,l)=>n+(l.held[k]??0),0)+(k==='TRAIN'?8:k==='TRUCK'?16:0);
  const produced=s.econ.ledger.flatMap(e=>e.production).filter(l=>l.type===k).reduce((n,l)=>n+l.qty,0);
  const held=Object.values(s.econ.gear.units).concat(Object.values(s.archive.gear)).reduce((n,g)=>n+(g.held[k]??0),0);
  const staged=Object.values(s.econ.gear.units).flatMap(g=>g.staged).filter(l=>l.type===k).reduce((n,l)=>n+l.qty,0);
  const warehouse=Object.values(s.econ.warehouses).flatMap(w=>w.lots).filter(l=>l.type===k).reduce((n,l)=>n+l.qty,0);
  const pool=Object.values(s.econ.ux.vehicles).flat().filter(l=>l.type===k).reduce((n,l)=>n+l.qty,0);
  const lost=s.econ.gear.ledger.filter(l=>l.kind==='LOSS').reduce((n,l)=>n+(l.lost[k]??0),0);
  assert.equal(initial+produced,held+staged+warehouse+pool+lost,`${f}:${k}`);balances.push({game:f,type:k,initial,produced,held,staged,warehouse,pool,lost});
 }
 const reserve=Object.values(s.econ.accounts).reduce((n,a)=>n+a.reserve,0),staged=Object.values(s.econ.gear.units).flatMap(g=>g.staged).filter(l=>l.type==='P').reduce((n,l)=>n+l.qty,0),ware=Object.values(s.econ.warehouses).flatMap(w=>w.lots).filter(l=>l.type==='P').reduce((n,l)=>n+l.qty,0),paid=s.econ.uses.flatMap(u=>u.paid??[]).filter(l=>l.type==='P').reduce((n,l)=>n+l.qty,0);assert.equal(reserve+staged+ware+paid,96);balances.push({game:f,type:'P',initial:96,reserve,staged,ware,paid});
}
const c=new Campaign(),id='G-013',send=(operation,version=c.version)=>c.transaction({id:crypto.randomUUID(),version,operation});send({type:'CLOCK',paused:false,speed:4});c.clock.autopause=false;c.tick();send({type:'CLOCK',paused:true,speed:4},0);assert(c.clock.paused);
send({type:'DIRECT',unit:id,order:{kind:'HOLD',target:c.state.units[id].hex,risk:'LOW',paused:true}});send({type:'ORDER',group:'GERMAN:0',order:{kind:'ADVANCE',target:c.clock.goals[1].hex,risk:'HIGH',paused:false}});assert(c.ownOrder(id).paused);const accounts=structuredClone(c.econ.accounts);send({type:'ASSIGN',unit:id,group:'GERMAN:1'});assert.equal(c.clock.corps.filter(g=>g.members.includes(id)).length,1);assert.equal(c.clock.units[id].direct,null);assert.deepEqual(c.econ.accounts,accounts);
fs.writeFileSync(new URL('conservation-and-command-audit.json',root),JSON.stringify({passed:true,commandChecks:['stale pause succeeds','corps order preserves direct control','explicit assignment unique','no resource refund'],balances},null,2));console.log('Recorded inventories and command seams passed.');
