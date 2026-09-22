import {createLocalGameSession} from './app/core-adapter/session.js';
import {deriveBrowserRenderModel} from './app/render/coreModel.js';
import {createPresentationState} from './app/state/presentation.js';
import {buildCachedTerrainSurface as oldBuild} from '../perf003-baseline/app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks as oldHooks} from '../perf003-baseline/app/render/vs2TerrainSurface.js';
import {buildCachedTerrainSurface as newBuild} from './app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks as newHooks} from './app/render/vs2TerrainSurface.js';
import {TERRAIN_VISUAL_SEED} from './app/web/preview.js';
const output=document.querySelector('#visual-evidence'),button=document.querySelector('#verify'),rows=[];
button.addEventListener('click',async()=>{button.disabled=true;try{
 const map=await (await fetch('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')).json();
 const model=deriveBrowserRenderModel(createLocalGameSession(map,17),createPresentationState());
 for(const lod of ['far','medium','close']){
  const row={lod};rows.push(row);
  for(const [name,build,hooks] of [['baseline',oldBuild,oldHooks],['candidate',newBuild,newHooks]]){
   output.textContent=JSON.stringify({status:`building ${lod} ${name}`,rows});const start=performance.now();
   const surface=await build(model,TERRAIN_VISUAL_SEED,'p5',lod,hooks().worldBase);row[`${name}Ms`]=performance.now()-start;
   const pixels=surface.canvas.getContext('2d').getImageData(0,0,surface.canvas.width,surface.canvas.height);
   row[`${name}Hash`]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',pixels.data))).map(n=>n.toString(16).padStart(2,'0')).join('');
   row.size=[surface.canvas.width,surface.canvas.height];surface.canvas.width=0;surface.canvas.height=0;
  }
  row.equal=row.baselineHash===row.candidateHash;if(!row.equal)throw Error(`Final pixels differ: ${lod}`);
 }
 output.textContent=JSON.stringify({status:'PASS',rows});
}catch(error){output.textContent=JSON.stringify({status:'FAIL',error:String(error),rows});}});
