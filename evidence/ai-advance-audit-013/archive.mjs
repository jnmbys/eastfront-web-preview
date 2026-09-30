// Lossless packaging of this audit's derived records, never original match files.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=resolve('evidence/ai-advance-audit-013');
const files=['baseline-timeline.ndjson','candidate-timeline.ndjson','baseline-phase-ends.json','candidate-phase-ends.json'];
for(const [v,ns] of Object.entries({baseline:[156,161,181,189,198,200,224,225],candidate:[156,161,190,199,219,220]}))for(const n of ns)for(const kind of ['input','state'])files.push(`nodes/${v}-n${n}-${kind}.json`);
const sha=b=>createHash('sha256').update(b).digest('hex');
const path=f=>{assert(files.includes(f));const p=resolve(root,f);assert(p.startsWith(root+'\\')||p.startsWith(root+'/'));return p;};
const archive=resolve(root,'full-records.json.gz'),manifestPath=resolve(root,'archive-manifest.json');
if(process.argv.includes('--extract')){
 const zipped=readFileSync(archive),manifest=JSON.parse(readFileSync(manifestPath));assert.equal(sha(zipped),manifest.archiveSha256);
 const entries=JSON.parse(gunzipSync(zipped));assert.deepEqual(entries.map(e=>e.path),files);
 for(const entry of entries){const b=Buffer.from(entry.content,'utf8'),m=manifest.files.find(m=>m.path===entry.path);assert.equal(b.length,m.bytes);assert.equal(sha(b),m.sha256);mkdirSync(dirname(path(entry.path)),{recursive:true});writeFileSync(path(entry.path),b);}
 console.log('PASS: extracted '+entries.length+' exact derived records inside audit directory');
}else{
 const entries=files.map(f=>({path:f,content:readFileSync(path(f),'utf8')})),raw=Buffer.from(JSON.stringify(entries)),zipped=gzipSync(raw,{level:9});assert.deepEqual(gunzipSync(zipped),raw);
 const manifest={format:'gzip of UTF-8 JSON array [{path,content}]; exact original file text',archiveSha256:sha(zipped),archiveBytes:zipped.length,files:entries.map(e=>({path:e.path,bytes:Buffer.byteLength(e.content),sha256:sha(e.content)}))};
 writeFileSync(archive,zipped);writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');
 console.log('PASS: packed '+entries.length+' derived records; '+zipped.length+' bytes; lossless roundtrip verified');
}
