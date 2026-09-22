import {collectSamples} from '../mp005a/samples.mjs';
import {encodeSnapshot,decodeSnapshot,COMPACT_SNAPSHOT,FULL_SNAPSHOT} from '../../dist/app/multiplayer/snapshotCodec.js';
import {stats} from '../mp005a/audit.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {cpus} from 'node:os';
const samples=collectSamples().samples.filter(s=>s.label.endsWith('-deployment'));
const inputs=samples.map(s=>({...s,payload:{...s.message.payload,model:{...s.message.payload.model,playerView:s.message.payload.view,hexes:s.message.payload.view.hexes,edges:s.message.payload.view.edges}}}));
const run=(s,format)=>{
 const start=performance.now(),text=JSON.stringify({...s.message,payload:encodeSnapshot(s.payload,format)}),encoded=performance.now();
 const parsed=JSON.parse(text),parseEnd=performance.now(),decoded=decodeSnapshot(parsed.payload,true),end=performance.now();
 return {group:s.label+'-'+s.role,revision:decoded.matchRevision,format,bytes:Buffer.byteLength(text),packStringifyMs:encoded-start,parseMs:parseEnd-encoded,validateRebuildMs:end-parseEnd,totalClientMs:end-encoded};
};
for(let pass=0;pass<2;pass++)for(const s of inputs){run(s,FULL_SNAPSHOT);run(s,COMPACT_SNAPSHOT);}
const rows=[];for(const [i,s]of inputs.entries())for(const f of i%2?[FULL_SNAPSHOT,COMPACT_SNAPSHOT]:[COMPACT_SNAPSHOT,FULL_SNAPSHOT])rows.push(run(s,f));
const summary={};for(const row of rows){const key=row.group+':'+row.format;if(summary[key])continue;const group=rows.filter(r=>r.group===row.group&&r.format===row.format);summary[key]=Object.fromEntries(['bytes','packStringifyMs','parseMs','validateRebuildMs','totalClientMs'].map(k=>[k,stats(group.map(r=>r[k]))]));}
mkdirSync('evidence/mp-005b',{recursive:true});writeFileSync('evidence/mp-005b/local-codec.json',JSON.stringify({environment:{node:process.version,cpu:cpus()[0].model,transport:'none',rendering:'none',warmup:2},boundaries:['real production codec; new client forced-full vs compact','JSON bytes not WS frames','no network latency or browser application/paint measured'],summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
