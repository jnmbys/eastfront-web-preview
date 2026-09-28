import { derivePlayerView } from '../src/player-view/playerView.js';
export function playerSnapshot(match, controllerId) {
    const assignment = match.controllerAssignments.find(a => a.controllerId === controllerId);
    if (!assignment)
        throw new Error('Controller has no viewer assignment');
    const derived = derivePlayerView(match.authoritative.state, assignment.viewer, match.authoritative.rules, match.authoritative.knowledge?.[assignment.viewer]);
    // Explicit allowlist, even if the local projection later grows host/debug fields.
    return { viewer: assignment.viewer, turn: derived.turn, phase: derived.phase, activeSide: derived.activeSide,
        hexes: derived.hexes, edges: derived.edges, units: derived.units, contacts: derived.contacts, lastKnown: derived.lastKnown,
        identifiedHexKeys: derived.identifiedHexKeys, contactHexKeys: derived.contactHexKeys, resources: derived.resources,
        pendingDecision: derived.pendingDecision, victory: derived.victory };
}
