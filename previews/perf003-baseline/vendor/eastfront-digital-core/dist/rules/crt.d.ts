import type { GameRules } from '../core/config.js';
import type { CRTResult } from '../core/types.js';
export declare function selectCRTColumn(attack: number, defense: number, rules: GameRules): number;
export declare function clampCRTShift(shift: number, rules: GameRules): number;
export declare function shiftedCRTColumn(base: number, shift: number, rules: GameRules): number;
export declare function resolveCRTResult(diceTotal: number, column: number, rules: GameRules): CRTResult;
export declare function parseCRTResult(result: CRTResult): {
    attackerLossSteps: number;
    defenderLossSteps: number;
    attackerRetreatSteps: number;
    defenderRetreatSteps: number;
};
