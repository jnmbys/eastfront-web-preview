import { hexKey, offsetToAxial } from '../geometry/hex.js';
export const ROWS = 8;
export const COLS = 10;
export const mapHexes = Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => offsetToAxial(col, row))).flat();
export const mapHexKeys = new Set(mapHexes.map(hexKey));
function h(col, row) {
    return offsetToAxial(col, row);
}
const terrainEntries = [
    [h(1, 0), 'forest'], [h(2, 0), 'forest'], [h(6, 0), 'hill'], [h(8, 0), 'forest'],
    [h(0, 1), 'forest'], [h(2, 1), 'forest'], [h(4, 1), 'city'], [h(7, 1), 'hill'],
    [h(1, 2), 'forest'], [h(5, 2), 'city'], [h(7, 2), 'hill'], [h(8, 2), 'forest'],
    [h(3, 3), 'forest'], [h(5, 3), 'city'], [h(8, 3), 'marsh'], [h(9, 3), 'marsh'],
    [h(2, 4), 'hill'], [h(6, 4), 'forest'], [h(8, 4), 'marsh'], [h(9, 4), 'marsh'],
    [h(1, 5), 'hill'], [h(4, 5), 'forest'], [h(7, 5), 'marsh'], [h(8, 5), 'marsh'],
    [h(3, 6), 'forest'], [h(6, 6), 'city'], [h(8, 6), 'marsh'],
    [h(2, 7), 'forest'], [h(6, 7), 'city'], [h(9, 7), 'hill'],
];
export const terrainByHex = new Map(terrainEntries.map(([hex, terrain]) => [hexKey(hex), terrain]));
export const units = [
    { id: 'G-A1', faction: 'german', kind: 'armor', hex: h(3, 3), stats: '8·6·6', damage: 0, oos: false },
    { id: 'G-I1', faction: 'german', kind: 'infantry', hex: h(1, 2), stats: '5·5·3', damage: 0, oos: false },
    { id: 'G-I2', faction: 'german', kind: 'infantry', hex: h(2, 5), stats: '5·5·3', damage: 1, oos: false },
    { id: 'G-ART', faction: 'german', kind: 'artillery', hex: h(1, 6), stats: '+1 | R2', damage: 0, oos: true },
    { id: 'G-ST1', faction: 'german', kind: 'infantry', hex: h(4, 6), stats: '5·5·3', damage: 0, oos: false },
    { id: 'G-ST2', faction: 'german', kind: 'artillery', hex: h(4, 6), stats: '+1 | R2', damage: 0, oos: false },
    { id: 'S-T1', faction: 'soviet', kind: 'tank', hex: h(6, 2), stats: '6·5·5', damage: 0, oos: false },
    { id: 'S-I1', faction: 'soviet', kind: 'infantry', hex: h(7, 3), stats: '3·3·3', damage: 0, oos: false },
    { id: 'S-AT1', faction: 'soviet', kind: 'at', hex: h(7, 5), stats: '2·2·3', damage: 1, oos: false },
    { id: 'S-I2', faction: 'soviet', kind: 'infantry', hex: h(8, 1), stats: '3·3·3', damage: 0, oos: true },
    { id: 'S-ST1', faction: 'soviet', kind: 'infantry', hex: h(6, 6), stats: '3·3·3', damage: 0, oos: false },
    { id: 'S-ST2', faction: 'soviet', kind: 'at', hex: h(6, 6), stats: '2·2·3', damage: 0, oos: false },
];
export const initialSelectedUnitId = 'G-A1';
export const reachableHexes = [h(3, 2), h(4, 2), h(4, 3), h(3, 4), h(4, 4), h(5, 4), h(5, 3)];
export const enemyZocHexes = [h(5, 1), h(6, 1), h(7, 1), h(5, 2), h(7, 2), h(5, 3), h(6, 3)];
export const attackTargetHexes = [h(6, 2), h(7, 3)];
export const roadPath = [h(0, 3), h(1, 3), h(2, 3), h(3, 3), h(4, 3), h(5, 3), h(6, 3), h(7, 3), h(8, 3), h(9, 3)];
export const railPath = [h(4, 0), h(4, 1), h(5, 2), h(5, 3), h(6, 4), h(6, 5), h(6, 6), h(7, 6), h(7, 7)];
// River segments live on shared hex edges, never through centers.
export const riverEdges = [
    { a: h(5, 0), b: h(6, 0) },
    { a: h(5, 1), b: h(6, 0) },
    { a: h(5, 1), b: h(6, 1) },
    { a: h(6, 2), b: h(6, 1) },
    { a: h(6, 2), b: h(7, 2) },
    { a: h(6, 2), b: h(6, 3) },
    { a: h(5, 3), b: h(6, 3) }, // road crossing
    { a: h(6, 4), b: h(6, 3) },
    { a: h(6, 4), b: h(7, 4) },
    { a: h(6, 4), b: h(6, 5) },
    { a: h(5, 5), b: h(6, 5) },
    { a: h(6, 6), b: h(6, 5) },
    { a: h(6, 6), b: h(7, 6) }, // railway crossing
    { a: h(6, 6), b: h(6, 7) },
    { a: h(5, 7), b: h(6, 7) },
];
export const bridgeEdges = [
    { a: h(5, 3), b: h(6, 3) }, // road crossing
    { a: h(6, 6), b: h(7, 6) }, // railway crossing
];
export function terrainAt(hex) {
    return terrainByHex.get(hexKey(hex)) ?? 'plain';
}
