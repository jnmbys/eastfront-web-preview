export const DRAFT_KEYS = [
    'selectedUnitId', 'selectedDeploymentUnitId', 'interactionMode', 'pathDraft', 'railRepairEdgeKeys', 'selectedEngineerUnitId',
    'selectedReinforcementId', 'attackUnitIds', 'primaryAttackerId', 'attackTarget', 'attackerArtilleryUnitId', 'selectedBattleId',
    'lossDraft', 'retreatOrder', 'retreatDrafts', 'activeRetreaterId', 'advanceUnitId', 'breakthroughUnitId', 'breakthroughPath', 'schwerpunktTarget',
];
export function queryDraft(p) { return Object.fromEntries(DRAFT_KEYS.map(k => [k, structuredClone(p[k])])); }
export const record = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const id = v => typeof v === 'string' && /^[A-Za-z0-9_:.,-]{1,96}$/.test(v);
export const revision = v => Number.isSafeInteger(v) && Number(v) >= 0;
export const hex = v => record(v) && Object.keys(v).length === 2 && ['q', 'r'].every(k => Number.isSafeInteger(v[k]) && Math.abs(Number(v[k])) <= 10000);
const list = (check, max = 128) => v => Array.isArray(v) && v.length <= max && v.every(check);
const ids = list(id), path = list(hex, 64), nullable = (check) => v => v === null || check(v);
const oneOf = (...values) => v => values.includes(v);
export function shape(v, required, optional = {}) {
    return record(v) && Object.keys(v).every(k => Object.hasOwn(required, k) || Object.hasOwn(optional, k)) && Object.entries(required).every(([k, c]) => Object.hasOwn(v, k) && c(v[k])) && Object.entries(optional).every(([k, c]) => !Object.hasOwn(v, k) || c(v[k]));
}
const hq = oneOf('FORCE_ATTACK', 'LAST_STAND', 'STAFF_OFFICE_PLAN', 'MAKESHIFT_BRIDGES', 'EXTRA_SUPPLIES', 'SIEGE_ARTILLERY');
const support = v => shape(v, {}, { attackerArtilleryUnitId: id, attackerHQUnitId: id, attackerHQCommand: hq });
const schema = {
    MOVE: { required: { unitId: id, path } }, ATTACK: { required: { attackerUnitIds: ids, target: hex }, optional: { support } },
    READY_FOR_PHASE_END: { required: {} }, END_PHASE: { required: {} }, END_TURN: { required: {} },
    USE_HQ_COMMAND: { required: { hqUnitId: id, command: hq }, optional: { target: hex, unitIds: ids, battleId: id } },
    ENTRENCH: { required: { unitId: id } }, REPAIR_UNIT: { required: { unitId: id } }, RAIL_REPAIR: { required: { edgeKeys: ids }, optional: { engineerUnitId: id } },
    DEPLOY_REINFORCEMENT: { required: { reinforcementId: id, entryHex: hex } }, DEPLOY_INITIAL_UNIT: { required: { deploymentUnitId: id, hex } },
    BREAKTHROUGH: { required: { battleId: id, unitId: id, path } }, PASS_BREAKTHROUGH: { required: { battleId: id } },
    ALLOCATE_LOSSES: { required: { battleId: id, unitIdsByStep: ids } },
    RETREAT: { required: { battleId: id, retreats: list(v => shape(v, { unitId: id, path }), 64) } },
    COMBAT_REACTION: { required: { battleId: id, reaction: v => shape(v, { kind: oneOf('DEFENDER_ARTILLERY'), artilleryUnitId: id }) || shape(v, { kind: oneOf('DEFENDER_HQ_COMMAND'), hqUnitId: id, command: oneOf('LAST_STAND') }) } },
    PASS_REACTION: { required: { battleId: id } }, ADVANCE_AFTER_COMBAT: { required: { battleId: id, unitId: id } }, PASS_ADVANCE: { required: { battleId: id } },
    SCHWERPUNKT_ATTACK: { required: { sourceBattleId: id, unitId: id, target: hex }, optional: { support: v => shape(v, {}, { attackerArtilleryUnitId: id }) } },
    PASS_SCHWERPUNKT: { required: { battleId: id } },
};
export function isNetworkAction(v) {
    if (!record(v) || typeof v.type !== 'string' || !Object.hasOwn(schema, v.type))
        return false;
    const s = schema[v.type];
    return shape(v, { type: oneOf(v.type), ...s.required }, s.optional);
}
export function isQueryDraft(v) {
    const checks = {
        selectedUnitId: nullable(id), selectedDeploymentUnitId: nullable(id), interactionMode: oneOf('SELECT', 'MOVE_PATH', 'RAIL_REPAIR', 'REINFORCEMENT', 'RECOVERY', 'ENTRENCH', 'ATTACK', 'LOSS_ALLOCATION', 'RETREAT', 'BREAKTHROUGH', 'SCHWERPUNKT'),
        pathDraft: path, railRepairEdgeKeys: ids, selectedEngineerUnitId: nullable(id), selectedReinforcementId: nullable(id), attackUnitIds: ids, primaryAttackerId: nullable(id), attackTarget: nullable(hex), attackerArtilleryUnitId: nullable(id), selectedBattleId: nullable(id), lossDraft: ids, retreatOrder: ids,
        retreatDrafts: x => record(x) && Object.keys(x).length <= 64 && Object.entries(x).every(([k, p]) => id(k) && k !== '__proto__' && path(p)),
        activeRetreaterId: nullable(id), advanceUnitId: nullable(id), breakthroughUnitId: nullable(id), breakthroughPath: path, schwerpunktTarget: nullable(hex),
    };
    return shape(v, checks);
}
/** Called only after exact schema validation and server ownership checks. */
export function toCoreAction(action, controllerId) { return { ...structuredClone(action), controllerId }; }
