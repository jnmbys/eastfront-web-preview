import type { UnitState } from '../core-adapter/core.js';
import { selectTerrainLod, type TerrainLod } from '../render/terrainAssets.js';

/** Only canonical identity enters the presence layer; Counter supplies the anchor. */
export type UnitPresenceIdentity = Readonly<Pick<UnitState,'id'|'side'|'type'>>;
export type PresenceFamily='infantry'|'armor'|'motorized'|'artillery'|'anti-tank'|'engineer'|'recon'|'headquarters';
export const PRESENCE_FAMILY = Object.freeze({
  INFANTRY:'infantry', JAGER:'infantry', ELITE_INFANTRY:'infantry',
  PANZER:'armor', TANK:'armor', HEAVY_TANK:'armor', MOTORIZED:'motorized',
  ARTILLERY:'artillery', ANTI_TANK:'anti-tank', ENGINEER:'engineer', RECON:'recon', HQ:'headquarters',
} satisfies Record<UnitState['type'],PresenceFamily>);
export const PRESENCE_PALETTE=Object.freeze({
  GERMAN:{body:'#718996',accent:'#bdcbd0'},
  SOVIET:{body:'#956a5f',accent:'#d1a393'},
});
export const PRESENCE_LOD=Object.freeze({far:{scale:.64,opacity:0},medium:{scale:.78,opacity:.92},close:{scale:1,opacity:1}});
/** Two screen pixels of hysteresis prevent detail flicker during a slow pinch.
 * Thresholds still come from the existing LOD selector; Camera/terrain are untouched. */
export function selectPresenceLod(width:number,previous:TerrainLod|null):TerrainLod {
  const next=selectTerrainLod(width);if(!previous||next===previous)return next;
  const order={far:0,medium:1,close:2};
  return selectTerrainLod(width+(order[next]>order[previous]?-2:2))===next?next:previous;
}
