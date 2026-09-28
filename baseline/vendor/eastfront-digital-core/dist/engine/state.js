import { hexKey } from '../core/hex.js';
import { SeededRNG } from '../random/SeededRNG.js';
import { refreshGermanSupplyState, refreshSovietSupplyState } from '../rules/supply.js';
import { beginGameTurn, beginPhase, beginPlayerTurn } from '../rules/turn.js';
export function createDeploymentGameState(input) {
    const { scenario, rules } = input;
    if (!scenario.deployment)
        throw new Error('createDeploymentGameState requires scenario.deployment configuration.');
    const controllers = {};
    for (const c of scenario.controllers) {
        if (controllers[c.id])
            throw new Error(`Duplicate controller id in scenario: ${c.id}`);
        controllers[c.id] = { ...c };
    }
    const hexes = {};
    for (const h of input.hexes) {
        const key = hexKey(h.coord);
        if (hexes[key])
            throw new Error(`Duplicate hex coordinate in initial state: ${key}`);
        hexes[key] = { ...h, coord: { ...h.coord } };
    }
    const edges = {};
    for (const e of input.edges) {
        if (edges[e.key])
            throw new Error(`Duplicate edge key in initial state: ${e.key}`);
        edges[e.key] = structuredClone(e);
    }
    const rng = new SeededRNG(input.seed ?? 1);
    return {
        scenarioId: scenario.id, rulesVersion: rules.id, turn: 1, phase: 'SOVIET_DEPLOYMENT', activeSide: 'SOVIET', hexes, edges, units: {}, controllers,
        rp: { ...rules.recovery.initialRP }, cp: { GERMAN: rules.cp.initial, SOVIET: rules.cp.initial }, random: rng.snapshot(), victory: { winner: null, reason: null, turn: null, checkedAtPhase: null }, pendingDecision: null, phaseReadyControllerIds: [], unitCommitments: {}, combatTransactions: {}, schwerpunktUsedOnTurn: null, idCounters: { nextAction: 1, nextBattle: 1 }, actionLog: []
    };
}
export function createGameState(input) {
    const { scenario, rules } = input;
    const controllers = {};
    for (const c of scenario.controllers) {
        if (controllers[c.id])
            throw new Error(`Duplicate controller id in scenario: ${c.id}`);
        controllers[c.id] = { ...c };
    }
    const units = {};
    for (const u of input.units ?? []) {
        if (units[u.id])
            throw new Error(`Duplicate unit id in initial state: ${u.id}`);
        units[u.id] = { ...u, hex: { ...u.hex } };
    }
    const hexes = {};
    for (const h of input.hexes) {
        const key = hexKey(h.coord);
        if (hexes[key])
            throw new Error(`Duplicate hex coordinate in initial state: ${key}`);
        hexes[key] = { ...h, coord: { ...h.coord } };
    }
    const edges = {};
    for (const e of input.edges) {
        if (edges[e.key])
            throw new Error(`Duplicate edge key in initial state: ${e.key}`);
        edges[e.key] = structuredClone(e);
    }
    const rng = new SeededRNG(input.seed ?? 1);
    const state = {
        scenarioId: scenario.id,
        rulesVersion: rules.id,
        turn: 1,
        phase: 'GERMAN_SUPPLY_RAIL',
        activeSide: 'GERMAN',
        hexes,
        edges,
        units,
        controllers,
        rp: { ...rules.recovery.initialRP },
        cp: { GERMAN: rules.cp.initial, SOVIET: rules.cp.initial },
        random: rng.snapshot(),
        victory: { winner: null, reason: null, turn: null, checkedAtPhase: null },
        pendingDecision: null,
        phaseReadyControllerIds: [],
        unitCommitments: {},
        combatTransactions: {},
        schwerpunktUsedOnTurn: null,
        idCounters: { nextAction: 1, nextBattle: 1 },
        actionLog: []
    };
    // Setup enters German Player Turn 1, so run the same lifecycle hooks used by later turns.
    // Initial reserve is created above; beginPlayerTurn applies the first +CP income here.
    beginGameTurn(state, rules);
    beginPlayerTurn(state, rules, 'GERMAN');
    beginPhase(state, 'GERMAN_SUPPLY_RAIL');
    refreshGermanSupplyState(state, rules, scenario);
    // Soviet units can already defend during the opening German Player Turn, so their initial normal
    // supply snapshot must also be authoritative from setup rather than waiting for the first Soviet turn.
    refreshSovietSupplyState(state, rules, scenario);
    return state;
}
export function cloneGameState(state) {
    return structuredClone(state);
}
