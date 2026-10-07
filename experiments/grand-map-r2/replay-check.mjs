import assert from 'node:assert/strict';
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {gunzipSync} from 'node:zlib';import {createHash} from 'node:crypto';
import {Campaign} from '../grand-map-r1/authority.mjs';
const reference=path.resolve(process.argv[2]??'../grand-map-001-r1-action-arrows');
const {Campaign:Original}=await import(pathToFileURL(path.join(reference,'experiments/grand-map-r1/authority.mjs')));
const saved=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-r1/battle-t10.save.json.gz')).toString()).payload).campaign;
const a=new Original(),b=new Campaign();a.restore(saved);b.restore(saved);
const rows=fs.readFileSync('evidence/grand-map-r1/browser-commands.jsonl','utf8').trim().split('\n').map(JSON.parse).slice(39,122);let steps=0,commands=0;
const start=performance.now();for(const row of rows){
 if(row.kind==='OPERATION'&&row.status==='APPLIED'){for(const c of[a,b])c.transaction({id:row.requestId,version:c.version,operation:row.payload});commands++;}
 if(row.type==='step-end'&&row.changed){a.tick();b.tick();steps++;assert.equal(b.clock.tick,row.tick);}
 assert.deepEqual(a.state,b.state);assert.deepEqual(a.econ,b.econ);assert.equal(a.clock.rng,b.clock.rng);assert.deepEqual(a.clock.engagements,b.clock.engagements);
}
const digest=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const result={baseline:'e4be8245d70a70031c0628c6be7c213ef04f6b56',source:'R1 browser log rows39..121 and T10 save, offline replay only',steps,commands,tick:b.clock.tick,state:digest(b.state),economy:digest(b.econ),rng:b.clock.rng,engagements:digest(b.clock.engagements),equal:true,elapsedMs:Math.round(performance.now()-start)};
fs.writeFileSync('evidence/grand-map-r2/replay-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
