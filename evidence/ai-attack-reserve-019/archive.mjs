import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-attack-reserve-019',blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
if(process.argv[2]==='--extract'){
 const index=JSON.parse(readFileSync(out+'/archive-index.json')),bytes=readFileSync(out+'/full-records.json.gz');assert.equal(hash(bytes),index.sha256);const entries=JSON.parse(gunzipSync(bytes));assert.equal(entries.length,index.files.length);
 for(const e of entries){assert(e.path.startsWith(out+'/')&&!e.path.includes('..'));const dest=resolve(e.path);assert(dest.startsWith(resolve(out)+'/')||dest.startsWith(resolve(out)+'\\'));const b=Buffer.from(e.content),meta=index.files.find(f=>f.path===e.path);assert(meta);assert.equal(hash(b),meta.sha256);assert.equal(blob(b),meta.gitBlobSha);if(existsSync(dest))assert.equal(hash(readFileSync(dest)),meta.sha256);else{mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,b);}}
 console.log(`PASS: ${entries.length} complete records verified/extracted without overwrite.`);
}else{
 const walk=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(p+'/'+e.name):[p+'/'+e.name]);const paths=[...walk(out+'/batch'),...['1017-019','1018-019'].map(n=>`${out}/${n}-audit.json`)].sort();
 const entries=paths.map(path=>({path,content:readFileSync(path,'utf8')})),bytes=gzipSync(Buffer.from(JSON.stringify(entries)),{level:9});assert.deepEqual(JSON.parse(gunzipSync(bytes)),entries);writeFileSync(out+'/full-records.json.gz',bytes);
 atomic(out+'/archive-index.json',{format:'gzip UTF-8 JSON [{path,content}], lossless original bytes',sha256:hash(bytes),bytes:bytes.length,files:entries.map(e=>{const b=Buffer.from(e.content);return {path:e.path,bytes:b.length,sha256:hash(b),gitBlobSha:blob(b)};})});
 const exclude='.git/info/exclude',old=readFileSync(exclude,'utf8');writeFileSync(exclude,old+'\n# AI-ATTACK-RESERVE-019 raw copies stored losslessly in tracked full-records.json.gz\n'+paths.map(p=>'/'+p).join('\n')+'\n');console.log(JSON.stringify({records:entries.length,compressedBytes:bytes.length,rawBytes:entries.reduce((n,e)=>n+Buffer.byteLength(e.content),0)}));
}
