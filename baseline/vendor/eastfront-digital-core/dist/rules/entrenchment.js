import { hexKey } from '../core/hex.js';
export function validateEntrenchAction(state, rules, scenario, action) {
    const issues = [];
    const u = state.units[action.unitId];
    if (!u)
        return [{ code: 'UNIT_NOT_FOUND', message: `Unknown unit ${action.unitId}.`, unitId: action.unitId }];
    const controller = state.controllers[action.controllerId];
    if (!controller)
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
    if (u.controllerId !== action.controllerId)
        issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Controller does not own this unit.', unitId: u.id });
    const expected = u.side === 'GERMAN' ? 'GERMAN_ENTRENCHMENT' : 'SOVIET_ENTRENCHMENT';
    if (state.phase !== expected)
        issues.push({ code: 'WRONG_PHASE', message: 'Entrenchment is only legal in the entrenchment phase.', unitId: u.id });
    const template = rules.unitTemplates[u.templateId];
    if (!template?.canEntrench)
        issues.push({ code: 'CANNOT_ENTRENCH', message: 'This unit type cannot entrench.', unitId: u.id });
    if (u.hasMoved)
        issues.push({ code: 'MOVED_THIS_TURN', message: 'A unit that moved this turn cannot entrench.', unitId: u.id });
    if (u.dedicatedRailRepair)
        issues.push({ code: 'INVALID_SUPPORT', message: 'A rail-dedicated engineer cannot entrench during the remainder of this German Player Turn.', unitId: u.id, details: { reason: 'DEDICATED_RAIL_REPAIR' } });
    const cores = new Set(scenario.capitalCoreHexes.map(hexKey));
    if (cores.has(hexKey(u.hex)))
        issues.push({ code: 'CORE_CANNOT_ENTRENCH', message: 'Capital core hexes AC10/AC11 cannot be entrenched.', unitId: u.id, hex: u.hex });
    return issues;
}
