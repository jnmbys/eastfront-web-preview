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
  GERMAN:{body:'#91a5ac',accent:'#c5d0cf'},
  SOVIET:{body:'#ad8171',accent:'#d9b7a0'},
});
export const PRESENCE_LOD=Object.freeze({far:{opacity:0},medium:{opacity:1},close:{opacity:1}});
/** Artwork dimensions, not map geometry. Width excludes transient firing cues.
 * Family profiles keep infantry formations, vehicles and gun trails legible at Medium.
 * Counter width and its existing stack displacement are the only composition inputs. */
export const PRESENCE_PROFILE=Object.freeze({
  infantry: {width:52,foot:10,medium:1.10,close:1.42,shadow:24,muzzle:27},
  armor: {width:54,foot:10,medium:1.12,close:1.43,shadow:25,muzzle:30},
  motorized: {width:53,foot:10,medium:1.08,close:1.36,shadow:24,muzzle:27},
  artillery: {width:48,foot:11,medium:1.18,close:1.56,shadow:22,muzzle:28},
  'anti-tank': {width:46,foot:9,medium:1.18,close:1.51,shadow:23,muzzle:27},
  engineer: {width:43,foot:10,medium:1.22,close:1.57,shadow:21,muzzle:24},
  recon: {width:40,foot:9,medium:1.30,close:1.66,shadow:21,muzzle:24},
  headquarters: {width:32,foot:10,medium:1.52,close:1.98,shadow:18,muzzle:22},
} satisfies Record<PresenceFamily,{width:number;foot:number;medium:number;close:number;shadow:number;muzzle:number}>);
export function presenceComposition(family:PresenceFamily,half:number,stackSign:number,heavy:boolean,lod:TerrainLod){
  const profile=PRESENCE_PROFILE[family],close=lod==='close';
  const scale=profile[close?'close':'medium']*(stackSign ? .86 : 1)*(heavy?1.06:1);
  // Solo models occupy the rear ground strip. In a stack both models fan out onto
  // the near ground strip, keeping them clear of the preceding occupied Counter row.
  // The existing sign determines left/right and slight depth. Neither this display
  // offset nor the shadow is a hex anchor or an input surface.
  const gap=close?12:9;
  const top=family==='infantry'?21:family==='armor'?18:family==='artillery'?20:15;
  const y=stackSign?half+(close?9:7)+top*scale:-half-gap-profile.foot*scale;
  return {x:stackSign*(close?25:20),y,scale};
}
/** Two screen pixels of hysteresis prevent detail flicker during a slow pinch.
 * Thresholds still come from the existing LOD selector; Camera/terrain are untouched. */
export function selectPresenceLod(width:number,previous:TerrainLod|null):TerrainLod {
  const next=selectTerrainLod(width);if(!previous||next===previous)return next;
  const order={far:0,medium:1,close:2};
  return selectTerrainLod(width+(order[next]>order[previous]?-2:2))===next?next:previous;
}
