import {hexKey,hexDistance,hexNeighbors,hexPolygon,sharedHexEdge,pointString,type HexCoord} from '../geometry/hex.js';
export function controlRegions(view:any){
 const identified=new Set(view.identifiedHexKeys),map=new Map<string,any>(view.hexes.map((h:any)=>[hexKey(h.coord),h]));
 const owner=(h:any)=>!identified.has(hexKey(h.coord))?'UNKNOWN':h.control??'NEUTRAL';
 const fills:Record<string,string>={},edges:Record<string,{d:string;unknown:boolean}>={};
 for(const h of view.hexes){const a=hexKey(h.coord),side=owner(h);if(side!=='UNKNOWN')fills[side]=(fills[side]??'')+'M'+hexPolygon(h.coord).map(p=>pointString(p)).join('L')+'Z';
  for(const n of hexNeighbors(h.coord)){const b=hexKey(n),other=map.get(b);if(!other||a>=b||side===owner(other))continue;
   const edge=sharedHexEdge(h.coord,n)!;edges[a+'|'+b]={d:'M'+pointString(edge[0])+'L'+pointString(edge[1]),unknown:side==='UNKNOWN'||owner(other)==='UNKNOWN'};
  }
 }
 return {fills,edges};
}
// Do not smooth or union away holes, single hex pockets or narrow corridors.
export function frontPath(front:HexCoord[],point:(h:HexCoord)=>{x:number;y:number}){return front.flatMap((h,i)=>front.slice(i+1).filter(n=>hexDistance(h,n)===1).map(n=>{const a=point(h),b=point(n);return `M${a.x},${a.y}L${b.x},${b.y}`;})).join('');}
