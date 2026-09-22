import { hexEqual, hexToPixel } from '../geometry/hex.js';
import { deriveCounterPlacement } from '../render/derive.js';
export function isTravelEvent(event) { return 'path' in event; }
/** Supporting fire is separate from the actual attack group / Counter selection. */
export function firingParticipants(event) {
    return [...event.attackers, ...(event.supporters ?? [])];
}
/** Existing Counter V2 placement is the only authority for local stack offsets. */
function stackOffset(state, id) {
    const unit = state.units[id];
    if (!unit)
        return { x: 0, y: 0 };
    const group = Object.values(state.units).filter(u => u.alive && hexEqual(u.hex, unit.hex)).sort((a, b) => a.id.localeCompare(b.id));
    const placement = deriveCounterPlacement(unit, Math.max(0, group.findIndex(u => u.id === id)), group.length);
    return { x: placement.visualCenter.x - placement.authoritativeAnchor.x, y: placement.visualCenter.y - placement.authoritativeAnchor.y };
}
function character(type) {
    if (['PANZER', 'TANK', 'HEAVY_TANK'].includes(type))
        return 'armor';
    if (type === 'ARTILLERY')
        return 'artillery';
    if (['INFANTRY', 'ELITE_INFANTRY', 'JAGER'].includes(type))
        return 'infantry';
    return 'generic';
}
function participant(state, id, target) {
    const unit = state.units[id];
    if (!unit)
        return;
    const position = hexToPixel(unit.hex), dx = target ? target.x - position.x : 0, dy = target ? target.y - position.y : 0;
    const length = Math.hypot(dx, dy);
    return { unitId: id, position, offset: stackOffset(state, id), direction: length ? { x: dx / length, y: dy / length } : { x: 1, y: 0 }, character: character(unit.type) };
}
/** Read-only projection of accepted facts. No engine calls, legality checks or random draws. */
export function derivePresentationEvents(before, result) {
    if (!result.accepted)
        return Object.freeze([]);
    const after = result.state, events = [];
    const identity = () => ({ id: `${result.actionId}:presentation:${events.length}`, actionId: result.actionId });
    const combat = (kind, battleId) => {
        const tx = after.combatTransactions[battleId];
        const defender = tx?.defenderUnitIds.map(id => before.units[id] ?? after.units[id]).find(Boolean);
        const attackers = (tx?.attackerUnitIds ?? []).flatMap(id => {
            const cue = participant(before, id, defender ? hexToPixel(defender.hex) : undefined);
            return cue ? [cue] : [];
        });
        const supporters = [];
        // Only resolved context proves support actually contributed. Never infer from range,
        // a draft selection, or the mere existence of a nearby artillery unit.
        if (kind === 'combat-fire' && tx?.context) {
            const firstAttacker = tx.attackerUnitIds.map(id => before.units[id]).find(Boolean);
            const supportTargets = [
                [tx.context.attackerArtilleryUnitId, defender ? hexToPixel(defender.hex) : undefined],
                [tx.context.defenderArtilleryUnitId, firstAttacker ? hexToPixel(firstAttacker.hex) : undefined],
            ];
            for (const [id, target] of supportTargets) {
                if (!id || !target || attackers.some(a => a.unitId === id) || supporters.some(a => a.unitId === id))
                    continue;
                if (before.units[id]?.type !== 'ARTILLERY')
                    continue;
                const cue = participant(before, id, target);
                if (cue)
                    supporters.push(cue);
            }
        }
        events.push({ ...identity(), kind, battleId, unitIds: [...(tx?.attackerUnitIds ?? []), ...(tx?.defenderUnitIds ?? [])], attackers, ...(supporters.length ? { supporters } : {}) });
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
                const cue = participant(before, event.unitId) ?? participant(after, event.unitId);
                if (cue)
                    events.push({ ...identity(), kind: event.type === 'UnitStepLost' ? 'hit' : 'destroyed', unitId: event.unitId, position: cue.position, participant: cue });
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
