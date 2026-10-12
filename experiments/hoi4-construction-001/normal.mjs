import fs from 'node:fs';import assert from 'node:assert/strict';import {Campaign} from './authority.mjs';import {validate} from '../grand-division-002/inventory.mjs';
const c=new Campaign(),m=c.snapshot().modern,rail=m.rails.find(r=>(m.network.edges[r.id]??0)>0)??m.rails[0],before=c.econ.modern.rails[rail.id].level;
c.transaction({id:'normal-rail-upgrade-001',version:c.version,operation:{type:'ECON_BUILD',kind:'RAIL',target:rail.id}});const q=c.econ.modern.queue.at(-1),events=[];
for(let i=0;i<288&&q.status!=='DONE';i++){c.advance();validate(c.clock.divisionLedger);if(c.clock.tick%24===0||q.status==='DONE')events.push({tick:c.clock.tick,progress:q.progress,status:q.status,assigned:q.assigned,rate:q.rate});}
assert.equal(q.status,'DONE');assert.equal(c.econ.modern.rails[rail.id].level,before+1);assert(q.progress<=q.cost+1e-8);
const result={seed:219031,normalStart:true,noInjectedResources:true,rail:rail.id,kind:q.kind,cost:q.cost,completedTick:c.clock.tick,events,capacityBefore:c.econ.modern.balanceConfig.railFlow*before,capacityAfter:c.econ.modern.balanceConfig.railFlow*(before+1),note:'physical rail capacity increased; other bottlenecks may still limit actual shipment'};
fs.writeFileSync('evidence/hoi4-construction-001/normal.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
