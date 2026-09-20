import { t, enumLabel, phaseName, formatMessage } from '../localization/index.js';
import type {DeploymentTouch} from './deploymentTouch.js';
import type {BrowserRenderModel} from '../render/coreModel.js';
export const escapeUi=(value:string):string=>value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]??c));
export const unitLabel=(type:string):string=>enumLabel(type);
export function commandHeader(model:BrowserRenderModel):string{
 const phase=phaseName(model.phase,false);
 return `<div class="campaign-heading"><span class="eyebrow">${t('campaign.name')}</span><strong>${escapeUi(phase)}</strong></div><div class="campaign-turn"><span>${t('common.turn')}</span><strong>${t('game.turn',{turn:model.turn})}</strong></div><div class="campaign-side" data-side="${model.activeSide}"><span class="faction-seal" aria-hidden="true">${model.activeSide==='GERMAN'?'G':'S'}</span><strong>${enumLabel(model.activeSide)}</strong></div>`;
}
export function deploymentLocations(model:BrowserRenderModel,selected:string|null,ui?:DeploymentTouch):string{
 const d=model.deployment;if(!d||!selected||model.activeSide!==model.viewerSide)return '';
 const row=d.roster.find(r=>r.id===selected);if(!row||row.placed)return '';
 const cards=d.zoneKeys.map(key=>{
  const h=model.hexes.find(h=>`${h.coord.q},${h.coord.r}`===key);
  const terrain=unitLabel(h?.terrain??t('common.unknown'));
  const occupied=model.counters.filter(c=>`${c.hex.q},${c.hex.r}`===key).length;
  const chosen=ui?.unitId===selected&&ui.key===key;
  return `<button type="button" class="location-button location-card ${chosen?'selected':''}" data-deploy-destination="${escapeUi(key)}" aria-pressed="${chosen}"><span class="card-unit-type">${t('deployment.unitTitle',{unit:unitLabel(row.type)})}</span><strong>${escapeUi(terrain)}</strong><span>${t('deployment.terrain',{terrain:escapeUi(terrain)})}</span><span>${t('deployment.occupancy',{occupancy:occupied?t('deployment.visibleUnits',{count:occupied}):t('deployment.noVisibleUnits')})}</span><small>${t('deployment.position',{position:escapeUi(key)})}</small></button>`;
 }).join('');
 return `<section class="deployment-locations"><div class="deployment-location-heading"><strong>${t('deployment.chooseTerrain')}</strong><span>${t('deployment.locationsHelp',{count:d.zoneKeys.length})}</span></div><div class="location-grid">${cards}</div></section>`;
}
export function deploymentConfirm(model:BrowserRenderModel,selected:string|null,ui:DeploymentTouch):string{
 const row=model.deployment?.roster.find(r=>r.id===selected);
 if(!row||row.placed||model.viewerSide!==model.activeSide)return '';
 const chosen=ui.unitId===selected&&ui.key;
 const terrain=chosen?model.hexes.find(h=>`${h.coord.q},${h.coord.r}`===ui.key)?.terrain:null;
 return `<div class="deployment-confirm"><p>${unitLabel(row.type)} · ${chosen?`${unitLabel(terrain??t('common.unknown'))} / ${escapeUi(ui.key!)}`:t('deployment.chooseDestination')}</p>${deploymentFeedback(ui)}<button type="button" id="confirm-deployment" class="primary-action" ${chosen?'':'disabled'}>${t('deployment.confirm')}</button></div>`;
}

export function deploymentFeedback(ui:DeploymentTouch):string{
 if(ui.status==='idle')return '';
 return `<div class="deployment-feedback ${ui.status}" role="${ui.status==='invalid'?'alert':'status'}"><strong>${ui.status==='deployed'?t('deployment.deployed'):ui.status==='invalid'?t('deployment.cannotDeploy'):t('deployment.readyToConfirm')}</strong><p>${escapeUi(formatMessage(ui.message))}</p></div>`;
}
export function unitDescription(type:string):string{
 const descriptions:Record<string,string>={INFANTRY:t('unit.infantryDescription'),ELITE_INFANTRY:t('unit.eliteDescription'),JAGER:t('unit.jagerDescription'),PANZER:t('unit.panzerDescription'),TANK:t('unit.tankDescription'),HEAVY_TANK:t('unit.heavyDescription'),ARTILLERY:t('unit.artilleryDescription'),ENGINEER:t('unit.engineerDescription'),RECON:t('unit.reconDescription'),MOTORIZED:t('unit.motorizedDescription'),ANTI_TANK:t('unit.atDescription'),HQ:t('unit.hqDescription')};
 return descriptions[type]??unitLabel(type);
}
