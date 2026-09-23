import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {collectSamples} from '../mp005a/samples.mjs';
import {encodeSnapshot,decodeSnapshot,COMPACT_SNAPSHOT,MAP_SNAPSHOT} from '../../dist/app/multiplayer/snapshotCodec.js';
import {encodeMapTable,decodeMapTable} from '../../dist/app/multiplayer/mapEncoding.js';
const samples=collectSamples().samples;
function run(s,candidate){
 const p=s.message.payload,canonical={...p,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}};
 const start=performance.now();const payload=encodeSnapshot(canonical,candidate?MAP_SNAPSHOT:COMPACT_SNAPSHOT);
 const encoded=performance.now(),text=JSON.stringify({...s.message,payload}),serialized=performance.now();
 const parsed=JSON.parse(text),parsedAt=performance.now(),timing={validationMs:0,rebuildMs:0};
 const decoded=decodeSnapshot(parsed.payload,true,true,timing),end=performance.now();
 assert.deepEqual(decoded,p);assert.notEqual(decoded.model.hexes,decoded.view.hexes);
 return {label:s.label,role:s.role,revision:p.revision,resync:p.resync,format:payload.format,bytes:Buffer.byteLength(text),mapBytes:Buffer.byteLength(JSON.stringify(payload.view.hexes))+Buffer.byteLength(JSON.stringify(payload.view.edges)),encodeMs:encoded-start,serializeMs:serialized-encoded,parseMs:parsedAt-serialized,mapRebuildMs:timing.rebuildMs,validateRebuildMs:timing.validationMs,clientMs:end-serialized};
}
for(let i=0;i<3;i++)for(const s of samples){run(s,false);run(s,true);}
const rows=[];for(let pass=0;pass<5;pass++)for(const [i,s] of samples.entries())for(const c of (i+pass)%2?[true,false]:[false,true])rows.push(run(s,c));
const summary={};for(const f of [COMPACT_SNAPSHOT,'snapshot-v3-map-table']){const a=rows.filter(r=>r.format===f);summary[f]={count:a.length};for(const key of ['bytes','mapBytes','encodeMs','serializeMs','parseMs','mapRebuildMs','validateRebuildMs','clientMs']){const ns=a.map(r=>r[key]).sort((a,b)=>a-b);summary[f][key]={median:ns[Math.floor(ns.length/2)],p95:ns[Math.floor(ns.length*.95)],max:ns.at(-1)};}}
writeFileSync('evidence/mp-006/production-codec.json',JSON.stringify({environment:{node:process.version,cpu:cpus()[0].model,warmup:3,passes:5},samples:samples.length,boundaries:['Local Node CPU only; no network, browser, apply or paint','Complete UTF-8 JSON messages, not wire bytes','Resync retains existing v1'],summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
