import { parsePaperHex } from '../core/hex.js';
const deploymentUnits = (side, templateId, prefix, count) => Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${String(index + 1).padStart(2, '0')}`,
    templateId,
    side
}));
const productionInitialDeploymentUnits = [
    ...deploymentUnits('GERMAN', 'G-INF', 'G-I', 11),
    ...deploymentUnits('GERMAN', 'G-JAGER', 'G-J', 2),
    ...deploymentUnits('GERMAN', 'G-PANZER', 'G-PZ', 4),
    ...deploymentUnits('GERMAN', 'G-MOT', 'G-MOT', 3),
    ...deploymentUnits('GERMAN', 'G-ARTY', 'G-ART', 2),
    ...deploymentUnits('GERMAN', 'G-ENG', 'G-ENG', 2),
    ...deploymentUnits('GERMAN', 'G-RECON', 'G-REC', 2),
    ...deploymentUnits('SOVIET', 'S-INF', 'S-I', 16),
    ...deploymentUnits('SOVIET', 'S-ELITE', 'S-EL', 2),
    ...deploymentUnits('SOVIET', 'S-TANK', 'S-TK', 3),
    ...deploymentUnits('SOVIET', 'S-MOT', 'S-MOT', 2),
    ...deploymentUnits('SOVIET', 'S-HEAVY', 'S-HV', 1),
    ...deploymentUnits('SOVIET', 'S-AT', 'S-AT', 3),
    ...deploymentUnits('SOVIET', 'S-ARTY', 'S-ART', 3),
    ...deploymentUnits('SOVIET', 'S-ENG', 'S-ENG', 2)
];
export const defaultScenario = {
    id: 'strategic-reset-f',
    displayName: 'Strategic Reset F — Open Operational Basin',
    rulesId: 'paper-rules-digital-branch-0.1',
    board: { paperColumns: 32, paperRows: 20 },
    turnLimit: 16,
    experimental: { turnLimitCandidates: [16, 18, 20], wholeRoadMoveBonusCandidate: true },
    germanWestRailEntries: ['A5', 'A10', 'A16'].map(parsePaperHex),
    sovietEastRailExits: ['AF4', 'AF10', 'AF16'].map(parsePaperHex),
    sovietSupplySources: ['AC10', 'AC11'].map(parsePaperHex),
    capitalCoreHexes: ['AC10', 'AC11'].map(parsePaperHex),
    capitalOuterHexes: ['AD10'].map(parsePaperHex),
    reinforcements: [
        { turn: 4, units: ['INFANTRY', 'INFANTRY'] },
        { turn: 7, units: ['INFANTRY', 'INFANTRY', 'ANTI_TANK'] },
        { turn: 10, units: ['INFANTRY', 'MOTORIZED', 'TANK'] },
        { turn: 13, units: ['INFANTRY', 'TANK', 'ELITE_INFANTRY'] },
        { turn: 15, units: ['TANK', 'MOTORIZED'] }
    ],
    controllers: [
        { id: 'G-HUMAN-1', side: 'GERMAN', controllerType: 'HUMAN', displayName: 'German Controller' },
        { id: 'S-AI-1', side: 'SOVIET', controllerType: 'AI', displayName: 'Soviet AI' }
    ],
    initialUnits: [],
    deployment: {
        sequence: ['SOVIET', 'GERMAN'],
        hiddenUntilBothComplete: true,
        zones: {
            GERMAN: { kind: 'WESTERNMOST_COLUMNS', columnCount: 3 },
            SOVIET: { kind: 'COMPLEMENT_OF_SIDE_ZONE', excludedSide: 'GERMAN' }
        },
        units: productionInitialDeploymentUnits
    }
};
