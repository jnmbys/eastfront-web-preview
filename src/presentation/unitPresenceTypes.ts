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
  infantry: {width:52,foot:10,medium:0.9,close:1.1,shadow:24,muzzle:27},
  armor: {width:54,foot:10,medium:0.91,close:1.11,shadow:25,muzzle:30},
  motorized: {width:53,foot:10,medium:0.9,close:1.1,shadow:24,muzzle:27},
  artillery: {width:48,foot:11,medium:1,close:1.22,shadow:22,muzzle:28},
  'anti-tank': {width:46,foot:9,medium:1.02,close:1.25,shadow:23,muzzle:27},
  engineer: {width:43,foot:10,medium:1.08,close:1.33,shadow:21,muzzle:24},
  recon: {width:40,foot:9,medium:1.16,close:1.42,shadow:21,muzzle:24},
  headquarters: {width:32,foot:10,medium:1.4,close:1.75,shadow:18,muzzle:22},
} satisfies Record<PresenceFamily,{width:number;foot:number;medium:number;close:number;shadow:number;muzzle:number}>);
export function presenceComposition(family:PresenceFamily,_half:number,stackSign:number,heavy:boolean,lod:TerrainLod){
  const profile=PRESENCE_PROFILE[family];
  const scale=profile[lod==='close'?'close':'medium']*(stackSign?.60:1)*(heavy?1.06:1);
  // Counter supplies the existing stack sign and motion anchor. Cancel only its
  // small vertical display stagger so model feet stay at the canonical ground plane.
  const groundY=stackSign<0?6:stackSign>0?-7:0;
  return {x:stackSign*12.5,y:groundY-profile.foot*scale,scale};
}
/** Two screen pixels of hysteresis prevent detail flicker during a slow pinch.
 * Thresholds still come from the existing LOD selector; Camera/terrain are untouched. */
export function selectPresenceLod(width:number,previous:TerrainLod|null):TerrainLod {
  const next=selectTerrainLod(width);if(!previous||next===previous)return next;
  const order={far:0,medium:1,close:2};
  return selectTerrainLod(width+(order[next]>order[previous]?-2:2))===next?next:previous;
}
