import {readFile,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {controllerIdForSide,createLocalGameSession,dispatchGameAction,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup,viewBoxForHexes} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {deploymentHexKeysForSide} from '../dist/vendor/eastfront-digital-core/dist/index.js';
const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const out='screenshots/ui007r1';await mkdir(`${out}/evidence-assets`,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const beforeS02=new URL('../screenshots/ui007r1/evidence-assets/S02-UI007-before.png',import.meta.url);
const runtimeS02=new URL('../public/assets/terrain/p4r3/city/small/S02.png',import.meta.url);
function fresh(){return createLocalGameSession(raw,17)}
function planFor(s,side,preferMarsh=false){const ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort(),zone=deploymentHexKeysForSide(s.state,s.scenario,side);const ordered=[...zone].sort((a,b)=>{if(preferMarsh){const am=s.state.hexes[a].terrain==='MARSH'?0:1,bm=s.state.hexes[b].terrain==='MARSH'?0:1;if(am!==bm)return am-bm;}return a.localeCompare(b)}),plan={};ids.forEach((id,i)=>plan[id]={...s.state.hexes[ordered[Math.floor(i/s.rules.stackingLimit)]].coord});return {ids,plan};}
function deployAll(s,side,preferMarsh=false){const cid=controllerIdForSide(s,side),{ids,plan}=planFor(s,side,preferMarsh);for(const id of ids){const r=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:plan[id]}).result;if(!r.accepted)throw Error(JSON.stringify(r.issues));}}
function turn1Marsh(){const s=fresh();deployAll(s,'SOVIET',true);dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'SOVIET')});setActiveViewer(s,controllerIdForSide(s,'GERMAN'));deployAll(s,'GERMAN',false);dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;}
function crop(svg,hexes,margin=20){const v=viewBoxForHexes(hexes,margin);return svg.replace(/viewBox="[^"]+"/,`viewBox="${v.minX} ${v.minY} ${v.width} ${v.height}"`)}
function baseSvg(s,lod,p=createPresentationState(),marshContinuity=true){const m=deriveBrowserRenderModel(s,p);return {m,svg:coreSvgMarkup(m,{debug:false,rendererMode:'production',assetSet:'p5',lod,scenarioSeed:s.state.random.seed,marshContinuity})};}
const files=[];async function save(name,svg,meta={}){await writeFile(`${out}/${name}`,svg);files.push({name,sha256:sha(svg),...meta});}
const blank=fresh(),med=baseSvg(blank,'medium'),close=baseSvg(blank,'close'),far=baseSvg(blank,'far');
const south=med.m.hexes.filter(h=>h.coord.r>=10),marshFocus=med.m.hexes.filter(h=>h.coord.r>=10&&h.coord.q<=16);
await save('01-south-marsh-medium-r1.svg',crop(med.svg,marshFocus,24),{lod:'medium',view:'south-marsh',continuity:true});
await save('02-south-marsh-close-r1.svg',crop(close.svg,marshFocus,24),{lod:'close',view:'south-marsh',continuity:true});
await save('03-full-far-r1.svg',far.svg,{lod:'far',view:'full',continuity:true});
const t1=turn1Marsh(),t1v=baseSvg(t1,'medium');await save('04-turn1-counters-over-marsh-r1.svg',crop(t1v.svg,south,24),{lod:'medium',view:'turn1-south',counterCount:t1v.m.counters.length});
const baseNoContinuity=baseSvg(blank,'medium',createPresentationState(),false);await save('05-ab-marsh-ui007-baseline.svg',crop(baseNoContinuity.svg,marshFocus,24),{lod:'medium',view:'south-marsh',continuity:false});await save('06-ab-marsh-ui007r1.svg',crop(med.svg,marshFocus,24),{lod:'medium',view:'south-marsh',continuity:true});
const target={q:29,r:-5},cityRegion=med.m.hexes.filter(h=>Math.abs(h.coord.q-target.q)<=3&&Math.abs(h.coord.r-target.r)<=3),cityCurrent=crop(close.svg,cityRegion,28);const beforeCity=cityCurrent.replaceAll('/assets/terrain/p4r3/city/small/S02.png','evidence-assets/S02-UI007-before.png');await save('07-city-s02-before.svg',beforeCity,{lod:'close',view:'outer-city-29--5',asset:'S02',stage:'before'});
const oldBytes=await readFile(beforeS02),newBytes=await readFile(runtimeS02),changed=sha(oldBytes)!==sha(newBytes);if(changed){await save('08-city-s02-after.svg',cityCurrent,{lod:'close',view:'outer-city-29--5',asset:'S02',stage:'after'});}await save('09-city-railway-close.svg',cityCurrent,{lod:'close',view:'outer-city-railway'});
await writeFile(`${out}/manifest.json`,JSON.stringify({generatedAt:new Date().toISOString(),renderer:'compiled coreSvgMarkup',scenario:'Strategic Reset F',seed:17,s02:{beforeSha256:sha(oldBytes),runtimeSha256:sha(newBytes),changed},files},null,2));
console.log(`UI-007R1 snapshots: ${files.length} SVGs; S02 changed=${changed}`);
