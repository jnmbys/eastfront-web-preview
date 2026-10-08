import fs from 'node:fs';import {gunzipSync,gzipSync} from 'node:zlib';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {Campaign} from './authority.mjs';
const envelope=JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-002/mid-march.save.json.gz'))),saved=JSON.parse(envelope.payload),c=new Campaign();c.restore(saved.campaign);c.transport=saved.transport;
const rows=fs.readFileSync('evidence/grand-map-002/browser-sequence.jsonl','utf8').trim().split('\n').map(JSON.parse),load=rows.findLastIndex(r=>r.kind==='LOAD'&&r.status==='APPLIED');let capture=null;
for(const row of rows.slice(load+1)){
 if(row.kind==='OPERATION'&&row.status==='APPLIED')c.transaction({id:row.requestId,version:c.version,operation:row.payload});
 if(row.type==='step-end'&&row.changed){c.tick();assert.equal(c.clock.tick,row.tick);if(row.tick===32){capture=c.save();capture.clock.paused=true;}}
}
const final=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-002/browser-final.save.json.gz'))).payload).campaign;
assert.deepEqual(c.state,final.state);assert.deepEqual(c.econ,final.econ);assert.equal(c.clock.rng,final.clock.rng);
const payload=JSON.stringify({schema:saved.schema,campaign:capture,transport:saved.transport});const result={checksum:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),payload};
// Adapter canonical(string) is JSON.stringify, not the unquoted payload.
fs.writeFileSync('evidence/grand-map-002/observed-t32.save.json.gz',gzipSync(JSON.stringify(result)));
console.log(JSON.stringify({tick:c.clock.tick,equal:true,checkpoint:32,scope:'Existing browser commands replay; no new orders or battle outcomes'}));
