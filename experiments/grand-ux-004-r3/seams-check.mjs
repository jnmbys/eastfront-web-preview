import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {diff,patch} from '../grand-play-mp022/sync.mjs';
import {ReleaseAdapter,readSave} from '../grand-release-001/persistence.mjs';
const checks=[],ok=s=>checks.push(s),copy=structuredClone;
let current={a:{units:[{id:'a',org:1},{id:'b',org:2}],terrain:{x:1}},gone:{x:1}};
for(let i=0;i<200;i++){const before=copy(current),next=copy(current);next.a.units[i%2].org=i;if(i%2)next.extra={i};else delete next.extra;const changed=patch(current,diff(current,next,[],{set:[],remove:[]},true));assert.deepEqual(changed,next);assert.deepEqual(current,before);assert.equal(changed.a.terrain,current.a.terrain);current=changed;}
assert.throws(()=>patch(current,{set:[{path:['__proto__','polluted'],value:1}],remove:[]}),/UNSAFE/);assert.throws(()=>patch(current,{set:[{path:['missing','x'],value:1}],remove:[]}),/BASE_MISSING/);ok('Ordered copy-on-write deltas equal full states and preserve prior version; unsafe/missing bases rejected');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grand-r3-')),file=path.join(dir,'campaign.json'),a=new ReleaseAdapter({saveFile:file});
const envelope={instanceId:a.id,era:a.era,requestId:'r3-durable-clock-001',commandSeq:1,kind:'OPERATION',payload:{type:'AUTOPAUSE',enabled:false},dependencies:{worldGeneration:0}};
const r=await a.submit('a',envelope);assert.equal(r.status,'APPLIED');assert.equal(readSave(file).transport.next.a,2);assert(readSave(file).campaign.receipts);const saved=fs.readFileSync(file,'utf8');assert.deepEqual(await a.submit('a',envelope),r);assert.equal(a.c.transport.next.a,2);assert.equal(fs.readFileSync(file,'utf8'),saved);ok('Accepted command is durable before response; exact duplicate does not save or execute twice');
await a.exclusive(()=>a.saveFileNow());assert.equal(readSave(file+'.bak').campaign.clock.tick,a.c.clock.tick);const b=new ReleaseAdapter({saveFile:file});assert(b.c.clock.paused);assert.deepEqual(b.c.econ.modern.stock,a.c.econ.modern.stock);assert.equal(b.c.transport.next.a,2);await assert.rejects(()=>b.submit('a',envelope),/RESTORED_SESSION/);ok('Durable backup/restart preserve stock and request sequence, pause world and reject old era');
fs.writeFileSync(file,'corrupt');await assert.rejects(()=>a.exclusive(()=>a.saveFileNow()));assert(a.c.clock.paused);assert.equal(a.persistence.state,'failed');assert(readSave(file+'.bak'));ok('Corrupt current checkpoint is not rotated over valid backup; failure pauses and reports failed');
fs.writeFileSync('evidence/grand-ux-004-r3/seams-checks.json',JSON.stringify({scope:'targeted offline persistence/delta tests',checks},null,2));console.log(checks);
