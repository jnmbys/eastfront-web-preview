import { hexPolygon } from '../geometry/hex.js';
export function deploymentRejection(issues) {
    const messages = { STACKING_LIMIT: 'Maximum units reached. Choose another position.', INVALID_DEPLOYMENT_HEX: 'This position is outside your deployment area. Choose a highlighted position.', DEPLOYMENT_UNIT_UNAVAILABLE: 'This unit is unavailable. Select another reserve unit.', WRONG_PHASE: 'Deployment is no longer active.', WRONG_SIDE: 'Wait for your side’s deployment phase.', INVALID_CONTROLLER: 'Your side could not be identified. Return to the current player’s view.' };
    return [...new Set(issues.map(i => messages[i.code] ?? 'This deployment could not be completed. Choose another unit or position and try again.'))].join(' ') || 'This deployment could not be completed. Please select the unit and position again.';
}
export function deploymentFocus(model, ui, selected) {
    if (!model.deployment || model.activeSide !== model.viewerSide || ui.unitId !== selected || !ui.key || !model.deployment.zoneKeys.includes(ui.key))
        return '';
    const h = model.hexes.find(h => `${h.coord.q},${h.coord.r}` === ui.key);
    if (!h)
        return '';
    return `<g id="deployment-focus" aria-hidden="true" pointer-events="none"><polygon class="deployment-focus-halo" points="${hexPolygon(h.coord).map(p => `${p.x},${p.y}`).join(' ')}"/><polygon class="deployment-focus-ring" points="${hexPolygon(h.coord).map(p => `${p.x},${p.y}`).join(' ')}"/></g>`;
}
