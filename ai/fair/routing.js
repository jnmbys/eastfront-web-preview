import { getNeighbors, hexDistance, hexKey } from '../../vendor/eastfront-digital-core/dist/core/hex.js';
export const ROUTE_UNIT_LIMIT = 768, ROUTE_DECISION_LIMIT = 32768;
const edgeKey = (a, b) => [hexKey(a), hexKey(b)].sort().join('|');
/** Decision-local indexes and lazy per-unit reverse Dijkstra. No retained match state,
 * callbacks, authoritative validators or inferred hidden obstacles. A route is an estimate
 * across future turns: submit ONE existing one-hex Action, then plan from the next view. */
export function createMoveScorer(input) {
    const { view, rules } = input;
    const board = new Map(view.hexes.map(h => [hexKey(h.coord), h]));
    const edges = new Map(view.edges.map(e => [edgeKey(e.a, e.b), e]));
    const own = view.units.filter(u => 'friendly' in u && u.friendly.controllerId === input.scope.controllerId);
    const enemies = view.units.filter(u => u.side !== view.viewer);
    const occupied = new Set([...enemies.map(u => hexKey(u.hex)), ...view.contacts.map(c => hexKey(c.hex))]);
    const friendlyCounts = new Map();
    for (const u of view.units.filter(u => u.side === view.viewer))
        friendlyCounts.set(hexKey(u.hex), (friendlyCounts.get(hexKey(u.hex)) ?? 0) + 1);
    const zoc = new Set();
    for (const e of enemies) {
        const templates = Object.values(rules.templates).filter(t => t.side === e.side && t.type === e.type);
        if (templates.length && templates.every(t => t.exertsZoc))
            for (const h of getNeighbors(e.hex))
                zoc.add(hexKey(h));
    }
    // Keep only bounded, own feedback since the last accepted phase end. An unrelated
    // unit move changes observationKey but must not retry this unit's rejected edge.
    // These are temporary failed intentions, NOT newly discovered enemy locations.
    let end = -1;
    for (let i = 0; i < input.history.length; i++) {
        const h = input.history[i];
        if (h.outcome === 'ACCEPTED' && h.intent?.type === 'READY_FOR_PHASE_END')
            end = i;
    }
    const recent = input.history.slice(end + 1);
    const failed = new Set(recent.filter(h => h.outcome === 'REJECTED' && h.intent?.type === 'MOVE').map(h => JSON.stringify(h.intent)));
    const metrics = { expanded: 0, searches: 0, exhausted: false };
    const plans = new Map();
    const safeCell = (u, k) => {
        const cell = board.get(k);
        if (!cell || rules.terrainMovementCost[cell.terrain] === 'IMPASSABLE' || occupied.has(k))
            return false;
        if ((friendlyCounts.get(k) ?? 0) - (k === hexKey(u.hex) ? 1 : 0) >= rules.stackingLimit)
            return false;
        const adjacent = enemies.filter(e => hexDistance(cell.coord, e.hex) === 1);
        const attack = u.supplyState === 'OUT_OF_SUPPLY' ? Math.ceil(u.stats.attack * rules.oosAttackMultiplier) : u.stats.attack;
        return adjacent.reduce((n, e) => n + e.stats.attack, 0) <= Math.max(1, u.stats.defense) * 2 && !adjacent.some(e => e.stats.defense > attack * 2);
    };
    // R1 public cost calculation, reused for every future one-step edge. Unknown ZOC
    // never cancels a possible road bonus; only the engine can adjudicate that uncertainty.
    const cost = (u, from, to) => {
        const cell = board.get(hexKey(to));
        if (!cell)
            return Infinity;
        const terrain = rules.terrainMovementCost[cell.terrain];
        if (terrain === 'IMPASSABLE' || terrain === undefined)
            return Infinity;
        const edge = edges.get(edgeKey(from, to)), road = edge?.road === true;
        const bridge = road && edge?.bridge && !edge.bridge.destroyed && ['ROAD', 'BOTH'].includes(edge.bridge.kind);
        const terrainCost = road ? rules.road.movementCost : u.type === 'JAGER' && ['FOREST', 'HILL'].includes(cell.terrain) ? Math.max(1, terrain - 1) : terrain;
        const step = terrainCost + (edge?.river && !(bridge && rules.road.bridgeCancelsRiverMovementSurcharge) ? rules.riverMovementSurcharge[edge.river] ?? 0 : 0);
        const knownZoc = zoc.has(hexKey(from)) || zoc.has(hexKey(to));
        const bonus = road && rules.road.wholeMoveBonusEnabled && !knownZoc ? rules.road.wholeMoveBonusMP : 0;
        const mp = Math.max(0, u.stats.movement - (u.supplyState === 'OUT_OF_SUPPLY' ? rules.oosMovementPenalty : 0) + bonus);
        return step <= mp ? step : Infinity;
    };
    const plan = (u) => {
        const cached = plans.get(u.id);
        if (cached)
            return cached;
        const start = hexKey(u.hex), safe = new Set([...board.keys()].filter(k => safeCell(u, k)));
        const distance = new Map(), out = { distance, safe };
        plans.set(u.id, out);
        metrics.searches++;
        if (u.stats.movement <= 0)
            return out;
        const goals = enemies.length ? [...safe].filter(k => enemies.some(e => hexDistance(board.get(k).coord, e.hex) === 1)) : rules.objectives.map(hexKey).filter(k => safe.has(k));
        const heap = [];
        const less = (a, b) => a.d < b.d || a.d === b.d && a.k < b.k;
        const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) {
            const p = (i - 1) >> 1;
            if (!less(heap[i], heap[p]))
                break;
            [heap[i], heap[p]] = [heap[p], heap[i]];
            i = p;
        } };
        const pop = () => { const first = heap[0], last = heap.pop(); if (heap.length) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                let j = i;
                for (const c of [i * 2 + 1, i * 2 + 2])
                    if (c < heap.length && less(heap[c], heap[j]))
                        j = c;
                if (j === i)
                    break;
                [heap[i], heap[j]] = [heap[j], heap[i]];
                i = j;
            }
        } return first; };
        const best = new Map();
        for (const k of new Set(goals)) {
            best.set(k, 0);
            push({ k, d: 0 });
        }
        let expanded = 0;
        while (heap.length) {
            if (expanded >= ROUTE_UNIT_LIMIT || metrics.expanded >= ROUTE_DECISION_LIMIT) {
                metrics.exhausted = true;
                break;
            }
            const n = pop();
            if (distance.has(n.k) || best.get(n.k) !== n.d)
                continue;
            distance.set(n.k, n.d);
            expanded++;
            metrics.expanded++;
            if (n.k === start)
                break; // every strictly lower-distance neighbor is now settled
            const to = board.get(n.k).coord;
            for (const from of getNeighbors(to)) {
                const k = hexKey(from);
                if ((k !== start && !safe.has(k)) || !board.has(k) || distance.has(k))
                    continue;
                if (k === start && failed.has(JSON.stringify({ type: 'MOVE', unitId: u.id, path: [to] })))
                    continue;
                const step = cost(u, from, to);
                if (!Number.isFinite(step))
                    continue;
                // A turn per step dominates ordinary terrain preferences. Positive weights give
                // a strictly descending potential: fixed goals/occupancy cannot produce A-B-A.
                const d = n.d + 10 + step;
                if (d < (best.get(k) ?? Infinity)) {
                    best.set(k, d);
                    push({ k, d });
                }
            }
        }
        return out;
    };
    const score = (a) => {
        if (a.type !== 'MOVE' || a.path.length !== 1 || failed.has(JSON.stringify(a)))
            return -Infinity;
        const u = own.find(u => u.id === a.unitId), to = a.path[0];
        if (!u || !to || !('friendly' in u) || u.friendly.hasMoved || hexDistance(u.hex, to) !== 1)
            return -Infinity;
        // Preserve R1's stop at identified adjacency and its immediate risk thresholds.
        if (enemies.some(e => hexDistance(u.hex, e.hex) <= 1))
            return -Infinity;
        const step = cost(u, u.hex, to);
        if (!Number.isFinite(step))
            return -Infinity;
        const p = plan(u), before = p.distance.get(hexKey(u.hex)), after = p.distance.get(hexKey(to));
        if (!p.safe.has(hexKey(to)) || before === undefined || after === undefined || after >= before)
            return -Infinity;
        const total = 10 + step + after;
        return 3 + 1 / (1 + total / 10) - (total - before) / 10;
    };
    return { score, metrics };
}
