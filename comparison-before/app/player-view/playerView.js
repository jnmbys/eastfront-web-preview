import { getNeighbors, getUnitStats, isDeploymentPhase } from '../core-adapter/core.js';
/** Experimental information policy, not movement, ZOC or combat rules. */
export const SPOTTING = Object.freeze({ identification: 1, contact: 1, reconIdentification: 2, reconContact: 3 });
const key = (h) => `${h.q},${h.r}`;
export const emptyKnowledge = (viewer) => ({ viewer, sightings: [] });
/** Geometry uses the existing canonical neighbour API, never render coordinates. */
export function spottingHexes(state, viewer) {
    const identified = new Set(), contact = new Set();
    for (const u of Object.values(state.units)) {
        if (!u.alive || u.side !== viewer)
            continue;
        const identify = u.type === 'RECON' ? SPOTTING.reconIdentification : SPOTTING.identification;
        const radius = u.type === 'RECON' ? SPOTTING.reconContact : SPOTTING.contact;
        let frontier = [u.hex];
        const seen = new Set();
        for (let distance = 0; distance <= radius; distance++) {
            const next = [];
            for (const hex of frontier) {
                const k = key(hex);
                if (seen.has(k) || !state.hexes[k])
                    continue;
                seen.add(k);
                contact.add(k);
                if (distance <= identify)
                    identified.add(k);
                next.push(...getNeighbors(hex));
            }
            frontier = next;
        }
    }
    return { identified, contact };
}
/** Pure, detached and JSON-safe. HIDDEN units have no object in this DTO. */
export function derivePlayerView(state, viewer, rules, knowledge) {
    const observer = viewer === 'OBSERVER', deploying = isDeploymentPhase(state);
    const sight = observer ? { identified: new Set(Object.keys(state.hexes)), contact: new Set(Object.keys(state.hexes)) } : spottingHexes(state, viewer);
    // Setup is private even where opposing deployment zones touch.
    if (deploying && !observer) {
        sight.identified.clear();
        sight.contact.clear();
        for (const u of Object.values(state.units))
            if (u.alive && u.side === viewer) {
                sight.identified.add(key(u.hex));
                sight.contact.add(key(u.hex));
            }
    }
    const participants = new Set();
    // Only a CURRENT accepted battle reveals participants; history cannot track them forever.
    const tx = state.pendingDecision ? state.combatTransactions[state.pendingDecision.battleId] : undefined;
    if (!deploying && tx && (observer || tx.attackerSide === viewer || tx.defenderSide === viewer))
        for (const id of [...tx.attackerUnitIds, ...tx.defenderUnitIds])
            participants.add(id);
    const units = [], contacts = new Map();
    for (const u of Object.values(state.units).sort((a, b) => a.id.localeCompare(b.id))) {
        if (!u.alive)
            continue;
        const friendly = u.side === viewer, identified = observer || friendly || (!deploying && (sight.identified.has(key(u.hex)) || participants.has(u.id)));
        if (identified) {
            const publicUnit = { visibility: 'IDENTIFIED', id: u.id, side: u.side, type: u.type, step: u.step, hex: { ...u.hex }, stats: { ...getUnitStats(u, rules) }, supplyState: u.supplyState, entrenched: u.entrenched };
            units.push(friendly ? { ...publicUnit, friendly: structuredClone(u) } : publicUnit);
        }
        else if (!deploying && sight.contact.has(key(u.hex))) {
            const contactId = `contact:${u.side}:${key(u.hex)}`;
            contacts.set(contactId, { visibility: 'CONTACT', contactId, side: u.side, hex: { ...u.hex }, status: 'CURRENT' });
        }
    }
    const currentHexes = new Set([...units.filter(u => u.side !== viewer).map(u => key(u.hex)), ...Array.from(contacts.values(), c => key(c.hex))]);
    const lastKnown = observer || deploying || knowledge?.viewer !== viewer ? [] : knowledge.sightings.filter(s => !sight.contact.has(key(s.hex)) && !currentHexes.has(key(s.hex))).map(s => structuredClone(s));
    const resources = {};
    for (const side of ['GERMAN', 'SOVIET'])
        if (observer || side === viewer)
            resources[side] = { rp: state.rp[side], cp: state.cp[side] };
    return { viewer, turn: state.turn, phase: state.phase, activeSide: state.activeSide,
        hexes: Object.values(state.hexes).map(h => ({ ...structuredClone(h), control: observer || sight.identified.has(key(h.coord)) ? h.control : null })),
        edges: structuredClone(Object.values(state.edges)), units, contacts: [...contacts.values()], lastKnown,
        identifiedHexKeys: [...sight.identified].sort(), contactHexKeys: [...sight.contact].sort(), resources,
        pendingDecision: state.pendingDecision && (observer || state.pendingDecision.side === viewer) ? structuredClone(state.pendingDecision) : null,
        victory: structuredClone(state.victory), ...(observer ? { authoritativeState: structuredClone(state) } : {}) };
}
/** Advance memory from already-disclosed facts only; never look up a hidden unit. */
export function rememberPlayerView(view) {
    if (view.viewer === 'OBSERVER')
        return null;
    if (view.phase.endsWith('_DEPLOYMENT'))
        return emptyKnowledge(view.viewer);
    const sightings = new Map(view.lastKnown.map(s => [s.contactId, structuredClone(s)]));
    for (const u of [...view.units.filter(u => u.side !== view.viewer), ...view.contacts]) {
        const contactId = `contact:${u.side}:${key(u.hex)}`;
        sightings.set(contactId, { contactId, side: u.side, hex: { ...u.hex }, lastSeenTurn: view.turn, status: 'LAST_KNOWN', confidence: 'UNCONFIRMED' });
    }
    return { viewer: view.viewer, sightings: [...sightings.values()].sort((a, b) => a.contactId.localeCompare(b.contactId)) };
}
