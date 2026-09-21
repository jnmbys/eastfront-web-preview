import { issueText } from '../localization/issues.js';
import { t } from '../localization/index.js';
import { escapeUi as esc, unitLabel } from './commandPresentation.js';
export function combatAttackPanel(model, details) {
    const c = model.combat;
    if (!c)
        return '';
    const a = c.attackDraft, preview = a.preview;
    const key = (h) => `${h.q},${h.r}`;
    const label = (id) => { const u = model.counters.find(u => u.id === id); return u ? `${unitLabel(u.side)} ${unitLabel(u.type)} · ${id}` : id; };
    const chipIds = a.primaryAttackerId ? [a.primaryAttackerId, ...a.attackerUnitIds.filter(id => id !== a.primaryAttackerId)] : a.attackerUnitIds;
    const chips = chipIds.map(id => {
        const unit = model.counters.find(u => u.id === id), name = unit ? `${unitLabel(unit.type)} · ${id}` : id;
        return id === a.primaryAttackerId || !a.target
            ? `<span class="combat-attacker-chip ${id === a.primaryAttackerId ? 'primary' : ''}" title="${t(id === a.primaryAttackerId ? 'combat.group.primary' : 'combat.group.selected')}">${esc(name)}</span>`
            : `<button type="button" class="combat-attacker-chip" data-remove-attacker="${esc(id)}" aria-label="${esc(t('combat.group.remove', { unit: label(id) }))}">${esc(name)} <span aria-hidden="true">×</span></button>`;
    }).join('');
    const defenders = a.target ? model.counters.filter(u => u.side !== model.viewerSide && key(u.hex) === key(a.target)) : [];
    const terrain = a.target ? model.hexes.find(h => key(h.coord) === key(a.target))?.terrain : null;
    const enabled = !!a.target && a.attackerUnitIds.length > 0 && a.issues.length === 0 && !!preview;
    const allies = model.counters.filter(u => u.side === model.viewerSide);
    const result = c.battle?.resolution;
    const modifierKeys = { terrainShift: 'common.terrain', riverShift: 'combat.river', engineerShift: 'combat.engineer', combinedArmsShift: 'combat.combinedArms', unsupportedArmorShift: 'combat.armorPenalty', antiTankShift: 'combat.antiTank', attackerArtilleryShift: 'combat.attackerArtillery', defenderArtilleryShift: 'combat.defenderArtillery', flankShift: 'combat.flank', entrenchmentShift: 'combat.entrenchment', hqShift: 'combat.hq', secondAttackShift: 'combat.secondAttack' };
    const modifiers = preview ? Object.entries(modifierKeys).filter(([key]) => preview.modifiers[key] !== 0).map(([key, label]) => `${t(label)} ${preview.modifiers[key] > 0 ? '+' : ''}${preview.modifiers[key]}`) : [];
    const crt = `<div class="combat-crt-scroll"><table class="combat-crt"><caption>${t('combat.flow.crtTable')}</caption><thead><tr><th>${t('combat.flow.diceTotal')}</th>${c.crt.columns.map(label => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${Object.entries(c.crt.table).map(([roll, results]) => `<tr><th>${roll}</th>${results.map(result => `<td>${esc(result)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    return `<section class="panel-block phase-actions attack-preview"><span class="eyebrow">${t('combat.flow.preview')}</span>
 <p class="attack-guidance">${!a.attackerUnitIds.length ? t('common.selectUnit') : !a.target ? t('combat.chooseEnemy') : t('combat.flow.ready')}</p>
 <div class="attack-matchup"><div class="combat-attack-group"><span class="combat-group-count">${t('combat.group.count', { count: a.attackerUnitIds.length })}</span><div class="combat-attacker-chips">${chips || t('combat.selectAttacker')}</div></div><span>${t('combat.versus')}</span><strong>${defenders.map(u => esc(label(u.id))).join('<br>') || t('combat.selectEnemy')}</strong></div>
 ${a.target && a.eligibleAttackerIds.length ? `<p class="combat-group-hint">${t('combat.group.hint')}</p>` : ''}
 <div class="phase-metric"><span>${t('common.target')}</span><strong>${a.target ? key(a.target) : '—'}</strong></div>
 ${terrain ? `<div class="phase-metric"><span>${t('common.terrain')}</span><strong>${unitLabel(terrain)}</strong></div>` : ''}
 ${preview ? `<div class="phase-metric"><span>${t('combat.group.strength')}</span><strong>${preview.attackStrength}</strong></div><div class="attack-odds"><span>${t('combat.odds')} <strong>${esc(preview.finalCRTColumnLabel)}</strong></span><span>${t('combat.modifiers')} <strong>${preview.finalShift > 0 ? '+' : ''}${preview.finalShift}</strong></span></div><p class="combat-modifier-summary"><span>${t('combat.flow.majorModifiers')}</span> · ${modifiers.join(' · ') || t('combat.flow.noModifiers')}</p><small>${t('combat.previewHelp')}</small>` : ''}
 <div role="status" aria-live="polite">${a.issues.map(i => `<p>${esc(issueText(i))}</p>`).join('')}</div>
 <button id="attack-declare" class="primary-action combat-confirm" ${enabled ? '' : 'disabled'}>${t('combat.attack')}</button>
 <details class="combat-advanced"><summary>${t('combat.flow.advanced')}</summary>
 <p>${t('combat.advancedHelp')}</p>
 <div class="combat-unit-list">${allies.map(u => `<button class="mini-button ${a.attackerUnitIds.includes(u.id) ? 'active' : ''}" data-attack-unit="${esc(u.id)}" aria-pressed="${a.attackerUnitIds.includes(u.id)}">${a.attackerUnitIds.includes(u.id) ? '−' : '+'} ${esc(label(u.id))}</button>`).join('')}</div>
 ${a.target ? `<p>${t('unit.artilleryDescription')}</p><div class="button-row"><button id="attack-art-none" class="mini-button ${!a.selectedArtilleryId ? 'active' : ''}">${t('combat.noArtillery')}</button>${a.artilleryUnitIds.map(id => `<button class="mini-button ${a.selectedArtilleryId === id ? 'active' : ''}" data-attack-artillery="${esc(id)}">${esc(label(id))}</button>`).join('')}</div>` : ''}
 <button id="attack-clear" class="secondary-action">${t('combat.clear')}</button>
 ${details}${crt}</details>
 ${result ? `<div class="combat-card" role="status"><h3>${t('combat.lastResult', { result: esc(result.crtResult) })}</h3><p>${t('combat.dice', { ...result.dice })}</p></div>` : ''}
 <button id="ready-button" class="secondary-action">${t('combat.endPhase')}</button></section>`;
}
