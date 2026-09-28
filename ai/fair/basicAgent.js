import { hexDistance, hexKey } from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import { observationCandidates } from './candidates.js';
import { minimalAgent, agentOrder } from './minimalAgent.js';
const key = (a) => JSON.stringify(a);
/** Heuristic only, never CRT prediction or an authoritative legality query.
 * No unseen support, surrounded bonus, future dice or inferred CONTACT strength. */
export function scoreIntent(input, a) {
    const { view, rules } = input;
    const own = view.units.filter(u => 'friendly' in u && u.friendly.controllerId === input.scope.controllerId);
    const enemies = view.units.filter(u => u.side !== view.viewer);
    if (a.type === 'READY_FOR_PHASE_END')
        return 0;
    if (a.type === 'ATTACK') {
        const attackers = own.filter(u => a.attackerUnitIds.includes(u.id));
        const defenders = enemies.filter(u => hexKey(u.hex) === hexKey(a.target));
        if (!defenders.length || attackers.length !== a.attackerUnitIds.length)
            return -Infinity;
        const attack = attackers.reduce((n, u) => n + (u.supplyState === 'OUT_OF_SUPPLY' ? Math.ceil(u.stats.attack * rules.oosAttackMultiplier) : u.stats.attack), 0);
        const defense = defenders.reduce((n, u) => n + u.stats.defense, 0);
        const terrain = view.hexes.find(h => hexKey(h.coord) === hexKey(a.target));
        let penalty = Math.max(0, -(rules.terrainAttackShift[terrain?.terrain ?? ''] ?? 0));
        if (defenders.some(u => u.entrenched))
            penalty += Math.max(0, -rules.entrenchmentShift);
        // Conservative: charge the worst crossing and ignore favorable combined-arms/flank bonuses.
        penalty += Math.max(0, ...attackers.map(u => {
            const e = view.edges.find(e => (hexKey(e.a) === hexKey(u.hex) && hexKey(e.b) === hexKey(a.target)) || (hexKey(e.b) === hexKey(u.hex) && hexKey(e.a) === hexKey(a.target)));
            return e?.river ? -(rules.riverAttackShift[e.river] ?? 0) : 0;
        }));
        const ratio = attack / Math.max(1, defense);
        const required = 1.5 + penalty * 0.75;
        return ratio >= required ? 10 + Math.min(10, ratio - required) : -Infinity;
    }
    if (a.type === 'MOVE') {
        const u = own.find(u => u.id === a.unitId), to = a.path.at(-1);
        if (!u || !to || u.stats.movement <= 0)
            return -Infinity;
        const k = hexKey(to), cell = view.hexes.find(h => hexKey(h.coord) === k);
        if (!cell || cell.terrain === 'LAKE' || enemies.some(e => hexKey(e.hex) === k) || view.contacts.some(e => hexKey(e.hex) === k))
            return -Infinity;
        // Public one-step cost only. This is NOT an engine legality query. Unknown ZOC
        // must not remove a possible road bonus: keep uncertain proposals for adjudication.
        if (a.path.length === 1) {
            const terrain = rules.terrainMovementCost[cell.terrain];
            if (terrain === 'IMPASSABLE')
                return -Infinity;
            const edge = view.edges.find(e => (hexKey(e.a) === hexKey(u.hex) && hexKey(e.b) === k) || (hexKey(e.b) === hexKey(u.hex) && hexKey(e.a) === k));
            const road = edge?.road === true;
            const bridge = road && edge?.bridge && !edge.bridge.destroyed && ['ROAD', 'BOTH'].includes(edge.bridge.kind);
            const terrainCost = road ? rules.road.movementCost : u.type === 'JAGER' && ['FOREST', 'HILL'].includes(cell.terrain) ? Math.max(1, (terrain ?? 0) - 1) : (terrain ?? 0);
            const cost = terrainCost + (edge?.river && !(bridge && rules.road.bridgeCancelsRiverMovementSurcharge) ? rules.riverMovementSurcharge[edge.river] ?? 0 : 0);
            const knownZoc = [u.hex, to].some(h => enemies.some(e => {
                const templates = Object.values(rules.templates).filter(t => t.side === e.side && t.type === e.type);
                return hexDistance(h, e.hex) === 1 && templates.length > 0 && templates.every(t => t.exertsZoc);
            }));
            const possibleBonus = road && rules.road.wholeMoveBonusEnabled && !knownZoc ? rules.road.wholeMoveBonusMP : 0;
            const possibleMP = Math.max(0, u.stats.movement - (u.supplyState === 'OUT_OF_SUPPLY' ? rules.oosMovementPenalty : 0) + possibleBonus);
            if (cost > possibleMP)
                return -Infinity;
        }
        if (own.filter(e => e.id !== u.id && hexKey(e.hex) === k).length >= rules.stackingLimit)
            return -Infinity;
        // One-step proposals + hasMoved prevent repeated movement in a phase. Strictly decreasing
        // distance to current authorized goals avoids greedy backtracking without hidden-state probes.
        const goals = enemies.length ? enemies.map(e => e.hex) : rules.objectives;
        if (!goals.length)
            return -Infinity;
        const distance = (h) => Math.min(...goals.map(g => hexDistance(h, g)));
        const before = distance(u.hex), after = distance(to);
        if (after >= before || enemies.length && before <= 1)
            return -Infinity;
        const adjacent = enemies.filter(e => hexDistance(to, e.hex) === 1);
        const attack = u.supplyState === 'OUT_OF_SUPPLY' ? Math.ceil(u.stats.attack * rules.oosAttackMultiplier) : u.stats.attack;
        if (adjacent.reduce((n, e) => n + e.stats.attack, 0) > Math.max(1, u.stats.defense) * 2 || adjacent.some(e => e.stats.defense > attack * 2))
            return -Infinity;
        return 2 + (before - after) - Math.max(0, -(rules.terrainAttackShift[cell.terrain] ?? 0)) * 0.1;
    }
    return -Infinity;
}
/** Stateless, deterministic basic policy. Original minimal policy remains the forced-flow owner. */
export const basicAgent = input => {
    if (input.deployment || input.view.pendingDecision || !input.view.phase.endsWith('_MOVEMENT') && !input.view.phase.endsWith('_COMBAT'))
        return minimalAgent(input);
    const rejected = new Set(input.history.filter(h => h.outcome === 'REJECTED' && h.observationKey === input.observationKey).map(h => key(h.intent)));
    // Avoid probing alternative tactical intents after repeated rejection. Never inspect error codes.
    const failures = input.history.filter(h => h.outcome === 'REJECTED' && h.observationKey === input.observationKey).length;
    const ranked = observationCandidates(input).filter(a => !rejected.has(key(a)) && (failures < 3 || a.type === 'READY_FOR_PHASE_END'))
        .map((a, i) => ({ a, score: scoreIntent(input, a), tie: agentOrder(input.agentRandom.seed, i) }))
        .filter(x => Number.isFinite(x.score)).sort((a, b) => b.score - a.score || a.tie - b.tie);
    return ranked.length ? { kind: 'INTENT', intent: ranked[0].a } : { kind: 'STOP', reason: 'NO_CANDIDATE' };
};
