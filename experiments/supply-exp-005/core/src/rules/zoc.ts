import { getNeighbors, hexKey } from '../core/hex.js';
import type { GameRules } from '../core/config.js';
import type { GameState, HexCoord, Side } from '../core/types.js';

export function enemyOf(side: Side): Side {
  return side === 'GERMAN' ? 'SOVIET' : 'GERMAN';
}

export function zocHexKeys(state: GameState, rules: GameRules, projectedBy: Side): Set<string> {
  const out = new Set<string>();
  for (const unit of Object.values(state.units)) {
    if (!unit.alive || unit.side !== projectedBy) continue;
    const template = rules.unitTemplates[unit.templateId];
    if (!template?.exertsZoc) continue;
    for (const n of getNeighbors(unit.hex)) {
      if (state.hexes[hexKey(n)]) out.add(hexKey(n));
    }
  }
  return out;
}

export function isInEnemyZoc(state: GameState, rules: GameRules, side: Side, hex: HexCoord): boolean {
  return zocHexKeys(state, rules, enemyOf(side)).has(hexKey(hex));
}
