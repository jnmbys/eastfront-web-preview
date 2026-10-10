import fs from 'node:fs';import z from 'node:zlib';import assert from 'node:assert/strict';
import {Campaign} from './authority.mjs';import {validate,totals} from '../grand-division-002/inventory.mjs';import {validateFuel} from './fuel.mjs';
const c=new Campaign(),file='evidence/grand-division-003/defended/tank-and-fuel-delivered.json.gz';c.restore(JSON.parse(z.gunzipSync(fs.readFileSync(file))),false);
const id='G-017',before={tick:c.clock.tick,hex:structuredClone(c.state.units[id].hex),unit:structuredClone(c.clock.divisionLedger.units[id]),fuel:c.clock.divisionLedger.fuel.units[id]},to={q:6,r:7};
assert(before.unit.held.leichttraktor_lt0>0);assert(before.fuel>0);
c.transaction({id:'final-checkpoint-move',version:c.version,operation:{type:'DIRECT',unit:id,order:{kind:'ADVANCE',target:to,risk:'LOW',paused:false}}});
for(let i=0;i<288&&!c.clock.ended&&c.state.units[id].alive;i++){c.advance();if(JSON.stringify(c.state.units[id].hex)===JSON.stringify(to))break;}
validate(c.clock.divisionLedger);validateFuel(c);const saved=c.save(),r=new Campaign();r.restore(saved);assert.deepEqual(totals(r.clock.divisionLedger),totals(c.clock.divisionLedger));
const result={kind:'final-code continuation of genuine produced/delivered checkpoint, no injection; not a fresh final-code full campaign',input:file,before,after:{tick:c.clock.tick,hex:c.state.units[id].hex,unit:c.clock.divisionLedger.units[id],fuel:c.clock.divisionLedger.fuel.units[id],reason:c.clock.units[id].reason},arrived:JSON.stringify(c.state.units[id].hex)===JSON.stringify(to),savedRestarted:true};
fs.writeFileSync('evidence/grand-division-003/final-checkpoint.json',JSON.stringify(result,null,2));fs.writeFileSync('evidence/grand-division-003/final-checkpoint.json.gz',z.gzipSync(JSON.stringify(saved)));console.log(JSON.stringify(result));
