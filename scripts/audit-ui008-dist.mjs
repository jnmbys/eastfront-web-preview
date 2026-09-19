import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
const root=new URL('../dist/',import.meta.url);
const rootPath=root.pathname;
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const files=await walk(rootPath);const rel=files.map(f=>relative(rootPath,f).replaceAll('\\','/')).sort();
const errors=[];
const forbiddenPathFragments=['dev-assets/','screenshots/','tests/','review-evidence/','leader_review','p2s'];
for(const r of rel){const low=r.toLowerCase();for(const f of forbiddenPathFragments)if(low.includes(f))errors.push(`forbidden path: ${r}`);if(r.endsWith('.map'))errors.push(`source map shipped: ${r}`);}
if(rel.some(r=>r.startsWith('assets/terrain/p4r3-baseline/')||r.startsWith('assets/terrain/p4/')))errors.push('legacy visual baseline entered production assets');
const index=await readFile(new URL('index.html',root),'utf8');
for(const ref of ['./styles.css','./app/main.js'])if(!index.includes(ref))errors.push(`index missing ref ${ref}`);
for(const f of ['styles.css','app/main.js','vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','assets/terrain/p4r3/manifest.json']){try{await stat(new URL(f,root));}catch{errors.push(`missing production file: ${f}`)}}
const manifest=JSON.parse(await readFile(new URL('assets/terrain/p4r3/manifest.json',root),'utf8'));
const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))].sort();
if(refs.length!==123)errors.push(`expected 123 raster refs, got ${refs.length}`);
const csv=(await readFile(new URL('../docs/p5-handoff/P5_ASSET_HASHES.csv',import.meta.url),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const p5Hashes=new Map(csv.slice(1).map(line=>{const c=line.split(',');return [c[0],c[4]];}));
const p5r1=JSON.parse(await readFile(new URL('../docs/p5r1-handoff/P5R1_CHANGED_ASSETS.json',import.meta.url),'utf8')).changedProductionAssets[0];
let payload=0,p5MatchCount=0,p5r1MatchCount=0;for(const r of refs){const u=new URL(`assets/terrain/p4r3/${r}`,root);try{const bytes=await readFile(u);payload+=bytes.length;const got=createHash('sha256').update(bytes).digest('hex');const expected=r===p5r1.file?p5r1.afterSHA256:p5Hashes.get(r);if(!expected)errors.push(`missing expected P5 hash: ${r}`);else if(got!==expected)errors.push(`runtime hash mismatch: ${r}`);else if(r===p5r1.file)p5r1MatchCount++;else p5MatchCount++;}catch{errors.push(`missing raster: ${r}`)}}
const s02=await readFile(new URL('assets/terrain/p4r3/city/small/S02.png',root));const s02Sha=createHash('sha256').update(s02).digest('hex');if(s02Sha!==p5r1.afterSHA256)errors.push(`wrong P5R1 S02: ${s02Sha}`);
for(const r of rel.filter(x=>/\.(html|js|css|json|txt)$/i.test(x))){const text=await readFile(join(rootPath,r),'utf8');for(const needle of ['/mnt/data/','C:\\Users\\','outputs/'])if(text.includes(needle))errors.push(`absolute/dev path ${needle} in ${r}`);}
let total=0;for(const f of files)total+=(await stat(f)).size;
const result={result:errors.length?'FAIL':'CLEAN',fileCount:rel.length,runtimeRasterCount:refs.length,p5BaselineRasterMatchCount:p5MatchCount,p5r1RasterMatchCount:p5r1MatchCount,runtimeRasterPayloadBytes:payload,runtimeRasterPayloadMiB:Number((payload/1048576).toFixed(3)),totalDeployBytes:total,totalDeployMiB:Number((total/1048576).toFixed(3)),s02Sha256:s02Sha,forbiddenPaths:errors};
await mkdir('validation-logs',{recursive:true});await writeFile('validation-logs/ui008-production-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
