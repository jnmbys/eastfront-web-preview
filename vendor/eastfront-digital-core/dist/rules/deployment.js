import { hexKey } from '../core/hex.js';
import { livingUnitsAt } from './stacking.js';
function canonical(values) { return [...new Set(values)].sort(); }
export function isDeploymentPhase(state) { return state.phase === 'SOVIET_DEPLOYMENT' || state.phase === 'GERMAN_DEPLOYMENT'; }
function deployableMapHexKeys(state) {
    return Object.entries(state.hexes).filter(([, hex]) => hex.terrain !== 'LAKE').map(([key]) => key).sort();
}
function zoneKeys(state, scenario, side, visiting) {
    const deployment = scenario.deployment;
    if (!deployment)
        return [];
    if (visiting.has(side))
        return [];
    visiting.add(side);
    const rule = deployment.zones[side];
    if (!rule)
        return [];
    let result = [];
    if (rule.kind === 'WESTERNMOST_COLUMNS') {
        const qs = [...new Set(Object.values(state.hexes).map((hex) => hex.coord.q))].sort((a, b) => a - b).slice(0, Math.max(0, rule.columnCount));
        const allowed = new Set(qs);
        result = Object.entries(state.hexes).filter(([, hex]) => hex.terrain !== 'LAKE' && allowed.has(hex.coord.q)).map(([key]) => key);
    }
    else if (rule.kind === 'EXPLICIT_HEXES') {
        result = rule.hexes.map(hexKey).filter((key) => state.hexes[key]?.terrain !== 'LAKE');
    }
    else {
        const excluded = new Set(zoneKeys(state, scenario, rule.excludedSide, visiting));
        result = deployableMapHexKeys(state).filter((key) => !excluded.has(key));
    }
    visiting.delete(side);
    return canonical(result);
}
/** Pure, map-derived deployment zone query. Only real, non-LAKE HexState records are returned. */
export function deploymentHexKeysForSide(state, scenario, side) {
    return zoneKeys(state, scenario, side, new Set());
}
function rosterForSide(scenario, side) {
    return (scenario.deployment?.units ?? []).filter((unit) => unit.side === side);
}
export function evaluateDeploymentSideStatus(state, rules, scenario, side) {
    const zone = new Set(deploymentHexKeysForSide(state, scenario, side));
    const missing = [];
    const invalid = [];
    for (const roster of rosterForSide(scenario, side)) {
        const unit = state.units[roster.id];
        if (!unit) {
            missing.push(roster.id);
            continue;
        }
        const controller = state.controllers[unit.controllerId];
        const key = hexKey(unit.hex);
        const stack = livingUnitsAt(state, unit.hex);
        const enemies = stack.filter((other) => other.id !== unit.id && other.side !== side);
        if (!unit.alive || unit.side !== side || unit.templateId !== roster.templateId || !controller || controller.side !== side || !zone.has(key) || state.hexes[key]?.terrain === 'LAKE' || stack.length > rules.stackingLimit || enemies.length > 0)
            invalid.push(roster.id);
    }
    return { complete: missing.length === 0 && invalid.length === 0, missingUnitIds: canonical(missing), invalidUnitIds: canonical(invalid) };
}
export function validateDeployInitialUnitAction(state, rules, scenario, action) {
    const issues = [];
    const deployment = scenario.deployment;
    const controller = state.controllers[action.controllerId];
    if (!deployment)
        return [{ code: 'RULE_NOT_IMPLEMENTED', message: 'Scenario does not configure FA-003 initial deployment.' }];
    if (!controller)
        return [{ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' }];
    if (!isDeploymentPhase(state))
        return [{ code: 'WRONG_PHASE', message: 'Initial deployment placement is only legal during deployment phases.' }];
    if (controller.side !== state.activeSide)
        return [{ code: 'WRONG_SIDE', message: 'Only an active deployment-side controller may place units.' }];
    const roster = deployment.units.find((unit) => unit.id === action.deploymentUnitId);
    if (!roster)
        return [{ code: 'DEPLOYMENT_UNIT_UNAVAILABLE', message: 'Deployment unit is not present in the scenario deployment roster.', details: { deploymentUnitId: action.deploymentUnitId } }];
    if (roster.side !== state.activeSide)
        return [{ code: 'WRONG_SIDE', message: 'Deployment unit belongs to the other side.', details: { deploymentUnitId: roster.id, unitSide: roster.side, activeSide: state.activeSide } }];
    const template = rules.unitTemplates[roster.templateId];
    if (!template || template.side !== roster.side)
        return [{ code: 'DEPLOYMENT_UNIT_UNAVAILABLE', message: 'Deployment roster unit has no valid same-side UnitTemplate.', details: { deploymentUnitId: roster.id, templateId: roster.templateId } }];
    const key = hexKey(action.hex);
    if (!state.hexes[key])
        return [{ code: 'HEX_OUT_OF_BOUNDS', message: 'Deployment hex does not exist on the current map.', hex: action.hex }];
    const legalZone = new Set(deploymentHexKeysForSide(state, scenario, roster.side));
    if (!legalZone.has(key) || state.hexes[key].terrain === 'LAKE')
        return [{ code: 'INVALID_DEPLOYMENT_HEX', message: 'Requested hex is not legal for this side initial deployment.', hex: action.hex, details: { deploymentUnitId: roster.id } }];
    const existing = state.units[roster.id];
    if (existing) {
        if (!existing.alive || existing.side !== roster.side || existing.templateId !== roster.templateId)
            return [{ code: 'DEPLOYMENT_UNIT_UNAVAILABLE', message: 'Existing deployment unit state conflicts with canonical roster data.', unitId: roster.id }];
        if (existing.controllerId !== action.controllerId)
            return [{ code: 'NOT_UNIT_CONTROLLER', message: 'Only the controller that first placed this deployment unit may reposition it.', unitId: roster.id }];
    }
    const occupants = livingUnitsAt(state, action.hex).filter((unit) => unit.id !== roster.id);
    if (occupants.some((unit) => unit.side !== roster.side))
        return [{ code: 'ENEMY_OCCUPIED_HEX', message: 'Initial deployment cannot overlap a living enemy unit.', hex: action.hex }];
    if (occupants.length >= rules.stackingLimit)
        return [{ code: 'STACKING_LIMIT', message: 'Initial deployment would exceed the total living-unit stacking limit.', hex: action.hex, details: { stackingLimit: rules.stackingLimit, currentLivingUnitIds: occupants.map((unit) => unit.id).sort() } }];
    return issues;
}
export function applyDeployInitialUnit(state, rules, scenario, action) {
    const roster = scenario.deployment.units.find((unit) => unit.id === action.deploymentUnitId);
    const existing = state.units[roster.id];
    if (existing) {
        existing.hex = { ...action.hex };
        return { unit: existing, repositioned: true };
    }
    const template = rules.unitTemplates[roster.templateId];
    const unit = {
        id: roster.id, templateId: template.id, side: roster.side, type: template.type, step: 0, alive: true, hex: { ...action.hex }, supplyState: 'OUT_OF_SUPPLY', entrenched: false, hasMoved: false, hasAttacked: false, controllerId: action.controllerId, temporarySupply: false, dedicatedRailRepair: false, reconZocIgnoreUsed: false, artillerySupportUsed: false, lastHQCommandTurn: null
    };
    state.units[unit.id] = unit;
    return { unit, repositioned: false };
}
/** Whitelist-only hidden deployment DTO. It intentionally excludes actionLog and other private runtime state. */
export function projectDeploymentView(state, scenario, viewerControllerId) {
    if (!isDeploymentPhase(state))
        throw new Error('projectDeploymentView is only valid during initial deployment phases.');
    const viewer = state.controllers[viewerControllerId];
    if (!viewer)
        throw new Error(`Unknown viewer controller: ${viewerControllerId}`);
    const units = {};
    for (const unit of Object.values(state.units).filter((unit) => unit.side === viewer.side).sort((a, b) => a.id.localeCompare(b.id)))
        units[unit.id] = structuredClone(unit);
    const ownRoster = rosterForSide(scenario, viewer.side).map((unit) => unit.id);
    const ownUnplacedDeploymentUnitIds = ownRoster.filter((id) => !state.units[id]).sort();
    return {
        scenarioId: state.scenarioId, turn: state.turn, phase: state.phase, activeSide: state.activeSide,
        hexes: structuredClone(state.hexes), edges: structuredClone(state.edges), controllers: structuredClone(state.controllers), units,
        phaseReadyControllerIds: [...state.phaseReadyControllerIds], ownUnplacedDeploymentUnitIds
    };
}
