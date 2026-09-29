const T = (id, side, type, steps, options = {}) => ({
    id,
    side,
    type,
    steps,
    maxDamageSteps: options.maxDamageSteps ?? 3,
    exertsZoc: options.exertsZoc ?? true,
    canEntrench: options.canEntrench ?? false,
    isArmor: options.isArmor ?? false,
    infantryCoordination: options.infantryCoordination ?? false,
    isSupport: options.isSupport ?? false,
    recoveryCostPerStep: options.recoveryCostPerStep ?? 1
});
export const unitTemplates = {
    'G-INF': T('G-INF', 'GERMAN', 'INFANTRY', [
        { attack: 5, defense: 5, movement: 3 }, { attack: 4, defense: 4, movement: 3 }, { attack: 3, defense: 3, movement: 2 }
    ], { canEntrench: true, infantryCoordination: true }),
    'G-JAGER': T('G-JAGER', 'GERMAN', 'JAGER', [
        { attack: 5, defense: 5, movement: 4 }, { attack: 4, defense: 4, movement: 4 }, { attack: 3, defense: 3, movement: 3 }
    ], { canEntrench: true, infantryCoordination: true }),
    'G-PANZER': T('G-PANZER', 'GERMAN', 'PANZER', [
        { attack: 8, defense: 6, movement: 6 }, { attack: 6, defense: 5, movement: 6 }, { attack: 4, defense: 3, movement: 5 }
    ], { isArmor: true, recoveryCostPerStep: 2 }),
    'G-MOT': T('G-MOT', 'GERMAN', 'MOTORIZED', [
        { attack: 6, defense: 5, movement: 5 }, { attack: 5, defense: 4, movement: 5 }, { attack: 3, defense: 3, movement: 4 }
    ], { infantryCoordination: true, recoveryCostPerStep: 2 }),
    'G-ARTY': T('G-ARTY', 'GERMAN', 'ARTILLERY', [
        { attack: 0, defense: 1, movement: 2 }, { attack: 0, defense: 1, movement: 2 }, { attack: 0, defense: 1, movement: 1 }
    ], { exertsZoc: false, isSupport: true, recoveryCostPerStep: 2 }),
    'G-ENG': T('G-ENG', 'GERMAN', 'ENGINEER', [
        { attack: 3, defense: 3, movement: 3 }, { attack: 2, defense: 2, movement: 3 }, { attack: 1, defense: 1, movement: 2 }
    ], { exertsZoc: false, isSupport: true }),
    'G-RECON': T('G-RECON', 'GERMAN', 'RECON', [
        { attack: 2, defense: 2, movement: 6 }, { attack: 1, defense: 1, movement: 6 }, { attack: 1, defense: 1, movement: 5 }
    ]),
    'G-HQ': T('G-HQ', 'GERMAN', 'HQ', [
        { attack: 0, defense: 1, movement: 4 }, { attack: 0, defense: 1, movement: 4 }, { attack: 0, defense: 1, movement: 4 }
    ], { maxDamageSteps: 1, exertsZoc: false, isSupport: true }),
    'S-INF': T('S-INF', 'SOVIET', 'INFANTRY', [
        { attack: 3, defense: 3, movement: 3 }, { attack: 2, defense: 2, movement: 3 }, { attack: 1, defense: 1, movement: 2 }
    ], { canEntrench: true, infantryCoordination: true }),
    'S-ELITE': T('S-ELITE', 'SOVIET', 'ELITE_INFANTRY', [
        { attack: 5, defense: 5, movement: 3 }, { attack: 4, defense: 4, movement: 3 }, { attack: 2, defense: 2, movement: 2 }
    ], { canEntrench: true, infantryCoordination: true }),
    'S-TANK': T('S-TANK', 'SOVIET', 'TANK', [
        { attack: 6, defense: 5, movement: 5 }, { attack: 4, defense: 4, movement: 5 }, { attack: 3, defense: 2, movement: 4 }
    ], { isArmor: true, recoveryCostPerStep: 2 }),
    'S-MOT': T('S-MOT', 'SOVIET', 'MOTORIZED', [
        { attack: 4, defense: 4, movement: 5 }, { attack: 3, defense: 3, movement: 4 }, { attack: 2, defense: 2, movement: 4 }
    ], { infantryCoordination: true, recoveryCostPerStep: 2 }),
    'S-HEAVY': T('S-HEAVY', 'SOVIET', 'HEAVY_TANK', [
        { attack: 5, defense: 7, movement: 4 }, { attack: 4, defense: 6, movement: 4 }, { attack: 2, defense: 4, movement: 3 }
    ], { isArmor: true, recoveryCostPerStep: 2 }),
    'S-AT': T('S-AT', 'SOVIET', 'ANTI_TANK', [
        { attack: 2, defense: 2, movement: 3 }, { attack: 1, defense: 1, movement: 3 }, { attack: 1, defense: 1, movement: 2 }
    ]),
    'S-ARTY': T('S-ARTY', 'SOVIET', 'ARTILLERY', [
        { attack: 0, defense: 1, movement: 2 }, { attack: 0, defense: 1, movement: 2 }, { attack: 0, defense: 1, movement: 1 }
    ], { exertsZoc: false, isSupport: true, recoveryCostPerStep: 2 }),
    'S-ENG': T('S-ENG', 'SOVIET', 'ENGINEER', [
        { attack: 2, defense: 2, movement: 3 }, { attack: 1, defense: 1, movement: 3 }, { attack: 1, defense: 1, movement: 2 }
    ], { exertsZoc: false, isSupport: true }),
    'S-HQ': T('S-HQ', 'SOVIET', 'HQ', [
        { attack: 0, defense: 1, movement: 4 }, { attack: 0, defense: 1, movement: 4 }, { attack: 0, defense: 1, movement: 4 }
    ], { maxDamageSteps: 1, exertsZoc: false, isSupport: true })
};
export const defaultRules = {
    id: 'paper-rules-digital-branch-0.1',
    stackingLimit: 2,
    terrain: {
        PLAIN: { movementCost: 1, attackShift: 0 },
        FOREST: { movementCost: 2, attackShift: -1 },
        HILL: { movementCost: 2, attackShift: -1 },
        MARSH: { movementCost: 2, attackShift: -1 },
        ROUGH: { movementCost: 2, attackShift: 0 },
        CITY: { movementCost: 1, attackShift: -1 },
        MAIN_CITY: { movementCost: 1, attackShift: -1 },
        OUTER_CITY: { movementCost: 1, attackShift: -1 },
        LAKE: { movementCost: 'IMPASSABLE', attackShift: 0 }
    },
    river: {
        MINOR: { movementSurcharge: 1, attackShift: -1 },
        MAJOR: { movementSurcharge: 2, attackShift: -2 }
    },
    road: {
        movementCost: 1,
        wholeMoveBonusEnabled: false,
        wholeMoveBonusMP: 1,
        bridgeCancelsRiverMovementSurcharge: true
    },
    crt: {
        columns: ['1:3', '1:2', '2:3', '1:1', '3:2', '2:1', '3:1', '4:1+'],
        thresholds: [1 / 3, 1 / 2, 2 / 3, 1, 1.5, 2, 3, 4],
        maxNetShift: 2,
        table: {
            2: ['A3R', 'A3R', 'A3R', 'A2', 'A1', 'AR', 'EX', 'NE'],
            3: ['A3R', 'A3R', 'A2', 'A1', 'AR', 'EX', 'NE', 'DR'],
            4: ['A3R', 'A3R', 'A2', 'A1', 'AR', 'EX', 'NE', 'DR'],
            5: ['A3R', 'A2', 'A1', 'AR', 'EX', 'NE', 'DR', 'D1R'],
            6: ['A3R', 'A2', 'A1', 'AR', 'EX', 'NE', 'DR', 'D1R'],
            7: ['A2', 'A1', 'AR', 'EX', 'NE', 'DR', 'D1R', 'D2R'],
            8: ['A1', 'AR', 'EX', 'NE', 'DR', 'D1R', 'D2R', 'D3R'],
            9: ['AR', 'EX', 'NE', 'DR', 'D1R', 'D2R', 'D3R', 'D3R'],
            10: ['EX', 'NE', 'DR', 'D1R', 'D2R', 'D3R', 'D3R', 'D3R'],
            11: ['NE', 'DR', 'D1R', 'D2R', 'D3R', 'D3R', 'D3R', 'D3R'],
            12: ['DR', 'D1R', 'D2R', 'D3R', 'D3R', 'D3R', 'D3R', 'D3R']
        }
    },
    unitTemplates,
    supply: {
        germanRadius: 5,
        sovietRadius: 5,
        oosAttackMultiplier: 0.5,
        oosMovementPenalty: 1
    },
    rail: {
        baseRepairPerTurn: 4,
        engineerRepairPerTurn: 5,
        branchCap: 2,
        engineerBranchCap: 3
    },
    recovery: {
        initialRP: { GERMAN: 8, SOVIET: 12 },
        maxUnitsPerTurn: {
            GERMAN: 1,
            SOVIET: [{ fromTurn: 1, maxUnits: 1 }, { fromTurn: 5, maxUnits: 2 }, { fromTurn: 10, maxUnits: 3 }]
        },
        maxDistanceFromBase: 2
    },
    cp: { initial: 1, gainPerOwnTurn: 1, maximum: 3 },
    hqCommands: {
        FORCE_ATTACK: { command: 'FORCE_ATTACK', cost: 2, range: 3, crtShift: 1 },
        LAST_STAND: { command: 'LAST_STAND', cost: 2, range: 3, crtShift: -1 },
        STAFF_OFFICE_PLAN: { command: 'STAFF_OFFICE_PLAN', cost: 1, range: 3, crtShift: 1 },
        MAKESHIFT_BRIDGES: { command: 'MAKESHIFT_BRIDGES', cost: 1, range: 3, crtShift: 1 },
        EXTRA_SUPPLIES: { command: 'EXTRA_SUPPLIES', cost: 2, range: 3 },
        SIEGE_ARTILLERY: { command: 'SIEGE_ARTILLERY', cost: 1, range: 3, crtShift: 1 }
    },
    combat: {
        combinedArmsShift: 1,
        unsupportedArmorComplexTerrainShift: -1,
        antiTankShift: -1,
        artilleryShift: 1,
        flankShift: 1,
        entrenchmentShift: -1,
        schwerpunktSecondAttackShift: -1,
        germanCombinedArmsArmorTypes: ['PANZER'],
        germanCombinedArmsCoordinationTypes: ['INFANTRY', 'JAGER', 'MOTORIZED'],
        complexTerrainForArmor: ['FOREST', 'CITY', 'MAIN_CITY', 'OUTER_CITY', 'MARSH']
    }
};
