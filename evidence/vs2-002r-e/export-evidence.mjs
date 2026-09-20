// Evidence harness only. Executes unchanged compiled production renderers with
// a Skia Canvas/Image adapter; these exports are NOT browser screenshots.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createFreshProductionSession} from '../../dist/app/web/preview.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {buildCachedTerrainSurface} from '../../dist/app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks} from '../../dist/app/render/vs2TerrainSurface.js';
import {coreSvgStaticMarkup,viewBoxForHexes} from '../../dist/app/render/coreSvg.js';
import {hexToPixel,hexPolygon} from '../../dist/app/geometry/hex.js';
import {paperToAxial} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
const require=createRequire(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/package.json');
const {createCanvas,Image:NativeImage,loadImage}=require('@napi-rs/canvas');
const root=resolve('.'),out=resolve('evidence/vs2-002r-e'),dist=resolve('dist');
await mkdir(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),loaded=new Map();
class FileImage extends NativeImage {
  set src(value){
    if(!value)return;
    const path=fileURLToPath(value),bytes=readFileSync(path);
    loaded.set(relative(root,path),sha(bytes));super.src=bytes;
  }
}
globalThis.Image=FileImage;
globalThis.document={baseURI:pathToFileURL(dist+'/').href,createElement(tag){
  if(tag!=='canvas')throw new Error(`Unexpected element ${tag}`);
  const canvas=createCanvas(1,1);canvas.dataset={};canvas.setAttribute=(name,value)=>{canvas[name]=value;};return canvas;
}};
const raw=JSON.parse(await readFile('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','utf8'));
const session=createFreshProductionSession(raw,17),model=deriveBrowserRenderModel(session,createPresentationState(false,false));
const before=JSON.stringify({session,model}),vb=viewBoxForHexes(model.hexes),css=await readFile('styles.css','utf8');
const grid=coreSvgStaticMarkup(model,{debug:false,rendererMode:'production',staticTerrainSurface:true,lod:'close'});
const gridRule=css.match(/\.production-grid\{[^}]+\}/)[0];
const metadata={rendererCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),backend:'@napi-rs/canvas Skia; offline production-function exports, not browser screenshots',seed:17,map:{rows:raw.rows,cols:raw.cols,hexes:model.hexes.length,sha256:sha(await readFile('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'))},gridRule,captures:[],assetReads:[]};
async function capture(name,surface,camera,width,height,lod,description){
 const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.fillStyle='#bbb393';ctx.fillRect(0,0,width,height);
 const scale=Math.min(width/camera.width,height/camera.height),dx=(width-camera.width*scale)/2,dy=(height-camera.height*scale)/2;
 ctx.save();ctx.translate(dx,dy);ctx.scale(scale,scale);ctx.translate(-camera.minX,-camera.minY);
 // Map the same cached canvas extents as production object-fit:contain.
 ctx.drawImage(surface.canvas,vb.minX,vb.minY,vb.width,vb.height);ctx.restore();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${camera.minX} ${camera.minY} ${camera.width} ${camera.height}" preserveAspectRatio="xMidYMid meet"><style>${gridRule}</style>${grid.replaceAll('class="production-grid"', 'class="production-grid" fill="none" stroke="#655f4e" stroke-width="'+(.75/scale)+'" stroke-opacity=".64"')}</svg>`;
 // Skia SVG does not apply stylesheet class rules reliably; mirror the exact
 // production grid paint as attributes, including non-scaling stroke.
 ctx.drawImage(await loadImage(Buffer.from(svg)),0,0);
 const png=canvas.toBuffer('image/png');await writeFile(`${out}/${name}.png`,png);
 metadata.captures.push({file:name+'.png',description,lod,width,height,camera,worldToScreenScale:scale,sha256:sha(png),surfaceStats:surface.stats});
 console.log(`SAVED ${name}.png`);
}
function cameraAt(label,row,width=650,height=410){const c=hexToPixel(paperToAxial(label,row));return {minX:c.x-width/2,minY:c.y-height/2,width,height};}
console.log('Rendering VS2 Far...');
const vs2far=await buildCachedTerrainSurface(model,17,'p5','far',createVS2TerrainSurfaceHooks().worldBase);
await capture('01-full-vs2-far',vs2far,vb,1920,1440,'far','Full Strategic Reset F, all 640 hexes; production grid only; no UI, units or deployment tint.');
vs2far.canvas.width=0;vs2far.canvas.height=0;
console.log('Rendering V1 Far...');
const v1far=await buildCachedTerrainSurface(model,17,'p5','far');
await capture('02-full-v1-same-camera',v1far,vb,1920,1440,'far','Legacy V1/P5R1 cached renderer, identical seed/camera/grid/output size to image 01.');
v1far.canvas.width=0;v1far.canvas.height=0;
console.log('Rendering VS2 Close...');
const close=await buildCachedTerrainSurface(model,17,'p5','close',createVS2TerrainSurfaceHooks().worldBase);
await capture('03-north-forest-close',close,cameraAt('H',4),1280,808,'close','North forest belt centred at canonical H4; includes forest gaps and neighbouring plain.');
await capture('04-central-plain-hill-infrastructure',close,cameraAt('P',9),1280,808,'close','Central plain/hill and transport approaches centred at P9.');
await capture('05-south-marsh-river',close,cameraAt('P',17),1280,808,'close','Southern marsh/river corridor centred at P17.');
await capture('06-city-railway-road',close,cameraAt('R',10,410,259),1280,808,'close','R10 city and canonical railway/road approaches.');
close.canvas.width=0;close.canvas.height=0;
if(before!==JSON.stringify({session,model}))throw new Error('Evidence rendering mutated canonical state');
metadata.assetReads=[...loaded].map(([file,sha256])=>({file,sha256}));
metadata.sourceStateUnchanged=true;
await writeFile(out+'/CAPTURE_MANIFEST.json',JSON.stringify(metadata,null,2)+'\n');
console.log('DONE: 6 exports; canonical state unchanged.');
