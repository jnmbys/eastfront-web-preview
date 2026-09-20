import type {BrowserRenderModel} from '../render/coreModel.js';
export const escapeUi=(value:string):string=>value.replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]??c));
export const unitLabel=(type:string):string=>type.toLowerCase().replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export function commandHeader(model:BrowserRenderModel):string{
 const phase=model.phase.replace(/^(GERMAN|SOVIET)_/,'').replaceAll('_',' ');
 return `<div class="campaign-heading"><span class="eyebrow">STRATEGIC RESET F</span><strong>${escapeUi(phase)}</strong></div><div class="campaign-turn"><span>TURN</span><strong>${String(model.turn).padStart(2,'0')}</strong></div><div class="campaign-side" data-side="${model.activeSide}"><span class="faction-seal" aria-hidden="true">${model.activeSide==='GERMAN'?'G':'S'}</span><strong>${model.activeSide}</strong></div>`;
}
export function deploymentLocations(model:BrowserRenderModel,selected:string|null):string{
 const d=model.deployment;if(!d||!selected||model.activeSide!==model.viewerSide)return '';
 const row=d.roster.find(r=>r.id===selected);if(!row||row.placed)return '';
 return `<details class="deployment-locations" open><summary>Choose deployment position</summary><p>Large touch targets for the same highlighted map area. Positions use map coordinates; placement is validated on selection.</p><div class="location-grid">${d.zoneKeys.map(key=>`<button type="button" class="location-button" data-deploy-destination="${escapeUi(key)}" aria-label="Deploy selected unit at ${escapeUi(key)}">${escapeUi(key)}</button>`).join('')}</div></details>`;
}
