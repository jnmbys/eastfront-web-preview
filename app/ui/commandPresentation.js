export const escapeUi = (value) => value.replace(/[&<>\"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] ?? c));
export const unitLabel = (type) => type.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
export function commandHeader(model) {
    const phase = model.phase.replace(/^(GERMAN|SOVIET)_/, '').replaceAll('_', ' ');
    return `<div class="campaign-heading"><span class="eyebrow">STRATEGIC RESET F</span><strong>${escapeUi(phase)}</strong></div><div class="campaign-turn"><span>TURN</span><strong>${String(model.turn).padStart(2, '0')}</strong></div><div class="campaign-side" data-side="${model.activeSide}"><span class="faction-seal" aria-hidden="true">${model.activeSide === 'GERMAN' ? 'G' : 'S'}</span><strong>${model.activeSide}</strong></div>`;
}
export function deploymentLocations(model, selected, ui) {
    const d = model.deployment;
    if (!d || !selected || model.activeSide !== model.viewerSide)
        return '';
    const row = d.roster.find(r => r.id === selected);
    if (!row || row.placed)
        return '';
    const cards = d.zoneKeys.map(key => {
        const h = model.hexes.find(h => `${h.coord.q},${h.coord.r}` === key);
        const terrain = unitLabel(h?.terrain ?? 'Unknown');
        const occupied = model.counters.filter(c => `${c.hex.q},${c.hex.r}` === key).length;
        const chosen = ui?.unitId === selected && ui.key === key;
        return `<button type="button" class="location-button location-card ${chosen ? 'selected' : ''}" data-deploy-destination="${escapeUi(key)}" aria-pressed="${chosen}"><span class="card-unit-type">${unitLabel(row.type)} deployment</span><strong>${escapeUi(terrain)}</strong><span>Terrain · ${escapeUi(terrain)}</span><span>Occupancy · ${occupied ? `${occupied} visible unit(s)` : 'No visible units'}</span><small>Position ${escapeUi(key)}</small></button>`;
    }).join('');
    return `<section class="deployment-locations"><div class="deployment-location-heading"><strong>Choose deployment terrain</strong><span>${d.zoneKeys.length} zone positions · choose a card to mark it on the map</span></div><div class="location-grid">${cards}</div></section>`;
}
export function deploymentConfirm(model, selected, ui) {
    const row = model.deployment?.roster.find(r => r.id === selected);
    if (!row || row.placed || model.viewerSide !== model.activeSide)
        return '';
    const chosen = ui.unitId === selected && ui.key;
    const terrain = chosen ? model.hexes.find(h => `${h.coord.q},${h.coord.r}` === ui.key)?.terrain : null;
    return `<div class="deployment-confirm"><p>${unitLabel(row.type)} · ${chosen ? `${unitLabel(terrain ?? 'Unknown')} / ${escapeUi(ui.key)}` : 'Choose a destination'}</p>${deploymentFeedback(ui)}<button type="button" id="confirm-deployment" class="primary-action" ${chosen ? '' : 'disabled'}>CONFIRM DEPLOYMENT</button></div>`;
}
export function deploymentFeedback(ui) {
    if (ui.status === 'idle')
        return '';
    return `<div class="deployment-feedback ${ui.status}" role="${ui.status === 'invalid' ? 'alert' : 'status'}"><strong>${ui.status === 'deployed' ? 'DEPLOYED' : ui.status === 'invalid' ? 'CANNOT DEPLOY' : 'READY TO CONFIRM'}</strong><p>${escapeUi(ui.message)}</p></div>`;
}
export function unitDescription(type) {
    const descriptions = { INFANTRY: 'Infantry formation', ELITE_INFANTRY: 'Elite infantry formation', JAGER: 'Light infantry formation', PANZER: 'Armored formation', TANK: 'Tank formation', HEAVY_TANK: 'Heavy tank formation', ARTILLERY: 'Artillery support', ENGINEER: 'Engineer support', RECON: 'Reconnaissance formation', MOTORIZED: 'Motorized formation', ANTI_TANK: 'Anti-tank formation', HQ: 'Headquarters' };
    return descriptions[type] ?? unitLabel(type);
}
