import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.RELEASE_SOURCE_SHA&&process.env.RELEASE_SOURCE_SHA!==source)throw Error('RELEASE_SOURCE_SHA_MISMATCH');
await import('../grand-release-001/build.mjs');
const root='.release-territory-preview',index=path.join(root,'index.html');
await (await import('./bundle-client.mjs')).bundleClient(root);
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('<head>','<head><meta name="grand-campaign-menu" content="release002">'));
const file=path.join(root,'release-build.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8')),files={};
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(dir,e.name);if(e.isDirectory())scan(f);else if(f!==file)files[path.relative(root,f).replaceAll('\\','/')]=createHash('sha256').update(fs.readFileSync(f)).digest('hex');}}
scan(root);
Object.assign(manifest,{release:'GRAND-RELEASE-002',rules:['GRAND-TERRITORY-1','GRAND-DIVISION-2-INTEGRATED-2','GRAND-DIVISION-2-INTEGRATED-3'],save:'Separate authority envelopes; legacy root / division-002',assetsSHA256:createHash('sha256').update(JSON.stringify(files)).digest('hex'),fileCount:Object.keys(files).length,totalBytes:Object.keys(files).reduce((n,f)=>n+fs.statSync(path.join(root,f)).size,0)});
fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
