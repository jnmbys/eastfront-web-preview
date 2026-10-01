import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSlice,label,inside,corridors,segmentDistance,semanticAudit} from './dist/app/experiments/mapData.js';
import {hexToPixel,hexPolygon,hexDistance} from './dist/app/geometry/hex.js';
import {placements} from './dist/app/experiments/blend011Terrain.js';
import {composeSettlement,settlementCells,bakeNatural} from './dist/app/experiments/blend011Layout.js';
import {composeWorld,worldContext} from './dist/app/experiments/map015Layout.js';
import {vs2RectangleSegmentDistance} from './dist/app/render/vs2Projection.js';
import {beginMapGesture,updateMapGesture,gesturePanViewport,dragSuppressesTap} from './dist/app/web/mapInteraction.js';
const baseline='1a33de2bf90fa3e97579482a0e534db8ff41927d',root=new URL('../..',import.meta.url),evidence=new URL('../../evidence/ART-MAP-015/',import.meta.url);
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const hash=b=>createHash('sha256').update(b).digest('hex');
const raw=await readFile(new URL('./dist/map.json',import.meta.url)),data=createSlice(JSON.parse(raw)),frozen=JSON.stringify(data),approved=composeSettlement(data,placements(data),'014'),next=composeWorld(data,approved),tests=[];
const test=(name,fn)=>{fn();tests.push({name,status:'PASS'});};
const golden=JSON.parse(await readFile(new URL('../../evidence/ART-IMPLEMENT-014/semantic-tests.json',import.meta.url)));
test('Full 640-cell map, 257 edges and 58 fixtures unchanged',()=>{
 assert.equal(hash(raw),'150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3');
 assert.deepEqual([data.hexes.length,data.edges.length,data.counters.length],[640,257,58]);assert.equal(JSON.stringify(data),frozen);
});
test('Approved X14 and seven neighboring cells match committed 014 golden',()=>assert.deepEqual(next.filter(p=>settlementCells.has(p.cell)),golden.placements));
const contexts=worldContext(data),lanes=corridors(data),units=data.counters.map(u=>hexToPixel(u.hex));
test('World rules use actual adjacency and never create terrain on a plain, marsh or lake',()=>{
 for(const a of contexts)for(const n of a.neighbors)assert.equal(hexDistance(a.h.coord,n.coord),1);
 for(const p of next){const h=data.hexes.find(h=>label(h.coord)===p.cell);assert(h);assert(p.kind==='city'?h.terrain.includes('CITY'):p.kind==='forest'?h.terrain==='FOREST':p.kind===h.terrain);}
 for(const h of data.hexes.filter(h=>['FOREST','HILL','ROUGH'].includes(h.terrain)))assert(next.some(p=>p.cell===label(h.coord)));
 assert.deepEqual(composeWorld(data,approved),next);
});
test('Every town roof fits real city, every transport/water corridor, every unit and label',()=>{
 for(const p of next.filter(p=>p.kind==='city')){const h=data.hexes.find(h=>label(h.coord)===p.cell),c=hexToPixel(h.coord);
  for(const x of [-1,1])for(const y of [-1,1])assert(inside({x:p.x+x*p.width/2,y:p.y+y*p.height/2},hexPolygon(h.coord)),p.cell);
  for(const l of lanes)assert(vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)>=l.width+2-1e-6,p.cell);
  for(const q of units)assert(Math.abs(q.x-p.x)>=34+p.width/2||Math.abs(q.y-p.y)>=34+p.height/2,p.cell);
  const labelY=c.y+(p.cell==='X14'?-22:29);assert(!(Math.abs(p.x-c.x)<9+p.width/2&&Math.abs(p.y-labelY)<4+p.height/2),p.cell);
 }
});
const cityLayouts=data.hexes.filter(h=>h.terrain.includes('CITY')).map(h=>{const c=hexToPixel(h.coord);return {cell:label(h.coord),terrain:h.terrain,unitOccupied:units.some(u=>u.x===c.x&&u.y===c.y),roofs:next.filter(p=>p.cell===label(h.coord)).map(p=>({dx:p.x-c.x,dy:p.y-c.y,w:p.width,h:p.height,roof:p.roof}))};});
test('Town plans vary with space; budgets bounded; empty occupied city is explicit',()=>{
 const unique=new Set(cityLayouts.filter(c=>c.roofs.length).map(c=>JSON.stringify(c.roofs)));assert(unique.size>=7);
 for(const c of cityLayouts){assert(c.roofs.length<=12);if(!c.unitOccupied)assert(c.roofs.length>=3,c.cell);}
 assert(next.filter(p=>p.kind!=='city').length<=data.hexes.filter(h=>h.terrain==='FOREST').length*2+data.hexes.filter(h=>['HILL','ROUGH'].includes(h.terrain)).length);
});
// Test the actual alpha-mask function with an opaque synthetic tile. No browser
// rendering is substituted: this is a clearance regression, not an art screenshot.
let maskSamples=0,scratchPeak=0,maskedTiles=0;
test('Natural alpha cannot cover neighboring terrain, transport, units or labels',()=>{
 for(const p of next.filter(p=>!settlementCells.has(p.cell)&&p.kind!=='city')){
  let pixels;const tile={width:0,height:0,getContext:()=>({drawImage(){},getImageData(_x,_y,w,h){return {data:new Uint8ClampedArray(w*h*4).fill(255)};},putImageData(im){pixels=im.data;}})};
  bakeNatural({},p,data,'014',tile,2,true);scratchPeak=Math.max(scratchPeak,tile.width*tile.height*4);maskedTiles++;
  const a=contexts.find(a=>label(a.h.coord)===p.cell),poly=hexPolygon(a.h.coord);
  for(let y=0;y<tile.height;y+=3)for(let x=0;x<tile.width;x+=3){
   const q={x:p.x-p.width/2+(x+.5)/tile.width*p.width,y:p.y-p.height/2+(y+.5)/tile.height*p.height};
   const blocked=!inside(q,poly)||a.lanes.some(l=>segmentDistance(q,l.a,l.b)<=l.width+.8)||units.some(u=>Math.abs(q.x-u.x)<=34&&Math.abs(q.y-u.y)<=34)||(Math.abs(q.x-a.c.x)<=10&&Math.abs(q.y-a.c.y-29)<=5);
   if(blocked){assert.equal(pixels[(y*tile.width+x)*4+3],0,p.cell);maskSamples++;}
  }
 }
 assert(maskSamples>10000);assert(scratchPeak<=144*144*4);
});
const rendererPath='task-source/ART-PREVIEW-002/src/experiments/blend011Terrain.ts',viewerPath='task-source/ART-PREVIEW-002/src/experiments/artBlend011.ts';
const renderer=await readFile(new URL('../../'+rendererPath,import.meta.url),'utf8'),oldRenderer=git('show',baseline+':'+rendererPath),viewer=await readFile(new URL('../../'+viewerPath,import.meta.url),'utf8'),oldViewer=git('show',baseline+':'+viewerPath);
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)));
test('River chains, centerline/width geometry, routes, rail gaps, bridges and interaction handlers frozen',()=>{
 for(const [a,b] of [['function riverChains','export async function loadImage'],[' const rivers=data.edges',' paintNaturalBanks(ctx,data);'],[' const segments=data.edges',' for(const h of data.hexes.filter(h=>']])assert.equal(section(renderer,a,b),section(oldRenderer,a,b));
 assert.equal(section(viewer,'function drawUnits()','async function sample()'),section(oldViewer,'function drawUnits()','async function sample()'));
 const frozenFiles=['task-source/ART-PREVIEW-002/src/experiments/mapData.ts','task-source/ART-PREVIEW-002/src/experiments/scene012Geometry.ts','task-source/ART-PREVIEW-002/src/web/mapInteraction.ts','task-source/ART-PREVIEW-002/src/render/coreSvg.ts'];
 for(const p of frozenFiles)assert.equal(git('hash-object',p),git('rev-parse',baseline+':'+p));
 const view={zoom:3,panX:0,panY:0},tap=updateMapGesture(beginMapGesture(1,0,0,view),3,2),drag=updateMapGesture(tap,70,30);assert(!dragSuppressesTap(tap));assert(dragSuppressesTap(drag));assert.deepEqual(gesturePanViewport(drag,70,30,3),{zoom:3,panX:70,panY:30});
});
const changed=git('diff','--name-only',baseline).split(/\r?\n/).filter(Boolean);
test('Tracked change allowlist excludes map, Core, RNG, AI, supply and asset mutations',()=>{
 const allow=['.gitignore',rendererPath,viewerPath,'task-source/ART-PREVIEW-002/src/experiments/blend011Layout.ts','task-source/ART-PREVIEW-002/src/experiments/map015Layout.ts'];
 for(const p of changed)assert(allow.includes(p)||p.startsWith('experiments/art-map-015/')||p.startsWith('evidence/ART-MAP-015/'),p);
});
await writeFile(new URL('semantic-tests.json',evidence),JSON.stringify({baseline,tests,mapSHA256:hash(raw),semanticAndFixturesSHA256:hash(frozen),terrainCounts:data.hexes.reduce((m,h)=>(m[h.terrain]=(m[h.terrain]??0)+1,m),{}),cityLayouts,stampCount:next.length,naturalStampCount:next.filter(p=>p.kind!=='city').length,maskSamples,maskedTiles,scratchPeak,changedTrackedFiles:changed,limits:'Synthetic opaque alpha-mask samples test clearance, not visual quality. All actual screenshots come from browser.'},null,2)+'\n');
await writeFile(new URL('semantic-map.json',evidence),JSON.stringify({...semanticAudit(data),fixtures:data.counters},null,2)+'\n');
const prev=JSON.parse(await readFile(new URL('../../evidence/ART-IMPLEMENT-014/cost.json',import.meta.url))),manifest=JSON.parse(await readFile(new URL('./dist/manifest.json',import.meta.url))),manifestBytes=(await stat(new URL('./dist/manifest.json',import.meta.url))).size;
const runtimeBytes=manifest.entries.reduce((s,e)=>s+e.bytes,0)+manifestBytes;
const costs={baseline,runtimeFiles:manifest.entries.length+1,runtimeBytes,baselineRuntimeBytes:prev.runtimeBytes,deltaBytes:runtimeBytes-prev.runtimeBytes,newRuntimeAssets:0,canvasBackingEstimates:{...prev.canvasBackingEstimates,worldScratchPeakBytes:scratchPeak},sumListedCanvasBytes:prev.sumListedCanvasBytes+scratchPeak,baselineListedCanvasBytes:prev.sumListedCanvasBytes,canvasDeltaBytes:scratchPeak,dom:'Measured separately through ordinary DOM locators in browser-results.json',startup:{status:'UNVERIFIED',sameConditionSamples:[],reason:'Prior 014 export timeout and 012 runtime inspection restriction retained. No failed channel retried in 015.',historical708ms:'OPEN'},limits:'Same RGBA source dimensions/count categories as 014, plus one shared scratch peak. Not RSS/VRAM, excludes decode buffers, ImageData, temporary gradients, GC and browser copies. No GPU/Huawei acceptance.'};
await writeFile(new URL('cost.json',evidence),JSON.stringify(costs,null,2)+'\n');await writeFile(new URL('runtime-manifest.json',evidence),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({tests:tests.length,status:'PASS',stamps:next.length,cityRoofs:cityLayouts.map(c=>[c.cell,c.roofs.length]),maskSamples,maskedTiles,costs}));
