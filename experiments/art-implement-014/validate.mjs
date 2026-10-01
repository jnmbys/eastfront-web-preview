import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSlice,label,inside,corridors,segmentDistance} from './dist/app/experiments/mapData.js';
import {hexToPixel,hexPolygon,sharedHexEdge} from './dist/app/geometry/hex.js';
import {placements} from './dist/app/experiments/blend011Terrain.js';
import {composeSettlement,settlementCells} from './dist/app/experiments/blend011Layout.js';
import {sceneGeometry} from './dist/app/experiments/scene012Geometry.js';
import {vs2RectangleSegmentDistance} from './dist/app/render/vs2Projection.js';
import {viewBoxForHexes} from './dist/app/render/coreSvg.js';
import {beginMapGesture,updateMapGesture,gesturePanViewport,dragSuppressesTap} from './dist/app/web/mapInteraction.js';

const baseline='ad359de4e78ce28e3e9aafcb2d14e0a0f003f20b';
const evidence=new URL('../../evidence/ART-IMPLEMENT-014/',import.meta.url);
const data=createSlice(JSON.parse(await readFile(new URL('./dist/map.json',import.meta.url)))),frozen=JSON.stringify(data),base=placements(data),old=composeSettlement(data,base,true),next=composeSettlement(data,base,'014'),g=sceneGeometry(data),tests=[];
function test(name,fn){fn();tests.push({name,status:'PASS'});}
const golden=JSON.parse(await readFile(new URL('../../evidence/ART-SCENE-012/semantic-tests.json',import.meta.url)));
test('012 layout matches committed golden; exact eight-cell ownership; outside placements unchanged',()=>{
 assert.deepEqual(old.filter(p=>settlementCells.has(p.cell)),golden.placements);
 assert.deepEqual([...settlementCells],['X14','W13','W14','V13','V14','W15','X15','Y15']);
 assert.deepEqual(next.filter(p=>!settlementCells.has(p.cell)),old.filter(p=>!settlementCells.has(p.cell)));
 assert.deepEqual([data.hexes.length,data.edges.length,data.counters.length],[640,257,58]);
});
test('Town blocks stay inside X14 and clear every transport corridor, unit and label',()=>{
 const roofs=next.filter(p=>p.cell==='X14');assert.equal(roofs.length,8);
 const h=data.hexes.find(h=>label(h.coord)==='X14'),c=hexToPixel(h.coord);assert.equal(h.terrain,'CITY');
 for(const p of roofs){
  for(const x of [-1,1])for(const y of [-1,1])assert(inside({x:p.x+x*p.width/2,y:p.y+y*p.height/2},hexPolygon(h.coord)));
  for(const l of corridors(data))assert(vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)>=l.width+2-1e-6);
  assert(!(Math.abs(p.x-c.x)<9+p.width/2&&Math.abs(p.y-(c.y-22))<4+p.height/2));
  for(const u of data.counters){const q=hexToPixel(u.hex);assert(Math.abs(q.x-p.x)>=34+p.width/2||Math.abs(q.y-p.y)>=34+p.height/2);}
 }
});
test('Road/rail endpoints, bounded displacement and bridge approaches retained',()=>{
 for(const e of data.edges.filter(e=>e.road||e.railway?.present)){const points=g.route(e),a=hexToPixel(e.a),b=hexToPixel(e.b);assert.equal(points[0].x,a.x);assert.equal(points[0].y,a.y);assert(Math.hypot(points.at(-1).x-b.x,points.at(-1).y-b.y)<1e-9);for(const p of points)assert(segmentDistance(p,a,b)<=1.60001);if(e.bridge&&!e.bridge.destroyed)assert(Math.hypot(points[16].x-(a.x+b.x)/2,points[16].y-(a.y+b.y)/2)<1e-8);}
});
test('River edge corridors, bridge center and outside region retained',()=>{
 for(const e of data.edges.filter(e=>e.river)){const [a,b]=sharedHexEdge(e.a,e.b),points=Array.from({length:41},(_,i)=>({x:a.x+(b.x-a.x)*i/40,y:a.y+(b.y-a.y)*i/40})),water=g.water(points);for(let i=0;i<water.length;i++){assert(segmentDistance(water[i],a,b)<=1.45001);if(!g.weight(points[i]))assert.deepEqual(water[i],points[i]);}if(e.bridge&&!e.bridge.destroyed)assert.deepEqual(water[20],points[20]);}
});
test('Same seven mass stamps; no new terrain or unit mutation',()=>{
 assert.equal(next.filter(p=>settlementCells.has(p.cell)&&p.kind!=='city').length,7);
 assert.deepEqual(next.filter(p=>settlementCells.has(p.cell)&&p.kind!=='city').map(p=>[p.cell,p.kind,p.tile]),old.filter(p=>settlementCells.has(p.cell)&&p.kind!=='city').map(p=>[p.cell,p.kind,p.tile]));
 assert.equal(JSON.stringify(data),frozen);
});
test('Drag threshold and drag/tap suppression contract',()=>{
 const view={zoom:5,panX:-875.586,panY:0},tap=updateMapGesture(beginMapGesture(1,700,680,view),703,681);assert(!dragSuppressesTap(tap));
 const drag=updateMapGesture(tap,770,710);assert(dragSuppressesTap(drag));assert.deepEqual(gesturePanViewport(drag,770,710,5),{zoom:5,panX:-805.586,panY:30});
});
const git=(...args)=>execFileSync('git',args,{cwd:new URL('../..',import.meta.url),encoding:'utf8'}).trim();
const changed=git('diff','--name-only',baseline).split(/\r?\n/).filter(Boolean);
test('No edits to frozen tracked source, map, transport geometry, interaction or assets',()=>{
 const allowed=new Set(['.gitignore','task-source/ART-PREVIEW-002/src/experiments/artBlend011.ts','task-source/ART-PREVIEW-002/src/experiments/blend011Terrain.ts','task-source/ART-PREVIEW-002/src/experiments/blend011Layout.ts']);
 for(const path of changed)assert(allowed.has(path)||path.startsWith('experiments/art-implement-014/')||path.startsWith('evidence/ART-IMPLEMENT-014/'),path);
});
await writeFile(new URL('semantic-tests.json',evidence),JSON.stringify({baseline,tests,changedTrackedFiles:changed,placements:next.filter(p=>settlementCells.has(p.cell)),limits:'Geometry/source regression, not pixel-identical outside-region or live-match acceptance.'},null,2)+'\n');

const manifest=JSON.parse(await readFile(new URL('./dist/manifest.json',import.meta.url))),manifestSize=(await stat(new URL('./dist/manifest.json',import.meta.url))).size;
const previous=JSON.parse(await readFile(new URL('../../evidence/ART-SCENE-012/cost.json',import.meta.url)));
const box=viewBoxForHexes(data.hexes,8),scale=Math.min(2,4096/Math.max(box.width,box.height));
const canvas={...previous.canvasBackingEstimates,estimatedCanvasBytes:Math.ceil(box.width*scale)*Math.ceil(box.height*scale)*4,blendTileBytes:next.filter(p=>settlementCells.has(p.cell)&&p.kind!=='city').reduce((s,p)=>s+Math.ceil(p.width*3)*Math.ceil(p.height*3)*4,0)};
const cost={baseline,runtimeFiles:manifest.entries.length+1,runtimeBytes:manifest.entries.reduce((s,e)=>s+e.bytes,0)+manifestSize,baselineRuntimeBytes:previous.runtimeBytes,newImageBytes:0,newAssetCount:0,canvasBackingEstimates:canvas,sumListedCanvasBytes:Object.values(canvas).reduce((a,b)=>a+b,0),baselineListedCanvasBytes:previous.sumListedCanvasBytes,estimateBasis:'Same six canvas categories and RGBA width*height*4 as 012. Counts/dimensions from source; transient decode, ImageData, gradients, GC, browser copies, RSS and VRAM excluded. References/screenshots not runtime assets.',sameConditionStartupSamples:[],startupStatus:'UNVERIFIED: ordinary page export download did not complete within 30 seconds; runtime inspection previously restricted at 012. No CDP/evaluate workaround. No startup improvement claim. Historical 708ms issue remains open.'};
cost.runtimeDeltaBytes=cost.runtimeBytes-cost.baselineRuntimeBytes;cost.canvasDeltaBytes=cost.sumListedCanvasBytes-cost.baselineListedCanvasBytes;
await writeFile(new URL('cost.json',evidence),JSON.stringify(cost,null,2)+'\n');
await writeFile(new URL('runtime-manifest.json',evidence),JSON.stringify(manifest,null,2)+'\n');
const hash=createHash('sha256').update(await readFile(new URL('./dist/map.json',import.meta.url))).digest('hex');
console.log(JSON.stringify({tests:tests.length,status:'PASS',mapSHA256:hash,cost}));
