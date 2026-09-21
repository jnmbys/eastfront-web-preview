/** Offline production VS2 + production presence, using Skia canvas adapter.
 * Terrain is unchanged. Units are presentation fixtures on cropped canonical terrain.
 * Not a browser capture, not an extra production loader or startup dependency.
 */
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createFreshProductionSession,TERRAIN_VISUAL_SEED} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {buildCachedTerrainSurface} from '../dist/app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks} from '../dist/app/render/vs2TerrainSurface.js';
import {hexToPixel} from '../dist/app/geometry/hex.js';
import {harness,movementFixture} from '../tests/helpers/animation-fixture.mjs';
import {unit} from '../tests/helpers/combat-fixture.mjs';
import {defaultRules} from '../dist/vendor/eastfront-digital-core/dist/index.js';
const require=createRequire(import.meta.url),{createCanvas,Image:NativeImage}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas'),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const out=resolve(process.argv[2]??'evidence/ua-003');mkdirSync(out,{recursive:true});
class FileImage extends NativeImage {set src(value){if(value)super.src=readFileSync(fileURLToPath(value));}}
globalThis.Image=FileImage;globalThis.document={baseURI:pathToFileURL(resolve('dist')+'/').href,createElement(tag){if(tag!=='canvas')throw Error(tag);const c=createCanvas(1,1);c.dataset={};c.setAttribute=(k,v)=>{c[k]=v;};return c;}};
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const s=createFreshProductionSession(raw,17),model=deriveBrowserRenderModel(s,createPresentationState(false,false)),before=JSON.stringify(s.state);
const hooks=createVS2TerrainSurfaceHooks().worldBase;let worldBuilds=0;const paint=hooks.paint.bind(hooks);hooks.paint=(...args)=>{worldBuilds++;return paint(...args);};
const surface=await buildCachedTerrainSurface(model,TERRAIN_VISUAL_SEED,'p5','close',hooks),vb=surface.viewBox;
const terrains=['PLAIN','FOREST','HILL','CITY'];const selected=terrains.map(t=>model.hexes.filter(h=>h.terrain===t)).map(hexes=>hexes[Math.floor(hexes.length/2)]);
if(selected.some(h=>!h))throw Error('Missing canonical terrain fixture');
const templates=['G-INF','G-PANZER','S-ARTY','S-AT'];
const css=readFileSync('styles.css','utf8'),captures=[];
for(const level of ['medium','close']){
 let body='';for(const [col,hex]of selected.entries())for(const [row,id]of templates.entries()){
  const center=hexToPixel(hex.coord),crop={x:center.x-60,y:center.y-71,w:120,h:112};
  const canvas=createCanvas(244,220),ctx=canvas.getContext('2d');ctx.fillStyle='#797b62';ctx.fillRect(0,0,244,220);
  ctx.drawImage(surface.canvas,(crop.x-vb.minX)/vb.width*surface.canvas.width,(crop.y-vb.minY)/vb.height*surface.canvas.height,crop.w/vb.width*surface.canvas.width,crop.h/vb.height*surface.canvas.height,0,0,244,220);
  const background=canvas.toBuffer('image/png').toString('base64');const t=defaultRules.unitTemplates[id];
  const h=harness(movementFixture([unit(id,id,t.side,t.type,{q:0,r:0})]));h.dom().querySelector('#eastfront-map').setAttribute('data-lod',level);h.runtime.sync(h.s,h.dom());
  const art=['[data-presence-definitions]','[data-unit-presence-layer]','#counter-layer'].map(sel=>h.dom().querySelector(sel).serialize()).join('');
  const x=18+col*258,y=87+row*258;
  body+=`<image x="${x}" y="${y}" width="244" height="220" href="data:image/png;base64,${background}"/><svg x="${x}" y="${y}" width="244" height="220" viewBox="-60 -71 120 112">${art}</svg><text x="${x+8}" y="${y+239}" font-size="12" fill="#eee4cd">${hex.terrain} · ${id} · ${level.toUpperCase()}</text>`;
  const retained={draws:surface.stats.imageDraws,buildCount:surface.canvas.dataset.buildCount};
  // Animation frames must leave this exact existing VS2 canvas untouched.
  for(let i=0;i<60;i++)h.time.tick(16);if(retained.draws!==surface.stats.imageDraws||retained.buildCount!==surface.canvas.dataset.buildCount)throw Error('Terrain repainted');h.runtime.dispose();
 }
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="1140"><style>${css}</style><rect width="100%" height="100%" fill="#111e29"/><g font-family="sans-serif"><text x="24" y="33" fill="#eee4cd" font-size="21">EASTFRONT UA-003 · VS2 terrain readability / ${level.toUpperCase()}</text><text x="24" y="57" fill="#b7c3bd" font-size="12">SOFTWARE-RENDERED · current VS2 production surface + arranged unit presentation fixtures</text>${body}</g></svg>`;
 await sharp(Buffer.from(svg)).png().toFile(join(out,`13-vs2-readability-${level}.png`));captures.push({level,file:`13-vs2-readability-${level}.png`,terrainHexes:selected.map(h=>({hex:h.coord,terrain:h.terrain})),templates});
}
if(JSON.stringify(s.state)!==before)throw Error('Terrain evidence changed state');
writeFileSync(join(out,'terrain-evidence.json'),JSON.stringify({type:'software-rendered',backend:'Skia canvas + sharp/librsvg',worldBuilds,terrainSeed:TERRAIN_VISUAL_SEED,stats:surface.stats,buildCount:surface.canvas.dataset.buildCount,sourceStateUnchanged:true,notes:'Arranged presentation fixtures over canonical terrain crops; not campaign deployment or browser interaction evidence.',captures},null,2));surface.canvas.width=0;surface.canvas.height=0;console.log(JSON.stringify({worldBuilds,captures:captures.length}));
