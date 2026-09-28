import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createFreshProductionSession } from '../src/web/preview.js';
import { controllerIdForSide } from '../src/core-adapter/session.js';
import { SEATS, sideForSeat } from '../src/multiplayer/protocol.js';
const rawMap = JSON.parse(readFileSync(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json', import.meta.url), 'utf8'));
export function createMatchSession(room, now) {
    const authoritative = createFreshProductionSession(rawMap);
    if (authoritative.integrityIssues.length)
        throw new Error('Scenario integrity failed');
    const controllerAssignments = SEATS.map(seat => {
        const owner = room.seats[seat];
        if (owner.controllerType !== 'HUMAN_REMOTE' || !owner.ready)
            throw new Error('Seats not ready');
        const viewer = sideForSeat(seat);
        return { seat, controllerId: owner.controllerId, coreControllerId: controllerIdForSide(authoritative, viewer), viewer };
    });
    return { matchRevision: 0, actionSequence: 0, status: 'ACTIVE', serverSequences: Object.fromEntries(controllerAssignments.map(a => [a.controllerId, 0])),
        battleSummaries: Object.fromEntries(controllerAssignments.map(a => [a.controllerId, { entries: new Map(), olderOmitted: false }])),
        disclosedBattles: Object.fromEntries(controllerAssignments.map(a => [a.controllerId, new Set()])),
        receipts: Object.fromEntries(controllerAssignments.map(a => [a.controllerId, new Map()])), matchId: randomUUID(), scenarioId: authoritative.scenario.id, createdAt: now, authoritative, controllerAssignments,
        viewerAssignments: Object.fromEntries(controllerAssignments.map(a => [a.controllerId, a.viewer])) };
}
export { playerSnapshot } from './playerSnapshot.js';
