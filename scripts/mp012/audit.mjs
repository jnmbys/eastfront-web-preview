import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {get} from 'node:http';
import {verifyArtifacts} from '../mp010/integrity.mjs';
const base='0ca8d312c0e74f58a37121b6207c78aae546ffa1',hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=verifyArtifacts(),frozen=JSON.parse(readFileSync('evidence/mp-009-r1/frozen-audit.json'));
const checked=new Map(),differences=[];
for(const r of frozen.rows){if(!checked.has(r.path))checked.set(r.path,hash(readFileSync(r.path)));if(checked.get(r.path)!==r.candidate)differences.push({path:r.path,expected:r.candidate,actual:checked.get(r.path)});}
const manifests=frozen.manifests.map(m=>({path:m.manifest,expected:m.sha256,actual:hash(readFileSync(m.manifest))}));
const paths=['src','server','vendor','scripts/mp010','scripts/mp011','scripts/mp011-r1','evidence/mp-009','evidence/mp-009-r1','evidence/mp-010','evidence/mp-010-r1','evidence/mp-011','evidence/mp-011-r1','tests/fixtures','package.json','package-lock.json'];
const changed=execFileSync('git',['diff','--name-only',base,'--',...paths],{encoding:'utf8'}).trim();
const result={base,protectedPaths:paths,protectedChanged:changed,frozenEntries:frozen.rows.length,uniqueFiles:checked.size,newDifferences:differences,manifests,retainedRedTests:['UA002','UA003','UA003R1'],fullSuiteRerun:false,versions:manifest.versions,treeHashes:Object.fromEntries(Object.entries(manifest.builds).map(([k,v])=>[k,v.treeSha256])),pass:!changed&&!differences.length&&manifests.every(m=>m.expected===m.actual)};
mkdirSync('evidence/mp-012',{recursive:true});
writeFileSync('evidence/mp-012/scope-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,frozenEntries:result.frozenEntries,newDifferences:differences.length}));
if(!result.pass)process.exitCode=1;
if(process.argv.includes('--http')){
  const rows=[];
  for(const [label,build] of Object.entries(manifest.builds)){
    const failures=[];let verified=0,bytes=0;
    for(const [path,expected] of Object.entries(build.hashes)){
      const {response,body}=await new Promise((resolve,reject)=>get(`http://127.0.0.1:4190/v/${label}/move/real/${path}`,response=>{const chunks=[];response.on('data',d=>chunks.push(d));response.on('end',()=>resolve({response,body:Buffer.concat(chunks)}));response.on('error',reject);}).on('error',reject));
      bytes+=body.length;
      const transformed=path==='index.html',match=transformed?body.toString().includes('src="/mp012/entry.mjs"'):path==='multiplayer-config.json'?JSON.parse(body).serverUrl==='ws://127.0.0.1:4190/ws/move/real':hash(body)===expected;
      const mime=response.headers['content-type']??'';
      const mimeValid=!/\.(m?js|json|html)$/.test(path)||(/\.m?js$/.test(path)?mime.includes('javascript'):/\.json$/.test(path)?mime.includes('json'):mime.includes('html'));
      if(response.statusCode!==200||response.headers['cache-control']!=='no-store'||!match||!mimeValid)failures.push({path,status:response.statusCode,match,mime,mimeValid});else verified++;
    }
    rows.push({label,sourceSha:build.sourceSha,verified,bytes,failures,exceptions:['index.html diagnostic entry','multiplayer-config.json original gateway dynamic local address']});
  }
  writeFileSync('evidence/mp-012/local-http-audit.json',JSON.stringify({scenario:'local loopback, no injected faults; not field evidence',rows},null,2)+'\n');
  console.log(JSON.stringify(rows));if(rows.some(r=>r.failures.length))process.exitCode=1;
}
