// No dependency installation or renderer rebuild: verify the pinned 015 compiled closure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const here=import.meta.dirname,root=path.resolve(here,'../..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const provenance=JSON.parse(fs.readFileSync(path.join(here,'map-provenance.json')));
for(const e of provenance.entries){const b=fs.readFileSync(path.join(here,'map',e.path));assert.equal(b.length,e.bytes,e.path);assert.equal(hash(b),e.sha256,e.path);}
const names=['index.html','candidate.css','shell.mjs','chain-view.mjs','map-controller.mjs','map-data.json'];
function walk(folder){for(const e of fs.readdirSync(path.join(here,folder),{withFileTypes:true})){const n=folder+'/'+e.name;if(e.isDirectory())walk(n);else if(/\.(js|json|webp|svg)$/.test(n))names.push(n);}}
walk('map');walk('icons');
const entries=names.sort().map(n=>{const b=fs.readFileSync(path.join(here,n));return {path:n,bytes:b.length,sha256:hash(b)};});
for(const n of names.filter(n=>/\.(mjs|js)$/.test(n))){
 const s=fs.readFileSync(path.join(here,n),'utf8');
 for(const m of s.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){
  const ref=m[1],file=ref.startsWith('/')?path.join(here,'../industry-ui-001',ref):path.resolve(here,path.dirname(n),ref);
  assert(ref.startsWith('.')||ref.startsWith('/'),'Nonlocal import '+ref);assert(fs.existsSync(file),'Missing import '+file);
 }
}
for(const n of ['shell.mjs','chain-view.mjs','map-controller.mjs'])execFileSync(process.execPath,['--check',path.join(here,n)]);
const html=fs.readFileSync(path.join(here,'index.html'),'utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate DOM ids');
for(const id of ['allocate','order','activate','apply','care','recover','next','message','retry','check','forget'])assert(ids.includes(id));
const data=JSON.parse(fs.readFileSync(path.join(here,'map-data.json')));assert.equal(data.hexes.length,640);assert.equal(data.edges.length,257);assert.equal(data.counters.length,0);
const report={task:'ART-UI-022',method:'Direct ES modules and precompiled, byte-identical 015 renderer; no transpilation required for candidate UI.',functionalBase:'75183910f524c87d9a6db3fafee27f3a2e189691',rendererBase:provenance.commit,files:entries.length,bytes:entries.reduce((s,e)=>s+e.bytes,0),atlasBytes:entries.filter(e=>e.path.endsWith('.webp')).reduce((s,e)=>s+e.bytes,0),newIconBytes:entries.filter(e=>e.path.startsWith('icons/')).reduce((s,e)=>s+e.bytes,0),unchangedRendererFiles:provenance.entries.length,entries,sharedOriginalRoutes:['/candidate/chain-client.mjs → unchanged industry-ui-001/chain-client.mjs','/chain-view.mjs','/chain-nav.mjs'],excludes:'Original UI/history modes and backend runtime are reused; evidence and TypeScript source copies are not served.'};
const out=path.join(root,'evidence/ART-UI-022');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'BUILD.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',files:report.files,bytes:report.bytes,atlasBytes:report.atlasBytes,newIconBytes:report.newIconBytes,unchangedRendererFiles:report.unchangedRendererFiles}));
