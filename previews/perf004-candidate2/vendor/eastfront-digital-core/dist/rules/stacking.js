import { hexKey, sameHex } from '../core/hex.js';
export function livingUnitsAt(state, hex, side) {
    return Object.values(state.units).filter((u) => u.alive && sameHex(u.hex, hex) && (side === undefined || u.side === side));
}
export function stackingIssueForDestination(state, rules, movingUnit, destination) {
    const enemy = livingUnitsAt(state, destination).filter((u) => u.side !== movingUnit.side);
    if (enemy.length > 0) {
        return { code: 'ENEMY_OCCUPIED_HEX', message: 'A unit cannot move into an enemy-occupied hex.', unitId: movingUnit.id, hex: destination };
    }
    const friendlies = livingUnitsAt(state, destination, movingUnit.side).filter((u) => u.id !== movingUnit.id);
    if (friendlies.length >= rules.stackingLimit) {
        return {
            code: 'STACKING_LIMIT',
            message: `Destination ${hexKey(destination)} already contains ${friendlies.length} friendly units; limit is ${rules.stackingLimit}.`,
            unitId: movingUnit.id,
            hex: destination,
            details: { stackingLimit: rules.stackingLimit, currentFriendlyUnits: friendlies.map((u) => u.id) }
        };
    }
    return null;
}
