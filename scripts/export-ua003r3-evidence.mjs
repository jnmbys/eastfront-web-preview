import {setLocale} from '../dist/app/localization/index.js';
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
import {unit,G,S} from '../tests/helpers/combat-fixture.mjs';
const require=createRequire(import.meta.url),{createCanvas,Image:NativeImage}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/@napi-rs/canvas'),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const {SvgUnitPresentation:BaselineRenderer}=await import(pathToFileURL(resolve(process.argv[3]??'../eastfront-ua001/dist')+'/app/presentation/svgUnits.js'));
const out=resolve(process.argv[2]??'evidence/ua003r3');mkdirSync(out,{recursive:true});
class FileImage extends NativeImage{set src(value){if(value)super.src=readFileSync(fileURLToPath(value));}}
globalThis.Image=FileImage;globalThis.document={documentElement:{lang:'en-US'},baseURI:pathToFileURL(resolve('dist')+'/').href,createElement(tag){assert.equal(tag,'canvas');const c=createCanvas(1,1);c.dataset={};c.setAttribute=(k,v)=>{c[k]=v;};return c;}};
// Software renderer has no CJK font; use the supported English catalog for legible evidence.
setLocale('en-US');
const raw=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const terrainSession=createFreshProductionSession(raw,17),p=createPresentationState(false,false),terrainModel=deriveBrowserRenderModel(terrainSession,p);
const hook=createVS2TerrainSurfaceHooks().worldBase,paint=hook.paint.bind(hook);let builds=0;hook.paint=(...args)=>{builds++;return paint(...args);};
const surface=await buildCachedTerrainSurface(terrainModel,TERRAIN_VISUAL_SEED,'p5','close',hook),bounds=surface.viewBox;
const terrain=surface.canvas.toBuffer('image/png').toString('base64'),css=readFileSync('styles.css','utf8'),grid=coreSvgStaticMarkup(terrainModel,{debug:false,rendererMode:'production',staticTerrainSurface:true});
const s=createFreshProductionSession(raw,2722);s.activeViewerControllerId=G;s.state.phase='GERMAN_MOVEMENT';s.state.activeSide='GERMAN';
const roster=[unit('G-I-01','G-INF','GERMAN','INFANTRY',{q:11,r:2}),unit('G-PZ-01','G-PANZER','GERMAN','PANZER',{q:12,r:2}),unit('G-ART-01','G-ARTY','GERMAN','ARTILLERY',{q:12,r:3}),unit('G-MOT-01','G-MOT','GERMAN','MOTORIZED',{q:10,r:3}),unit('G-I-02','G-INF','GERMAN','INFANTRY',{q:10,r:3}),unit('G-REC-01','G-RECON','GERMAN','RECON',{q:11,r:4}),unit('G-PZ-02','G-PANZER','GERMAN','PANZER',{q:5,r:10}),unit('S-I-01','S-INF','SOVIET','INFANTRY',{q:14,r:4}),unit('S-TK-01','S-TANK','SOVIET','TANK',{q:18,r:2}),unit('S-ART-01','S-ARTY','SOVIET','ARTILLERY',{q:24,r:-2}),unit('S-I-02','S-INF','SOVIET','INFANTRY',{q:20,r:6}),unit('S-I-03','S-INF','SOVIET','INFANTRY',{q:28,r:-4})];
s.state.units=Object.fromEntries(roster.map(u=>[u.id,u]));for(const u of roster)assert(s.state.hexes[`${u.hex.q},${u.hex.r}`]);
const past=structuredClone(s.state);past.units['G-REC-01'].hex={q:16,r:6};past.units['S-I-02'].hex={q:17,r:6};
s.knowledge={GERMAN:rememberPlayerView(derivePlayerView(past,'GERMAN',s.rules))};
const manifest={kind:'software-rendered',locale:'en-US',baseline:'d11712ce6693a493c5fb887e1b48bcbcc9d3539b',fixture:'Arranged real roster on canonical production map; accepted Core MOVE for animation',terrainBuilds:builds,terrainDraws:surface.stats.imageDraws,files:[],visibility:{},animations:[],privacy:{}};
const cache=new Map();let maskBuilds=0;
function encoded(plan,kind='fog'){const k=plan.key+kind;if(cache.has(k))return cache.get(k);const r=rasterizeFog(plan,kind),c=createCanvas(r.width,r.height),ctx=c.getContext('2d'),image=ctx.createImageData(r.width,r.height);image.data.set(r.rgba);ctx.putImageData(image,0,0);const data=c.toBuffer('image/png').toString('base64');cache.set(k,data);maskBuilds++;return data;}
function fogImage(plan,opacity=1,kind='fog'){if(plan.viewer==='OBSERVER')return '';const b=plan.bounds;return `<image x="${b.minX}" y="${b.minY}" width="${b.width}" height="${b.height}" opacity="${opacity}" href="data:image/png;base64,${encoded(plan,kind)}" preserveAspectRatio="none"/>`;}
function drawRoot(session,level='medium',mode='auto'){const root=mapDom(session,p);root.querySelector('#eastfront-map').setAttribute('data-lod',level);const renderer=mode==='baseline'?new BaselineRenderer():new SvgUnitPresentation();if(mode!=='baseline')renderer.setModelDisplay(mode);renderer.bind(root,sessionPlayerView(session).units.map(({id,side,type})=>({id,side,type})));renderer.paint(new Map());return {root,renderer};}
const esc=x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;');
function crop(hex,width=1050,height=610){const c=hexToPixel(hex);return {minX:c.x-width/2,minY:c.y-height/2,width,height};}
async function frame(session,title,box=bounds,{width=1500,height=760,root=null,fog=null,recon=false,level='medium',mode='auto'}={}){
 const view=sessionPlayerView(session),plan=deriveFogPlan(view,recon?'G-REC-01':null),made=root?null:drawRoot(session,level,mode);root??=made.root;
 const dynamic=root.querySelector('#map-dynamic-layer').serialize();
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height+58}"><style>${css}</style><rect width="100%" height="100%" fill="#12202c"/><text x="20" y="24" font-family="sans-serif" font-size="17" fill="#eee4ce">${esc(title)}</text><text x="20" y="45" font-family="sans-serif" font-size="12" fill="#aebdc1">SOFTWARE-RENDERED · production VS2 + Counter + authorized PlayerView · fixed camera</text><svg id="eastfront-map" data-renderer-mode="production" x="0" y="58" width="${width}" height="${height}" viewBox="${box.minX} ${box.minY} ${box.width} ${box.height}"><image x="${bounds.minX}" y="${bounds.minY}" width="${bounds.width}" height="${bounds.height}" href="data:image/png;base64,${terrain}"/>${grid}${fog??fogImage(plan)}${recon?fogImage(plan,1,'recon'):''}${dynamic}</svg></svg>`;
 const png=await sharp(Buffer.from(svg)).png().toBuffer();made?.renderer.dispose();return png;
}
async function save(name,title,box=bounds,options={}){const png=await frame(s,title,box,options);writeFileSync(join(out,name),png);manifest.files.push(name);return png;}

p.selectedUnitId='G-I-01';s.state.units['G-I-01'].step=1;
s.viewOverride='GERMAN';
for(const level of ['far','medium','close']){
 const scale={far:.42,medium:.95,close:1.6}[level],box=crop({q:11,r:3},900/scale,560/scale),panels=[];
 for(const mode of ['baseline','auto','off'])panels.push(await frame(s,`${level.toUpperCase()} · ${mode.toUpperCase()} · matched camera / actual PlayerView`,box,{width:900,height:560,level,mode}));
 const name=`01-${level}-comparison.png`;await sharp({create:{width:2700,height:618,channels:4,background:'#12202c'}}).composite(panels.map((input,i)=>({input,left:i*900,top:0}))).png().toFile(join(out,name));manifest.files.push(name);
}
for(const side of ['GERMAN','SOVIET']){s.viewOverride=side;await save(`02-${side.toLowerCase()}-view.png`,`${side} · AUTO · production VS2 + FOW`,bounds,{level:'far'});manifest.visibility[side]=sessionPlayerView(s).units.map(u=>u.id);}
s.viewOverride='SOVIET';for(const level of ['medium','close'])await save(`03-city-${level}.png`,`CITY · Soviet infantry · ${level}`,crop({q:28,r:-4},900/(level==='close'?1.6:.95),560/(level==='close'?1.6:.95)),{width:900,height:560,level});
s.viewOverride='GERMAN';await save('04-fog-boundary.png','IDENTIFIED / CONTACT / LAST KNOWN · fog boundary',crop({q:14,r:4},880,548),{width:1200,height:747,level:'close'});
if(!process.argv.includes('--static-only')){
 // Accepted movement; the authorized view changes once and its fog mask is reused by every animation frame.
 const time=clock(),runtime=new UnitAnimationRuntime(time);let root=mapDom(s,p);root.querySelector('#eastfront-map').setAttribute('data-lod','close');runtime.sync(s,root);
 const result=dispatchGameAction(s,{type:'MOVE',controllerId:G,unitId:'G-PZ-02',path:[{q:6,r:10},{q:7,r:10},{q:8,r:10}]}).result;assert(result.accepted,JSON.stringify(result.issues));
 root=mapDom(s,p);root.querySelector('#eastfront-map').setAttribute('data-lod','close');runtime.sync(s,root);const truth=JSON.stringify(s.state),frames=[];let previous=0;
 for(let ms=0;ms<=720;ms+=60){time.tick(ms-previous);previous=ms;frames.push(await frame(s,`MOVE · model + plate · ${ms} ms`,crop({q:7,r:10},620,385),{width:1000,height:620,level:'close',root}));assert.equal(JSON.stringify(s.state),truth);}
 await gif('05-movement.gif',frames,1000,678,60);manifest.animations.push({kind:'movement',action:result.action,accepted:true,stateUnchanged:true});runtime.dispose();
 // Production map with an adjacent three-attacker accepted battle. Observer is used only for the evidence comparison.
 const c=createFreshProductionSession(raw,2722);c.viewOverride='OBSERVER';c.activeViewerControllerId=G;c.state.phase='GERMAN_COMBAT';c.state.activeSide='GERMAN';
 c.state.units=Object.fromEntries([unit('G-PZ-01','G-PANZER','GERMAN','PANZER',{q:10,r:10}),unit('G-I-01','G-INF','GERMAN','INFANTRY',{q:10,r:11}),unit('G-I-02','G-INF','GERMAN','INFANTRY',{q:11,r:11}),unit('S-I-01','S-INF','SOVIET','INFANTRY',{q:11,r:10})].map(u=>[u.id,u]));
 const ct=clock(),cr=new UnitAnimationRuntime(ct);let dom=mapDom(c,p);dom.querySelector('#eastfront-map').setAttribute('data-lod','close');cr.sync(c,dom);
 const attack=dispatchGameAction(c,{type:'ATTACK',controllerId:G,attackerUnitIds:['G-PZ-01','G-I-01','G-I-02'],target:{q:11,r:10}}).result;assert(attack.accepted,JSON.stringify(attack.issues));
 if(c.state.pendingDecision?.kind==='DEFENDER_REACTION'){const pass=dispatchGameAction(c,{type:'PASS_REACTION',controllerId:S,battleId:c.state.pendingDecision.battleId}).result;assert(pass.accepted,JSON.stringify(pass.issues));}
 dom=mapDom(c,p);dom.querySelector('#eastfront-map').setAttribute('data-lod','close');cr.sync(c,dom);const ctruth=JSON.stringify(c.state),combat=[],phases=new Set();let last=0;
 const dense=[];for(const mode of ['auto','off'])dense.push(await frame(c,`DENSE BATTLE · ${mode.toUpperCase()} · same camera`,crop({q:11,r:10},620,385),{width:1000,height:620,level:'close',mode}));await sharp({create:{width:2000,height:678,channels:4,background:'#12202c'}}).composite(dense.map((input,i)=>({input,left:i*1000,top:0}))).png().toFile(join(out,'06-dense-auto-off.png'));manifest.files.push('06-dense-auto-off.png');
 for(let ms=0;ms<=720;ms+=60){ct.tick(ms-last);last=ms;for(const state of cr.coordinator.snapshot().values())phases.add(state.phase);combat.push(await frame(c,`THREE ATTACKERS · accepted battle · ${ms} ms`,crop({q:11,r:10},620,385),{width:1000,height:620,level:'close',root:dom}));assert.equal(JSON.stringify(c.state),ctruth);}
 await gif('06-three-attacker-combat.gif',combat,1000,678,60);manifest.animations.push({kind:'combat',action:attack.action,accepted:true,phases:[...phases],stateUnchanged:true});cr.dispose();
}
async function gif(name,frames,width,height,delay){const raws=await Promise.all(frames.map(b=>sharp(b).ensureAlpha().raw().toBuffer()));await sharp(Buffer.concat(raws),{raw:{width,height:height*raws.length,channels:4,pageHeight:height}}).gif({loop:0,delay:frames.map((_,i)=>i===frames.length-1?800:delay)}).toFile(join(out,name));manifest.files.push(name);for(const [i,label]of [[0,'start'],[Math.floor(frames.length/2),'during'],[frames.length-1,'end']])writeFileSync(join(out,name.replace('.gif',`-${label}.png`)),frames[i]);}
assert.equal(builds,1);manifest.terrainBuildsAfterAllFrames=builds;manifest.fogRasterBuilds=maskBuilds;
writeFileSync(join(out,'evidence-manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({out,files:manifest.files.length,terrainBuilds:builds,maskBuilds}));
