import type { HexCoord } from './types.js';

export const AXIAL_DIRECTIONS: readonly HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 }
] as const;

export function hexKey(h: HexCoord): string {
  return `${h.q},${h.r}`;
}

export function sameHex(a: HexCoord, b: HexCoord): boolean {
  return a.q === b.q && a.r === b.r;
}

export function getNeighbor(hex: HexCoord, direction: number): HexCoord {
  const d = AXIAL_DIRECTIONS[((direction % 6) + 6) % 6]!;
  return { q: hex.q + d.q, r: hex.r + d.r };
}

export function getNeighbors(hex: HexCoord): HexCoord[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -(a.q + a.r) + (b.q + b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

/** Convert paper offset coordinates (A..AF / 1..20) to axial coordinates. */
export function paperToAxial(columnLabel: string, row: number): HexCoord {
  const col = lettersToColumn(columnLabel);
  const q = col - 1;
  const zeroBasedRow = row - 1;
  const r = zeroBasedRow - Math.floor((q - (q & 1)) / 2);
  return { q, r };
}

/** Convert axial coordinates to paper offset coordinates. */
export function axialToPaper(hex: HexCoord): { column: string; row: number; label: string } {
  const col = hex.q + 1;
  const zeroBasedRow = hex.r + Math.floor((hex.q - (hex.q & 1)) / 2);
  const row = zeroBasedRow + 1;
  const column = columnToLetters(col);
  return { column, row, label: `${column}${row}` };
}

export function columnToLetters(column: number): string {
  if (!Number.isInteger(column) || column < 1) throw new Error(`Invalid column: ${column}`);
  let n = column;
  let out = '';
  while (n > 0) {
    n -= 1;
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26);
  }
  return out;
}

export function lettersToColumn(label: string): number {
  const normalized = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) throw new Error(`Invalid column label: ${label}`);
  let n = 0;
  for (const ch of normalized) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

export function parsePaperHex(label: string): HexCoord {
  const match = /^([A-Za-z]+)(\d+)$/.exec(label.trim());
  if (!match) throw new Error(`Invalid paper hex: ${label}`);
  return paperToAxial(match[1]!, Number(match[2]));
}
