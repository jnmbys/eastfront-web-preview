import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createSlice,label} from './dist/app/experiments/mapData.js';
import {hexToPixel} from './dist/app/geometry/hex.js';
import {viewBoxForHexes} from './dist/app/render/coreSvg.js';
import {previewViews,previewViewport} from './dist/app/experiments/preview016Views.js';

const baseline='35e36314b61e157be016040d91d9d05eeaf39f5a',out=new URL('./dist/',import.meta.url),evidence=new URL('../../evidence/ART-PREVIEW-016/',import.meta.url),tests=[];
const hash=b=>createHash('sha256').update(b).digest('hex');
const old=JSON.parse(await readFile(new URL('../../evidence/ART-MAP-015/runtime-manifest.json',import.meta.url))),manifest=JSON.parse(await readFile(new URL('manifest.json',out))),files=[];
async function walk(url,prefix=''){for(const e of await readdir(url,{withFileTypes:true})){const p=prefix+e.name;if(e.isDirectory())await walk(new URL(e.name+'/',url),p+'/');else files.push(p);}}
await walk(out);
const normalize=p=>p.replaceAll('\\','/');
for(const e of manifest.entries)e.path=normalize(e.path);for(const e of old.entries)e.path=normalize(e.path);
const allowed=new Set(['index.html','slice.css','app/experiments/artBlend011.js']);
const changed=[];
for(const e of old.entries){const n=manifest.entries.find(n=>n.path===e.path);assert(n,'Missing '+e.path);if(e.sha256!==n.sha256){assert(allowed.has(e.path),'Frozen visual/runtime changed '+e.path);changed.push(e.path);}}
assert.deepEqual(manifest.entries.filter(e=>!old.entries.some(o=>o.path===e.path)).map(e=>e.path),['app/experiments/preview016Views.js']);
tests.push({name:'All 015 runtime art, map, assets and dependencies hash-identical; only shell and camera entry differ',status:'PASS',changed});
assert.deepEqual([...files].sort(),[...manifest.entries.map(e=>e.path),'manifest.json'].sort());
for(const e of manifest.entries){const b=await readFile(new URL(e.path,out));assert.equal(b.length,e.bytes,e.path);assert.equal(hash(b),e.sha256,e.path);}
tests.push({name:'Exact artifact list and every file byte/hash',status:'PASS',files:files.length});
const data=createSlice(JSON.parse(await readFile(new URL('map.json',out)))),box=viewBoxForHexes(data.hexes,8),width=799.44;
for(const [key,preset] of Object.entries(previewViews)){const view=previewViewport(data,width,key);assert.equal(view.zoom,preset.zoom);if(preset.cell){const p=hexToPixel(data.hexes.find(h=>label(h.coord)===preset.cell).coord),scale=width/box.width;assert(Math.abs((p.x-box.minX-box.width/2)*scale*view.zoom+view.panX)<1e-8);assert(Math.abs((p.y-box.minY-box.height/2)*scale*view.zoom+view.panY)<1e-8);}else assert.deepEqual(view,{zoom:1,panX:0,panY:0});}
assert.deepEqual(previewViewport(data,width,'invalid'),previewViewport(data,width,'full'));
tests.push({name:'Six camera presets center their true cells, unknown entry falls back to full map',status:'PASS'});
const root=new URL('../..',import.meta.url),sourcePath='task-source/ART-PREVIEW-002/src/experiments/artBlend011.ts',viewer=await readFile(new URL('../../'+sourcePath,import.meta.url),'utf8'),before=execFileSync('git',['show',baseline+':'+sourcePath],{cwd:root,encoding:'utf8'});
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
assert.equal(section(viewer,'function drawUnits()','async function sample()'),section(before,'function drawUnits()','async function sample()'));
assert(viewer.includes("['eastfront-web-preview.pages.dev','jnmbys.github.io'].includes(location.hostname)"));
tests.push({name:'Existing selection, stacking, drag/zoom handlers unchanged; production-host guard present',status:'PASS'});
const html=await readFile(new URL('index.html',out),'utf8');assert(html.includes("connect-src 'self'"));assert(!files.some(p=>/^(node_modules|evidence|task-source|scripts|\.git)\//.test(p)));assert(!files.includes('app/main.js'));
tests.push({name:'Runtime-only root, self-only connections, no game bootstrap',status:'PASS'});
const http=[];
// Plain local HTTP integrity check, not browser control or startup measurement.
for(let start=0;start<files.length;start+=8)await Promise.all(files.slice(start,start+8).map(async p=>{const res=await fetch('http://127.0.0.1:44116/'+p),bytes=Buffer.from(await res.arrayBuffer());assert.equal(res.status,200,p);assert.equal(hash(bytes),hash(await readFile(new URL(p,out))),p);http.push({path:p,status:res.status,sha256:hash(bytes),contentType:res.headers.get('content-type')});}));
for(const suffix of ['', '?view=north','?view=central&variant=baseline','index.html?view=south','?view=ac10']){const res=await fetch('http://127.0.0.1:44116/'+suffix);assert.equal(res.status,200,suffix);assert.equal(await res.text(),html);}
tests.push({name:'Every runtime path and direct entry HTTP 200 with exact local bytes',status:'PASS',files:http.length});
const bytes=(await Promise.all(files.map(async p=>(await stat(new URL(p,out))).size))).reduce((a,b)=>a+b,0);
await writeFile(new URL('entry-checks.json',evidence),JSON.stringify({baseline,tests,artifactFiles:files.length,artifactBytes:bytes,deltaVs015Bytes:bytes-3996913,manifestSHA256:hash(await readFile(new URL('manifest.json',out))),reused:'015 eight semantic/layout/mask regressions and interaction evidence retained; no art changes, no unrelated suite rerun.',startup:'UNVERIFIED. Failed export/runtime inspection channels not retried.',http},null,2)+'\n');
console.log(JSON.stringify({tests:tests.length,status:'PASS',files:files.length,bytes,deltaVs015Bytes:bytes-3996913}));
