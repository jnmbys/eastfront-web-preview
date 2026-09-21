/** Software evidence from the real RulesEngine, coordinator, SVG renderer and Counter V2.
 * Usage: npm run build && node scripts/export-ua002-evidence.mjs
 * SVG + JSON need no extra dependencies. Optional PNG/GIF rasterization is a separate step.
 */
import {mkdirSync,writeFileSync,readFileSync,mkdtempSync,cpSync,symlinkSync,rmSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {AnimationCoordinator,eventDuration,sequenceEvents} from '../dist/app/presentation/coordinator.js';
import {SvgUnitPresentation} from '../dist/app/presentation/svgUnits.js';
import {ANIMATION_TIMING as T} from '../dist/app/presentation/timing.js';
import {clock,harness,move,mapDom,movementFixture} from '../tests/helpers/animation-fixture.mjs';
import {record,battleRun,tacticalRun} from '../tests/helpers/tactical-fixture.mjs';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {polygonPointsString,hexToPixel} from '../dist/app/geometry/hex.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';

const base='8a817dc0abfa1999ac9262108c139ca508fa798a';
const out=resolve(process.argv[2]??'evidence/ua-002');mkdirSync(out,{recursive:true});
const css=readFileSync('styles.css','utf8');
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
const duration=events=>sequenceEvents(events).reduce((n,s)=>n+Math.max(0,...s.parallel.map(eventDuration)),0);
const stageBox={x:-145,y:-180,w:365,h:310};
const center=h=>Object.fromEntries(Object.values(h.s.state.units).map(u=>[u.id,{hex:u.hex,alive:u.alive,step:u.step}]));
function mapArt(h){
 const defs=coreSvgMarkup(deriveBrowserRenderModel(h.s,h.p),{debug:false,rendererMode:'prototype'}).match(/<defs>.*?<\/defs>/s)?.[0]??'';
 const grid=Object.values(h.s.state.hexes).map(hex=>`<polygon points="${polygonPointsString(hex.coord)}" fill="#243541" stroke="#4d5a60" stroke-width=".7"/>`).join('');
 return `${defs}${grid}${h.dom().querySelector('#counter-layer').serialize()}`;
}
function frame(h,at){return {at,states:[...h.runtime.coordinator.snapshot().values()],art:mapArt(h),ghosts:h.dom().querySelectorAll('[data-presentation-ghost]').length};}
function showMap(art,x,y,w,h){return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${stageBox.x} ${stageBox.y} ${stageBox.w} ${stageBox.h}" preserveAspectRatio="xMidYMid meet">${art}</svg>`;}
function svg(title,body,w=960,h=450){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${css}</style><rect width="100%" height="100%" fill="#101d29"/><g font-family="sans-serif" fill="#f0e6cf"><text x="24" y="32" font-size="20" font-weight="700">EASTFRONT · ${escape(title)}</text><text x="24" y="55" font-size="12" fill="#b0bebf">SOFTWARE-RENDERED · real accepted Core facts / actual Counter V2 + presentation renderer</text>${body}</g></svg>`.replace(/[ \t]+\n/g,'\n')+'\n';}
const all=[];
function exportSequence(id,title,h,{start=0,end=duration(h.events),samples=6,focus}={}){
 if(start)h.time.tick(start);
 const selected=Array.from({length:samples},(_,i)=>Math.round(start+(end-start)*i/(samples-1)));
 const frames=[];let last=start;
 for(let at=start;at<=end+24;at+=24){const current=Math.min(end,at);h.time.tick(current-last);last=current;frames.push(frame(h,current));if(current===end)break;}
 const cells=selected.map(at=>frames.reduce((a,b)=>Math.abs(b.at-at)<Math.abs(a.at-at)?b:a));
 const body=cells.map((f,i)=>{
  const x=18+(i%3)*312,y=84+Math.floor(i/3)*220;
  const phases=f.states.filter(s=>!focus||s.unitId===focus).map(s=>`${s.unitId}: ${s.phase}`).join(' · ')||'canonical settle';
  return `<rect x="${x}" y="${y}" width="300" height="207" rx="5" fill="#1c2b37" stroke="#42505a"/>${showMap(f.art,x+4,y+3,292,174)}<text x="${x+10}" y="${y+186}" font-size="11">${f.at} ms · ${escape(phases)}</text>`;
 }).join('');
 writeFileSync(join(out,`${id}-strip.svg`),svg(title,body,960,548));
 const framesDir=join(out,'frames',id);mkdirSync(framesDir,{recursive:true});
 for(const [i,f]of frames.entries()){
  const phases=f.states.filter(s=>!focus||s.unitId===focus).map(s=>`${s.unitId}: ${s.phase}`).join(' · ')||'canonical settle';
  writeFileSync(join(framesDir,`${String(i).padStart(3,'0')}.svg`),svg(title,`${showMap(f.art,18,70,604,320)}<text x="24" y="420" font-size="14">${f.at} ms · ${escape(phases)}</text><text x="24" y="445" font-size="11" fill="#b0bebf">Normal speed. Fixed camera. Plain canonical-hex fixture; no VS2 terrain rendering.</text>`,640,468));
 }
 all.push({id,title,start,end,frameIntervalMs:24,events:h.events,batches:h.batches??[],canonical: center(h),pendingDecision:h.s.state.pendingDecision?.kind??null,
  frames:frames.map(({art,...f})=>f)});
 h.finish();
}

const moving=record(harness(movementFixture()));dispatchGameAction(moving.s,move('g',[{q:1,r:0},{q:1,r:1}]));moving.remount();
exportSequence('01-move','MOVE · weighted travel and arrival settle',moving);
const tactical=tacticalRun();
for(const [id,kind,title]of [['02-retreat','retreat','RETREAT · urgent withdrawal'],['03-advance','advance','ADVANCE · direct entry'],['04-breakthrough','breakthrough','BREAKTHROUGH · stronger forward emphasis']]){
 const h=tacticalRun(),event=h.events.find(e=>e.kind===kind);let start=0;
 for(const step of sequenceEvents(h.events)){if(step.parallel.includes(event))break;start+=Math.max(...step.parallel.map(eventDuration));}
 exportSequence(id,title,h,{start,end:start+eventDuration(event),focus:event.unitId});
}
tactical.finish();
exportSequence('05-single-combat','Single attacker · windup / fire / hit',tacticalRun(),{end:T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION});
exportSequence('06-multi-combat','Three attackers · staggered fire / loss',battleRun({multi:true}));
exportSequence('07-hit','HIT · brief displacement and edge emphasis',tacticalRun(),{start:T.COMBAT_WINDUP+T.COMBAT_FIRE,end:T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION,focus:'d'});
exportSequence('08-destroyed','DESTROYED · noninteractive ghost / canonical absence',battleRun({destroy:true}),{start:T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION});

// Load the actual baseline implementation, not a hand-written approximation of UA-001.
const temp=mkdtempSync(join(tmpdir(),'eastfront-ua002-baseline-'));
try{
 cpSync('dist/app',join(temp,'app'),{recursive:true});symlinkSync(resolve('dist/vendor'),join(temp,'vendor'));writeFileSync(join(temp,'package.json'),'{"type":"module"}');
 for(const name of ['coordinator','events','runtime','svgUnits','timing','transitionBus']){
  const source=execFileSync('git',['show',`${base}:src/presentation/${name}.ts`],{encoding:'utf8'});
  writeFileSync(join(temp,'app/presentation',`${name}.js`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
 }
 const old=await import(pathToFileURL(join(temp,'app/presentation/coordinator.js'))),oldSvg=await import(pathToFileURL(join(temp,'app/presentation/svgUnits.js')));
 const results=[];
 for(const [label,Coordinator,Renderer]of [['UA-001 baseline',old.AnimationCoordinator,oldSvg.SvgUnitPresentation],['UA-002',AnimationCoordinator,SvgUnitPresentation]]){
  const h=record(harness());dispatchGameAction(h.s,move('g',[{q:1,r:0}]));h.runtime.skip();h.remount();
  const time=clock(),renderer=new Renderer();renderer.bind(h.dom());const queue=new Coordinator(time,states=>renderer.paint(states));queue.enqueue(sequenceEvents(h.events));
  const samples=[];let prior=0;for(const at of [0,65,130,234,260]){time.tick(at-prior);prior=at;samples.push({at,states:[...queue.snapshot().values()],art:mapArt(h)});}
  results.push({label,samples});h.finish();
 }
 const body=results.map((row,r)=>`<text x="20" y="${88+r*211}" font-size="15">${row.label}</text>`+row.samples.map((f,i)=>`${showMap(f.art,16+i*188,98+r*211,182,165)}<text x="${25+i*188}" y="${281+r*211}" font-size="12">${f.at} ms</text>`).join('')).join('');
 writeFileSync(join(out,'00-move-before-after.svg'),svg('MOVE · actual baseline vs UA-002',body,960,520));
 writeFileSync(join(out,'move-before-after-trace.json'),JSON.stringify({baselineCommit:base,results:results.map(r=>({...r,samples:r.samples.map(({art,...f})=>f)}))},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
writeFileSync(join(out,'traces.json'),JSON.stringify({evidenceType:'software-rendered',baselineCommit:base,notes:['No browser capture.','Core results were known before playback.','Decision pauses are excluded; queued tactical choices were accepted before sampling.','A segment endpoint may already start the next queued phase.'],sequences:all},null,2));
console.log(JSON.stringify({output:out,sequences:all.map(s=>({id:s.id,start:s.start,end:s.end,frames:s.frames.length,pendingDecision:s.pendingDecision}))},null,2));
