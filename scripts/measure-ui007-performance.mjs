import {readFile,writeFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {createLocalGameSession} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const s=createLocalGameSession(raw,17),m=deriveBrowserRenderModel(s,createPresentationState());
function run(assetSet,lod){for(let i=0;i<4;i++)coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet,lod,scenarioSeed:17});const times=[];let svg='';for(let i=0;i<20;i++){const a=performance.now();svg=coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet,lod,scenarioSeed:17});times.push(performance.now()-a);}const urls=new Set([...svg.matchAll(/href="([^"]+)"/g)].map(x=>x[1]));return {assetSet,lod,meanMs:Number((times.reduce((a,b)=>a+b,0)/times.length).toFixed(2)),minMs:Number(Math.min(...times).toFixed(2)),maxMs:Number(Math.max(...times).toFixed(2)),approxSvgNodes:(svg.match(/<[a-zA-Z][^!?]/g)||[]).length,uniqueAssetUrls:urls.size,svgBytes:Buffer.byteLength(svg)};}
const result={measuredAt:new Date().toISOString(),iterations:20,results:[run('p4r3','far'),run('p5','far'),run('p4r3','medium'),run('p5','medium')]};
await writeFile('docs/UI007_PERFORMANCE.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
