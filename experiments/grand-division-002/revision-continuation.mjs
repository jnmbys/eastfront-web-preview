// Continue the recorded normal campaign, never change units/resources/terrain.
import fs from 'node:fs';import zlib from 'node:zlib';import assert from 'node:assert/strict';
import {Campaign,eligibleModel} from './authority.mjs';
const dir='evidence/grand-division-002/revision/approved-chain',c=new Campaign(),id='G-013';
c.restore(JSON.parse(zlib.gunzipSync(fs.readFileSync(dir+'/battle-loss.json.gz'))),false);
const records=[],write=(label)=>{const row={label,tick:c.clock.tick,unit:structuredClone(c.clock.divisionLedger.units[id]),hex:structuredClone(c.state.units[id].hex),status:structuredClone(c.clock.units[id].refillStatus),reason:c.clock.units[id].reason,alive:c.state.units[id].alive};records.push(row);fs.writeFileSync(dir+'/continuation.json',JSON.stringify(records,null,2));fs.writeFileSync(dir+'/'+label+'.json.gz',zlib.gzipSync(JSON.stringify(c.save())));console.log(label,row.tick,row.hex,row.reason);};
const order=(label,target)=>c.transaction({id:'revision-'+label,version:c.version,operation:{type:'DIRECT',unit:id,order:{kind:'RETREAT',target,risk:'LOW',paused:false}}});
order('original-retreat',{q:21,r:4});for(let i=0;i<144&&!c.clock.ended;i++)c.tick();write('original-12h-refill-blocked');
// One explicit player correction to the known friendly headquarters, no seed search.
order('headquarters',{q:7,r:12});let ready=false,refilled=false;
for(let i=0;i<576&&!c.clock.ended&&c.state.units[id].alive;i++){
 c.tick();const r=c.clock.units[id].refillStatus;if(r.personnel||Object.values(r.items).some(Boolean))refilled=true;
 try{eligibleModel(c,id);if(refilled){ready=true;break;}}catch{}
}
write(ready?'connected-after-player-retreat':'headquarters-retreat-still-blocked');
if(ready){const p=c.clock.divisionLedger,req={id:'revision-return',version:c.version,operation:{type:'DIVISION_FORMAL_ADOPT',unit:id,expectedUnitRevision:p.units[id].revision,templateId:'GERMAN:initial-infantry',expectedTemplateVersion:1}},r=c.transaction(req),before=structuredClone(c.clock.divisionLedger);assert.deepEqual(c.transaction(req),r);assert.deepEqual(c.clock.divisionLedger,before);write('returned');}
const saved=c.save(),b=new Campaign();b.restore(saved);assert.deepEqual(b.clock.divisionLedger,c.clock.divisionLedger);assert.ok(b.clock.paused);write('restart-verified');
