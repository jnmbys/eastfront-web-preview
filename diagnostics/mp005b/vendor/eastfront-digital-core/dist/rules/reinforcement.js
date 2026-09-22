import { hexKey } from '../core/hex.js';
import { computeActiveSovietRailNetwork } from './rail.js';
import { zocHexKeys } from './zoc.js';
function slotNumber(value) {
    return String(value).padStart(2, '0');
}
function reinforcementSlotId(turn, groupOrdinal, unitOrdinal) {
    return `S-R-T${slotNumber(turn)}-G${slotNumber(groupOrdinal)}-U${slotNumber(unitOrdinal)}`;
}
/** Expand canonical Scenario reinforcement rule data into deterministic permanent slot identities. */
export function deriveSovietReinforcementSlots(scenario) {
    const out = [];
    scenario.reinforcements.forEach((group, groupIndex) => {
        group.units.forEach((type, unitIndex) => {
            out.push({
                id: reinforcementSlotId(group.turn, groupIndex + 1, unitIndex + 1),
                scheduledTurn: group.turn,
                type
            });
        });
    });
    return out.sort((a, b) => a.scheduledTurn - b.scheduledTurn || a.id.localeCompare(b.id));
}
/** Accepted deployment actions are the only canonical evidence that a Scenario slot was consumed. */
export function getDeployedSovietReinforcementIds(state) {
    const deployed = new Set();
    for (const entry of state.actionLog) {
        if (entry.accepted && entry.action.type === 'DEPLOY_REINFORCEMENT')
            deployed.add(entry.action.reinforcementId);
    }
    return [...deployed].sort();
}
export function getAvailableSovietReinforcements(state, scenario) {
    const deployed = new Set(getDeployedSovietReinforcementIds(state));
    return deriveSovietReinforcementSlots(scenario)
        .filter((slot) => slot.scheduledTurn <= state.turn && !deployed.has(slot.id));
}
export function getDelayedSovietReinforcements(state, scenario) {
    return getAvailableSovietReinforcements(state, scenario)
        .filter((slot) => slot.scheduledTurn < state.turn);
}
export function getCurrentTurnSovietReinforcements(state, scenario) {
    return getAvailableSovietReinforcements(state, scenario)
        .filter((slot) => slot.scheduledTurn === state.turn);
}
/** Pure board-fact query for Soviet reinforcement entry capacity. Phase legality is Task 002D-2. */
export function computeLegalSovietReinforcementEntryHexKeys(state, rules, scenario) {
    // East-only network is intentional: independent Soviet supply sources are never implicit entries.
    const eastNetwork = computeActiveSovietRailNetwork(state, scenario);
    const germanZoc = zocHexKeys(state, rules, 'GERMAN');
    const livingGermanOccupied = new Set(Object.values(state.units)
        .filter((unit) => unit.alive && unit.side === 'GERMAN')
        .map((unit) => hexKey(unit.hex)));
    return eastNetwork.exitHexKeys
        .filter((entryKey) => {
        if (livingGermanOccupied.has(entryKey) || germanZoc.has(entryKey))
            return false;
        const livingStack = Object.values(state.units)
            .filter((unit) => unit.alive && hexKey(unit.hex) === entryKey)
            .length;
        return livingStack < rules.stackingLimit;
    })
        .sort();
}
export function hasDeployableSovietReinforcement(state, rules, scenario) {
    return getAvailableSovietReinforcements(state, scenario).length > 0 &&
        computeLegalSovietReinforcementEntryHexKeys(state, rules, scenario).length > 0;
}
/** Resolve a scheduled Soviet UnitType defensively; deployment never guesses among multiple templates. */
export function resolveSovietReinforcementTemplate(rules, slot) {
    const matches = Object.values(rules.unitTemplates)
        .filter((template) => template.side === 'SOVIET' && template.type === slot.type)
        .sort((a, b) => a.id.localeCompare(b.id));
    if (matches.length === 0)
        return { status: 'UNRESOLVED', template: null };
    if (matches.length > 1)
        return { status: 'AMBIGUOUS', template: null };
    return { status: 'RESOLVED', template: matches[0] };
}
/**
 * Task 002D-2 authoritative validation for one Soviet reinforcement deployment.
 * Availability remains schedule + accepted actionLog derived; no reinforcement runtime state exists.
 */
export function validateDeploySovietReinforcementAction(state, rules, scenario, action) {
    const issues = [];
    const controller = state.controllers[action.controllerId];
    if (!controller) {
        issues.push({ code: 'INVALID_CONTROLLER', message: 'Unknown controller.' });
        return issues;
    }
    if (state.phase !== 'SOVIET_REINFORCEMENT_SUPPLY') {
        issues.push({ code: 'WRONG_PHASE', message: 'Soviet reinforcements may only deploy during SOVIET_REINFORCEMENT_SUPPLY.' });
        return issues;
    }
    if (controller.side !== 'SOVIET' || state.activeSide !== 'SOVIET') {
        issues.push({ code: 'WRONG_SIDE', message: 'Only an active-side Soviet controller may deploy Soviet reinforcements.' });
        return issues;
    }
    const slot = deriveSovietReinforcementSlots(scenario).find((candidate) => candidate.id === action.reinforcementId);
    if (!slot) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'Unknown Soviet reinforcement slot.', details: { reason: 'REINFORCEMENT_SLOT_UNKNOWN', reinforcementId: action.reinforcementId } });
        return issues;
    }
    if (slot.scheduledTurn > state.turn) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'This Soviet reinforcement is not yet available.', details: { reason: 'REINFORCEMENT_NOT_YET_AVAILABLE', reinforcementId: slot.id, scheduledTurn: slot.scheduledTurn, currentTurn: state.turn } });
        return issues;
    }
    const deployed = new Set(getDeployedSovietReinforcementIds(state));
    if (deployed.has(slot.id)) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'This Soviet reinforcement slot has already been deployed.', details: { reason: 'REINFORCEMENT_ALREADY_DEPLOYED', reinforcementId: slot.id } });
        return issues;
    }
    // Canonical availability is derived by the shared Task 002D-1 helper.
    if (!getAvailableSovietReinforcements(state, scenario).some((candidate) => candidate.id === slot.id)) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'This Soviet reinforcement slot is not currently available.', details: { reason: 'REINFORCEMENT_NOT_YET_AVAILABLE', reinforcementId: slot.id } });
        return issues;
    }
    if (state.units[slot.id]) {
        issues.push({ code: 'DUPLICATE_ID', message: `Unit id ${slot.id} already exists.`, unitId: slot.id, details: { reinforcementId: slot.id } });
        return issues;
    }
    const resolution = resolveSovietReinforcementTemplate(rules, slot);
    if (resolution.status !== 'RESOLVED') {
        const reason = resolution.status === 'UNRESOLVED' ? 'REINFORCEMENT_TEMPLATE_UNRESOLVED' : 'REINFORCEMENT_TEMPLATE_AMBIGUOUS';
        issues.push({ code: 'INVALID_SUPPORT', message: 'Soviet reinforcement template resolution failed.', details: { reason, reinforcementId: slot.id, unitType: slot.type } });
        return issues;
    }
    const entryKey = hexKey(action.entryHex);
    if (!state.hexes[entryKey]) {
        issues.push({ code: 'HEX_OUT_OF_BOUNDS', message: 'Reinforcement entry hex does not exist on the current map.', hex: action.entryHex });
        return issues;
    }
    const eastExitKeys = new Set(scenario.sovietEastRailExits.map(hexKey));
    if (!eastExitKeys.has(entryKey)) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'Soviet reinforcement deployment must use a configured East Rail Exit.', hex: action.entryHex, details: { reason: 'REINFORCEMENT_ENTRY_NOT_EAST_EXIT', entryHexKey: entryKey } });
        return issues;
    }
    const germanOccupier = Object.values(state.units).find((unit) => unit.alive && unit.side === 'GERMAN' && hexKey(unit.hex) === entryKey);
    if (germanOccupier) {
        issues.push({ code: 'ENEMY_OCCUPIED_HEX', message: 'A Soviet reinforcement cannot deploy onto a live German-occupied East Exit.', unitId: germanOccupier.id, hex: action.entryHex });
        return issues;
    }
    const activeEastExits = new Set(computeActiveSovietRailNetwork(state, scenario).exitHexKeys);
    if (!activeEastExits.has(entryKey)) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'The selected Soviet East Exit is not currently connected to the active East rail network.', hex: action.entryHex, details: { reason: 'REINFORCEMENT_ENTRY_INACTIVE', entryHexKey: entryKey } });
        return issues;
    }
    if (zocHexKeys(state, rules, 'GERMAN').has(entryKey)) {
        issues.push({ code: 'INVALID_SUPPORT', message: 'The selected Soviet East Exit is inside German ZOC.', hex: action.entryHex, details: { reason: 'REINFORCEMENT_ENTRY_IN_GERMAN_ZOC', entryHexKey: entryKey } });
        return issues;
    }
    const livingStack = Object.values(state.units).filter((unit) => unit.alive && hexKey(unit.hex) === entryKey);
    if (livingStack.length >= rules.stackingLimit) {
        issues.push({ code: 'STACKING_LIMIT', message: `Reinforcement entry ${entryKey} is at the stacking limit.`, hex: action.entryHex, details: { stackingLimit: rules.stackingLimit, currentLivingUnits: livingStack.map((unit) => unit.id).sort() } });
        return issues;
    }
    return issues;
}
/** Apply a prevalidated deployment. No supply refresh, CP/RP/RNG spend, or GameEvent occurs here. */
export function applyDeploySovietReinforcement(state, rules, scenario, action) {
    const slot = deriveSovietReinforcementSlots(scenario).find((candidate) => candidate.id === action.reinforcementId);
    if (!slot)
        throw new Error(`Missing prevalidated reinforcement slot ${action.reinforcementId}`);
    const resolution = resolveSovietReinforcementTemplate(rules, slot);
    if (resolution.status !== 'RESOLVED' || !resolution.template)
        throw new Error(`Missing prevalidated reinforcement template for ${slot.id}`);
    state.units[slot.id] = {
        id: slot.id,
        templateId: resolution.template.id,
        side: 'SOVIET',
        type: slot.type,
        step: 0,
        alive: true,
        hex: { ...action.entryHex },
        supplyState: 'OUT_OF_SUPPLY',
        entrenched: false,
        hasMoved: false,
        hasAttacked: false,
        controllerId: action.controllerId,
        temporarySupply: false,
        dedicatedRailRepair: false,
        reconZocIgnoreUsed: false,
        artillerySupportUsed: false,
        lastHQCommandTurn: null
    };
}
