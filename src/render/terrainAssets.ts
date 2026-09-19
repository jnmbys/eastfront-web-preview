import manifestData from '../assets/p4r3-manifest.json' with { type: 'json' };
import type { HexCoord } from '../core-adapter/core.js';

export type TerrainLod='far'|'medium'|'close';
export type RendererMode='prototype'|'production';
export type TerrainAssetSet='p5'|'p4r3';
export interface TerrainAssetEntry {id:string;family:string;file:string;sourceSize:[number,number];companion?:string;lod?:TerrainLod[];alpha?:boolean;tileable?:boolean;tileableX?:boolean;rotation?:string;mirror?:boolean;scaleJitter?:number;}
export interface TerrainAssetCatalog {byId(id:string):TerrainAssetEntry|undefined;byFamily(family:string):readonly TerrainAssetEntry[];selectVariant(family:string,seed:number,hex:HexCoord,salt?:string):TerrainAssetEntry|undefined;}
const entries=((manifestData as unknown) as {assets:TerrainAssetEntry[]}).assets;
const byIdMap=new Map(entries.map(e=>[e.id,e]));
const byFamilyMap=new Map<string,TerrainAssetEntry[]>();
for(const e of entries){const list=byFamilyMap.get(e.family)??[];list.push(e);byFamilyMap.set(e.family,list);}
export function stableStringHash(value:string):number{let h=2166136261>>>0;for(let i=0;i<value.length;i++){h^=value.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
export function visualSeed(seed:number,hex:HexCoord,kind:string):number{return stableStringHash(`${seed}|${hex.q}|${hex.r}|${kind}`);}
export function unorderedEdgeVisualSeed(seed:number,a:HexCoord,b:HexCoord,kind:string):number{const ka=`${a.q},${a.r}`,kb=`${b.q},${b.r}`;return stableStringHash(`${seed}|${ka<kb?ka:kb}|${ka<kb?kb:ka}|${kind}`);}
export const terrainAssetCatalog:TerrainAssetCatalog={byId:(id)=>byIdMap.get(id),byFamily:(f)=>byFamilyMap.get(f)??[],selectVariant:(family,seed,hex,salt='')=>{const list=byFamilyMap.get(family)??[];return list.length?list[visualSeed(seed,hex,`${family}|${salt}`)%list.length]:undefined;}};
export function assetRoot(set:TerrainAssetSet='p5'):string{return set==='p4r3'?'./dev-assets/terrain/p4r3-baseline':'./assets/terrain/p4r3';}
export function assetUrl(entry:TerrainAssetEntry,set:TerrainAssetSet='p5'):string{return `${assetRoot(set)}/${entry.file}`;}
export function assetCompanionUrl(entry:TerrainAssetEntry,set:TerrainAssetSet='p5'):string|undefined{return entry.companion?`${assetRoot(set)}/${entry.companion}`:undefined;}
export function selectTerrainLod(screenHexWidth:number):TerrainLod{return screenHexWidth<56?'far':screenHexWidth<=96?'medium':'close';}
export function entryVisibleAtLod(entry:TerrainAssetEntry|undefined,lod:TerrainLod):boolean{return Boolean(entry&&(!entry.lod||entry.lod.includes(lod)));}
export function manifestEntryCount():number{return entries.length;}
