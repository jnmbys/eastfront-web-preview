import {createLocalGameSession} from './app/core-adapter/session.js';
import {deriveBrowserRenderModel} from './app/render/coreModel.js';
import {createPresentationState} from './app/state/presentation.js';
import {buildCachedTerrainSurface as oldBuild} from '../perf003-baseline/app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks as oldHooks} from '../perf003-baseline/app/render/vs2TerrainSurface.js';
import {buildCachedTerrainSurface as newBuild} from './app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks as newHooks} from './app/render/vs2TerrainSurface.js';
import {TERRAIN_VISUAL_SEED} from './app/web/preview.js';
const output=document.querySelector('#visual-evidence'),button=document.querySelector('#verify'),rows=[];
const digest=async data=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data))).map(n=>n.toString(16).padStart(2,'0')).join('');
button.addEventListener('click',async()=>{button.disabled=true;try{
 const map=await (await fetch('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')).json();
 const model=deriveBrowserRenderModel(createLocalGameSession(map,17),createPresentationState()),outputs=[];
 for(const [name,build,hooks] of [['baseline',oldBuild,oldHooks],['baseline-repeat',oldBuild,oldHooks],['candidate',newBuild,newHooks]]){
   output.textContent=JSON.stringify({status:`building far ${name}`,rows});const start=performance.now(),stages=[],base=hooks().worldBase;
   const surface=await build(model,TERRAIN_VISUAL_SEED,'p5','far',{...base,async paint(ctx,...args){const original=ctx.drawImage;ctx.drawImage=function(source,...coords){if(source instanceof HTMLCanvasElement)stages.push({stage:'canvas-source',width:source.width,data:source.getContext('2d').getImageData(0,0,source.width,source.height).data});return original.call(this,source,...coords);};const r=await base.paint(ctx,...args);ctx.drawImage=original;stages.push({stage:'world-complete',width:ctx.canvas.width,data:ctx.getImageData(0,0,ctx.canvas.width,ctx.canvas.height).data});return r;}});
   stages.push({stage:'final',width:surface.canvas.width,data:surface.canvas.getContext('2d').getImageData(0,0,surface.canvas.width,surface.canvas.height).data});outputs.push(stages);
   const row={name,elapsedMs:performance.now()-start,stages:[]};rows.push(row);
   for(let i=0;i<stages.length;i++){const s=stages[i],base=outputs[0][i],diff={pixels:0,maxDelta:0,bounds:[Infinity,Infinity,-1,-1],samples:[]};for(let p=0;p<s.data.length;p+=4){let d=0;for(let c=0;c<4;c++)d=Math.max(d,Math.abs(s.data[p+c]-base.data[p+c]));if(d){diff.pixels++;diff.maxDelta=Math.max(diff.maxDelta,d);const x=p/4%s.width,y=Math.floor(p/4/s.width);diff.bounds=[Math.min(diff.bounds[0],x),Math.min(diff.bounds[1],y),Math.max(diff.bounds[2],x),Math.max(diff.bounds[3],y)];if(diff.samples.length<4)diff.samples.push({x,y,old:[...base.data.slice(p,p+4)],new:[...s.data.slice(p,p+4)]});}}row.stages.push({stage:s.stage,hash:await digest(s.data),diff});}
   surface.canvas.width=0;surface.canvas.height=0;
 }
 output.textContent=JSON.stringify({status:'DIAGNOSED',rows});
}catch(error){output.textContent=JSON.stringify({status:'FAIL',error:String(error),rows});}});
