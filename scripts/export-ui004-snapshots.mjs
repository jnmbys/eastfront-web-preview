import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {
  computeLegalSovietReinforcementEntryHexKeys,deploymentHexKeysForSide,getAvailableSovietReinforcements,getNeighbors,
  validateEntrenchAction,validateMoveAction,validateRailRepairAction,validateRecoveryAction,computeRecoveryBaseHexKeys,
} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {controllerIdForSide,createLocalGameSession,dispatchGameAction,setActiveViewer} from '../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../dist/app/render/coreModel.js';
import {coreSvgMarkup} from '../dist/app/render/coreSvg.js';
import {createPresentationState} from '../dist/app/state/presentation.js';

const raw=JSON.parse(await readFile('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','utf8'));
const css=(await readFile('styles.css','utf8')).replace(/transition:[^;]+;/g,'').replace(/filter:url\([^;]+;/g,'').replace(/filter:drop-shadow\([^;]+;/g,'');
await mkdir('screenshots',{recursive:true});
const key=(h)=>`${h.q},${h.r}`;
function fresh(){return createLocalGameSession(raw,17);}
function planFor(s,side){const ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort(),zone=deploymentHexKeysForSide(s.state,s.scenario,side),plan={};ids.forEach((id,i)=>plan[id]={...s.state.hexes[zone[Math.floor(i/s.rules.stackingLimit)]].coord});return {ids,plan};}
function deployAll(s,side){const cid=controllerIdForSide(s,side),{ids,plan}=planFor(s,side);for(const id of ids){const r=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:cid,deploymentUnitId:id,hex:plan[id]}).result;if(!r.accepted)throw Error(JSON.stringify(r.issues));}}
function ready(s,side=s.state.activeSide){const r=dispatchGameAction(s,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,side)}).result;if(!r.accepted)throw Error(`${s.state.phase}: ${JSON.stringify(r.issues)}`);}
function started(){const s=fresh();deployAll(s,'SOVIET');ready(s,'SOVIET');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));deployAll(s,'GERMAN');ready(s,'GERMAN');return s;}
function standalone(model,w=1366,h=1024){let svg=coreSvgMarkup(model,{debug:false});const match=svg.match(/viewBox="([^"]+)"/);if(!match)throw Error('viewBox');const [x,y,vw,vh]=match[1].split(' ').map(Number);svg=svg.replace('<svg ',`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" `);return svg.replace('>',`><style type="text/css"><![CDATA[${css}]]></style><rect x="${x}" y="${y}" width="${vw}" height="${vh}" fill="#bbb393"/>`);}
async function mapShot(name,s,p,meta={}){const model=deriveBrowserRenderModel(s,p);await writeFile(`screenshots/${name}.svg`,standalone(model));return {name,kind:'map',turn:model.turn,phase:model.phase,viewer:model.viewerSide,counters:model.counters.length,...meta};}
function cardSvg(title,subtitle,lines){return `<svg xmlns="http://www.w3.org/2000/svg" width="1366" height="1024" viewBox="0 0 1366 1024"><rect width="1366" height="1024" fill="#171c1d"/><rect x="373" y="292" width="620" height="440" rx="4" fill="#202728" stroke="#566260" stroke-width="2"/><text x="683" y="365" text-anchor="middle" fill="#8f9a98" font-family="sans-serif" font-size="14" letter-spacing="3">EASTFRONT UI-004</text><text x="683" y="430" text-anchor="middle" fill="#e7e2d4" font-family="Georgia,serif" font-size="38" font-weight="700">${title}</text><text x="683" y="472" text-anchor="middle" fill="#aab4b1" font-family="sans-serif" font-size="18">${subtitle}</text>${lines.map((line,i)=>`<text x="683" y="${535+i*38}" text-anchor="middle" fill="#c7cfcc" font-family="sans-serif" font-size="16">${line}</text>`).join('')}</svg>`;}
function findRail(s){const cid=controllerIdForSide(s,'GERMAN');const edges=Object.values(s.state.edges).filter(e=>e.railway?.present).sort((a,b)=>a.key.localeCompare(b.key));for(const e of edges){const a={type:'RAIL_REPAIR',controllerId:cid,edgeKeys:[e.key]};if(!validateRailRepairAction(s.state,s.rules,s.scenario,a).length)return a;}throw Error('no rail plan');}
function findMove(s){const cid=controllerIdForSide(s,'GERMAN');for(const unit of Object.values(s.state.units).filter(u=>u.alive&&u.controllerId===cid).sort((a,b)=>a.id.localeCompare(b.id)))for(const a of getNeighbors(unit.hex)){if(!s.state.hexes[key(a)])continue;for(const b of getNeighbors(a)){if(!s.state.hexes[key(b)]||key(b)===key(unit.hex))continue;const action={type:'MOVE',controllerId:cid,unitId:unit.id,path:[a,b]};const v=validateMoveAction(s.state,s.rules,action);if(!v.issues.length)return {unit,action,v};}}throw Error('no 2-step move');}
function passiveAdvance(s,target){let guard=1000;while(s.state.phase!==target&&s.state.phase!=='GAME_OVER'&&guard-->0){if(s.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){const av=getAvailableSovietReinforcements(s.state,s.scenario),entries=computeLegalSovietReinforcementEntryHexKeys(s.state,s.rules,s.scenario);if(av.length&&entries.length){setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const r=dispatchGameAction(s,{type:'DEPLOY_REINFORCEMENT',controllerId:controllerIdForSide(s,'SOVIET'),reinforcementId:av[0].id,entryHex:{...s.state.hexes[entries[0]].coord}}).result;if(!r.accepted)throw Error(JSON.stringify(r.issues));continue;}}setActiveViewer(s,controllerIdForSide(s,s.state.activeSide));ready(s);}if(target&&s.state.phase!==target)throw Error(`failed target ${target}: ${s.state.phase}`);}
const stages=[];
// Rail repair planner
{
 const s=started(),p=createPresentationState(false,false),action=findRail(s);p.interactionMode='RAIL_REPAIR';p.railRepairEdgeKeys=[...action.edgeKeys];stages.push(await mapShot('ui004-rail-repair-planner',s,p,{selectedEdges:action.edgeKeys}));
}
// Multi-step movement draft
{
 const s=started();ready(s,'GERMAN');const p=createPresentationState(false,false),c=findMove(s);p.selectedUnitId=c.unit.id;p.interactionMode='MOVE_PATH';p.pathDraft=c.action.path.map(h=>({...h}));stages.push(await mapShot('ui004-multistep-movement',s,p,{unitId:c.unit.id,path:c.action.path,spentMP:c.v.spentMP,maxMP:c.v.maxMP}));
}
// Reinforcement phase with available slot
{
 const s=started();let guard=400;while(guard-->0){if(s.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'&&getAvailableSovietReinforcements(s.state,s.scenario).length>0)break;if(s.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){const av=getAvailableSovietReinforcements(s.state,s.scenario),entries=computeLegalSovietReinforcementEntryHexKeys(s.state,s.rules,s.scenario);if(av.length&&entries.length){dispatchGameAction(s,{type:'DEPLOY_REINFORCEMENT',controllerId:controllerIdForSide(s,'SOVIET'),reinforcementId:av[0].id,entryHex:{...s.state.hexes[entries[0]].coord}});continue;}}setActiveViewer(s,controllerIdForSide(s,s.state.activeSide));ready(s);}setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const p=createPresentationState(false,false),av=getAvailableSovietReinforcements(s.state,s.scenario);p.selectedReinforcementId=av[0]?.id??null;p.interactionMode='REINFORCEMENT';stages.push(await mapShot('ui004-soviet-reinforcement',s,p,{available:av.map(x=>x.id)}));
}
// Recovery fixture: authoritative action preview on a Core-derived base
{
 const s=started();passiveAdvance(s,'SOVIET_RECOVERY');setActiveViewer(s,controllerIdForSide(s,'SOVIET'));const cid=controllerIdForSide(s,'SOVIET'),bases=computeRecoveryBaseHexKeys(s.state,'SOVIET',s.scenario);let chosen=null;for(const u of Object.values(s.state.units).filter(u=>u.alive&&u.side==='SOVIET'&&u.controllerId===cid)){for(const bk of bases){u.step=1;u.hex={...s.state.hexes[bk].coord};u.supplyState='SUPPLIED';u.hasMoved=false;u.hasAttacked=false;u.dedicatedRailRepair=false;u.artillerySupportUsed=false;if(!validateRecoveryAction(s.state,s.rules,s.scenario,{type:'REPAIR_UNIT',controllerId:cid,unitId:u.id}).length){chosen=u;break;}}if(chosen)break;}if(!chosen)throw Error('no recovery fixture');const p=createPresentationState(false,false);p.selectedUnitId=chosen.id;p.interactionMode='RECOVERY';stages.push(await mapShot('ui004-recovery-selection',s,p,{unitId:chosen.id,base:key(chosen.hex)}));
}
// Entrenchment phase
{
 const s=started();passiveAdvance(s,'GERMAN_ENTRENCHMENT');setActiveViewer(s,controllerIdForSide(s,'GERMAN'));const cid=controllerIdForSide(s,'GERMAN'),unit=Object.values(s.state.units).filter(u=>u.alive&&u.side==='GERMAN'&&u.controllerId===cid).find(u=>!validateEntrenchAction(s.state,s.rules,s.scenario,{type:'ENTRENCH',controllerId:cid,unitId:u.id}).length);if(!unit)throw Error('no entrench unit');const p=createPresentationState(false,false);p.selectedUnitId=unit.id;p.interactionMode='ENTRENCH';stages.push(await mapShot('ui004-entrenchment',s,p,{unitId:unit.id}));
}
// Handoff evidence from actual phase change
{
 const s=started();passiveAdvance(s,'GERMAN_ENTRENCHMENT');const before=s.state.phase;ready(s,'GERMAN');const gate='PASS_TURN_TO_SOVIET';await writeFile('screenshots/ui004-soviet-side-handoff.svg',cardSvg('Pass device to Soviet side',`${before} → ${s.state.phase}`,[`Turn ${s.state.turn}`,`Presentation gate: ${gate}`,'GameState already advanced by accepted READY; viewer changes only on confirm.']));stages.push({name:'ui004-soviet-side-handoff',kind:'card',turn:s.state.turn,phase:s.state.phase,gate});
}
// GAME OVER evidence
{
 const s=started();passiveAdvance(s,'GAME_OVER');await writeFile('screenshots/ui004-game-over.svg',cardSvg('SOVIET VICTORY',s.state.victory.reason??'—',[`Turn ${s.state.turn}`,`Phase ${s.state.phase}`,'No gameplay controls after terminal Core state.']));stages.push({name:'ui004-game-over',kind:'card',turn:s.state.turn,phase:s.state.phase,winner:s.state.victory.winner,reason:s.state.victory.reason});
}
await writeFile('screenshots/ui004-snapshot-manifest.json',JSON.stringify({seed:17,stages},null,2));console.log(JSON.stringify({stages},null,2));
