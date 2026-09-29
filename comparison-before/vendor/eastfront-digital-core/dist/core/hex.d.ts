import type { HexCoord } from './types.js';
export declare const AXIAL_DIRECTIONS: readonly HexCoord[];
export declare function hexKey(h: HexCoord): string;
export declare function sameHex(a: HexCoord, b: HexCoord): boolean;
export declare function getNeighbor(hex: HexCoord, direction: number): HexCoord;
export declare function getNeighbors(hex: HexCoord): HexCoord[];
export declare function hexDistance(a: HexCoord, b: HexCoord): number;
/** Convert paper offset coordinates (A..AF / 1..20) to axial coordinates. */
export declare function paperToAxial(columnLabel: string, row: number): HexCoord;
/** Convert axial coordinates to paper offset coordinates. */
export declare function axialToPaper(hex: HexCoord): {
    column: string;
    row: number;
    label: string;
};
export declare function columnToLetters(column: number): string;
export declare function lettersToColumn(label: string): number;
export declare function parsePaperHex(label: string): HexCoord;
