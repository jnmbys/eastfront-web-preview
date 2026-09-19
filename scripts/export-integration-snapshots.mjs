import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  deploymentHexKeysForSide,
  validateMoveAction,
} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {
  controllerIdForSide,
  createLocalGameSession,
  dispatchGameAction,
  setActiveViewer,
} from '../dist/app/core-adapter/session.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { coreSvgMarkup } from '../dist/app/render/coreSvg.js';
import { createPresentationState } from '../dist/app/state/presentation.js';

const raw = JSON.parse(await readFile('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','utf8'));
const css = (await readFile('styles.css','utf8'))
  .replace(/transition:[^;]+;/g,'')
  .replace(/filter:url\([^;]+;/g,'')
  .replace(/filter:drop-shadow\([^;]+;/g,'');
await mkdir('screenshots',{recursive:true});

function key(hex){ return `${hex.q},${hex.r}`; }
function planFor(session,side){
  const ids=session.scenario.deployment.units.filter((u)=>u.side===side).map((u)=>u.id).sort();
  const zone=deploymentHexKeysForSide(session.state,session.scenario,side);
  if(zone.length*session.rules.stackingLimit<ids.length) throw new Error(`Insufficient ${side} zone capacity`);
  const plan={};
  ids.forEach((id,index)=>{const hex=session.state.hexes[zone[Math.floor(index/session.rules.stackingLimit)]]; if(!hex)throw new Error('Missing plan hex'); plan[id]={...hex.coord};});
  return {ids,plan};
}
function deploy(session,id,hex){
  const result=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId:session.activeViewerControllerId,deploymentUnitId:id,hex}).result;
  if(!result.accepted)throw new Error(`Deploy ${id}: ${JSON.stringify(result.issues)}`);
}
function deployAll(session,side){ const {ids,plan}=planFor(session,side); for(const id of ids)deploy(session,id,plan[id]); }
function ready(session){
  const result=dispatchGameAction(session,{type:'READY_FOR_PHASE_END',controllerId:session.activeViewerControllerId}).result;
  if(!result.accepted)throw new Error(`Ready: ${JSON.stringify(result.issues)}`);
}
function firstLegalGermanMove(session){
  const controllerId=controllerIdForSide(session,'GERMAN');
  const units=Object.values(session.state.units).filter((u)=>u.alive&&u.side==='GERMAN'&&u.controllerId===controllerId).sort((a,b)=>a.id.localeCompare(b.id));
  const dirs=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
  for(const unit of units){
    for(const d of dirs){
      const dest={q:unit.hex.q+d.q,r:unit.hex.r+d.r};
      if(!session.state.hexes[key(dest)])continue;
      const action={type:'MOVE',controllerId,unitId:unit.id,path:[dest]};
      if(validateMoveAction(session.state,session.rules,action).issues.length===0)return {unit,action};
    }
  }
  throw new Error('No legal one-step German move');
}
function standalone(model,width,height,debug=false){
  let svg=coreSvgMarkup(model,{debug});
  const match=svg.match(/viewBox="([^"]+)"/); if(!match)throw new Error('viewBox missing');
  const [x,y,w,h]=match[1].split(' ').map(Number);
  svg=svg.replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `);
  svg=svg.replace('>',`><style type="text/css"><![CDATA[${css}]]></style><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bbb393"/>`);
  return svg;
}
async function snapshot(name,session,presentation,width=1366,height=1024){
  const model=deriveBrowserRenderModel(session,presentation);
  await writeFile(`screenshots/${name}.svg`,standalone(model,width,height,presentation.debug));
  return {name,phase:model.phase,turn:model.turn,viewer:model.viewerSide,counters:model.counters.length,selected:model.selectedCounter?.id??null};
}

const session=createLocalGameSession(raw,17);
const presentation=createPresentationState(false,false);
const stages=[];

// 1) Actual Soviet deployment using Core roster/actions. Capture completed Soviet setup before Ready.
deployAll(session,'SOVIET');
stages.push(await snapshot('soviet-deployment-1366x1024',session,presentation));
ready(session);

// 2) Core has advanced to German deployment. German viewer sees zero Soviet positions.
setActiveViewer(session,controllerIdForSide(session,'GERMAN'));
const german=planFor(session,'GERMAN');
for(const id of german.ids.slice(0,12))deploy(session,id,german.plan[id]);
stages.push(await snapshot('german-hidden-deployment-1366x1024',session,presentation));
for(const id of german.ids.slice(12))deploy(session,id,german.plan[id]);
ready(session);

// 3) Accepted German Ready has entered real Turn 1; full 58-unit state is now visible.
stages.push(await snapshot('revealed-turn1-1366x1024',session,presentation));

// 4) Advance through Supply/Rail and execute a dynamically validated real MOVE.
ready(session);
const candidate=firstLegalGermanMove(session);
presentation.selectedUnitId=candidate.unit.id;
const before={...candidate.unit.hex};
const moved=dispatchGameAction(session,candidate.action).result;
if(!moved.accepted)throw new Error(`Move rejected: ${JSON.stringify(moved.issues)}`);
stages.push(await snapshot('real-move-1366x1024',session,presentation));

await writeFile('screenshots/integration-snapshot-manifest.json',JSON.stringify({seed:17,movedUnit:candidate.unit.id,from:before,to:candidate.action.path[0],stages},null,2));
console.log(JSON.stringify({movedUnit:candidate.unit.id,from:before,to:candidate.action.path[0],stages},null,2));
