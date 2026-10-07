import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { buildGeography,createScenario } from '../grand-campaign-003/scenario.mjs';
import { projectVS2Terrain } from '../../dist/app/render/vs2Projection.js';
import { vs2Region } from '../../dist/app/render/vs2WorldField.js';
import { hexToPixel } from '../../dist/app/geometry/hex.js';
import { buildCachedTerrainSurface } from '../../dist/app/render/terrainSurface.js';
const geometry=buildGeography(), model={hexes:geometry.map.hexes,edges:geometry.map.edges};
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
test('R1 retains all 1280 authoritative terrain centers at all sampling sizes',()=>{
 for(const pixelSize of [4,2]) {const p=projectVS2Terrain(model,pixelSize);for(const h of model.hexes){const c=hexToPixel(h.coord);assert.equal(p.field.regionAt(c.x,c.y),vs2Region(h.terrain));const back=p.rasterToWorld(p.worldToRaster(c));assert(Math.hypot(back.x-c.x,back.y-c.y)<1e-9);}}
 assert.equal(model.hexes.length,1280);
});
test('R1 rules, economy, scenario and source art blobs equal fixed CITY baseline',()=>{
 const base='37eae5148f8175574dba91e03c14346a1ea3a733';
 for(const path of ['experiments/grand-campaign-001','experiments/grand-campaign-002','experiments/grand-campaign-003','vendor/eastfront-digital-core','public/assets','src/render/vs2WorldRaster.ts','src/render/vs2ForestSurface.ts','src/render/vs2TerrainDetail.ts']){
  assert.equal(execFileSync('git',['diff',base,'--',path],{encoding:'utf8'}),'',path);
 }
 const a=createScenario(),b=createScenario();assert.equal(digest(a.state),digest(b.state));assert.equal(Object.keys(a.state.units).length,120);assert.equal(a.state.turn,1);
});
test('bounded surfaces retain world coordinates and original default resolution',async()=>{
 const original=globalThis.document;
 const calls=[];const context=new Proxy({scale:(...v)=>calls.push(['scale',...v]),translate:(...v)=>calls.push(['translate',...v])},{get:(o,k)=>o[k]??(()=>{})});
 globalThis.document={baseURI:'http://localhost/',createElement:()=>({dataset:{},getContext:()=>context,setAttribute(){}})};
 const world={id:'test',replacesCityMarkers:true,paint:async(_c,m)=>{assert.equal(m,model);return{imageDraws:1,uniqueAssets:0};},paintInfrastructure:async()=>({imageDraws:0,uniqueAssets:0})};
 try {let bytes=0;for(const scale of [.25,.5,.75,1]){calls.length=0;const r=await buildCachedTerrainSurface(model,17,'p5','far',world,scale);assert.deepEqual(calls[0],['scale',scale,scale]);assert.deepEqual(calls[1],['translate',-r.viewBox.minX,-r.viewBox.minY]);assert.equal(r.canvas.width,Math.ceil(r.viewBox.width*scale));assert.equal(r.canvas.height,Math.ceil(r.viewBox.height*scale));if(scale<1)bytes+=r.canvas.width*r.canvas.height*4;}assert(bytes<40*1024*1024);
 for(const scale of [0,-1,2,NaN,Infinity])await assert.rejects(buildCachedTerrainSurface(model,17,'p5','far',world,scale),RangeError);
 }finally{globalThis.document=original;}
});

test('R1 reuses path images per pass without changing draws and releases on failure',async()=>{
 const {paintVS2Infrastructure}=await import('../../dist/app/render/vs2Infrastructure.js');
 const previous={document:globalThis.document,Image:globalThis.Image};let loads=[],released=0,draws=[];
 class Image {naturalWidth=8;naturalHeight=8;width=8;height=8;set src(url){this.url=url;if(url){loads.push(url);queueMicrotask(()=>this.onload?.());}else released++;}}
 globalThis.Image=Image;globalThis.document={baseURI:'http://test.local/',createElement:()=>({getContext:()=>({})})};
 const ctx=new Proxy({drawImage(im,...args){draws.push([im.url,...args]);}},{get:(o,k)=>o[k]??(()=>{})});
 try{
  await paintVS2Infrastructure(ctx,model,'close');const oldDraws=draws,oldLoadCount=loads.length;
  loads=[];draws=[];released=0;await paintVS2Infrastructure(ctx,model,'close',undefined,true);
  assert.deepEqual(draws,oldDraws);assert.equal(new Set(loads).size,loads.length);assert(loads.length<oldLoadCount);assert.equal(released,loads.length);
  loads=[];released=0;const broken=new Proxy({drawImage(){throw new Error('draw failed');}},{get:(o,k)=>o[k]??(()=>{})});
  await assert.rejects(paintVS2Infrastructure(broken,model,'close',undefined,true),/draw failed/);assert.equal(released,loads.length);
 }finally{globalThis.Image=previous.Image;globalThis.document=previous.document;}
});

 test('static GRAND geometry excludes units, control, FOW and facility state',async()=>{const {staticGrandGeometry}=await import('../../dist/app/render/grandArtGeometry.js');const input={...model,units:[{id:'SECRET'}],facilities:[{id:'F'}],hexes:model.hexes.map(h=>({...h,control:'SOVIET',visibility:'HIDDEN'}))};const plain=staticGrandGeometry(input);assert(!JSON.stringify(plain).includes('SECRET'));assert(plain.hexes.every(h=>Object.keys(h).sort().join(',')==='coord,terrain'));assert.equal(plain.hexes.length,1280);});
