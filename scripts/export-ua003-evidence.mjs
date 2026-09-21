/** Production Counter + UnitPresence + UA-002 playback exports, not browser screenshots. */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {harness,movementFixture,move} from '../tests/helpers/animation-fixture.mjs';
import {record,battleRun,tacticalRun,attack} from '../tests/helpers/tactical-fixture.mjs';
import {fixture,unit,G,S,ordinary} from '../tests/helpers/combat-fixture.mjs';
import {defaultRules} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {dispatchGameAction} from '../dist/app/core-adapter/session.js';
import {sequenceEvents,eventDuration} from '../dist/app/presentation/coordinator.js';
import {ANIMATION_TIMING as T} from '../dist/app/presentation/timing.js';
import {polygonPointsString} from '../dist/app/geometry/hex.js';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const out=resolve(process.argv[2]??'evidence/ua-003'),frameRoot=resolve(process.argv[3]??'/tmp/eastfront-ua003-frames');mkdirSync(out,{recursive:true});
const css=readFileSync('styles.css','utf8'),traces=[];
const text=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;');
const duration=h=>sequenceEvents(h.events).reduce((s,step)=>s+Math.max(...step.parallel.map(eventDuration)),0);
function lod(h,value){h.dom().querySelector('#eastfront-map').setAttribute('data-lod',value);h.runtime.sync(h.s,h.dom());return h;}
function art(h){const root=h.dom();return root.querySelector('[data-presence-definitions]').serialize()+root.querySelector('[data-unit-presence-layer]').serialize()+root.querySelector('#counter-layer').serialize();}
function canvas(title,body,w=1100,h=950){return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><style>${css}</style><rect width="100%" height="100%" fill="#101c27"/><g fill="#f0e8d5" font-family="sans-serif"><text x="24" y="34" font-size="21" font-weight="700">EASTFRONT UA-003 · ${text(title)}</text><text x="24" y="58" font-size="12" fill="#acb9ba">SOFTWARE-RENDERED · production Counter V2 / presence / coordinator · not a browser capture</text>${body}</g></svg>`;}
async function save(id,svg){svg=svg.replace(/[ \t]+\n/g,'\n').trimEnd()+'\n';writeFileSync(join(out,id+'.svg'),svg);await sharp(Buffer.from(svg)).png().toFile(join(out,id+'.png'));}
function stage(h,x,y,w,height,view='-145 -145 330 260'){
 const grid=Object.values(h.s.state.hexes).map(hex=>`<polygon points="${polygonPointsString(hex.coord)}" fill="#777963" stroke="#474f49" stroke-width=".4"/>`).join('');
 return `<svg x="${x}" y="${y}" width="${w}" height="${height}" viewBox="${view}" preserveAspectRatio="xMidYMid meet">${grid}${art(h)}</svg>`;
}
for(const level of ['far','medium','close']){
 let body='';const entries=Object.entries(defaultRules.unitTemplates);
 for(const [i,[id,t]]of entries.entries()){
  const h=lod(harness(movementFixture([unit(id,id,t.side,t.type,{q:0,r:0})])),level);
  const x=18+(i%5)*214,y=82+Math.floor(i/5)*205;
  body+=`<rect x="${x}" y="${y}" width="206" height="194" rx="5" fill="#263640" stroke="#46535a"/>${stage(h,x+3,y+3,200,149,'-58 -66 116 105')}<text x="${x+12}" y="${y+166}" font-size="12">${id} · ${t.type}</text><text x="${x+12}" y="${y+183}" font-size="11" fill="#b7c2bd">${t.side} / ${level.toUpperCase()}</text>`;h.runtime.dispose();
 }
 await save(`01-roster-${level}`,canvas(`Actual unit templates / ${level.toUpperCase()}`,body,1100,920));
}
// Real canonical stack placement, contrasting LODs at comparable magnification.
let stackBody='';for(const [i,level]of ['far','medium','close'].entries()){
 const h=lod(harness(movementFixture([unit('G-I-01','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('G-PZ-01','G-PANZER','GERMAN','PANZER',{q:0,r:0})])),level);
 stackBody+=stage(h,18+i*360,90,344,275,'-80 -80 160 140')+`<text x="${30+i*360}" y="395" font-size="17">${level.toUpperCase()} · canonical two-unit stack</text>`;h.runtime.dispose();
}
await save('02-stack-lod',canvas('Counter-first stack composition',stackBody,1100,440));
async function sequence(id,title,make,{start=0,end,view='-145 -145 330 260',focus}={}){
 for(const level of ['medium','close']){
  const h=lod(make(),level),finish=end??duration(h),sampleAt=[start,start+(finish-start)*.16,start+(finish-start)*.34,start+(finish-start)*.52,start+(finish-start)*.74,finish].map(Math.round);
  const frames=[],frameTimes=[];let prior=0;h.time.tick(start);prior=start;
  const folder=join(frameRoot,`${id}-${level}`);mkdirSync(folder,{recursive:true});
  const atValues=[...new Set([...sampleAt,...Array.from({length:Math.ceil((finish-start)/24)+1},(_,i)=>Math.min(finish,start+i*24))])].sort((a,b)=>a-b);
  for(const [i,at] of atValues.entries()){
   h.time.tick(at-prior);prior=at;
   const groups=new Map();for(const s of h.runtime.coordinator.snapshot().values()){if(focus&&s.unitId!==focus)continue;groups.set(s.phase,[...(groups.get(s.phase)??[]),s.unitId]);}const phases=[...groups].map(([phase,ids])=>`${phase}: ${ids.join(',')}`).join(' / ')||'canonical settle';
   const rendered=stage(h,20,84,720,430,view);
   const svg=canvas(`${title} / ${level.toUpperCase()}`,rendered+`<text x="26" y="545" font-size="13">${at} ms · ${text(phases)}</text><text x="26" y="570" font-size="12" fill="#acb9ba">Accepted Core facts. Fixed camera. Plain hex fixture; no VS2 rebuild.</text>`,760,598);
   const entry={at,art:art(h),phases,states:[...h.runtime.coordinator.snapshot().values()],ghosts:h.dom().querySelectorAll('[data-presence-ghost]').length};frames.push(entry);
   if(at===start||at===finish||(at-start)%24===0){const file=`${String(i).padStart(3,'0')}.png`;await sharp(Buffer.from(svg)).png().toFile(join(folder,file));frameTimes.push({file,at});}
  }
  const body=sampleAt.map((at,i)=>{const f=frames.find(f=>f.at===at),x=18+i%3*356,y=88+Math.floor(i/3)*262;return `<rect x="${x}" y="${y}" width="344" height="246" fill="#73775f" stroke="#64716b"/><svg x="${x+2}" y="${y+2}" width="340" height="207" viewBox="${view}">${f.art}</svg><text x="${x+9}" y="${y+226}" fill="#fff4dc" font-size="11">${at} ms · ${text(f.phases)}</text>`;}).join('');
  await save(`${id}-${level}`,canvas(`${title} / ${level.toUpperCase()}`,body,1100,632));
  writeFileSync(join(folder,'frame-times.json'),JSON.stringify(frameTimes,null,2));
  traces.push({id,level,events:h.events,from:start,to:finish,frames:frames.map(({art,...entry})=>entry),finalCanonical:h.s.state.units});h.finish();h.runtime.dispose();
 }
}
await sequence('03-move','MOVE / identical Counter + presence anchors',()=>{const h=record(harness());dispatchGameAction(h.s,move('g',[{q:1,r:0}]));h.remount();return h;},{view:'-70 -84 220 175'});
await sequence('04-three-attackers','Three actual attackers / staggered fire',()=>battleRun({multi:true}));
await sequence('05-armor-fire','Armor fire / target-directed cue',()=>tacticalRun(),{end:T.COMBAT_WINDUP+T.COMBAT_FIRE,view:'-155 -102 270 200'});
await sequence('06-infantry-fire','Infantry fire / short burst',()=>battleRun(),{end:T.COMBAT_WINDUP+T.COMBAT_FIRE});
await sequence('07-hit','HIT / brief emphasis and settle',()=>tacticalRun(),{start:T.COMBAT_WINDUP+T.COMBAT_FIRE,end:T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION,focus:'d'});
await sequence('08-destroyed','DESTROYED / inert companion ghost then absence',()=>battleRun({destroy:true}),{start:T.COMBAT_WINDUP+T.COMBAT_FIRE+T.HIT_REACTION});
for(const [id,kind]of [['09-retreat','retreat'],['10-advance','advance'],['11-breakthrough','breakthrough']]){
 const reference=tacticalRun();let start=0,event;for(const step of sequenceEvents(reference.events)){event=step.parallel.find(e=>e.kind===kind);if(event)break;start+=Math.max(...step.parallel.map(eventDuration));}reference.finish();reference.runtime.dispose();
 await sequence(id,kind.toUpperCase(),()=>tacticalRun(),{start,end:start+eventDuration(event),view:'-170 -180 425 295',focus:event.unitId});
}
function support(){const h=record(harness(fixture(2722,[...ordinary(),unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:-2,r:0}),unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2})])));const r=dispatchGameAction(h.s,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0},support:{attackerArtilleryUnitId:'ga'}}).result;if(!r.accepted)throw Error(JSON.stringify(r.issues));for(const action of [{type:'COMBAT_REACTION',controllerId:S,battleId:r.battleId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}},{type:'PASS_REACTION',controllerId:S,battleId:r.battleId}]){const result=dispatchGameAction(h.s,action).result;if(!result.accepted)throw Error(JSON.stringify(result.issues));}h.remount();return h;}
await sequence('12-support-artillery','Confirmed attacking + defending artillery support',support,{view:'-205 -90 400 300'});
// Matched composition: the Counter renderer itself is byte-identical to UA002.
let comparison='';for(const [row,id]of ['G-INF','G-PANZER','S-ARTY'].entries())for(const [col,level]of ['baseline','medium','close'].entries()){
 const t=defaultRules.unitTemplates[id],h=lod(harness(movementFixture([unit(id,id,t.side,t.type,{q:0,r:0})])),level==='baseline'?'far':level);
 const x=18+col*355,y=88+row*215;
 comparison+=stage(h,x,y,340,176,'-70 -75 140 125')+`<text x="${x+12}" y="${y+198}" font-size="13">${id} · ${level==='baseline'?'UA002 Counter / unchanged':'UA003 '+level.toUpperCase()}</text>`;h.runtime.dispose();
}
await save('14-matched-before-after',canvas('Matched Counter-only / Medium / Close',comparison,1100,748));
writeFileSync(join(out,'traces.json'),JSON.stringify({type:'software-rendered',source:'real accepted RulesEngine facts / production Counter and presence renderer',browserManualValidation:'pending',frameIntervalMs:24,sequences:traces},null,2));
console.log(JSON.stringify({output:out,rosterSheets:3,sequences:traces.length}));
