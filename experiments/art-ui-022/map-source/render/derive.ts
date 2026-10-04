import {
  HEX_SIZE, hexPolygon, hexToPixel, midpoint, polygonPointsString, sharedHexEdge,
  type HexCoord, type Point, type HexEdge,
} from '../geometry/hex.js';

export const SELECTED_VISUAL_SCALE = 1.045;
export const TOUCH_HIT_SIZE = Math.max(44, HEX_SIZE * 1.22);

export interface HexAnchored { hex: HexCoord }

export interface CounterPlacement {
  authoritativeAnchor: Point;
  visualCenter: Point;
  side: number;
}

export interface CounterBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TouchHitArea {
  center: Point;
  side: number;
}

export type LineSegment = readonly [Point, Point];

export function deriveCounterPlacement(unit: HexAnchored, stackIndex = 0, stackSize = 1): CounterPlacement {
  const authoritativeAnchor = hexToPixel(unit.hex);
  if (stackSize === 1) {
    return { authoritativeAnchor, visualCenter: authoritativeAnchor, side: HEX_SIZE * 1.14 };
  }
  // Presentation-only local offsets. Both counters share one authoritative hex anchor.
  const offsets = stackIndex === 0 ? { x: -6.5, y: -6 } : { x: 6.5, y: 7 };
  return {
    authoritativeAnchor,
    visualCenter: { x: authoritativeAnchor.x + offsets.x, y: authoritativeAnchor.y + offsets.y },
    side: HEX_SIZE * 0.90,
  };
}

export function deriveCounterBounds(unit: HexAnchored, stackIndex = 0, stackSize = 1): CounterBounds {
  const placement = deriveCounterPlacement(unit, stackIndex, stackSize);
  return {
    x: placement.visualCenter.x - placement.side / 2,
    y: placement.visualCenter.y - placement.side / 2,
    width: placement.side,
    height: placement.side,
  };
}

export function deriveTouchHitArea(unit: HexAnchored): TouchHitArea {
  // Touch expansion is presentation-only and remains centered on the canonical Hex anchor.
  return { center: hexToPixel(unit.hex), side: TOUCH_HIT_SIZE };
}

export function deriveOverlayPolygon(hex: HexCoord): string {
  return polygonPointsString(hex);
}

export function deriveTargetBrackets(hex: HexCoord): LineSegment[] {
  const vertices = hexPolygon(hex);
  const t = 0.28;
  const segments: LineSegment[] = [];
  for (const index of [0, 2, 4]) {
    const vertex = vertices[index]!;
    const prev = vertices[(index + 5) % 6]!;
    const next = vertices[(index + 1) % 6]!;
    const toward = (point: Point): Point => ({
      x: vertex.x + (point.x - vertex.x) * t,
      y: vertex.y + (point.y - vertex.y) * t,
    });
    segments.push([vertex, toward(prev)], [vertex, toward(next)]);
  }
  return segments;
}

export function deriveCenterSegment(a: HexCoord, b: HexCoord): readonly [Point, Point] {
  return [hexToPixel(a), hexToPixel(b)];
}

export function deriveRiverEdge(a: HexCoord, b: HexCoord): HexEdge {
  const edge = sharedHexEdge(a, b);
  if (!edge) throw new Error('River edge requires adjacent hexes.');
  return edge;
}

export interface BridgeGeometry {
  crossing: Point;
  from: Point;
  to: Point;
  angleDeg: number;
}

export function deriveBridgeGeometry(a: HexCoord, b: HexCoord): BridgeGeometry {
  const edge = deriveRiverEdge(a, b);
  const crossing = midpoint(edge);
  const ca = hexToPixel(a);
  const cb = hexToPixel(b);
  const dx = cb.x - ca.x;
  const dy = cb.y - ca.y;
  const len = Math.hypot(dx, dy);
  const half = 12;
  const ux = dx / len;
  const uy = dy / len;
  return {
    crossing,
    from: { x: crossing.x - ux * half, y: crossing.y - uy * half },
    to: { x: crossing.x + ux * half, y: crossing.y + uy * half },
    angleDeg: Math.atan2(dy, dx) * 180 / Math.PI,
  };
}
