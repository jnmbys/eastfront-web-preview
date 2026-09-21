/** SOFTWARE-RENDERED evidence from production VS2 + actual fog raster + Counter/UA renderer.
 * Static fixture arranges real roster units on canonical hexes. Motion uses accepted Core MOVE.
 * Does not claim a browser capture or Huawei performance measurement.
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createFreshProductionSession,TERRAIN_VISUAL_SEED} from '../dist/app/web/preview.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgStaticMarkup} from '../dist/app/render/coreSvg.js';
import {buildCachedTerrainSurface} from '../dist/app/render/terrainSurface.js';
import {createVS2TerrainSurfaceHooks} from '../dist/app/render/vs2TerrainSurface.js';
import {derivePlayerView,rememberPlayerView} from '../dist/app/player-view/playerView.js';
import {deriveFogPlan,rasterizeFog,FOG_STYLE} from '../dist/app/fog/surface.js';
import {hexToPixel} from '../dist/app/geometry/hex.js';
import {dispatchGameAction,sessionPlayerView} from '../dist/app/core-adapter/session.js';
import {UnitAnimationRuntime} from '../dist/app/presentation/runtime.js';
import {SvgUnitPresentation} from '../dist/app/presentation/svgUnits.js';
import {mapDom,clock} from '../tests/helpers/animation-fixture.mjs';
import {unit,G} from '../tests/helpers/combat-fixture.mjs';
const require=createRequire(import.meta.url),{createCanvas,Image:NativeImage}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas'),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const out=resolve(process.argv[2]??'evidence/fow002');mkdirSync(out,{recursive:true});
class FileImage extends NativeImage{set src(value){if(value)super.src=readFileSync(fileURLToPath(value));}}
globalThis.Image=FileImage;globalThis.document={baseURI:pathToFileURL(resolve('dist')+'/').href,createElement(tag){assert.equal(tag,'canvas');const c=createCanvas(1,1);c.dataset={};c.setAttribute=(k,v)=>{c[k]=v;};return c;}};
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const terrainSession=createFreshProductionSession(raw,17),p=createPresentationState(false,false),terrainModel=deriveBrowserRenderModel(terrainSession,p);
const hook=createVS2TerrainSurfaceHooks().worldBase,paint=hook.paint.bind(hook);let builds=0;hook.paint=(...args)=>{builds++;return paint(...args);};
const surface=await buildCachedTerrainSurface(terrainModel,TERRAIN_VISUAL_SEED,'p5','close',hook),bounds=surface.viewBox;
const terrain=surface.canvas.toBuffer('image/png').toString('base64'),css=readFileSync('styles.css','utf8'),grid=coreSvgStaticMarkup(terrainModel,{debug:false,rendererMode:'production',staticTerrainSurface:true});
const s=createFreshProductionSession(raw,2722);s.activeViewerControllerId=G;s.state.phase='GERMAN_MOVEMENT';s.state.activeSide='GERMAN';
const roster=[unit('G-I-01','G-INF','GERMAN','INFANTRY',{q:8,r:2}),unit('G-PZ-01','G-PANZER','GERMAN','PANZER',{q:9,r:3}),unit('G-REC-01','G-RECON','GERMAN','RECON',{q:11,r:4}),unit('G-PZ-02','G-PANZER','GERMAN','PANZER',{q:5,r:10}),unit('S-I-01','S-INF','SOVIET','INFANTRY',{q:14,r:4}),unit('S-TK-01','S-TANK','SOVIET','TANK',{q:18,r:2}),unit('S-ART-01','S-ARTY','SOVIET','ARTILLERY',{q:24,r:-2}),unit('S-I-02','S-INF','SOVIET','INFANTRY',{q:20,r:6}),unit('S-I-03','S-INF','SOVIET','INFANTRY',{q:28,r:-4})];
s.state.units=Object.fromEntries(roster.map(u=>[u.id,u]));for(const u of roster)assert(s.state.hexes[`${u.hex.q},${u.hex.r}`]);
const past=structuredClone(s.state);past.units['G-REC-01'].hex={q:16,r:6};past.units['S-I-02'].hex={q:17,r:6};
s.knowledge={GERMAN:rememberPlayerView(derivePlayerView(past,'GERMAN',s.rules))};
const manifest={kind:'software-rendered',baseline:'887132ba162b92def89154d6ccb3907e27279613',fixture:'Arranged real roster on canonical production map; accepted Core MOVE for animation',terrainBuilds:builds,terrainDraws:surface.stats.imageDraws,files:[],visibility:{},animations:[],privacy:{}};
const cache=new Map();let maskBuilds=0;
function encoded(plan,kind='fog'){const k=plan.key+kind;if(cache.has(k))return cache.get(k);const r=rasterizeFog(plan,kind),c=createCanvas(r.width,r.height),ctx=c.getContext('2d'),image=ctx.createImageData(r.width,r.height);image.data.set(r.rgba);ctx.putImageData(image,0,0);const data=c.toBuffer('image/png').toString('base64');cache.set(k,data);maskBuilds++;return data;}
function fogImage(plan,opacity=1,kind='fog'){if(plan.viewer==='OBSERVER')return '';const b=plan.bounds;return `<image x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" opacity="${opacity}" href="data:image/png;base64,${encoded(plan,kind)}" preserveAspectRatio="none"/>`;}
function drawRoot(session,level='medium'){const root=mapDom(session,p);root.querySelector('#eastfront-map').setAttribute('data-lod',level);const renderer=new SvgUnitPresentation();renderer.bind(root,sessionPlayerView(session).units.map(({id,side,type})=>({id,side,type})));renderer.paint(new Map());return {root,renderer};}
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;');
function crop(hex,width=1050,height=610){const c=hexToPixel(hex);return {minX:c.x-width/2,minY:c.y-height/2,width,height};}
async function frame(session,title,box=bounds,{width=1500,height=760,root=null,fog=null,recon=false,level='medium'}={}){
 const view=sessionPlayerView(session),plan=deriveFogPlan(view,recon?'G-REC-01':null),made=root?null:drawRoot(session,level);root??=made.root;
 const dynamic=root.querySelector('#map-dynamic-layer').serialize();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height+58}"><style>${css}</style><rect width="100%" height="100%" fill="#12202c"/><text x="20" y="24" font-family="sans-serif" font-size="17" fill="#eee4ce">${esc(title)}</text><text x="20" y="45" font-family="sans-serif" font-size="12" fill="#aebdc1">SOFTWARE-RENDERED · production VS2 + Counter + authorized PlayerView · fixed camera</text><svg id="eastfront-map" data-renderer-mode="production" x="0" y="58" width="${width}" height="${height}" viewBox="${box.minX} ${box.minY} ${box.width} ${box.height}"><image x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" href="data:image/png;base64,${terrain}"/>${grid}${fog??fogImage(plan)}${recon?fogImage(plan,1,'recon'):''}${dynamic}</svg></svg>`;
 const png=await sharp(Buffer.from(svg)).png().toBuffer();made?.renderer.dispose();return png;
}
async function save(name,title,box=bounds,options={}){const png=await frame(s,title,box,options);writeFileSync(join(out,name),png);manifest.files.push(name);return png;}
const full=[];
for(const side of ['OBSERVER','GERMAN','SOVIET']){s.viewOverride=side;const view=sessionPlayerView(s);manifest.visibility[side]={units:view.units.map(u=>u.id),contacts:view.contacts,lastKnown:view.lastKnown,observedHexCount:view.contactHexKeys.length};full.push(await save(`01-full-${side.toLowerCase()}.png`,`${side} · Full strategic map`));}
await sharp({create:{width:1500,height:818*3,channels:4,background:'#12202c'}}).composite(full.map((input,i)=>({input,top:i*818,left:0}))).png().toFile(join(out,'02-matched-three-views.png'));manifest.files.push('02-matched-three-views.png');
s.viewOverride='GERMAN';
await save('03-visible-fog-edge.png','VISIBLE → FOGGED · soft world-space boundary',crop({q:10,r:4},900,520),{width:1300,height:752,level:'close'});
await save('04-forest-fog.png','Forest · known terrain remains readable through fog',crop({q:11,r:2},820,490),{width:1200,height:717,level:'close'});
await save('05-city-fog.png','Capital / city · fogged strategic map, no hidden Soviet counter',crop({q:28,r:-4},720,440),{width:1200,height:733,level:'close'});
const rivers=terrainModel.edges.filter(e=>e.river),rails=terrainModel.edges.filter(e=>e.railway?.present);const river=rivers.map(e=>({e,d:Math.min(...rails.map(r=>Math.hypot(hexToPixel(e.a).x-hexToPixel(r.a).x,hexToPixel(e.a).y-hexToPixel(r.a).y)))})).sort((a,b)=>a.d-b.d)[0].e;
await save('06-river-railway-fog.png','River / railway · infrastructure remains visible',crop(river.a,1050,630),{width:1300,height:780});manifest.riverRailFocus=river.a;
await save('07-recon-selected.png','Selected Recon · temporary soft observation emphasis',crop({q:12,r:4},1020,620),{width:1300,height:790,recon:true,level:'close'});
const contact=sessionPlayerView(s).contacts[0];assert(contact);await save('08-contact.png','CURRENT CONTACT · no exact type, stats or identity',crop(contact.hex,610,365),{width:1100,height:658,level:'close'});
const memory=sessionPlayerView(s).lastKnown.find(c=>c.hex.q===17&&c.hex.r===6);assert(memory);await save('09-last-known.png','LAST KNOWN · historical, unconfirmed location / clock marker',crop(memory.hex,610,365),{width:1100,height:658,level:'close'});
// Match ordinary vs Recon using actual templates at the same location. No production policy changes.
const comparison=[];for(const recon of [false,true]){const copy={...s,state:structuredClone(s.state)};if(!recon){copy.state.units['G-REC-01'].type='INFANTRY';copy.state.units['G-REC-01'].templateId='G-INF';}comparison.push(await frame(copy,recon?'Recon: identify 2 / contact 3':'Ordinary: identify 1 / contact 1',crop({q:12,r:4},1020,620),{width:1100,height:669,recon}));}
await sharp({create:{width:1100,height:1454,channels:4,background:'#12202c'}}).composite(comparison.map((input,i)=>({input,left:0,top:i*727}))).png().toFile(join(out,'10-spotting-comparison.png'));manifest.files.push('10-spotting-comparison.png');
// Accepted movement: canonical truth changes once; UA and fog interpolation are presentation only.
const time=clock(),runtime=new UnitAnimationRuntime(time);let root=mapDom(s,p);runtime.sync(s,root);const before=sessionPlayerView(s),beforePlan=deriveFogPlan(before);
const result=dispatchGameAction(s,{type:'MOVE',controllerId:G,unitId:'G-PZ-02',path:[{q:6,r:10},{q:7,r:10},{q:8,r:10}]}).result;assert(result.accepted,JSON.stringify(result.issues));
root=mapDom(s,p);runtime.sync(s,root);const after=sessionPlayerView(s),afterPlan=deriveFogPlan(after),truth=JSON.stringify(s.state);
const easeOut=x=>{let lo=0,hi=1;for(let i=0;i<18;i++){const t=(lo+hi)/2,tx=3*(1-t)*t*t*.58+t*t*t;if(tx<x)lo=t;else hi=t;}const t=(lo+hi)/2;return 3*(1-t)*t*t+t*t*t;};
const gifFrames={reveal:[],return:[]};let previous=0;
for(let ms=0;ms<=720;ms+=40){time.tick(ms-previous);previous=ms;const blend=easeOut(Math.min(1,ms/FOG_STYLE.transitionMs));const fog=ms<FOG_STYLE.transitionMs?fogImage(beforePlan,1-blend)+fogImage(afterPlan,blend):fogImage(afterPlan);
 for(const kind of ['reveal','return']){const box=crop(kind==='reveal'?{q:8,r:10}:{q:5,r:10},kind==='reveal'?920:760,540);gifFrames[kind].push(await frame(s,`Accepted MOVE · fog ${kind.toUpperCase()} · ${ms} ms`,box,{width:1000,height:587,root,fog}));}
 assert.equal(JSON.stringify(s.state),truth);
}
for(const [kind,frames]of Object.entries(gifFrames)){const raws=await Promise.all(frames.map(b=>sharp(b).ensureAlpha().raw().toBuffer()));const width=1000,height=645;await sharp(Buffer.concat(raws),{raw:{width,height:height*raws.length,channels:4,pageHeight:height}}).gif({loop:0,delay:frames.map((_,i)=>i===frames.length-1?700:40)}).toFile(join(out,`11-move-${kind}.gif`));manifest.files.push(`11-move-${kind}.gif`);}
manifest.animations.push({action:result.action,accepted:true,source:{q:5,r:10},destination:s.state.units['G-PZ-02'].hex,visibilityImmediate:true,transitionMs:FOG_STYLE.transitionMs,canonicalStateUnchangedDuringFrames:true});runtime.skip();runtime.dispose();
// Handoff evidence: direct replacement; no old player imagery or old unit DOM crosses the gate.
const switches=[];for(const side of ['GERMAN','SOVIET']){s.viewOverride=side;const v=sessionPlayerView(s);const {root:r,renderer}=drawRoot(s);const markup=r.serialize();const hidden=Object.keys(s.state.units).filter(id=>!v.units.some(u=>u.id===id));for(const id of hidden){assert(!markup.includes(`data-unit-id="${id}"`));assert(!markup.includes(`data-presence-id="${id}"`));}manifest.privacy[side]={hiddenIds: hidden,hiddenCounterNodes:0,hiddenPresenceNodes:0,viewerCrossfade:false};switches.push(await frame(s,`${side} · after privacy handoff (immediate replacement)`,bounds,{width:1200,height:608,root:r}));renderer.dispose();}
await sharp({create:{width:1200,height:1332,channels:4,background:'#12202c'}}).composite(switches.map((input,i)=>({input,left:0,top:i*666}))).png().toFile(join(out,'12-viewer-switch-privacy.png'));manifest.files.push('12-viewer-switch-privacy.png');
assert.equal(builds,1);assert.equal(surface.stats.imageDraws,manifest.terrainDraws);manifest.terrainBuildsAfterAllFrames=builds;manifest.fogRasterBuilds=maskBuilds;
writeFileSync(join(out,'evidence-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({out,files:manifest.files.length,terrainBuilds:builds,terrainDraws:surface.stats.imageDraws,contact:contact.hex,lastKnown:memory.hex}));
