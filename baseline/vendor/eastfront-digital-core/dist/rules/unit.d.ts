import type { GameRules } from '../core/config.js';
import type { Unit, UnitState, UnitStats } from '../core/types.js';
export declare function getUnitStats(unit: UnitState, rules: GameRules): UnitStats;
export declare function materializeUnit(unit: UnitState, rules: GameRules): Unit;
