import { getEdge } from '../core/edge.js';
import { hexDistance, hexKey, sameHex } from '../core/hex.js';
import { getUnitStats } from './unit.js';
import { stackingIssueForDestination } from './stacking.js';
import { isInEnemyZoc } from './zoc.js';
export function movementStepCost(state, rules, unit, from, to) {
    const dest = state.hexes[hexKey(to)];
    if (!dest)
        return { total: Number.POSITIVE_INFINITY, terrain: Number.POSITIVE_INFINITY, river: 0, usedRoad: false, usedBridge: false };
    const tr = rules.terrain[dest.terrain];
    if (tr.movementCost === 'IMPASSABLE') {
        return { total: Number.POSITIVE_INFINITY, terrain: Number.POSITIVE_INFINITY, river: 0, usedRoad: false, usedBridge: false };
    }
    const edge = getEdge(state.edges, from, to);
    const usedRoad = edge?.road === true;
    const bridgeActive = edge?.bridge !== null && edge?.bridge !== undefined && !edge.bridge.destroyed;
    const usedBridge = Boolean(usedRoad && bridgeActive && (edge?.bridge?.kind === 'ROAD' || edge?.bridge?.kind === 'BOTH'));
    let terrainCost = usedRoad ? rules.road.movementCost : tr.movementCost;
    if (!usedRoad && unit.type === 'JAGER' && (dest.terrain === 'FOREST' || dest.terrain === 'HILL')) {
        terrainCost = Math.max(1, terrainCost - 1);
    }
    let river = 0;
    if (edge?.river && !(usedBridge && rules.road.bridgeCancelsRiverMovementSurcharge)) {
        river = rules.river[edge.river].movementSurcharge;
    }
    return { total: terrainCost + river, terrain: terrainCost, river, usedRoad, usedBridge };
}
export function validateMoveAction(state, rules, action) {
    const issues = [];
    const unit = state.units[action.unitId];
    if (!unit)
        return { issues: [{ code: 'UNIT_NOT_FOUND', message: `Unknown unit ${action.unitId}.`, unitId: action.unitId }], spentMP: 0, maxMP: 0, allRoad: false, zocClean: false, reconIgnoreConsumed: false, enteredEnemyZoc: false, enteredEnemyZocHex: null };
    if (!unit.alive)
        issues.push({ code: 'UNIT_DESTROYED', message: 'Destroyed units cannot move.', unitId: unit.id });
    if (unit.controllerId !== action.controllerId)
        issues.push({ code: 'NOT_UNIT_CONTROLLER', message: 'Controller does not own this unit.', unitId: unit.id });
    if (unit.hasMoved)
        issues.push({ code: 'UNIT_ALREADY_MOVED', message: 'Unit has already moved this phase.', unitId: unit.id });
    if (unit.dedicatedRailRepair)
        issues.push({ code: 'INVALID_SUPPORT', message: 'A rail-dedicated engineer cannot move during the remainder of this German Player Turn.', unitId: unit.id, details: { reason: 'DEDICATED_RAIL_REPAIR' } });
    const controller = state.controllers[action.controllerId];
    if (!controller)
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
    else if (controller.side !== unit.side)
        issues.push({ code: 'WRONG_SIDE', message: 'Controller side does not match unit side.' });
    if ((state.phase !== 'GERMAN_MOVEMENT' && state.phase !== 'SOVIET_MOVEMENT') || state.activeSide !== unit.side) {
        issues.push({ code: 'WRONG_PHASE', message: 'Move action is not legal in the current phase.', unitId: unit.id });
    }
    if (action.path.length === 0) {
        issues.push({ code: 'EMPTY_MOVE_PATH', message: 'MoveAction.path must contain at least one destination hex.', unitId: unit.id });
        const baseMovement = getUnitStats(unit, rules).movement;
        const supplyPenalty = unit.supplyState === 'OUT_OF_SUPPLY' ? rules.supply.oosMovementPenalty : 0;
        return { issues, spentMP: 0, maxMP: Math.max(0, baseMovement - supplyPenalty), allRoad: false, zocClean: true, reconIgnoreConsumed: false, enteredEnemyZoc: false, enteredEnemyZocHex: null };
    }
    let current = unit.hex;
    let spent = 0;
    let allRoad = true;
    let zocClean = !isInEnemyZoc(state, rules, unit.side, current);
    let reconIgnoreUsed = unit.reconZocIgnoreUsed;
    let enteredEnemyZoc = false;
    let enteredEnemyZocHex = null;
    for (let i = 0; i < action.path.length; i += 1) {
        const next = action.path[i];
        if (!state.hexes[hexKey(next)]) {
            issues.push({ code: 'HEX_OUT_OF_BOUNDS', message: 'Path enters a hex outside the scenario map.', unitId: unit.id, hex: next });
            break;
        }
        if (hexDistance(current, next) !== 1) {
            issues.push({ code: 'NON_ADJACENT_HEX', message: 'Every movement path step must enter an adjacent hex.', unitId: unit.id, hex: next });
            break;
        }
        const destTerrain = state.hexes[hexKey(next)].terrain;
        if (rules.terrain[destTerrain].movementCost === 'IMPASSABLE') {
            issues.push({ code: 'IMPASSABLE_TERRAIN', message: `${destTerrain} is impassable.`, unitId: unit.id, hex: next });
            break;
        }
        const enemyAt = Object.values(state.units).some((u) => u.alive && u.side !== unit.side && sameHex(u.hex, next));
        if (enemyAt) {
            issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'Cannot move through or into an enemy-occupied hex.', unitId: unit.id, hex: next });
            break;
        }
        const currentInZoc = isInEnemyZoc(state, rules, unit.side, current);
        const nextInZoc = isInEnemyZoc(state, rules, unit.side, next);
        if (nextInZoc) {
            enteredEnemyZoc = true;
            enteredEnemyZocHex = { ...next };
        }
        const isRecon = unit.type === 'RECON';
        let ignoredZocRestrictionThisStep = false;
        if (currentInZoc && nextInZoc) {
            if (isRecon && !reconIgnoreUsed) {
                reconIgnoreUsed = true;
                ignoredZocRestrictionThisStep = true;
            }
            else {
                issues.push({ code: 'ENEMY_ZOC_TO_ZOC', message: 'Ordinary units may not move directly from enemy ZOC to enemy ZOC.', unitId: unit.id, hex: next });
                break;
            }
        }
        const step = movementStepCost(state, rules, unit, current, next);
        if (!Number.isFinite(step.total)) {
            issues.push({ code: 'IMPASSABLE_TERRAIN', message: 'Movement step is impassable.', unitId: unit.id, hex: next });
            break;
        }
        spent += step.total;
        allRoad = allRoad && step.usedRoad;
        zocClean = zocClean && !nextInZoc;
        const isLast = i === action.path.length - 1;
        if (nextInZoc && !isLast && !ignoredZocRestrictionThisStep) {
            if (isRecon && !reconIgnoreUsed)
                reconIgnoreUsed = true;
            else {
                issues.push({ code: 'ENEMY_ZOC_STOP', message: 'Entering enemy ZOC ends movement.', unitId: unit.id, hex: next });
                break;
            }
        }
        current = next;
    }
    const baseMovement = getUnitStats(unit, rules).movement;
    const supplyPenalty = unit.supplyState === 'OUT_OF_SUPPLY' ? rules.supply.oosMovementPenalty : 0;
    const roadBonus = rules.road.wholeMoveBonusEnabled && allRoad && zocClean ? rules.road.wholeMoveBonusMP : 0;
    const maxMP = Math.max(0, baseMovement - supplyPenalty + roadBonus);
    if (spent > maxMP)
        issues.push({ code: 'INSUFFICIENT_MP', message: `Movement costs ${spent} MP but unit has ${maxMP} MP.`, unitId: unit.id, details: { spentMP: spent, maxMP } });
    const destination = action.path[action.path.length - 1];
    if (!issues.some((x) => ['HEX_OUT_OF_BOUNDS', 'NON_ADJACENT_HEX', 'IMPASSABLE_TERRAIN', 'ENEMY_OCCUPIED_HEX', 'ENEMY_ZOC_STOP', 'ENEMY_ZOC_TO_ZOC'].includes(x.code))) {
        const stack = stackingIssueForDestination(state, rules, unit, destination);
        if (stack)
            issues.push(stack);
    }
    return { issues, spentMP: spent, maxMP, allRoad, zocClean, reconIgnoreConsumed: !unit.reconZocIgnoreUsed && reconIgnoreUsed, enteredEnemyZoc, enteredEnemyZocHex };
}
