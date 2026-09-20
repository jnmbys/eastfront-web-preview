import { escapeUi as esc, unitLabel } from './commandPresentation.js';
export function combatAttackPanel(model, details) {
    const c = model.combat;
    if (!c)
        return '';
    const a = c.attackDraft, preview = a.preview;
    const key = (h) => `${h.q},${h.r}`;
    const label = (id) => { const u = model.counters.find(u => u.id === id); return u ? `${unitLabel(u.side)} ${unitLabel(u.type)} · ${id}` : id; };
    const defenders = a.target ? model.counters.filter(u => u.side !== model.viewerSide && key(u.hex) === key(a.target)) : [];
    const terrain = a.target ? model.hexes.find(h => key(h.coord) === key(a.target))?.terrain : null;
    const enabled = !!a.target && a.attackerUnitIds.length > 0 && a.issues.length === 0 && !!preview;
    const allies = model.counters.filter(u => u.side === model.viewerSide);
    const result = c.battle?.resolution;
    return `<section class="panel-block phase-actions attack-preview"><span class="eyebrow">COMBAT · ATTACK MODE</span>
 <p class="attack-guidance">${!a.attackerUnitIds.length ? 'Select one of your units to begin.' : !a.target ? 'Choose a highlighted enemy on the map.' : 'Review the attack, then confirm.'}</p>
 <div class="attack-matchup"><strong>${a.attackerUnitIds.map(id => esc(label(id))).join('<br>') || 'Select attacker'}</strong><span>VS</span><strong>${defenders.map(u => esc(label(u.id))).join('<br>') || 'Select enemy target'}</strong></div>
 <div class="phase-metric"><span>Target</span><strong>${a.target ? key(a.target) : '—'}</strong></div>
 ${terrain ? `<div class="phase-metric"><span>Terrain</span><strong>${unitLabel(terrain)}</strong></div>` : ''}
 ${preview ? `<div class="attack-odds"><span>Combat odds <strong>${esc(preview.finalCRTColumnLabel)}</strong></span><span>Modifiers <strong>${preview.finalShift > 0 ? '+' : ''}${preview.finalShift}</strong></span></div><small>Preview before defender reaction. Dice determine the result.</small>` : ''}
 <div role="status" aria-live="polite">${a.issues.map(i => `<p>${esc(i.message)}</p>`).join('')}</div>
 <button id="attack-declare" class="primary-action combat-confirm" ${enabled ? '' : 'disabled'}>ATTACK</button>
 <details class="combat-advanced"><summary>Add supporting units / Advanced</summary>
 <p>Select additional direct attackers. The Core validates the combined attack.</p>
 <div class="combat-unit-list">${allies.map(u => `<button class="mini-button ${a.attackerUnitIds.includes(u.id) ? 'active' : ''}" data-attack-unit="${esc(u.id)}" aria-pressed="${a.attackerUnitIds.includes(u.id)}">${a.attackerUnitIds.includes(u.id) ? '−' : '+'} ${esc(label(u.id))}</button>`).join('')}</div>
 ${a.target ? `<p>Artillery support</p><div class="button-row"><button id="attack-art-none" class="mini-button ${!a.selectedArtilleryId ? 'active' : ''}">No Artillery</button>${a.artilleryUnitIds.map(id => `<button class="mini-button ${a.selectedArtilleryId === id ? 'active' : ''}" data-attack-artillery="${esc(id)}">${esc(label(id))}</button>`).join('')}</div>` : ''}
 <button id="attack-clear" class="secondary-action">Clear attack selection</button></details>
 ${details ? `<details class="combat-advanced"><summary>CRT / Combat details</summary>${details}</details>` : ''}
 ${result ? `<div class="combat-card" role="status"><h3>Last result · ${esc(result.crtResult)}</h3><p>Dice ${result.dice.die1} + ${result.dice.die2} = ${result.dice.total}</p></div>` : ''}
 <button id="ready-button" class="secondary-action">End combat phase</button></section>`;
}
