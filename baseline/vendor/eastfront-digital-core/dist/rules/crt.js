export function selectCRTColumn(attack, defense, rules) { if (defense <= 0)
    return rules.crt.columns.length - 1; const ratio = attack / defense; let index = 0; for (let i = 0; i < rules.crt.thresholds.length; i++)
    if (ratio >= rules.crt.thresholds[i])
        index = i; return Math.min(index, rules.crt.columns.length - 1); }
export function clampCRTShift(shift, rules) { return Math.max(-rules.crt.maxNetShift, Math.min(rules.crt.maxNetShift, shift)); }
export function shiftedCRTColumn(base, shift, rules) { return Math.max(0, Math.min(rules.crt.columns.length - 1, base + clampCRTShift(shift, rules))); }
export function resolveCRTResult(diceTotal, column, rules) { if (!Number.isInteger(diceTotal) || diceTotal < 2 || diceTotal > 12)
    throw new Error(`Invalid 2D6 total ${diceTotal}.`); if (!Number.isInteger(column) || column < 0 || column >= rules.crt.columns.length)
    throw new Error(`Invalid CRT column ${column}.`); const row = rules.crt.table[diceTotal]; if (!row)
    throw new Error(`Missing CRT row ${diceTotal}.`); const result = row[column]; if (!result)
    throw new Error(`Missing CRT result for row ${diceTotal}, column ${column}.`); return result; }
export function parseCRTResult(result) { switch (result) {
    case 'A3R': return { attackerLossSteps: 3, defenderLossSteps: 0, attackerRetreatSteps: 1, defenderRetreatSteps: 0 };
    case 'A2': return { attackerLossSteps: 2, defenderLossSteps: 0, attackerRetreatSteps: 0, defenderRetreatSteps: 0 };
    case 'A1': return { attackerLossSteps: 1, defenderLossSteps: 0, attackerRetreatSteps: 0, defenderRetreatSteps: 0 };
    case 'AR': return { attackerLossSteps: 0, defenderLossSteps: 0, attackerRetreatSteps: 1, defenderRetreatSteps: 0 };
    case 'EX': return { attackerLossSteps: 1, defenderLossSteps: 1, attackerRetreatSteps: 0, defenderRetreatSteps: 0 };
    case 'NE': return { attackerLossSteps: 0, defenderLossSteps: 0, attackerRetreatSteps: 0, defenderRetreatSteps: 0 };
    case 'DR': return { attackerLossSteps: 0, defenderLossSteps: 0, attackerRetreatSteps: 0, defenderRetreatSteps: 1 };
    case 'D1R': return { attackerLossSteps: 0, defenderLossSteps: 1, attackerRetreatSteps: 0, defenderRetreatSteps: 1 };
    case 'D2R': return { attackerLossSteps: 0, defenderLossSteps: 2, attackerRetreatSteps: 0, defenderRetreatSteps: 2 };
    case 'D3R': return { attackerLossSteps: 0, defenderLossSteps: 3, attackerRetreatSteps: 0, defenderRetreatSteps: 2 };
} }
