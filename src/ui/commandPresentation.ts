import type {DeploymentTouch} from './deploymentTouch.js';
import type {BrowserRenderModel} from '../render/coreModel.js';
export const escapeUi=(value:string):string=>value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]??c));
export const unitLabel=(type:string):string=>type.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function commandHeader(model:BrowserRenderModel):string{
 const phase=model.phase.replace(/^(GERMAN|SOVIET)_/,'').replaceAll('_',' ');
 return `<div class="campaign-heading"><span class="eyebrow">STRATEGIC RESET F</span><strong>${escapeUi(phase)}</strong></div><div class="campaign-turn"><span>TURN</span><strong>${String(model.turn).padStart(2,'0')}</strong></div><div class="campaign-side" data-side="${model.activeSide}"><span class="faction-seal" aria-hidden="true">${model.activeSide==='GERMAN'?'G':'S'}</span><strong>${model.activeSide}</strong></div>`;
}
export function deploymentLocations(model:BrowserRenderModel,selected:string|null,ui?:DeploymentTouch):string{
 const d=model.deployment;if(!d||!selected||model.activeSide!==model.viewerSide)return '';
 const row=d.roster.find(r=>r.id===selected);if(!row||row.placed)return '';
 const cards=d.zoneKeys.map(key=>{
  const h=model.hexes.find(h=>`${h.coord.q},${h.coord.r}`===key);
  const terrain=unitLabel(h?.terrain??'Unknown');
  const occupied=model.counters.filter(c=>`${c.hex.q},${c.hex.r}`===key).length;
  const chosen=ui?.unitId===selected&&ui.key===key;
  return `<button type="button" class="location-button location-card ${chosen?'selected':''}" data-deploy-destination="${escapeUi(key)}" aria-pressed="${chosen}"><strong>${escapeUi(terrain)}</strong><span>Deployment area</span><span>${occupied?`${occupied} visible unit(s)`:'No visible units'}</span><small>Position ${escapeUi(key)}</small></button>`;
 }).join('');
 const chosen=ui?.unitId===selected&&ui.key;
 return `<section class="deployment-locations"><div class="deployment-location-heading"><strong>Choose an area</strong><span>${d.zoneKeys.length} zone positions · legality checked on confirmation</span></div><div class="location-grid">${cards}</div><div class="deployment-confirm"><p role="status">${chosen?`Selected position ${escapeUi(ui!.key!)}`:'Select a terrain card or a highlighted map position.'}</p><button type="button" id="confirm-deployment" class="primary-action" ${chosen?'':'disabled'}>CONFIRM DEPLOYMENT</button></div></section>`;
}
export function deploymentFeedback(ui:DeploymentTouch):string{
 if(ui.status==='idle')return '';
 return `<div class="deployment-feedback ${ui.status}" role="${ui.status==='invalid'?'alert':'status'}"><strong>${ui.status==='deployed'?'DEPLOYED':ui.status==='invalid'?'CANNOT DEPLOY':'READY TO CONFIRM'}</strong><p>${escapeUi(ui.message)}</p></div>`;
}
export function unitDescription(type:string):string{
 const descriptions:Record<string,string>={INFANTRY:'Infantry formation',ELITE_INFANTRY:'Elite infantry formation',JAGER:'Light infantry formation',PANZER:'Armored formation',TANK:'Tank formation',HEAVY_TANK:'Heavy tank formation',ARTILLERY:'Artillery support',ENGINEER:'Engineer support',RECON:'Reconnaissance formation',MOTORIZED:'Motorized formation',ANTI_TANK:'Anti-tank formation',HQ:'Headquarters'};
 return descriptions[type]??unitLabel(type);
}
