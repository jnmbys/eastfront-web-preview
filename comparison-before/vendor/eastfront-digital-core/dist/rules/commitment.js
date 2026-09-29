import { findDuplicates } from '../core/collections.js';
import { phaseSide } from './turn.js';
export function validateAuthorizeUnitCommitment(state, action) {
    const issues = [];
    const grantor = state.controllers[action.controllerId];
    const authorized = state.controllers[action.authorizedControllerId];
    if (!grantor)
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Granting controller does not exist.' });
    if (!authorized)
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Authorized controller does not exist.' });
    if (!grantor || !authorized)
        return issues;
    if (grantor.side !== authorized.side)
        issues.push({ code: 'WRONG_SIDE', message: 'Unit commitment may only be granted to an allied controller.' });
    if (phaseSide(state.phase) !== grantor.side || state.activeSide !== grantor.side)
        issues.push({ code: 'WRONG_PHASE', message: 'Unit commitments may only be granted by the active side.' });
    const duplicates = findDuplicates(action.unitIds);
    if (duplicates.length > 0)
        issues.push({ code: 'DUPLICATE_ID', message: 'AuthorizeUnitCommitmentAction.unitIds must be unique.', details: { field: 'unitIds', duplicates } });
    if (action.unitIds.length === 0)
        issues.push({ code: 'INVALID_SUPPORT', message: 'Unit commitment must contain at least one unit.' });
    for (const unitId of action.unitIds) {
        const unit = state.units[unitId];
        if (!unit) {
            issues.push({ code: 'UNIT_NOT_FOUND', message: `Unknown committed unit ${unitId}.`, unitId });
            continue;
        }
        if (unit.controllerId !== grantor.id)
            issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Only the canonical unit owner can grant a commitment.', unitId });
        if (unit.side !== grantor.side)
            issues.push({ code: 'WRONG_SIDE', message: 'Committed unit must be on grantor side.', unitId });
        if (!unit.alive)
            issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed units cannot be committed.', unitId });
    }
    return issues;
}
