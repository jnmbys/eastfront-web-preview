import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const run=promisify(execFile),root=new URL('./',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
const base='https://art-map-preview-016.eastfront-web-preview.pages.dev/';
const expected=await readFile(new URL('../../../release/ART-PREVIEW-016/manifest.json',root));
const received=await readFile(new URL('manifest-http-body.txt',root));
if(hash(expected)!==hash(received))throw Error('manifest hash mismatch');
const manifest=JSON.parse(expected),results=[{path:'manifest.json',status:200,bytes:received.length,sha256:hash(received),match:true}];
let forbidden=false,next=0;
const entries=manifest.entries.filter(e=>e.path!=='_headers');
async function worker(){while(!forbidden&&next<entries.length){const e=entries[next++],path=e.path.replaceAll('\\','/');try{const r=await run('curl.exe',['--max-time','20','--location','--max-redirs','2','--silent','--show-error','--write-out','\n%{http_code}',base+path],{encoding:'buffer',maxBuffer:8*1024*1024});const b=r.stdout.subarray(0,-4),status=Number(r.stdout.subarray(-3).toString());if(status===403)forbidden=true;results.push({path,status,bytes:b.length,sha256:hash(b),expectedSHA256:e.sha256,match:status===200&&b.length===e.bytes&&hash(b)===e.sha256});}catch(error){results.push({path,status:'NETWORK_ERROR',message:error.message});}}}
await Promise.all(Array.from({length:6},worker));
const report={time:new Date().toISOString(),base,publicationCommit:'86241e5d24ed9457f54891056b90abe9772b25f3',status:results.length===77&&results.every(e=>e.match)?'PASS':'PARTIAL_OR_FAILED',matched:results.filter(e=>e.match).length,expectedPublicResources:77,excluded:{path:'_headers',reason:'Cloudflare configuration file, verified in Git; not an ordinary public asset'},forbiddenStopped:forbidden,noRetries:true,results:results.sort((a,b)=>a.path.localeCompare(b.path))};
await writeFile(new URL('http-hashes.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,matched:report.matched,expectedPublicResources:77,forbiddenStopped:forbidden,failures:results.filter(e=>!e.match)}));
