import { deploymentRejection } from './deploymentPolish.js';
import { deploySelectedUnit } from '../interaction/intents.js';
export const createDeploymentTouch = () => ({ unitId: null, key: null, status: 'idle', message: '' });
export function chooseDeploymentTarget(ui, model, unitId, key) {
    const row = model.deployment?.roster.find(r => r.id === unitId);
    if (!row || row.placed || model.viewerSide !== model.activeSide || !model.deployment?.zoneKeys.includes(key))
        return false;
    ui.unitId = unitId;
    ui.key = key;
    ui.status = 'selected';
    ui.message = 'Position selected. Confirm to deploy.';
    return true;
}
export function confirmDeploymentTarget(ui, session, presentation) {
    if (!ui.key || !ui.unitId || ui.unitId !== presentation.selectedDeploymentUnitId) {
        ui.status = 'invalid';
        ui.message = 'Select a unit and a deployment position again.';
        return;
    }
    const id = ui.unitId, [q, r] = ui.key.split(',').map(Number);
    deploySelectedUnit(session, presentation, { q: q, r: r });
    const accepted = session.lastResult?.accepted === true;
    ui.status = accepted ? 'deployed' : 'invalid';
    ui.message = accepted ? `${id} deployed. Next reserve selected when available.` : deploymentRejection(session.lastResult?.issues ?? []);
    if (accepted) {
        ui.key = null;
        ui.unitId = null;
    }
}
