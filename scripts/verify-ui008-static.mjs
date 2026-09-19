import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const port=Number(process.env.UI008_STATIC_PORT??4197),base=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['scripts/serve.mjs','dist'],{env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',d=>stdout+=d);child.stderr.on('data',d=>stderr+=d);
async function wait(){for(let i=0;i<80;i++){try{const r=await fetch(`${base}/`);if(r.ok)return;}catch{}await new Promise(r=>setTimeout(r,100));}throw new Error(`static server did not become ready: ${stderr}`);}
async function check(path){const r=await fetch(`${base}/${path}`);return {path,status:r.status,ok:r.ok,bytes:(await r.arrayBuffer()).byteLength};}
try{
 await wait();
 const manifest=JSON.parse(await readFile('dist/assets/terrain/p4r3/manifest.json','utf8'));const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))].sort();assert.equal(refs.length,123);
 const critical=['','styles.css','app/main.js','vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','assets/terrain/p4r3/manifest.json','assets/terrain/p4r3/city/small/S02.png'];
 const criticalResults=[];for(const p of critical)criticalResults.push(await check(p));
 const assetResults=[];for(let i=0;i<refs.length;i+=16){assetResults.push(...await Promise.all(refs.slice(i,i+16).map(r=>check(`assets/terrain/p4r3/${r}`))));}
 const failures=[...criticalResults,...assetResults].filter(x=>!x.ok);assert.equal(failures.length,0,JSON.stringify(failures.slice(0,10)));
 const result={result:'PASS',server:'pure static dist',basePath:'/',criticalResults,runtimeRasterRequests:assetResults.length,runtimeRasterHttp200:assetResults.filter(x=>x.status===200).length,missingAsset404:0,serverStdout:stdout.trim(),serverStderr:stderr.trim()};
 await mkdir('validation-logs',{recursive:true});await writeFile('validation-logs/ui008-static-http.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}finally{child.kill('SIGTERM');await new Promise(r=>setTimeout(r,100));if(!child.killed)child.kill('SIGKILL');}
