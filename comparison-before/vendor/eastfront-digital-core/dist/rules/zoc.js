import { getNeighbors, hexKey } from '../core/hex.js';
export function enemyOf(side) {
    return side === 'GERMAN' ? 'SOVIET' : 'GERMAN';
}
export function zocHexKeys(state, rules, projectedBy) {
    const out = new Set();
    for (const unit of Object.values(state.units)) {
        if (!unit.alive || unit.side !== projectedBy)
            continue;
        const template = rules.unitTemplates[unit.templateId];
        if (!template?.exertsZoc)
            continue;
        for (const n of getNeighbors(unit.hex)) {
            if (state.hexes[hexKey(n)])
                out.add(hexKey(n));
        }
    }
    return out;
}
export function isInEnemyZoc(state, rules, side, hex) {
    return zocHexKeys(state, rules, enemyOf(side)).has(hexKey(hex));
}
