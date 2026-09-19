import {readFile,readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {createFreshProductionSession,responsiveProfile} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';

const raw=JSON.parse(await readFile(new URL('../dist/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
function sample(fn,n=20){for(let i=0;i<4;i++)fn();const times=[];let value;for(let i=0;i<n;i++){const a=performance.now();value=fn();times.push(performance.now()-a);}return {value,meanMs:Number((times.reduce((a,b)=>a+b,0)/times.length).toFixed(3)),minMs:Number(Math.min(...times).toFixed(3)),maxMs:Number(Math.max(...times).toFixed(3))};}
const sessionSample=sample(()=>createFreshProductionSession(raw,17));const session=sessionSample.value;const p=createPresentationState(false,false);const modelSample=sample(()=>deriveBrowserRenderModel(session,p));const model=modelSample.value;
function render(lod){const r=sample(()=>coreSvgMarkup(model,{debug:false,rendererMode:'production',assetSet:'p5',lod,scenarioSeed:17}),12);const svg=r.value;return {lod,meanMs:r.meanMs,minMs:r.minMs,maxMs:r.maxMs,svgBytes:Buffer.byteLength(svg),approxSvgNodes:(svg.match(/<[a-zA-Z][^!?]/g)||[]).length,uniqueAssetUrls:new Set([...svg.matchAll(/href="([^"]+)"/g)].map(x=>x[1])).size};}
const files=await walk('dist');let total=0;for(const f of files)total+=(await stat(f)).size;
const manifest=JSON.parse(await readFile('dist/assets/terrain/p4r3/manifest.json','utf8'));const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))];let raster=0;for(const r of refs)raster+=(await stat(join('dist/assets/terrain/p4r3',r))).size;
const sizes={indexHtmlBytes:(await stat('dist/index.html')).size,cssBytes:(await stat('dist/styles.css')).size,mainJsBytes:(await stat('dist/app/main.js')).size,runtimeRasterPayloadBytes:raster,totalDeployBytes:total};
const result={measuredAt:new Date().toISOString(),environment:'Node construction measurements; not browser FPS',sessionInitialization:{meanMs:sessionSample.meanMs,minMs:sessionSample.minMs,maxMs:sessionSample.maxMs},renderModelConstruction:{meanMs:modelSample.meanMs,minMs:modelSample.minMs,maxMs:modelSample.maxMs},renderer:[render('far'),render('medium')],sizes:{...sizes,runtimeRasterPayloadMiB:Number((raster/1048576).toFixed(3)),totalDeployMiB:Number((total/1048576).toFixed(3))},responsiveObservations:[{viewport:'1920x1080',profile:responsiveProfile(1920,1080)},{viewport:'1366x768',profile:responsiveProfile(1366,768)},{viewport:'1180x820',profile:responsiveProfile(1180,820)},{viewport:'1024x768',profile:responsiveProfile(1024,768)},{viewport:'390x844',profile:responsiveProfile(390,844)}],browserBootstrap:'Not claimed: Node measurements only; static HTTP and production evidence are validated separately.'};
await mkdir('docs',{recursive:true});await writeFile('docs/UI008_PERFORMANCE.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
