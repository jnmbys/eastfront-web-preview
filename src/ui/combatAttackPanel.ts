import { issueText } from '../localization/issues.js';
import { t } from '../localization/index.js';
import type {BrowserRenderModel} from '../render/coreModel.js';
import {escapeUi as esc,unitLabel} from './commandPresentation.js';
export function combatAttackPanel(model:BrowserRenderModel,details:string):string {
 const c=model.combat;if(!c)return '';const a=c.attackDraft,preview=a.preview;
 const key=(h:{q:number;r:number})=>`${h.q},${h.r}`;
 const label=(id:string)=>{const u=model.counters.find(u=>u.id===id);return u?`${unitLabel(u.side)} ${unitLabel(u.type)} · ${id}`:id;};
 const defenders=a.target?model.counters.filter(u=>u.side!==model.viewerSide&&key(u.hex)===key(a.target!)):[];
 const terrain=a.target?model.hexes.find(h=>key(h.coord)===key(a.target!))?.terrain:null;
 const enabled=!!a.target&&a.attackerUnitIds.length>0&&a.issues.length===0&&!!preview;
 const allies=model.counters.filter(u=>u.side===model.viewerSide);
 const result=c.battle?.resolution;
 return `<section class="panel-block phase-actions attack-preview"><span class="eyebrow">${t('combat.mode')}</span>
 <p class="attack-guidance">${!a.attackerUnitIds.length?t('common.selectUnit'):!a.target?t('combat.chooseEnemy'):t('combat.review')}</p>
 <div class="attack-matchup"><strong>${a.attackerUnitIds.map(id=>esc(label(id))).join('<br>')||t('combat.selectAttacker')}</strong><span>${t('combat.versus')}</span><strong>${defenders.map(u=>esc(label(u.id))).join('<br>')||t('combat.selectEnemy')}</strong></div>
 <div class="phase-metric"><span>${t('common.target')}</span><strong>${a.target?key(a.target):'—'}</strong></div>
 ${terrain?`<div class="phase-metric"><span>${t('common.terrain')}</span><strong>${unitLabel(terrain)}</strong></div>`:''}
 ${preview?`<div class="attack-odds"><span>${t('combat.odds')} <strong>${esc(preview.finalCRTColumnLabel)}</strong></span><span>${t('combat.modifiers')} <strong>${preview.finalShift>0?'+':''}${preview.finalShift}</strong></span></div><small>${t('combat.previewHelp')}</small>`:''}
 <div role="status" aria-live="polite">${a.issues.map(i=>`<p>${esc(issueText(i))}</p>`).join('')}</div>
 <button id="attack-declare" class="primary-action combat-confirm" ${enabled?'':'disabled'}>${t('combat.attack')}</button>
 <details class="combat-advanced"><summary>${t('combat.advanced')}</summary>
 <p>${t('combat.advancedHelp')}</p>
 <div class="combat-unit-list">${allies.map(u=>`<button class="mini-button ${a.attackerUnitIds.includes(u.id)?'active':''}" data-attack-unit="${esc(u.id)}" aria-pressed="${a.attackerUnitIds.includes(u.id)}">${a.attackerUnitIds.includes(u.id)?'−':'+'} ${esc(label(u.id))}</button>`).join('')}</div>
 ${a.target?`<p>${t('unit.artilleryDescription')}</p><div class="button-row"><button id="attack-art-none" class="mini-button ${!a.selectedArtilleryId?'active':''}">${t('combat.noArtillery')}</button>${a.artilleryUnitIds.map(id=>`<button class="mini-button ${a.selectedArtilleryId===id?'active':''}" data-attack-artillery="${esc(id)}">${esc(label(id))}</button>`).join('')}</div>`:''}
 <button id="attack-clear" class="secondary-action">${t('combat.clear')}</button></details>
 ${details?`<details class="combat-advanced"><summary>${t('combat.detailsSummary')}</summary>${details}</details>`:''}
 ${result?`<div class="combat-card" role="status"><h3>${t('combat.lastResult',{result:esc(result.crtResult)})}</h3><p>${t('combat.dice',{...result.dice})}</p></div>`:''}
 <button id="ready-button" class="secondary-action">${t('combat.endPhase')}</button></section>`;
}
