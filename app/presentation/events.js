import { hexEqual, hexToPixel } from '../geometry/hex.js';
import { deriveCounterPlacement } from '../render/derive.js';
export function isTravelEvent(event) { return 'path' in event; }
/** Existing Counter V2 placement is the only authority for local stack offsets. */
function stackOffset(state, id) {
    const unit = state.units[id];
    if (!unit)
        return { x: 0, y: 0 };
    const group = Object.values(state.units).filter(u => u.alive && hexEqual(u.hex, unit.hex)).sort((a, b) => a.id.localeCompare(b.id));
    const placement = deriveCounterPlacement(unit, Math.max(0, group.findIndex(u => u.id === id)), group.length);
    return { x: placement.visualCenter.x - placement.authoritativeAnchor.x, y: placement.visualCenter.y - placement.authoritativeAnchor.y };
}
/** Read-only projection of accepted facts. No engine calls, legality checks or random draws. */
export function derivePresentationEvents(before, result) {
    if (!result.accepted)
        return Object.freeze([]);
    const after = result.state, events = [];
    const identity = () => ({ id: `${result.actionId}:presentation:${events.length}`, actionId: result.actionId });
    const combat = (kind, battleId) => {
        const tx = after.combatTransactions[battleId];
        events.push({ ...identity(), kind, battleId, unitIds: [...(tx?.attackerUnitIds ?? []), ...(tx?.defenderUnitIds ?? [])] });
    };
    const travel = (kind, unitId, acceptedPath) => {
        const source = before.units[unitId], destination = after.units[unitId];
        if (!source || !destination || !destination.alive || hexEqual(source.hex, destination.hex))
            return;
        const path = [{ ...source.hex }];
        for (const hex of acceptedPath)
            if (!hexEqual(path.at(-1), hex))
                path.push({ ...hex });
        // State is authoritative even if a future Core event omits its final path node.
        if (!hexEqual(path.at(-1), destination.hex))
            path.push({ ...destination.hex });
        events.push({ ...identity(), kind, unitId, path, sourceOffset: stackOffset(before, unitId), destinationOffset: stackOffset(after, unitId) });
    };
    for (const event of result.events) {
        switch (event.type) {
            case 'UnitMoved':
                travel('move', event.unitId, result.action.type === 'MOVE' ? result.action.path : [event.to]);
                break;
            case 'UnitRetreated':
                travel('retreat', event.unitId, event.path);
                break;
            case 'UnitAdvanced':
                travel('advance', event.unitId, [event.to]);
                break;
            case 'UnitBrokeThrough':
                travel('breakthrough', event.unitId, event.path);
                break;
            case 'CombatDeclared':
                combat('combat-started', event.battleId);
                break;
            // Fire is queued only AFTER Core has resolved the roll and CRT.
            case 'CRTResolved':
                combat('combat-fire', event.battleId);
                combat('combat-result', event.battleId);
                break;
            case 'CombatCompleted':
                combat('combat-completed', event.battleId);
                break;
            case 'UnitStepLost':
            case 'UnitDestroyed': {
                const unit = before.units[event.unitId] ?? after.units[event.unitId];
                if (unit)
                    events.push({ ...identity(), kind: event.type === 'UnitStepLost' ? 'hit' : 'destroyed', unitId: event.unitId, position: hexToPixel(unit.hex) });
                break;
            }
        }
    }
    // All payloads are detached, recursively frozen values. Observers never receive GameState.
    return freeze(events);
}
function freeze(value) {
    if (value && typeof value === 'object') {
        for (const item of Object.values(value))
            freeze(item);
        Object.freeze(value);
    }
    return value;
}
