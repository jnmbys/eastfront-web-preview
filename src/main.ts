import * as playFlow from './playable/flow.js';
import * as plan from './playable/command.js';
import {perf006} from './local-ai/performance.js';
import {localStatus} from './local-ai/status.js';
import {LocalAiClient,createLocalAiWorker} from './local-ai/client.js';
import type {LocalScenario} from './local-ai/types.js';
import {combatResults} from './ui/combatResult.js';
import { bindStartupDiagnostics } from './web/startupDiagnostics.js';
import { ProgressiveTerrain } from './render/progressiveTerrain.js';
import {NetworkPlayerSession} from './multiplayer/networkSession.js';
import type {LobbyClient} from './multiplayer/client.js';
import {mt} from './multiplayer/catalog.js';
import {isNetwork,isSessionDeployment,sessionPlayerView,dispatchGameAction,deriveBrowserRenderModel,type PlayerSession} from './multiplayer/playerSession.js';
import { addMultiplayerHomeButton, mountLobby } from './multiplayer/lobby.js';
import {DynamicMapRenderer} from './render/dynamicMap.js';
import {DeploymentPanelRenderer} from './ui/deploymentPanelRenderer.js';
import {modelControls,bindModelControls} from './ui/modelControls.js';
import { FogRuntime } from './fog/runtime.js';
import type { Viewer } from './player-view/playerView.js';
import { startupProgress } from './web/startupProgress.js';
import { observeTerrainLoad } from './render/terrainLoadProgress.js';
import { UnitAnimationRuntime } from './presentation/runtime.js';
import { animationControls, bindAnimationControls } from './ui/animationControls.js';
import { continueCombatFlow, chooseRetreatDestination, chooseRetreater, chooseAdvancer, chooseAdvanceDestination, routeCombatDecisionCounter, undoRetreatDestination } from './multiplayer/playerSession.js';
import { languageControl, bindLanguageControl } from './localization/languageControl.js';
import { issueText } from './localization/issues.js';
import { t, msg, enumLabel, phaseName, formatMessage, type Message } from './localization/index.js';
import {combatAttackPanel} from './ui/combatAttackPanel.js';
import {deploymentFocus,deploymentRejection} from './ui/deploymentPolish.js';
import {createDeploymentTouch,chooseDeploymentTarget,confirmDeploymentTarget} from './ui/deploymentTouch.js';
import { commandHeader, deploymentLocations, deploymentConfirm, deploymentFeedback, unitDescription, unitLabel } from './ui/commandPresentation.js';
import { coreHexKey, isDeploymentPhase, type LegacyMapData, type Side } from './core-adapter/core.js';
import { createLocalGameSession, loadProductionMapFromUrl, type LocalGameSession } from './core-adapter/session.js';
import {
  chooseLossAndContinue,cancelMoveDraft,cancelRailRepair,clearAttackDraft,clearLossDraft,commitBreakthrough,commitMoveDraft,commitRailRepair,commitSchwerpunkt,confirmPrivacyGate,attackAndContinue,deploySelectedReinforcement,deploySelectedUnit,
  enterRailRepairMode,entrenchSelectedUnit,extendBreakthroughDraft,extendMoveDraft,passAdvance,passBreakthrough,passCombatReaction,passSchwerpunkt,readyForPhase,recoverSelectedUnit,routeCombatTarget,isCombatTargetSelection,combatTargetIssues,selectAttackerArtillery,selectBreakthroughUnit,selectCounter,selectDeploymentRosterUnit,
  selectRailEngineer,selectReinforcement,selectSchwerpunktTarget,switchViewerForDevelopment,toggleAttackUnit,toggleSupportingAttacker,toggleRailRepairEdge,undoBreakthroughDraft,undoLossDraft,undoMoveDraft,useDefenderArtillery,
} from './multiplayer/playerSession.js';
import { type BrowserRenderModel } from './render/coreModel.js';
import { coreSvgDynamicMarkup, coreSvgMarkup, viewBoxForHexes, type CoreSvgOptions } from './render/coreSvg.js';
import { selectTerrainLod, type TerrainLod } from './render/terrainAssets.js';
import { buildCachedTerrainSurface, formatTerrainSurfaceFailure, terrainSurfaceCapabilities, type CachedTerrainSurface } from './render/terrainSurface.js';
import { hexToPixel, HEX_SIZE } from './geometry/hex.js';
import { createPresentationState, type PresentationState } from './state/presentation.js';
import { TERRAIN_VISUAL_SEED, createFreshProductionSession, defaultMapViewport, fatalMarkup, gameOverMarkup, homeMarkup, loadingMarkup, loadProductionRuntimeManifest, mobileAdvisoryMarkup, privacyHandoffMarkup, productionDeveloperUiAllowed, responsiveProfile, WEB_PREVIEW_VERSION, type MapViewport } from './web/preview.js';
import { beginMapGesture, dragSuppressesTap, gesturePanViewport, updateMapGesture, zoomMapAt, pinchMapViewport, type MapGestureState, type MapPoint } from './web/mapInteraction.js';

const rootElement=document.querySelector<HTMLElement>('#app');if(!rootElement)throw new Error('#app missing');const root=rootElement;
const LOCAL_AI_ENABLED=false; // Enabled only by the isolated AI003 build.
let localAi:LocalAiClient|null=null,localGeneration=0;
const query=new URLSearchParams(location.search);const developerUi=productionDeveloperUiAllowed(location.hostname,location.search);let presentation:PresentationState=createPresentationState(developerUi&&query.get('debug')==='1',window.matchMedia('(max-width: 1100px)').matches);let session:PlayerSession|null=null;let productionMap:LegacyMapData|null=null;let appStatus:'LOADING'|'HOME'|'MULTIPLAYER'|'PLAYING'|'FATAL'='LOADING';let fatalMessage:Message='';let mapViewport:MapViewport=defaultMapViewport();let cachedTerrainSurface:CachedTerrainSurface|null=null;const cachedTerrainSurfaces=new Map<TerrainLod,CachedTerrainSurface>();
let terrainPipeline:ProgressiveTerrain<CachedTerrainSurface>|null=null;
let terrainBoot:Promise<void>|null=null;
function esc(value:string):string{return value.replace(/[&<>\"]/g,(char)=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[char]??char));}
let deploymentTouch=createDeploymentTouch();
let forceNetworkRender=false;
const unitAnimations=new UnitAnimationRuntime({now:()=>performance.now(),request:callback=>requestAnimationFrame(callback),cancel:id=>cancelAnimationFrame(id)});
const fogSurface=new FogRuntime();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
unitAnimations.setReducedMotion(reducedMotion.matches);
const updateReducedMotion=()=>{unitAnimations.setReducedMotion(reducedMotion.matches);if(reducedMotion.matches)fogSurface.settle();};
reducedMotion.addEventListener('change',updateReducedMotion);
window.addEventListener('pagehide',()=>{unitAnimations.skip();});
window.addEventListener('pagehide',()=>{terrainPipeline?.pause();terrainZoomObserver?.disconnect();terrainZoomWrap=null;});
window.addEventListener('pageshow',()=>{if(appStatus==='PLAYING'||appStatus==='LOADING')terrainPipeline?.resume();});
window.addEventListener('pagehide',()=>releaseMapViewport());
window.addEventListener('pagehide',()=>fogSurface.settle());
function syncFogSurface():void{
 const svg=document.querySelector<SVGSVGElement>('#eastfront-map');
 fogSurface.sync(svg,session&&!presentation.privacyGate?sessionPlayerView(session):null,presentation.selectedUnitId,unitAnimations.effectiveSpeed==='instant');
}
function paintDeploymentFocus(model?:BrowserRenderModel):void{
 syncFogSurface();
 unitAnimations.sync(session,document.querySelector('#map-wrap'));
 if(LOCAL_AI_ENABLED&&localAi&&session&&!presentation.privacyGate)paintPlanMap(model??deriveBrowserRenderModel(session,presentation));
 const svg=document.querySelector('#eastfront-map');if(!svg||!session)return;
 svg.querySelector('#deployment-focus')?.remove();
 if(!isSessionDeployment(session))return;
 svg.insertAdjacentHTML('beforeend',deploymentFocus(model??deriveBrowserRenderModel(session,presentation),deploymentTouch,presentation.selectedDeploymentUnitId));
}
function chooseTouchTarget(key:string):void{
 if(!session)return;
 if(chooseDeploymentTarget(deploymentTouch,deriveBrowserRenderModel(session,presentation),presentation.selectedDeploymentUnitId,key)){
  if(presentation.panelCollapsed){presentation.panelCollapsed=false;render();}else refreshDynamicView();
 }
}
function chooseCounterTarget(id:string):boolean{
 if(!session||!isSessionDeployment(session))return false;
 const model=deriveBrowserRenderModel(session,presentation),counter=model.counters.find(c=>c.id===id);
 if(!counter)return false;
 const chosen=chooseDeploymentTarget(deploymentTouch,model,presentation.selectedDeploymentUnitId,coreHexKey(counter.hex));
 if(chosen){if(presentation.panelCollapsed){presentation.panelCollapsed=false;render();}else refreshDynamicView();}return chosen;
}
function parseHex(value:string){const [q,r]=value.split(',').map(Number);return {q:q!,r:r!};}
function sideLabel(side:Side):string{return t('faction.side',{side:enumLabel(side)});}
function phaseLabel(phase:string):string{return phaseName(phase);}
function issueHtml(issues:readonly {code:string;message:string}[]):string{return issues.length?`<div class="issue-list">${issues.map((issue)=>`<span>${esc(issueText(issue))}</span>`).join('')}</div>`:`<div class="issue-list"><span>${t('common.legal')}</span></div>`;}
function bindKeyboardActivation(element:Element,action:()=>void):void{element.addEventListener('keydown',(event)=>{const e=event as KeyboardEvent;if(e.key==='Enter'||e.key===' '){e.preventDefault();action();}});}

function lastActionPanel(current:LocalGameSession):string{
  const result=current.lastResult;const validation=result?.issues.map((issue)=>issue.code).join(', ')||'—';const events=result?.events.map((event)=>event.type).join(', ')||'—';const integrity=current.integrityIssues.length===0?'PASS':current.integrityIssues.map((issue)=>issue.code).join(', ');
  return `<section class="panel-block integration-debug"><span class="eyebrow">CORE ACTION DEBUG</span><div><span>Last action</span><strong>${result?esc(result.action.type):'—'}</strong></div><div><span>Accepted</span><strong>${result?String(result.accepted):'—'}</strong></div><div><span>Action ID</span><strong>${result?esc(result.actionId):'—'}</strong></div><div><span>Validation</span><strong>${esc(validation)}</strong></div><div><span>Events</span><strong>${esc(events)}</strong></div><div><span>Integrity</span><strong class="${current.integrityIssues.length===0?'ok':'bad'}">${esc(integrity)}</strong></div></section>`;
}
function selectedSummary(model:BrowserRenderModel):string{
 const unit=model.selectedCounter;
 if(!unit)return `<div class="command-empty"><span class="command-reticle" aria-hidden="true">◇</span><p>${t('unit.inspect')}</p></div>`;
 return `<div class="unit-dossier">${rosterEmblem(unit.type)}<div><span class="eyebrow">${unitLabel(unit.type)}</span><strong>${esc(unit.id)}</strong><span>${enumLabel(unit.side)}</span></div></div><dl class="unit-readings"><div><dt>${t('common.attack')}</dt><dd>${unit.stats.attack}</dd></div><div><dt>${t('common.defense')}</dt><dd>${unit.stats.defense}</dd></div><div><dt>${t('common.movement')}</dt><dd>${unit.stats.movement}</dd></div></dl><div class="unit-status"><span>${t('common.supply')}</span><strong>${enumLabel(unit.supplyState)}</strong><span>${t('common.status')}</span><strong>${t('unit.step',{step:unit.step})}${unit.entrenched?t('unit.entrenchedSuffix'):''}</strong><span>${t('common.position')}</span><strong>${coreHexKey(unit.hex)}</strong></div>`;
}
// Decorative roster identity only; canonical unit types and actions are unchanged.
function rosterEmblem(type:string):string{
  const infantry='<path d="M5 6L23 22M23 6L5 22"/>';
  const armor='<ellipse cx="14" cy="14" rx="10" ry="6"/>';
  const symbols:Record<string,string>={INFANTRY:infantry,JAGER:infantry+'<text x="14" y="17" text-anchor="middle">J</text>',ELITE_INFANTRY:infantry+'<text x="14" y="17" text-anchor="middle">E</text>',PANZER:armor,TANK:armor,HEAVY_TANK:armor+'<path d="M5 23H23"/>',MOTORIZED:armor+infantry,ARTILLERY:'<circle cx="14" cy="14" r="4" fill="currentColor"/>',ENGINEER:'<text x="14" y="18" text-anchor="middle">E</text>',ANTI_TANK:'<text x="14" y="18" text-anchor="middle">AT</text>',RECON:'<path d="M5 23L23 5"/>',HQ:'<text x="14" y="18" text-anchor="middle">HQ</text>'};
  return `<span class="roster-emblem" aria-hidden="true"><svg viewBox="0 0 28 28">${symbols[type]??'<path d="M14 4L24 14L14 24L4 14Z"/>'}</svg></span>`;
}
function deploymentPanel(model:BrowserRenderModel,locations?:string):string{const deployment=model.deployment;if(!deployment)return '';const active=model.activeSide===model.viewerSide;const selected=presentation.selectedDeploymentUnitId;const rows=deployment.roster.map((row)=>`<button type="button" class="roster-row ${row.placed?'placed':'unplaced'} ${selected===row.id?'selected':''}" data-deploy-unit-id="${esc(row.id)}" ${active?'':'disabled'} aria-pressed="${selected===row.id}">${rosterEmblem(row.type)}<span>${unitLabel(row.type)}</span><small>${esc(row.id)} · ${unitDescription(row.type)}<br>${t('unit.readings',{...row.stats})}</small><b>${row.placed?t('deployment.onMap'):t('deployment.reserve')}</b></button>`).join('');return `<section class="panel-block deployment-panel"><span class="eyebrow">${t('deployment.title',{side:sideLabel(model.viewerSide).toUpperCase()})}</span><div class="deployment-progress"><strong>${deployment.deployed}/${deployment.total}</strong><span>${deployment.complete?t('deployment.complete'):t('deployment.placeAll')}</span></div><ol class="deployment-steps"><li class="${selected?'done':'current'}">${t('deployment.selectUnit')}</li><li class="${selected?'current':''}">${t('deployment.choosePosition')}</li><li>${t('deployment.deploy')}</li></ol><p class="deployment-guidance" role="status">${selected?t('deployment.selectedHelp',{id:esc(selected)}):t('deployment.begin')}</p><div class="roster-list">${rows}</div>${deploymentFeedback(deploymentTouch)}${locations??deploymentLocations(model,selected,deploymentTouch)}<button id="ready-button" class="primary-action" type="button" ${active?'':'disabled'}><span class="advance-label">${t('deployment.confirmPhase')}</span><span class="advance-arrow" aria-hidden="true">›</span></button>${!active?`<p class="privacy-note">${t('deployment.hidden')}</p>`:''}</section>`;}


function modifierHtml(mods:NonNullable<NonNullable<BrowserRenderModel['combat']>['battle']>['context'] extends infer C ? any : never):string{return '';}
function combatContextHtml(context:NonNullable<NonNullable<BrowserRenderModel['combat']>['attackDraft']['preview']>,label:string):string{
  const m=context.modifiers;const rows=[[t('common.terrain'),m.terrainShift],[t('combat.river'),m.riverShift],[t('combat.engineer'),m.engineerShift],[t('combat.combinedArms'),m.combinedArmsShift],[t('combat.armorPenalty'),m.unsupportedArmorShift],[t('combat.antiTank'),m.antiTankShift],[t('combat.attackerArtillery'),m.attackerArtilleryShift],[t('combat.defenderArtillery'),m.defenderArtilleryShift],[t('combat.flank'),m.flankShift],[t('combat.entrenchment'),m.entrenchmentShift],[t('combat.hq'),m.hqShift],[t('combat.secondAttack'),m.secondAttackShift]].filter(([,v])=>v!==0);
  return `<div class="combat-card"><h3>${label}</h3><div class="combat-grid"><span>${t('common.attack')}</span><strong>${context.attackStrength}</strong><span>${t('common.defense')}</span><strong>${context.defenseStrength}</strong><span>${t('combat.baseOdds')}</span><strong>${esc(context.baseOdds)}</strong><span>${t('combat.baseColumn')}</span><strong>${context.baseCRTColumn}</strong><span>${t('combat.finalShift')}</span><strong>${context.finalShift}</strong><span>${t('combat.finalCRT')}</span><strong>${esc(context.finalCRTColumnLabel)}</strong></div>${rows.length?`<div class="modifier-list">${rows.map(([k,v])=>`<span>${k}</span><strong>${Number(v)>0?'+':''}${v}</strong>`).join('')}<span>${t('combat.rawCapped')}</span><strong>${m.rawShift} / ${m.cappedShift}</strong></div>`:''}</div>`;
}
function combatPanel(model:BrowserRenderModel):string{
  const c=model.combat;if(!c)return '';
  const pending=c.pending,tx=c.battle;
  if(!pending)return combatAttackPanel(model,c.attackDraft.preview?combatContextHtml(c.attackDraft.preview,t('combat.details')):'');
  const header=`<section class="panel-block phase-actions pending-lock"><span class="eyebrow">${t('combat.transaction',{kind:enumLabel(pending.kind)})}</span><div class="phase-metric"><span>${t('combat.battle')}</span><strong>${esc(pending.battleId)}</strong></div><div class="phase-metric"><span>${t('combat.decisionOwner')}</span><strong>${enumLabel(pending.side)}</strong></div>`;
  let body='';
  if(pending.kind==='DEFENDER_REACTION'){body=`<p>${t('combat.flow.defender')}</p><div class="combat-unit-list">${c.reaction.artillery.map(id=>`<button class="mini-button" data-defender-artillery="${esc(id)}">${t('combat.artilleryUnit',{id:esc(id)})}</button>`).join('')}${c.reaction.hq.map(id=>`<button class="mini-button" data-defender-hq="${esc(id)}">${t('combat.flow.lastStand',{id:esc(id)})}</button>`).join('')}</div><button id="pass-reaction" class="secondary-action">${t('combat.flow.declineSupport')}</button>`;}
  else if(pending.kind==='LOSS_ALLOCATION'&&c.loss){body=`<p>${t('combat.flow.allocateHelp',{steps:c.loss.steps})}</p><div class="combat-unit-list">${c.loss.eligibleUnitIds.map((id)=>`<button class="mini-button" data-loss-unit="${esc(id)}">${t('combat.capacity',{id:esc(id),count:c.loss!.capacityByUnitId[id]??0})}</button>`).join('')}</div><div class="loss-draft">${c.loss.draft.join(' → ')||t('combat.noLossDraft')}</div><div class="button-row"><button id="loss-undo" class="secondary-action">${t('common.undo')}</button><button id="loss-clear" class="secondary-action">${t('common.clear')}</button></div>`;}
  else if(pending.kind==='RETREAT'&&c.retreat){body=`<h3>${t('combat.flow.retreat')}</h3><p>${t('combat.flow.retreatHelp',{id:esc(c.retreat.activeUnitId??'—')})}</p>${c.retreat.unitIds.length>1?`<p>${t('combat.flow.retreatOrder')}</p><div class="combat-unit-list">${c.retreat.unitIds.map(id=>`<button class="mini-button ${c.retreat!.activeUnitId===id?'active':''}" data-retreater="${esc(id)}" ${c.retreat!.completeUnitIds.includes(id)?'disabled':''}>${esc(id)}</button>`).join('')}</div>`:''}<div class="loss-draft">${Object.entries(c.retreat.drafts).map(([id,path])=>`${esc(id)}: ${path.map(coreHexKey).join(' → ')||'—'}`).join('<br>')}</div>${Object.values(c.retreat.drafts).some(path=>path.length)?`<button id="retreat-undo" class="secondary-action">${t('common.undoStep')}</button>`:''}`;}
  else if(pending.kind==='ADVANCE_AFTER_COMBAT'&&c.advance){body=`<h3>${t('combat.flow.advance')}</h3><p>${c.advance.selectedUnitId?t('combat.flow.advanceHelp',{id:esc(c.advance.selectedUnitId)}):t('combat.flow.chooseAdvancer')}</p>${c.advance.unitIds.length>1?`<div class="combat-unit-list">${c.advance.unitIds.map(id=>`<button class="mini-button ${c.advance!.selectedUnitId===id?'active':''}" aria-pressed="${c.advance!.selectedUnitId===id}" data-advance-unit="${esc(id)}">${t('combat.flow.advancer',{id:esc(id)})}</button>`).join('')}</div>`:''}<button id="pass-advance" class="secondary-action">${t('combat.passAdvance')}</button>`;}
  else if(pending.kind==='BREAKTHROUGH_OPTION'&&c.breakthrough){body=`<p>${t('combat.flow.breakthrough',{max:c.breakthrough.maxHexes})}</p><div class="combat-unit-list">${c.breakthrough.eligibleUnitIds.map((id)=>`<button class="mini-button ${c.breakthrough!.selectedUnitId===id?'active':''}" data-breakthrough-unit="${esc(id)}">${esc(id)}</button>`).join('')}</div><div class="loss-draft">${c.breakthrough.path.map(coreHexKey).join(' → ')||t('combat.noBreakthroughDraft')}</div><div class="button-row"><button id="breakthrough-undo" class="secondary-action">${t('common.undo')}</button><button id="breakthrough-commit" class="secondary-action">${t('common.commit')}</button></div><button id="pass-breakthrough" class="secondary-action">${t('combat.passBreakthrough')}</button>`;}
  else if(pending.kind==='SCHWERPUNKT_OPTION'&&c.schwerpunkt){body=`<p>${t('combat.flow.schwerpunkt')}</p><div class="phase-metric"><span>${t('common.target')}</span><strong>${c.schwerpunkt.target?coreHexKey(c.schwerpunkt.target):'—'}</strong></div><div class="combat-unit-list">${c.schwerpunkt.eligibleUnitIds.map((id)=>`<button class="mini-button" data-schwerpunkt-unit="${esc(id)}" ${c.schwerpunkt!.choices.some(choice=>choice.unitId===id&&c.schwerpunkt!.target&&coreHexKey(choice.target)===coreHexKey(c.schwerpunkt!.target))?'':'disabled'}>${t('combat.attackWith',{id:esc(id)})}</button>`).join('')}</div><button id="pass-schwerpunkt" class="secondary-action">${t('combat.passSchwerpunkt')}</button>`;}
  const resolved=tx?.resolution?`<div class="combat-card"><h3>${t('combat.resolvedCRT')}</h3><div class="dice-box"><span class="die">${tx.resolution.dice.die1}</span><span class="die">${tx.resolution.dice.die2}</span><strong>= ${tx.resolution.dice.total}</strong></div><div class="combat-grid"><span>${t('combat.crt')}</span><strong>${tx.resolution.crtResult}</strong><span>${t('combat.attackerLoss')}</span><strong>${tx.resolution.attackerLossSteps}</strong><span>${t('combat.defenderLoss')}</span><strong>${tx.resolution.defenderLossSteps}</strong><span>${t('combat.defenderRetreat')}</span><strong>${tx.resolution.defenderRetreatSteps}</strong></div></div>`:'';
  const context=tx?.context?combatContextHtml(tx.context,t('combat.resolvedContext')):'';
  return header+body+(tx?.resolution?`<p class="combat-result-summary" role="status">${t('combat.lastResult',{result:tx.resolution.crtResult})} · ${t('combat.dice',{...tx.resolution.dice})}</p>`:'')+`<details class="combat-advanced"><summary>${t('combat.flow.resultDetails')}</summary>${resolved}${context}</details></section>`;
}

function phasePanel(model:BrowserRenderModel):string{
  if(model.readOnly)return `<p>${isNetwork(session)?esc(session.statusText):t('fow.inspection')}</p>`;
  if(model.deployment)return '';
  const ready=`<button id="ready-button" class="primary-action" type="button"><span class="advance-label"><small>${phaseLabel(model.phase)}</small>${flowEnabled(model)?(model.phase.endsWith('_RECOVERY')?'完成恢复，继续筑垒':model.phase.endsWith('_ENTRENCHMENT')?'完成整备':t('common.advancePhase')):t('common.advancePhase')}</span><span class="advance-arrow" aria-hidden="true">›</span></button>`;
  if(model.phase==='GERMAN_SUPPLY_RAIL'){
    const r=model.railRepair;
    if(!r)return `<section class="panel-block"><strong>铁路操作</strong><p role="status">正在读取本阶段资格；请稍候，尚未结束阶段。</p></section>`;
    const unavailable=r.alreadyUsed||!r.selectedEdgeKeys.length||r.issues.length>0;
    return `<section class="panel-block phase-actions"><strong>铁路推进 / 工兵支援</strong><div class="rail-primary"><button id="rail-mode" class="secondary-action">在地图选择铁路</button><button id="rail-commit" class="primary-action" ${unavailable?'disabled':''}>确认铁路计划（${r.selectedEdgeKeys.length}段）</button></div><p>普通推进不需要选兵：每回合最多4段；选择合格工兵可提高至5段。均须接入有效铁路网，每回合只接受一份计划。不消耗RP或CP；工兵支援后本回合专用于修路。</p><div class="button-row"><button id="rail-no-engineer" class="mini-button ${!r.selectedEngineerUnitId?'active':''}">普通推进 · 不使用工兵</button>${r.engineers.map(eng=>`<button class="mini-button ${eng.selected?'active':''}" data-rail-engineer="${esc(eng.id)}">工兵 ${esc(eng.id)}</button>`).join('')}</div><p>${r.alreadyUsed?'本回合铁路计划已使用。':r.selectedEdgeKeys.length?esc(r.selectedEdgeKeys.join('、')):'请从地图或下方列表选择区段；选中猎兵不影响普通推进。'}</p>${r.selectedEdgeKeys.length?issueHtml(r.issues):''}<details><summary>按区段选择（地图不易点选时）</summary><select id="rail-edge-choice" aria-label="铁路区段">${r.railwayEdgeKeys.map(key=>`<option value="${esc(key)}">${esc(key)}${r.activeEdgeKeys.includes(key)?' · 已通车':''}${r.selectedEdgeKeys.includes(key)?' · 已选':''}</option>`).join('')}</select><button id="rail-edge-add" class="mini-button">切换该区段</button></details><button id="rail-clear" class="secondary-action">清空计划</button>${ready}</section>`;
  }
  if(model.phase==='GERMAN_MOVEMENT'||model.phase==='SOVIET_MOVEMENT'){
    const m=model.movement,choosing=presentation.interactionMode==='MOVE_PATH';
    // Exit remains available during a read-only projection request or rejection.
    // Submission still disables it through the existing canSelect gate.
    const metrics=m?`<div class="phase-metric"><span>${t('movement.path')}</span><strong>${t('movement.steps',{count:m.path.length})}</strong></div><div class="phase-metric"><span>${t('movement.mp')}</span><strong>${m.spentMP}/${m.maxMP}</strong></div>${issueHtml(m.issues)}`:'';
    const controls=choosing?`<p role="status">${t('movement.active')}</p><div class="button-row"><button id="move-undo" class="secondary-action">${t('common.undoStep')}</button><button id="move-cancel" class="secondary-action">${t('movement.cancel')}</button></div><button id="move-commit" class="secondary-action" ${m?'':'disabled'}>${t('movement.commit')}</button>`:m?`<p role="status">${t('movement.selecting')}</p><button id="move-start" class="secondary-action">${t('movement.start')}</button>`:`<p>${t('common.selectUnit')}</p>`;
    return `<section class="panel-block phase-actions"><span class="eyebrow">${t('movement.title')}</span><p>${t('movement.help')}</p>${metrics}${controls}${ready}</section>`;
  }
  if(model.phase==='GERMAN_COMBAT'||model.phase==='SOVIET_COMBAT')return combatPanel(model);
  if(model.phase==='SOVIET_REINFORCEMENT_SUPPLY'&&model.reinforcement){const r=model.reinforcement;return `<section class="panel-block phase-actions"><span class="eyebrow">${t('reinforcement.title')}</span><div class="phase-metric"><span>${t('common.available')}</span><strong>${r.available.length}</strong></div><div class="phase-metric"><span>${t('common.delayed')}</span><strong>${r.delayed.length}</strong></div>${r.deployable?`<p class="warning-note">${t('reinforcement.required')}</p>`:''}<div class="reinforcement-list">${r.available.map((row)=>`<button class="reinforcement-row ${r.selectedId===row.id?'selected':''}" data-reinforcement-id="${esc(row.id)}"><span>${esc(row.id)} · ${unitLabel(row.type)}</span><b>${t('game.turn',{turn:row.scheduledTurn})}</b><small>${row.delayed?t('reinforcement.delayedPrefix'):''}${row.stats?`${row.stats.attack}-${row.stats.defense}-${row.stats.movement}`:enumLabel(row.resolution)}</small></button>`).join('')||`<p>${t('reinforcement.none')}</p>`}</div><p>${r.selectedId?t('reinforcement.entryHelp'):t('reinforcement.selectHelp')}</p>${ready}</section>`;}
  if((model.phase==='GERMAN_RECOVERY'||model.phase==='SOVIET_RECOVERY')&&model.recovery){const r=model.recovery;return `<section class="panel-block phase-actions"><span class="eyebrow">${t('recovery.title')}</span>${flowEnabled(model)?playFlow.refitMarkup(model):''}<div class="phase-metric"><span>${t('recovery.recovered')}</span><strong>${r.recoveredCount}/${r.limit}</strong></div><div class="phase-metric"><span>${t('recovery.rp')}</span><strong>${model.rp[model.viewerSide]??'—'}</strong></div>${model.selectedCounter?`<div class="phase-metric"><span>${t('recovery.cost')}</span><strong>${r.selectedCost??'—'} ${t('resource.rp')}</strong></div>${issueHtml(r.selectedIssues)}<button id="recover-unit" class="secondary-action">${t('recovery.commit')}</button>`:`<p>${t('recovery.help')}</p>`}${ready}</section>`;}
  if((model.phase==='GERMAN_ENTRENCHMENT'||model.phase==='SOVIET_ENTRENCHMENT')&&model.entrench){const e=model.entrench;return `<section class="panel-block phase-actions"><span class="eyebrow">${t('entrenchment.title')}</span>${flowEnabled(model)?playFlow.refitMarkup(model):''}${model.selectedCounter?`${issueHtml(e.selectedIssues)}<button id="entrench-unit" class="secondary-action">${t('entrenchment.commit')}</button>`:`<p>${t('entrenchment.help')}</p>`}${ready}</section>`;}
  return `<section class="panel-block phase-actions"><span class="eyebrow">${t('common.phase')}</span><p>${phaseLabel(model.phase)}</p>${ready}</section>`;
}
function viewerSwitch(model:BrowserRenderModel):string{if(!presentation.debug)return '';return `<section class="panel-block"><span class="eyebrow">${t('fow.view')}</span><div class="viewer-buttons">${(['GERMAN','SOVIET','OBSERVER'] as const).map(side=>`<button data-view-side="${side}" class="mini-button ${model.playerView.viewer===side?'active':''}">${t(side==='GERMAN'?'fow.german':side==='SOVIET'?'fow.soviet':'fow.observer')}</button>`).join('')}</div></section>`;}

function privacyGate():string{const gate=presentation.privacyGate;if(!gate)return '';if(gate==='COMBAT_DECISION'){const owner=(session?sessionPlayerView(session).pendingDecision:null)?.decisionOwnerControllerId??'';const side=owner&&session&&sessionPlayerView(session).pendingDecision?.side==='SOVIET'?'Soviet':'German';return privacyHandoffMarkup(gate,side);}return privacyHandoffMarkup(gate);}
function gameOver(model:BrowserRenderModel):string{return gameOverMarkup(model.victory.winner,model.victory.reason,model.turn);}

function startNewGame():void{if(LOCAL_AI_ENABLED){leaveLocalAi();return;}terrainPipeline?.resume();terrainPipeline?.continueAll();deploymentTouch=createDeploymentTouch();if(!productionMap||!cachedTerrainSurface){appStatus='FATAL';fatalMessage=msg('game.noMap');render();return;}session=createFreshProductionSession(productionMap);presentation=createPresentationState(developerUi&&query.get('debug')==='1',window.matchMedia('(max-width: 1100px)').matches);presentation.rendererMode='production';presentation.productionAssetSet='p5';appStatus='PLAYING';fatalMessage='';render();}
function restartGame():void{if(localAi){leaveLocalAi();return;}if(isNetwork(session)){session.client.send('LEAVE_ROOM',{});session.dispose();session=null;terrainPipeline?.pause();appStatus='HOME';render();return;}if(window.confirm(t('game.restartPrompt')))startNewGame();}
function applyMapViewport():void{
  const wrap=document.querySelector<HTMLElement>('#map-wrap'),svg=document.querySelector<SVGSVGElement>('#eastfront-map');if(!wrap||!svg)return;
  const transform=`translate(${mapViewport.panX}px, ${mapViewport.panY}px) scale(${mapViewport.zoom})`;if(svg.style.transform!==transform){svg.style.transform=transform;svg.style.transformOrigin='50% 50%';}const terrain=document.querySelector<HTMLCanvasElement>('#terrain-surface');if(terrain&&terrain.style.transform!==transform){terrain.style.transform=transform;terrain.style.transformOrigin='50% 50%';}
  const zoom=mapViewport.zoom.toFixed(2);if(wrap.dataset.zoom!==zoom){wrap.dataset.zoom=zoom;const readout=document.querySelector<HTMLElement>('#zoom-readout');if(readout)readout.textContent=`${Math.round(mapViewport.zoom*100)}%`;}
}
let releaseMapViewport=()=>{};
function bindMapViewport():void{
  releaseMapViewport();
  const wrap=document.querySelector<HTMLElement>('#map-wrap');if(!wrap)return;applyMapViewport();
  const points=new Map<number,MapPoint>();
  let gesture:MapGestureState|null=null;
  let pinch:{view:MapViewport;a:MapPoint;b:MapPoint}|null=null;
  let suppressNextClick=false;let panFrame:number|null=null;let latest:MapPoint|null=null;
  let bounds=wrap.getBoundingClientRect();
  const resizeObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(()=>{bounds=wrap.getBoundingClientRect();});resizeObserver?.observe(wrap);
  const local=(e:PointerEvent|WheelEvent):MapPoint=>{const r=bounds;return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};};
  const capture=(id:number)=>{try{wrap.setPointerCapture?.(id);}catch{/* Capture may end during cancellation. */}};
  const cancelFrame=()=>{if(panFrame!==null)cancelAnimationFrame(panFrame);panFrame=null;};
  releaseMapViewport=()=>{cancelFrame();resizeObserver?.disconnect();};
  const flushPan=()=>{panFrame=null;if(!gesture?.dragging||!latest)return;mapViewport=gesturePanViewport(gesture,latest.x,latest.y,mapViewport.zoom);applyMapViewport();};
  const queuePan=(x:number,y:number)=>{latest={x,y};if(panFrame===null)panFrame=requestAnimationFrame(flushPan);};
  const rebase=()=>{
    const entries=[...points.entries()];pinch=null;gesture=null;latest=null;
    if(entries.length>=2)pinch={view:{...mapViewport},a:{...entries[0]![1]},b:{...entries[1]![1]}};
    else if(entries.length===1){const [id,p]=entries[0]!;gesture=beginMapGesture(id,p.x,p.y,mapViewport);gesture.dragging=suppressNextClick;}
  };
  wrap.addEventListener('pointerdown',(event)=>{
    const e=event as PointerEvent;if(e.button!==0)return;
    if(points.size===0)suppressNextClick=false;
    cancelFrame();flushPan();points.set(e.pointerId,local(e));rebase();
    if(points.size>=2){suppressNextClick=true;for(const id of points.keys())capture(id);e.preventDefault();}
  });
  wrap.addEventListener('pointermove',(event)=>{
    const e=event as PointerEvent;if(!points.has(e.pointerId))return;const p=local(e);points.set(e.pointerId,p);
    if(pinch){const [a,b]=[...points.values()];mapViewport=pinchMapViewport(pinch.view,pinch.a,pinch.b,a!,b!);applyMapViewport();e.preventDefault();return;}
    if(!gesture)return;gesture=updateMapGesture(gesture,p.x,p.y);if(!gesture.dragging)return;
    capture(e.pointerId);queuePan(p.x,p.y);e.preventDefault();
  });
  const finish=(event:PointerEvent,cancelled=false)=>{
    if(!points.has(event.pointerId))return;
    cancelFrame();
    if(!pinch&&gesture){if(!cancelled)latest=local(event);flushPan();suppressNextClick= suppressNextClick||dragSuppressesTap(gesture,cancelled);}
    points.delete(event.pointerId);rebase();
    if(wrap.hasPointerCapture?.(event.pointerId)){try{wrap.releasePointerCapture?.(event.pointerId);}catch{}}
  };
  wrap.addEventListener('pointerup',(e)=>finish(e as PointerEvent));
  wrap.addEventListener('pointercancel',(e)=>finish(e as PointerEvent,true));
  wrap.addEventListener('lostpointercapture',(e)=>finish(e as PointerEvent,true));
  wrap.addEventListener('pointerleave',(e)=>{const p=e as PointerEvent;if(!wrap.hasPointerCapture?.(p.pointerId))finish(p,true);});
  wrap.addEventListener('click',(event)=>{if(!suppressNextClick)return;event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();},true);
  wrap.addEventListener('wheel',(event)=>{const e=event as WheelEvent;e.preventDefault();cancelFrame();flushPan();mapViewport=zoomMapAt(mapViewport,mapViewport.zoom+(e.deltaY<0?.15:-.15),local(e));applyMapViewport();rebase();},{passive:false});
}
function mapRenderOptions(model:BrowserRenderModel,lodOverride?:TerrainLod):CoreSvgOptions{
  const vb=viewBoxForHexes(model.hexes),usableWidth=Math.max(560,window.innerWidth-(presentation.panelCollapsed?24:280));
  const screenHexWidth=usableWidth*((Math.sqrt(3)*HEX_SIZE)/vb.width)*mapViewport.zoom;
  const lod=lodOverride??selectTerrainLod(screenHexWidth);
  const rendererMode=developerUi?presentation.rendererMode:'production';return {debug:developerUi&&presentation.debug,rendererMode,assetSet:'p5',lod,scenarioSeed:TERRAIN_VISUAL_SEED,staticTerrainSurface:rendererMode==='production'};
}
let terrainZoomObserver:MutationObserver|null=null;let terrainZoomWrap:HTMLElement|null=null;
function mountCachedTerrainSurface():void{
  if(!cachedTerrainSurface)return;const wrap=document.querySelector<HTMLElement>('#map-wrap'),svg=document.querySelector<SVGSVGElement>('#eastfront-map');if(!wrap||!svg)return;const usableWidth=Math.max(560,window.innerWidth-(presentation.panelCollapsed?24:280));const requested=selectTerrainLod(usableWidth*((Math.sqrt(3)*HEX_SIZE)/cachedTerrainSurface.viewBox.width)*mapViewport.zoom);terrainPipeline?.prioritize(requested);cachedTerrainSurface=terrainPipeline?.best(requested)??cachedTerrainSurfaces.get(requested)??cachedTerrainSurface;const canvas=cachedTerrainSurface.canvas;const previous=document.querySelector<HTMLCanvasElement>('#terrain-surface');if(previous&&previous!==canvas)previous.remove();if(canvas.parentElement!==wrap)wrap.insertBefore(canvas,svg);canvas.style.transform=svg.style.transform;canvas.style.transformOrigin='50% 50%';canvas.dataset.imageDraws=String(cachedTerrainSurface.stats.imageDraws);canvas.dataset.uniqueAssets=String(cachedTerrainSurface.stats.uniqueAssets);
  if(terrainZoomWrap!==wrap&&typeof MutationObserver!=='undefined'){terrainZoomObserver?.disconnect();terrainZoomWrap=wrap;terrainZoomObserver=new MutationObserver(()=>mountCachedTerrainSurface());terrainZoomObserver.observe(wrap,{attributes:true,attributeFilter:['data-zoom']});}
  updateTerrainDetailStatus();
}
function sidePanelMarkup(model:BrowserRenderModel,locations?:string):string{
  if(LOCAL_AI_ENABLED&&localAi&&session){
   const c=playFlow.controls(session,model.viewerControllerId),planning=commandEnabled.has(session);
   const options=`<section class="panel-block playable-options"><strong><img src="./assets/playable/personnel.svg" alt="">可选辅助 · 己方 ${model.playerView.units.filter(u=>u.side===model.viewerSide).length}</strong><label><input id="flow-auto" type="checkbox" ${c.enabled?'checked':''}> FLOW · 空恢复自动准备</label><label><input id="command-enable" type="checkbox" ${planning?'checked':''}> COMMAND · 计划与行动记录</label><p role="status">${esc(c.notice)}</p><small>两项独立；默认关闭。关闭不撤销已执行动作。</small></section>`;
   const command=planning&&!model.deployment?plan.panel(session,model):'';
   const results=combatResults(session).html(model,reducedMotion.matches);
   return `<div class="command-panel-scroll playable-dock"><div class="playable-actions">${deploymentPanel(model,locations)}${phasePanel(model)}${presentation.message?`<section class="panel-block status-message"><p>${esc(formatMessage(presentation.message))}</p></section>`:''}${results}</div><div class="playable-inspect"><section class="panel-block selection-block"><span class="eyebrow">当前部队</span>${selectedSummary(model)}</section></div><div class="playable-tools">${options}${command}</div></div>${deploymentConfirm(model,presentation.selectedDeploymentUnitId,deploymentTouch)}`;
  }
  const results=session?combatResults(session).html(model,typeof reducedMotion!=='undefined'&&reducedMotion.matches):'';
  return `<div class="command-panel-scroll">${results}${model.combat?phasePanel(model):''}${model.combat?`<details class="combat-advanced"><summary>${t('combat.flow.unitDetails')}</summary>`:''}<section class="panel-block selection-block"><span class="eyebrow command-title">${t('panel.title')}</span>${selectedSummary(model)}</section>${model.combat?'</details>':''}${presentation.message&&!model.readOnly&&(!model.deployment||developerUi||deploymentTouch.status==='idle')?`<section class="panel-block status-message"><span class="eyebrow">${t('panel.report')}</span><p>${model.deployment&&!developerUi?esc(deploymentRejection(!isNetwork(session!)?session!.lastResult?.issues??[]:[])):esc(formatMessage(presentation.message))}</p></section>`:''}${deploymentPanel(model,locations)}${model.combat?'':phasePanel(model)}${developerUi&&!isNetwork(session)?viewerSwitch(model):''}${developerUi&&!isNetwork(session)&&model.playerView.viewer==='OBSERVER'?lastActionPanel(session as LocalGameSession):''}</div>${deploymentConfirm(model,presentation.selectedDeploymentUnitId,deploymentTouch)}`;
}
const dynamicMap=new DynamicMapRenderer();
const deploymentPanelRenderer=new DeploymentPanelRenderer();
function refreshDynamicView():void{
  return perf006.measure('viewUpdate',refreshDynamicViewNow);
}
function refreshDynamicViewNow():void{
  if(isNetwork(session))session.requestProjection(presentation);
  if(!session||presentation.privacyGate){render();return;}
  const model=deriveBrowserRenderModel(session,presentation);
  if(model.phase==='GAME_OVER'||model.victory.winner){render();return;}
  const svg=document.querySelector<SVGSVGElement>('#eastfront-map'),dynamic=document.querySelector<SVGGElement>('#map-dynamic-layer'),panel=document.querySelector<HTMLElement>('#side-panel');
  if(!svg||!dynamic||!panel){render();return;}
  const lod=(svg.dataset.lod as TerrainLod|undefined)??mapRenderOptions(model).lod;
  dynamicMap.update(dynamic,model,mapRenderOptions(model,lod));
  const openDetails=Array.from(panel.querySelectorAll('details')).map(el=>el.open);
  let panelScroll=0,rosterScroll=0,locationScroll=0;
  const retainedPanel=deploymentPanelRenderer.update(panel,session,model,presentation.selectedDeploymentUnitId,deploymentTouch,locations=>sidePanelMarkup(model,locations),()=>{
    // Retained scrollers keep their own offsets. Only a real replacement needs
    // layout-sensitive reads/restoration after the canonical map update.
    panelScroll=panel.querySelector('.command-panel-scroll')?.scrollTop??0;
    rosterScroll=panel.querySelector('.roster-list')?.scrollTop??0;
    locationScroll=panel.querySelector('.location-grid')?.scrollTop??0;
  });
  panel.querySelectorAll('details').forEach((el,i)=>{el.open=openDetails[i]??false;});
  if(!retainedPanel){
    const scroll=panel.querySelector('.command-panel-scroll');if(scroll)scroll.scrollTop=panelScroll;
    const roster=panel.querySelector('.roster-list'),locations=panel.querySelector('.location-grid');
    if(roster)roster.scrollTop=rosterScroll;if(locations)locations.scrollTop=locationScroll;
  }
  bindDynamic(model);
  paintDeploymentFocus(model);
  applyMapViewport();
  updateNetworkStatus();
  const hud=document.querySelector('.command-hud');if(hud)hud.innerHTML=commandHeader(model);
  const mapLabel=document.querySelector('.map-toolbar>div:first-child>span');if(mapLabel)mapLabel.textContent=t('map.viewer',{side:sideLabel(model.viewerSide),phase:phaseLabel(model.phase)});
  if(isNetwork(session)){const resources=document.querySelectorAll('.resource-strip>span>strong');if(resources[0])resources[0].textContent=String(model.cp[model.viewerSide]??'—');if(resources[1])resources[1].textContent=String(model.rp[model.viewerSide]??'—');}
}
function render():void{
  document.body.classList.toggle("playable-integrated",LOCAL_AI_ENABLED);
  if(isNetwork(session)&&appStatus==='PLAYING'&&session.playerView.phase!=='GAME_OVER'&&!forceNetworkRender&&document.querySelector('#map-dynamic-layer')&&document.querySelector('#side-panel')){
    const workspace=document.querySelector('.workspace');workspace?.classList.toggle('panel-collapsed',presentation.panelCollapsed);workspace?.classList.toggle('panel-open',!presentation.panelCollapsed);
    document.querySelector('#side-panel')?.setAttribute('aria-hidden',String(presentation.panelCollapsed));
    document.querySelector('#panel-toggle')?.setAttribute('aria-expanded',String(!presentation.panelCollapsed));
    refreshDynamicView();return;
  }
  forceNetworkRender=false;
  deploymentPanelRenderer.clear();
  const profile=responsiveProfile(window.innerWidth,window.innerHeight);
  if(appStatus==='LOADING'){root.innerHTML=loadingMarkup(startupProgress.snapshot);bind();return;}
  if(appStatus==='FATAL'){root.innerHTML=fatalMarkup(fatalMessage||t('game.noResources'));bind();return;}
  if(appStatus==='MULTIPLAYER')return;
  if(appStatus==='HOME'&&LOCAL_AI_ENABLED){root.innerHTML=localAiHome();bindLocalAiHome();return;}
  if(appStatus==='HOME'){
    if(!cachedTerrainSurface){root.innerHTML=homeMarkup(profile);bind();return;}
    const markup=homeMarkup(profile);
    root.innerHTML=markup;bind();return;
  }
  if(!session){appStatus='FATAL';fatalMessage=msg('game.noSession');root.innerHTML=fatalMarkup(fatalMessage);bind();return;}
  if(presentation.privacyGate){root.innerHTML=mobileAdvisoryMarkup(profile)+privacyGate();bind();return;}
  if(isNetwork(session))session.requestProjection(presentation);
  const model=deriveBrowserRenderModel(session,presentation);if(model.phase==='GAME_OVER'||model.victory.winner){root.innerHTML=mobileAdvisoryMarkup(profile)+gameOver(model);bind();return;}
  const debugControls=developerUi?`<div class="developer-controls"><button id="renderer-toggle" class="debug-toggle production-toggle ${presentation.rendererMode==='production'?'on':''}">${presentation.rendererMode==='production'?'Production':'Prototype'}</button><button id="debug-toggle" class="debug-toggle ${presentation.debug?'on':''}" aria-pressed="${presentation.debug}">Debug Geometry <strong>${presentation.debug?'ON':'OFF'}</strong></button></div>`:'';
  root.innerHTML=`${mobileAdvisoryMarkup(profile)}<header class="topbar"><div class="brand"><span class="brand-mark">E</span><div><strong>EASTFRONT</strong><span>${t('game.preview')} · v${WEB_PREVIEW_VERSION}</span></div></div><div class="turn-strip command-hud">${commandHeader(model)}</div><div class="resource-strip">${languageControl()}<span>${t('resource.cp')} <strong>${model.cp[model.viewerSide]??'—'}</strong></span><span>${t('resource.rp')} <strong>${model.rp[model.viewerSide]??'—'}</strong></span><button id="restart-button" class="menu-button" type="button" title="${t('game.restartTitle')}">${localAi?'退出战役':isNetwork(session)?mt('leave'):t('game.newGame')}</button><button id="panel-toggle" class="menu-button" aria-expanded="${!presentation.panelCollapsed}">${t('game.panel')}</button></div></header><main class="workspace ${presentation.panelCollapsed?'panel-collapsed':'panel-open'} ${presentation.debug?'debug-active':''}" data-responsive-profile="${profile}"><section class="map-card ${isNetwork(session)?'network-map-card':''}"><div class="map-toolbar"><div><strong>${t('map.title')}</strong><span>${t('map.viewer',{side:model.playerView.viewer==='OBSERVER'?t('fow.observer'):sideLabel(model.viewerSide),phase:phaseLabel(model.phase)})}</span></div><div class="map-controls">${modelControls(unitAnimations)}${animationControls(unitAnimations)}<div class="zoom-controls" aria-label="${t('map.zoomControls')}"><button id="zoom-out" class="map-control-button" type="button" aria-label="${t('map.zoomOut')}">−</button><span id="zoom-readout">${Math.round(mapViewport.zoom*100)}%</span><button id="zoom-in" class="map-control-button" type="button" aria-label="${t('map.zoomIn')}">+</button><button id="zoom-reset" class="map-control-button fit-button" type="button" aria-label="${t('map.fitLabel')}">${t('map.fit')}</button></div>${debugControls}<span id="terrain-detail-status" role="status"></span><button id="terrain-detail-retry" class="mini-button" type="button" hidden>${t('startup.retryDetails')}</button></div></div>${isNetwork(session)?'<p id="network-match-status" class="network-match-status" role="status"></p>':''}<div id="map-wrap" class="map-wrap ${presentation.debug?'debug-on':''}" aria-label="${t('map.eastfront')}">${coreSvgMarkup(model,mapRenderOptions(model))}</div></section><aside id="side-panel" data-viewer-controller-id="${model.viewerControllerId}" class="side-panel" aria-hidden="${presentation.panelCollapsed}">${sidePanelMarkup(model)}</aside></main><footer><span>${t('campaign.name')}</span><span>${t('game.command')}</span></footer>`;dynamicMap.adopt(document.querySelector<SVGGElement>('#map-dynamic-layer'),model,mapRenderOptions(model));mountCachedTerrainSurface();bind();paintDeploymentFocus(model);updateNetworkStatus();
}
function bind():void{
  bindStartupDiagnostics(root);
  releaseMapViewport();
  unitAnimations.sync(session,document.querySelector('#map-wrap'));
  syncFogSurface();
  bindAnimationControls(root,unitAnimations);
  bindModelControls(root,unitAnimations);
  document.querySelector('#animation-skip')?.addEventListener('click',()=>fogSurface.settle());
  document.querySelector('#animation-speed')?.addEventListener('change',()=>{if(unitAnimations.effectiveSpeed==='instant')fogSurface.settle();});
  bindLanguageControl(root,()=>{forceNetworkRender=true;render();});
  document.querySelector('#terrain-detail-retry')?.addEventListener('click',()=>{terrainPipeline?.retry();updateTerrainDetailStatus();});
  if(appStatus==='HOME'&&!LOCAL_AI_ENABLED)addMultiplayerHomeButton(root,()=>{appStatus='MULTIPLAYER';mountLobby(root,()=>{appStatus='HOME';render();},client=>void enterNetworkMatch(client));});
  document.querySelector('#new-game-button')?.addEventListener('click',()=>{if(cachedTerrainSurface)startNewGame();else void boot().then(()=>{if(cachedTerrainSurface)startNewGame();});});document.querySelector('#reload-button')?.addEventListener('click',()=>location.reload());
  if(isNetwork(session) && session.client && 'meta' in session.client)updateLocalAiStatus();
  if(!session)return;
  document.querySelector('#privacy-confirm')?.addEventListener('click',()=>{deploymentTouch=createDeploymentTouch();confirmPrivacyGate(session!,presentation);if(sessionPlayerView(session!).pendingDecision)continueCombatFlow(session!,presentation);render();});document.querySelector('#restart-button')?.addEventListener('click',()=>restartGame());document.querySelector('#renderer-toggle')?.addEventListener('click',()=>{presentation.rendererMode=presentation.rendererMode==='production'?'prototype':'production';render();});document.querySelector('#debug-toggle')?.addEventListener('click',()=>{presentation.debug=!presentation.debug;render();});document.querySelector('#panel-toggle')?.addEventListener('click',()=>{presentation.panelCollapsed=!presentation.panelCollapsed;render();});document.querySelector('#zoom-out')?.addEventListener('click',()=>{mapViewport=zoomMapAt(mapViewport,mapViewport.zoom-.2,{x:0,y:0});applyMapViewport();});document.querySelector('#zoom-in')?.addEventListener('click',()=>{mapViewport=zoomMapAt(mapViewport,mapViewport.zoom+.2,{x:0,y:0});applyMapViewport();});document.querySelector('#zoom-reset')?.addEventListener('click',()=>{mapViewport=defaultMapViewport();applyMapViewport();});bindMapViewport();bindDynamic();
}
function showCombatView():void{
  const panel=document.querySelector<HTMLElement>('#side-panel');
  if(panel&&panel.dataset.viewerControllerId!==session?.activeViewerControllerId){render();return;}
  if(presentation.panelCollapsed&&(presentation.attackTarget||(session?sessionPlayerView(session).pendingDecision:null))){presentation.panelCollapsed=false;render();}
  else refreshDynamicView();
  const scroll=document.querySelector('.command-panel-scroll');if(scroll)scroll.scrollTop=0;
}
function runCombatAction(action:()=>void):void{
  action();if(session&&!isNetwork(session)&&session.lastResult?.accepted)continueCombatFlow(session,presentation);showCombatView();
}
let combatSubmitting=false;
async function submitCombatAttack():Promise<void>{
  if(combatSubmitting||!session)return;
  const button=document.querySelector<HTMLButtonElement>('#attack-declare');if(!button||button.disabled)return;
  combatResults(session).begin();combatSubmitting=true;button.disabled=true;button.textContent=t('result.waiting');button.setAttribute('aria-busy','true');
  const card=document.querySelector<HTMLElement>('.combat-result-panel');if(card)card.innerHTML=`<p role="status">${t('result.waiting')}</p>`;
  const current=session,currentPresentation=presentation;
  try{
    // Let the busy feedback paint before Core applies the complete transaction chain.
    await new Promise<void>(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
    if(session!==current||presentation!==currentPresentation)return;
    attackAndContinue(current,presentation);if(!isNetwork(current))combatResults(current).stopWaiting();showCombatView();
  }finally{combatSubmitting=false;}
}
function paintCombatTargets():void{
  if(!session)return;
  const enabled=isCombatTargetSelection(session,presentation);
  const legal=new Set<string>();
  const knownUnits=sessionPlayerView(session).units;
  if(enabled)for(const unit of knownUnits){
    if(unit.side!==sessionPlayerView(session).activeSide){const key=coreHexKey(unit.hex);if(!legal.has(key)&&combatTargetIssues(session,presentation,unit.hex).length===0)legal.add(key);}
  }
  document.querySelectorAll<SVGElement>('[data-unit-id], [data-role="attack-target"]').forEach(el=>{
    const key=el.dataset.hex??'',attackable=enabled&&legal.has(key);
    const enemy=enabled&&knownUnits.some(unit=>unit.side!==sessionPlayerView(session!).activeSide&&coreHexKey(unit.hex)===key);
    el.classList.toggle('unavailable-combat-target',enemy&&!attackable);
    const selected=attackable&&!!presentation.attackTarget&&coreHexKey(presentation.attackTarget)===key;
    el.classList.toggle('attackable-enemy',attackable);el.classList.toggle('selected-combat-target',selected);
    if(el.dataset.role==='attack-target'){
      el.classList.toggle('unavailable-combat-target',!attackable);
      el.setAttribute('aria-disabled',String(!attackable));el.setAttribute('aria-pressed',String(selected));
    }
  });
}
const boundUnitInputs=new WeakSet<Element>();
const boundDeploymentInputs=new WeakSet<Element>();
const boundMoveInputs=new WeakSet<Element>();
function startMoveSelection():void{
  if(!session||presentation.privacyGate||isNetwork(session)&&!session.interactive)return;
  const model=deriveBrowserRenderModel(session,presentation);
  if(model.readOnly||!model.movement)return;
  presentation.pathDraft.length=0;presentation.interactionMode='MOVE_PATH';presentation.message=null;refreshDynamicView();
}
function editMoveSelection(action:()=>void):void{
  if(!session||presentation.privacyGate||presentation.interactionMode!=='MOVE_PATH'||isNetwork(session)&&!session.canSelect)return;
  action();refreshDynamicView();
}
function chooseMoveTarget(hex:ReturnType<typeof parseHex>):void{
  if(!session||presentation.privacyGate||presentation.interactionMode!=='MOVE_PATH'||isNetwork(session)&&!session.interactive)return;
  const model=deriveBrowserRenderModel(session,presentation);
  if(model.readOnly||!model.movement)return;
  // Use the same local preview / authorized multiplayer options as a blank hex.
  extendMoveDraft(session,presentation,hex);refreshDynamicView();
}
function chooseUnitTarget(id:string):void{
  if(!session||presentation.privacyGate||isNetwork(session)&&!session.canSelect)return;
  const model=deriveBrowserRenderModel(session,presentation);
  if(model.readOnly)return;
  if(chooseCounterTarget(id))return;
  if(presentation.interactionMode==='MOVE_PATH'&&presentation.selectedUnitId&&model.phase.endsWith('_MOVEMENT')){
    const view=sessionPlayerView(session),mover=view.units.find(unit=>unit.id===presentation.selectedUnitId),target=view.units.find(unit=>unit.id===id);
    if(mover&&target&&mover.side===model.viewerSide&&target.side===mover.side){chooseMoveTarget(target.hex);return;}
  }
  if(!routeCombatDecisionCounter(session,presentation,id))selectCounter(session,presentation,id);
  showCombatView();
}
function bindUnitInputs():void{
  document.querySelectorAll<SVGElement>('[data-unit-id], [data-hit-unit-id]').forEach(element=>{
    const id=element.dataset.unitId??element.dataset.hitUnitId;
    if(!id||boundUnitInputs.has(element))return;
    boundUnitInputs.add(element);
    const action=()=>chooseUnitTarget(id);
    element.addEventListener('click',event=>{event.stopPropagation();action();});
    if(element.dataset.unitId)bindKeyboardActivation(element,action);
  });
}
function bindDeploymentControls():void{
  const confirm=document.querySelector<HTMLButtonElement>('#confirm-deployment');
  if(confirm&&!boundDeploymentInputs.has(confirm)){boundDeploymentInputs.add(confirm);confirm.addEventListener('click',event=>{
   const button=event.currentTarget as HTMLButtonElement;button.disabled=true;button.textContent=t('deployment.submitting');
   if(isNetwork(session!)){if(deploymentTouch.key)deploySelectedUnit(session!,presentation,parseHex(deploymentTouch.key));updateNetworkStatus();return;}
   confirmDeploymentTarget(deploymentTouch,session!,presentation);refreshDynamicView();
  });}
  const ready=document.querySelector('#ready-button');if(ready&&!boundDeploymentInputs.has(ready)){boundDeploymentInputs.add(ready);ready.addEventListener('click',()=>{deploymentTouch=createDeploymentTouch();readyForPhase(session!,presentation);render();});}
  document.querySelectorAll<HTMLButtonElement>('[data-deploy-destination]').forEach(element=>{if(boundDeploymentInputs.has(element))return;boundDeploymentInputs.add(element);element.addEventListener('click',()=>{const key=element.dataset.deployDestination;if(!key)return;chooseTouchTarget(key);});});
  document.querySelectorAll<HTMLElement>('[data-deploy-unit-id]').forEach((element)=>{const id=element.dataset.deployUnitId;if(!id||boundDeploymentInputs.has(element))return;boundDeploymentInputs.add(element);const action=()=>{deploymentTouch=createDeploymentTouch();selectDeploymentRosterUnit(presentation,id);refreshDynamicView();};element.addEventListener('click',action);bindKeyboardActivation(element,action);});
  document.querySelectorAll<SVGPolygonElement>('[data-role="deployment-hex"]').forEach((element)=>{const key=element.dataset.hex;if(!key||boundDeploymentInputs.has(element))return;boundDeploymentInputs.add(element);const action=()=>{chooseTouchTarget(key);};element.addEventListener('click',action);bindKeyboardActivation(element,action);});
  bindUnitInputs();
}

function bindDynamic(model?:BrowserRenderModel):void{
  if(LOCAL_AI_ENABLED&&localAi&&session)bindPlayable(model??deriveBrowserRenderModel(session,presentation));
  document.querySelectorAll<HTMLButtonElement>('[data-view-side]').forEach(element=>{const side=element.dataset.viewSide as Viewer|undefined;if(!side)return;element.addEventListener('click',()=>{switchViewerForDevelopment(session!,presentation,side);render();});});
  // Result inspection is local UI and remains available to non-decision viewers.
  document.querySelector('#result-close')?.addEventListener('click',()=>{if(session){combatResults(session).close();refreshDynamicView();}});
  document.querySelectorAll<HTMLElement>('[data-result-history]').forEach(el=>el.addEventListener('click',()=>{
    if(!session||!el.dataset.resultHistory)return;
    const id=el.dataset.resultHistory,cached=combatResults(session).open(id);
    if(!cached&&!sessionPlayerView(session).pendingDecision&&(!isNetwork(session)||session.interactive))presentation.selectedBattleId=id;
    refreshDynamicView();
  }));
  if(session&&((model??deriveBrowserRenderModel(session,presentation)).readOnly||isNetwork(session)&&!session.canSelect))return;
  if(session&&isSessionDeployment(session)){bindDeploymentControls();return;}
  paintCombatTargets();
  document.querySelectorAll<HTMLElement>('[data-remove-attacker]').forEach(el=>el.addEventListener('click',()=>{
    const id=el.dataset.removeAttacker;if(!id||!session)return;toggleSupportingAttacker(session,presentation,id);refreshDynamicView();
  }));
  document.querySelectorAll<HTMLElement>('[data-attack-unit]').forEach(el=>el.addEventListener('click',()=>{
    const id=el.dataset.attackUnit;if(!id||!session)return;toggleAttackUnit(session,presentation,id);refreshDynamicView();
  }));
  if(!session)return;
  document.querySelector('#ready-button')?.addEventListener('click',()=>{deploymentTouch=createDeploymentTouch();readyForPhase(session!,presentation);render();});
  document.querySelector('#rail-edge-add')?.addEventListener('click',()=>{const key=document.querySelector<HTMLSelectElement>('#rail-edge-choice')?.value;if(key){toggleRailRepairEdge(session!,presentation,key);render();}});
  document.querySelector('#rail-mode')?.addEventListener('click',()=>{enterRailRepairMode(presentation);render();});document.querySelector('#rail-clear')?.addEventListener('click',()=>{cancelRailRepair(presentation);render();});document.querySelector('#rail-commit')?.addEventListener('click',()=>{commitRailRepair(session!,presentation);render();});document.querySelector('#rail-no-engineer')?.addEventListener('click',()=>{selectRailEngineer(presentation,null);render();});document.querySelectorAll<HTMLElement>('[data-rail-engineer]').forEach((el)=>el.addEventListener('click',()=>{selectRailEngineer(presentation,el.dataset.railEngineer??null);render();}));
  document.querySelector('#move-start')?.addEventListener('click',startMoveSelection);document.querySelector('#move-undo')?.addEventListener('click',()=>editMoveSelection(()=>undoMoveDraft(presentation)));document.querySelector('#move-cancel')?.addEventListener('click',()=>editMoveSelection(()=>cancelMoveDraft(presentation)));document.querySelector('#move-commit')?.addEventListener('click',()=>editMoveSelection(()=>commitMoveDraft(session!,presentation)));document.querySelector('#recover-unit')?.addEventListener('click',()=>{recoverSelectedUnit(session!,presentation);render();});document.querySelector('#entrench-unit')?.addEventListener('click',()=>{entrenchSelectedUnit(session!,presentation);render();});
  bindUnitInputs();
  document.querySelectorAll<SVGPolygonElement>('[data-role="move-option"]').forEach((element)=>{const key=element.dataset.hex;if(!key||boundMoveInputs.has(element))return;boundMoveInputs.add(element);const action=()=>chooseMoveTarget(parseHex(key));element.addEventListener('click',event=>{event.stopPropagation();action();});bindKeyboardActivation(element,action);});
  document.querySelectorAll<SVGLineElement>('[data-role="rail-repair-edge"]').forEach((element)=>{const key=element.dataset.edgeKey;if(!key)return;const action=()=>{if(presentation.interactionMode!=='RAIL_REPAIR')enterRailRepairMode(presentation);toggleRailRepairEdge(session!,presentation,key);render();};element.addEventListener('click',action);bindKeyboardActivation(element,action);});document.querySelectorAll<HTMLElement>('[data-reinforcement-id]').forEach((element)=>{const id=element.dataset.reinforcementId;if(!id)return;element.addEventListener('click',()=>{selectReinforcement(presentation,id);render();});});document.querySelectorAll<SVGPolygonElement>('[data-role="reinforcement-entry"]').forEach((element)=>{const key=element.dataset.hex;if(!key)return;const action=()=>{deploySelectedReinforcement(session!,presentation,parseHex(key));render();};element.addEventListener('click',action);bindKeyboardActivation(element,action);});
  document.querySelector('#attack-toggle-selected')?.addEventListener('click',()=>{if(presentation.selectedUnitId)toggleAttackUnit(session!,presentation,presentation.selectedUnitId);refreshDynamicView();});document.querySelector('#attack-clear')?.addEventListener('click',()=>{clearAttackDraft(presentation);refreshDynamicView();});document.querySelector('#attack-declare')?.addEventListener('click',()=>{void submitCombatAttack();});document.querySelector('#attack-art-none')?.addEventListener('click',()=>{selectAttackerArtillery(presentation,null);refreshDynamicView();});document.querySelectorAll<HTMLElement>('[data-attack-artillery]').forEach((el)=>el.addEventListener('click',()=>{selectAttackerArtillery(presentation,el.dataset.attackArtillery??null);refreshDynamicView();}));
  document.querySelectorAll<SVGPolygonElement>('[data-role="attack-target"]').forEach((el)=>{const action=()=>{const key=el.dataset.hex;if(key){routeCombatTarget(session!,presentation,parseHex(key));showCombatView();}};el.addEventListener('click',action);bindKeyboardActivation(el,action);});document.querySelector('#pass-reaction')?.addEventListener('click',()=>{runCombatAction(()=>passCombatReaction(session!,presentation));});document.querySelectorAll<HTMLElement>('[data-defender-artillery]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.defenderArtillery;if(id){runCombatAction(()=>useDefenderArtillery(session!,presentation,id));}}));
  document.querySelectorAll<HTMLElement>('[data-defender-hq]').forEach(el=>el.addEventListener('click',()=>{const pending=sessionPlayerView(session!).pendingDecision,hqUnitId=el.dataset.defenderHq;if(pending?.kind==='DEFENDER_REACTION'&&hqUnitId)runCombatAction(()=>{dispatchGameAction(session!,{type:'COMBAT_REACTION',controllerId:session!.activeViewerControllerId,battleId:pending.battleId,reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId,command:'LAST_STAND'}});});}));
  document.querySelectorAll<SVGPolygonElement>('[data-role="advance-option"]').forEach(el=>{const action=()=>{if(el.dataset.hex){chooseAdvanceDestination(session!,presentation,parseHex(el.dataset.hex));showCombatView();}};el.addEventListener('click',action);bindKeyboardActivation(el,action);});
  document.querySelectorAll<HTMLElement>('[data-loss-unit]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.lossUnit;if(id){chooseLossAndContinue(session!,presentation,id);showCombatView();}}));document.querySelector('#loss-undo')?.addEventListener('click',()=>{undoLossDraft(presentation);refreshDynamicView();});document.querySelector('#loss-clear')?.addEventListener('click',()=>{clearLossDraft(presentation);refreshDynamicView();});
  document.querySelectorAll<HTMLElement>('[data-retreater]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.retreater;if(id){chooseRetreater(session!,presentation,id);refreshDynamicView();}}));document.querySelectorAll<HTMLElement|SVGPolygonElement>('[data-role="retreat-option"], [data-retreat-destination]').forEach((el)=>{const action=()=>{const key=el.dataset.hex??el.dataset.retreatDestination;if(key){chooseRetreatDestination(session!,presentation,parseHex(key));showCombatView();}};el.addEventListener('click',action);bindKeyboardActivation(el,action);});document.querySelector('#retreat-undo')?.addEventListener('click',()=>{undoRetreatDestination(presentation);refreshDynamicView();});
  document.querySelectorAll<HTMLElement>('[data-advance-unit]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.advanceUnit;if(id){chooseAdvancer(session!,presentation,id);refreshDynamicView();}}));document.querySelector('#pass-advance')?.addEventListener('click',()=>{runCombatAction(()=>passAdvance(session!,presentation));});document.querySelectorAll<HTMLElement>('[data-breakthrough-unit]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.breakthroughUnit;if(id){selectBreakthroughUnit(presentation,id);refreshDynamicView();}}));document.querySelectorAll<SVGPolygonElement>('[data-role="breakthrough-option"]').forEach((el)=>el.addEventListener('click',()=>{const key=el.dataset.hex;if(key){extendBreakthroughDraft(session!,presentation,parseHex(key));refreshDynamicView();}}));document.querySelector('#breakthrough-undo')?.addEventListener('click',()=>{undoBreakthroughDraft(presentation);refreshDynamicView();});document.querySelector('#breakthrough-commit')?.addEventListener('click',()=>{runCombatAction(()=>commitBreakthrough(session!,presentation));});document.querySelector('#pass-breakthrough')?.addEventListener('click',()=>{runCombatAction(()=>passBreakthrough(session!,presentation));});document.querySelectorAll<SVGPolygonElement>('[data-role="schwerpunkt-target"]').forEach((el)=>el.addEventListener('click',()=>{const key=el.dataset.hex;if(key){selectSchwerpunktTarget(presentation,parseHex(key));render();}}));document.querySelectorAll<HTMLElement>('[data-schwerpunkt-unit]').forEach((el)=>el.addEventListener('click',()=>{const id=el.dataset.schwerpunktUnit;if(id){runCombatAction(()=>commitSchwerpunkt(session!,presentation,id));}}));document.querySelector('#pass-schwerpunkt')?.addEventListener('click',()=>{runCombatAction(()=>passSchwerpunkt(session!,presentation));});

}

function updateNetworkStatus():void {
  if(!isNetwork(session))return;
  const status=document.querySelector<HTMLElement>('#network-match-status');if(status){status.textContent=session.statusText;status.dataset.status=session.status;status.dataset.revision=String(session.matchRevision);status.dataset.interactive=String(session.interactive);}
  if(session.client && 'meta' in session.client)updateLocalAiStatus();
  // Local selection stays responsive during read-only queries. Action controls
  // still wait for the latest authorized options and the single transport slot.
  const selectionControls='[data-deploy-unit-id],[data-deploy-destination],[data-remove-attacker],[data-attack-unit],#rail-mode,#rail-edge-add,#rail-clear,#rail-no-engineer,[data-rail-engineer],#move-undo,#move-cancel,[data-reinforcement-id],#attack-toggle-selected,#attack-clear,#attack-art-none,[data-attack-artillery],#loss-clear,[data-retreater],#retreat-undo,[data-breakthrough-unit],#breakthrough-undo';
  const network=session;
  document.querySelectorAll<HTMLButtonElement>('#side-panel button').forEach(button=>{
    if(button.matches('#result-close, [data-result-history]'))return;
    const blocked=!network.canSelect||(!network.interactive&&!button.matches(selectionControls));
    if(blocked&&!button.disabled){button.dataset.networkDisabled='true';button.disabled=true;}
    else if(!blocked&&button.dataset.networkDisabled){delete button.dataset.networkDisabled;button.disabled=false;}
  });
}
async function enterNetworkMatch(client:LobbyClient|LocalAiClient):Promise<void> {
  presentation=createPresentationState(false,window.matchMedia('(max-width: 1100px)').matches);deploymentTouch=createDeploymentTouch();
  const network=new NetworkPlayerSession(client,presentation,kind=>{
    if(session!==network||appStatus!=='PLAYING')return;
    if(kind==='resync'){combatResults(network).recover();unitAnimations.skip();deploymentTouch=createDeploymentTouch();deploymentPanelRenderer.clear();}
    if(network.notice&&!network.client.state.pending)combatResults(network).stopWaiting();
    if(kind==='status'){updateNetworkStatus();return;}
    if(kind==='view')deploymentTouch=createDeploymentTouch();
    refreshDynamicView();
  });
  session=network;
  if(LOCAL_AI_ENABLED&&localAi)plan.observe(network,()=>({viewer:network.activeViewerControllerId,view:sessionPlayerView(network)}));
  terrainPipeline?.resume();
  if(!cachedTerrainSurface)await boot(network.renderModel());
  if(!cachedTerrainSurface){network.dispose();return;}
  if(session!==network){network.dispose();return;}
  session=network;appStatus='PLAYING';presentation.privacyGate=null;if(LOCAL_AI_ENABLED&&localAi)presentation.panelCollapsed=false;render();terrainPipeline?.continueAll();
}

function localAiHome():string {
 return `<main class="home-screen"><h1>EASTFRONT · 单人战役</h1><p>PLAYABLE-001 · 主游戏整合候选</p><p>本地运行，不连接多人服务。暂不支持存档或加载，刷新会结束当前对局。</p><label>玩家阵营 <select id="ai-side"><option value="GERMAN">德军</option><option value="SOVIET">苏军</option></select></label><details class="playable-test-scenes"><summary>定向流程检查（可选）</summary><label>场景 <select id="ai-scenario"><option value="campaign">完整战役（从部署开始）</option><option value="human-attack">人类进攻 → AI 反应 / 撤退</option><option value="ai-attack">脚本 AI 进攻 → 人类反应</option><option value="reinforcement">第4回合增援</option><option value="breakthrough">实际战斗后的推进 / 突破</option><option value="terminal">现行终局检查前</option><option value="stop">停止与人工接管</option></select></label></details><p>完整战役使用自主 AI；其余场景用于流程检查。AI 已会按资格和RP主动恢复、为未移动的合格单位筑垒；仍不会主动修铁路或使用 HQ／炮兵支援，突破通常放弃。工业与新补给实验未接入。</p><button id="ai-start" class="primary-action">开始战役</button>${perf006.enabled?'<button id="ai-perf-report">导出上局性能诊断</button><textarea id="ai-perf-output" aria-label="上局性能诊断" readonly hidden></textarea>':''}</main>`;
}
function bindLocalAiHome():void {
 document.querySelector('#ai-perf-report')?.addEventListener('click',()=>{const field=document.querySelector<HTMLTextAreaElement>('#ai-perf-output')!;field.hidden=false;field.value=JSON.stringify(perf006.report(),null,2);field.select();void navigator.clipboard?.writeText(field.value).catch(()=>{});});
 document.querySelector('#ai-start')?.addEventListener('click',()=>{
 const side=(document.querySelector<HTMLSelectElement>('#ai-side')?.value??'GERMAN') as 'GERMAN'|'SOVIET';
 const scenario=(document.querySelector<HTMLSelectElement>('#ai-scenario')?.value??'campaign') as LocalScenario;
 void startLocalAi(side,scenario);
});}
function leaveLocalAi():void {
 perf006.measure('exitHandler',()=>{
 localGeneration++;if(isNetwork(session))session.dispose();else localAi?.dispose();localAi=null;session=null;appStatus='HOME';terrainPipeline?.pause();render();
 });perf006.stop();
}
async function startLocalAi(humanSide:'GERMAN'|'SOVIET',scenario:LocalScenario):Promise<void>{
 const generation=++localGeneration;
 if(isNetwork(session))session.dispose();else localAi?.dispose();session=null;localAi=null;
 if(!productionMap||!cachedTerrainSurface){await boot();if(generation!==localGeneration||!productionMap||!cachedTerrainSurface)return;}
 perf006.start(query.get('aiPerf006')==='1');
 const fixedSeed=query.get('aiSeed');
 const seed=perf006.enabled&&fixedSeed!==null&&/^\d+$/.test(fixedSeed)&&Number(fixedSeed)<=0xffffffff?Number(fixedSeed):crypto.getRandomValues(new Uint32Array(1))[0]!;
 const options={humanSide,scenario,seed,map:productionMap,performance:perf006.enabled};
 const port=createLocalAiWorker();
 const client=new LocalAiClient(port,options,()=>{if(localAi===client)updateLocalAiStatus();});localAi=client;appStatus='LOADING';render();
 try{await client.start(options);if(generation!==localGeneration){client.dispose();return;}await enterNetworkMatch(client);}
 catch(error){if(generation!==localGeneration)return;client.dispose();localAi=null;session=null;appStatus='HOME';render();const warning=document.createElement('p');warning.textContent='本地 AI 启动失败：'+(error instanceof Error?error.message:'UNKNOWN');root.prepend(warning);}
}
function updateLocalAiStatus():void {
 if(!localAi||appStatus==='HOME')return;
 let bar=document.querySelector<HTMLElement>('#local-ai-status');if(!bar){bar=document.createElement('section');bar.id='local-ai-status';bar.className='local-ai-status';root.prepend(bar);}
 const client=localAi,m=client.meta,side=(s:string)=>s==='GERMAN'?'德军':'苏军';
 const status=appStatus==='LOADING'?'正在准备本地对局 / 切换授权视角':localStatus(m,client.state.snapshot?.status==='FINISHED');
 if(!bar.querySelector('#ai-exit')){
  bar.innerHTML='<strong>实验 AI：流程验证，策略尚弱</strong><span id="ai-status-text" role="status"></span><span id="ai-status-count"></span><button id="ai-takeover" class="mini-button" hidden></button><button id="ai-diagnostic" class="mini-button">复制诊断</button><button id="ai-exit" class="mini-button">退出 / 新局</button>';
  bar.querySelector('#ai-exit')!.addEventListener('click',leaveLocalAi);
  bar.querySelector('#ai-diagnostic')!.addEventListener('click',()=>{
   let field=bar!.querySelector<HTMLTextAreaElement>('#ai-diagnostic-text');
   if(!field){field=document.createElement('textarea');field.id='ai-diagnostic-text';field.readOnly=true;field.setAttribute('aria-label','安全 AI 诊断');bar!.append(field);}
   field.value=JSON.stringify({version:'AI-PERF-006',...client.meta,revision:client.state.snapshot?.matchRevision,...(perf006.enabled?{performance:perf006.report()}: {})},null,2);
   field.select();void navigator.clipboard?.writeText(field.value).catch(()=>{});
  });
  bar.querySelector('#ai-takeover')!.addEventListener('click',()=>{
   if(bar!.querySelector('#ai-takeover-confirm'))return;
   const owner=client.meta.ownerSide,revision=client.state.snapshot?.matchRevision;
   const prompt=document.createElement('span');prompt.id='ai-takeover-confirm';prompt.setAttribute('role','group');prompt.setAttribute('aria-label','确认人工接管');
   const message=document.createElement('span');message.textContent=`切换到${side(owner)}的授权视角？接管后 AI 停止，后续切换座位仍需明确确认。`;
   const confirm=document.createElement('button');confirm.id='ai-takeover-accept';confirm.className='mini-button';confirm.textContent='确认接管';
   const cancel=document.createElement('button');cancel.id='ai-takeover-cancel';cancel.className='mini-button';cancel.textContent='取消';
   cancel.addEventListener('click',()=>prompt.remove());
   confirm.addEventListener('click',async()=>{
    if(localAi!==client||client.meta.ownerSide!==owner||client.state.snapshot?.matchRevision!==revision){prompt.remove();return;}
    confirm.disabled=true;cancel.disabled=true;
    const generation=++localGeneration;if(isNetwork(session))session.dispose(false);session=null;appStatus='LOADING';render();
    try{await client.takeover();if(generation!==localGeneration||localAi!==client)return;await enterNetworkMatch(client);}catch{if(generation===localGeneration)updateLocalAiStatus();}
   });
   prompt.append(message,confirm,cancel);bar!.append(prompt);confirm.focus();
  });
 }
 const setText=(selector:string,value:string)=>{const el=bar!.querySelector(selector)!;if(el.textContent!==value)el.textContent=value;};
 setText('#ai-status-text',status+' · 当前行动方：'+side(m.ownerSide)+' · 你的视角：'+side(m.humanSide));
 setText('#ai-status-count',`接受 ${m.accepted} / 拒绝 ${m.rejected} · 暂不支持存档 / 加载`);
 const takeover=bar.querySelector<HTMLButtonElement>('#ai-takeover')!;
 takeover.hidden=!(m.manual||/^(AGENT_STOP|AGENT_ERROR|REJECTION_LIMIT)/.test(m.reason??''));
 setText('#ai-takeover',`明确接管 ${side(m.ownerSide)}（切换授权视角）`);
 const statusEl=document.querySelector('#network-match-status');if(statusEl&&statusEl.textContent!==status)statusEl.textContent=status;
}

function updateTerrainDetailStatus():void {
  const label=document.querySelector<HTMLElement>('#terrain-detail-status'),retry=document.querySelector<HTMLButtonElement>('#terrain-detail-retry');
  if(!label||!terrainPipeline)return;
  const failed=terrainPipeline.failures.size>0,completed=terrainPipeline.ready.size;
  label.textContent=failed?t('startup.detailsFailed'):completed<3?t('startup.detailsPending',{completed,total:3}):'';
  label.dataset.completed=String(completed);label.dataset.failed=String(failed);
  if(retry)retry.hidden=!failed;
}
async function boot(networkModel?:BrowserRenderModel):Promise<void>{
  if(terrainBoot)return terrainBoot;
  terrainBoot=prepareTerrain(networkModel);
  try{await terrainBoot;}finally{terrainBoot=null;}
}
async function prepareTerrain(networkModel?:BrowserRenderModel):Promise<void>{
  appStatus='LOADING';render();
  const stopObserving=observeTerrainLoad(startupProgress.observe);
  let phase='manifest/map';
  try{
    const [map]=await Promise.all([loadProductionMapFromUrl(),loadProductionRuntimeManifest()]);
    productionMap=map;startupProgress.complete('resources');
    phase='static-terrain-surface';
    const terrainModel=networkModel??deriveBrowserRenderModel(createFreshProductionSession(map,TERRAIN_VISUAL_SEED),createPresentationState(false,false));
    // Retain static geometry only: never keep a PlayerView, controller, units or knowledge in the terrain task.
    const staticModel={hexes:terrainModel.hexes.map(({coord,terrain})=>({coord:{...coord},terrain})),
      edges:terrainModel.edges.map(({key,a,b,road,railway,river,bridge})=>({key,a:{...a},b:{...b},road,railway,river,bridge}))} as BrowserRenderModel;
    const vs2=await loadVS2TerrainSurfaceHooks();
    startupProgress.complete('model');startupProgress.building();
    const pipeline=new ProgressiveTerrain<CachedTerrainSurface>(
      (lod,control)=>buildCachedTerrainSurface(staticModel,TERRAIN_VISUAL_SEED,'p5',lod,vs2.worldBaseFor(control)),
      lod=>{
        if(terrainPipeline!==pipeline)return;
        const surface=pipeline.ready.get(lod);
        if(surface){cachedTerrainSurfaces.set(lod,surface);startupProgress.complete(lod);}
        if(pipeline.ready.size===3){startupProgress.finish();stopObserving();}
        if(pipeline.failures.size)stopObserving();
        if(appStatus==='PLAYING'){mountCachedTerrainSurface();applyMapViewport();updateTerrainDetailStatus();}
      },surface=>{surface.canvas.width=0;surface.canvas.height=0;});
    terrainPipeline=pipeline;
    cachedTerrainSurface=await pipeline.request(mapRenderOptions(terrainModel).lod??'far');
    console.info('EASTFRONT first terrain surface ready',cachedTerrainSurface.stats);
    appStatus='HOME';render();
  }catch(error){
    stopObserving();startupProgress.fail();terrainPipeline?.dispose();terrainPipeline=null;
    const detail=phase==='static-terrain-surface'?formatTerrainSurfaceFailure(error):(error instanceof Error?`${error.name}: ${error.message}`:String(error));
    const diagnostic={phase,detail,capabilities:terrainSurfaceCapabilities()};
    console.error('EASTFRONT startup failed',diagnostic,error);
    appStatus='FATAL';fatalMessage=msg('game.resourceFailure',{detail});render();
  }
}
window.addEventListener('resize',()=>{if(appStatus==='HOME'||appStatus==='PLAYING')render();});
window.addEventListener('pagehide',()=>{localGeneration++;localAi?.dispose();});

// Lobby and HOME need no terrain/session. Local play retains the full Startup Loading UX1 path.
appStatus='HOME';render();

// Lazy world-surface hook; the existing boot-time cache and image loader remain in use.
export async function loadVS2TerrainSurfaceHooks() {
  const { createVS2TerrainSurfaceHooks } = await import('./render/vs2TerrainSurface.js');
  return {worldBaseFor:(control:import('./render/terrainWork.js').TerrainWorkControl)=>createVS2TerrainSurfaceHooks(undefined,control).worldBase};
}

// PLAYABLE-001: optional UI state lives only in the current authorized session.
const commandEnabled=new WeakSet<object>();
function flowEnabled(model:BrowserRenderModel):boolean{return !!session&&LOCAL_AI_ENABLED&&!!localAi&&playFlow.controls(session,model.viewerControllerId).enabled;}
function playableContext(s:PlayerSession):playFlow.FlowContext{return {model:deriveBrowserRenderModel(s,presentation),revision:isNetwork(s)?s.matchRevision:-1,ready:isNetwork(s)&&s.interactive,privacy:!!presentation.privacyGate,local:LOCAL_AI_ENABLED&&!!localAi&&isNetwork(s)&&s.client===localAi,rejected:isNetwork(s)&&['actionRejected','outdated'].includes(s.notice??'')};}
function bindPlayable(model:BrowserRenderModel):void{
 if(!session)return;const captured=session,pp=presentation;
 const ctx=playableContext(captured);if(ctx.rejected)playFlow.stopOnRejection(captured,model.viewerControllerId);
 document.querySelector<HTMLInputElement>('#flow-auto')?.addEventListener('change',e=>{playFlow.setEnabled(captured,model.viewerControllerId,(e.target as HTMLInputElement).checked);refreshDynamicView();});
 document.querySelector<HTMLInputElement>('#command-enable')?.addEventListener('change',e=>{if((e.target as HTMLInputElement).checked)commandEnabled.add(captured);else{commandEnabled.delete(captured);plan.scope(captured,model.viewerControllerId).picking=null;}refreshDynamicView();});
 const ticket=playFlow.autoTicket(captured,ctx);
 if(ticket)setTimeout(()=>{if(session===captured&&presentation===pp&&playFlow.runAuto(captured,playableContext(captured),ticket,()=>readyForPhase(captured,pp)))refreshDynamicView();},600);
 if(!commandEnabled.has(captured)||model.deployment)return;
 const p=plan.scope(captured,model.viewerControllerId);
 if(p.phase!==model.phase||model.combat?.pending||model.readOnly)p.picking=null;p.phase=model.phase;
 const button=(id:string,fn:()=>void)=>document.querySelector(id)?.addEventListener('click',()=>{if(session!==captured)return;fn();refreshDynamicView();});
 button('#command-member',()=>plan.toggleMember(p,model,presentation.selectedUnitId));
 button('#command-target',()=>{if(!model.combat?.pending&&!model.readOnly)p.picking='target';});
 button('#command-origin',()=>{if(!model.combat?.pending&&!model.readOnly)p.picking='origin';});
 button('#command-cancel-pick',()=>{p.picking=null;});
 button('#command-clear',()=>{p.members=[];p.target=null;p.origin=null;p.picking=null;});
 button('#command-focus',()=>{if(p.target)focusPlanHex(p.target);});
 document.querySelectorAll<HTMLElement>('[data-command-remove]').forEach(el=>el.addEventListener('click',()=>{p.members=p.members.filter((id:string)=>id!==el.dataset.commandRemove);refreshDynamicView();}));
 document.querySelectorAll<HTMLElement>('[data-command-unit],[data-command-locate]').forEach(el=>el.addEventListener('click',()=>{
  if(session!==captured)return;const current=deriveBrowserRenderModel(captured,presentation),id=el.dataset.commandUnit??el.dataset.commandLocate,u=current.playerView.units.find(u=>u.id===id&&u.side===current.viewerSide);if(!u)return;
  if(!current.combat?.pending&&!current.readOnly){selectCounter(captured,presentation,u.id);refreshDynamicView();}focusPlanHex(u.hex);
 }));
}
function focusPlanHex(hex:{q:number;r:number}):void{
 const svg=document.querySelector<SVGSVGElement>('#eastfront-map'),wrap=document.querySelector('#map-wrap');if(!svg||!wrap)return;
 mapViewport=defaultMapViewport();applyMapViewport();const point=hexToPixel(hex),m=svg.getScreenCTM(),r=wrap.getBoundingClientRect();if(!m)return;
 const screen=new DOMPoint(point.x,point.y).matrixTransform(m);mapViewport={zoom:2.5,panX:(r.left+r.width/2-screen.x)*2.5,panY:(r.top+r.height/2-screen.y)*2.5};applyMapViewport();
}
function paintPlanMap(model:BrowserRenderModel):void{
 const svg=document.querySelector('#eastfront-map'),wrap=document.querySelector('#map-wrap');if(!svg||!wrap||!session)return;
 svg.querySelector('#command-overlay')?.remove();svg.querySelector('#command-picker')?.remove();document.querySelector('#command-map-note')?.remove();
 if(!commandEnabled.has(session)||model.deployment)return;
 svg.insertAdjacentHTML('beforeend',plan.overlay(session,model)+plan.picker(session,model));
 // Summary shares the bottom dock, never covers tactical click targets.
 const panel=document.querySelector('.playable-tools');panel?.insertAdjacentHTML('beforeend',plan.summary(session,model));
 svg.querySelectorAll<SVGElement>('[data-command-hex]').forEach(el=>{const mark=()=>{if(!session)return;const now=deriveBrowserRenderModel(session,presentation);plan.mark(plan.scope(session,now.viewerControllerId),now,parseHex(el.dataset.commandHex!));refreshDynamicView();};el.addEventListener('click',e=>{e.stopPropagation();mark();});bindKeyboardActivation(el,mark);});
}
