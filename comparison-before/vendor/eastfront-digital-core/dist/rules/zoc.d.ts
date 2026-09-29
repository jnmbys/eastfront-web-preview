import type { GameRules } from '../core/config.js';
import type { GameState, HexCoord, Side } from '../core/types.js';
export declare function enemyOf(side: Side): Side;
export declare function zocHexKeys(state: GameState, rules: GameRules, projectedBy: Side): Set<string>;
export declare function isInEnemyZoc(state: GameState, rules: GameRules, side: Side, hex: HexCoord): boolean;
