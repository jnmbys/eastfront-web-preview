import type {GrandPort} from './grand.js';
import {hexPolygon,hexNeighbors,hexKey,sharedHexEdge,pointString,hexToPixel} from '../geometry/hex.js';
/** Frozen public theatre ownership, never current hidden control or enemy positions. */
export function geographyPaths(geography:any){
 const rows=(geography?.cells??[]).map((r:any)=>({...r,coord:{q:Number(r.hex.split(',')[0]),r:Number(r.hex.split(',')[1])}})),lookup=new Map<string,any>(rows.map((r:any)=>[r.hex,r])),fills:Record<string,string>={},centres:Record<string,{x:number;y:number;n:number}>={};let border='';
 for(const r of rows){fills[r.side]=(fills[r.side]??'')+'M'+hexPolygon(r.coord).map(pointString).join('L')+'Z';const p=hexToPixel(r.coord),c=centres[r.side]??={x:0,y:0,n:0};c.x+=p.x;c.y+=p.y;c.n++;
  for(const h of hexNeighbors(r.coord)){const k=hexKey(h),n=lookup.get(k);if(n&&r.hex<k&&r.side!==n.side){const e=sharedHexEdge(r.coord,h)!;border+='M'+pointString(e[0])+'L'+pointString(e[1]);}}
 }
 return {fills,border,centres};
}
export function paintNationalGeography(p:GrandPort){const svg=document.querySelector<SVGSVGElement>('#eastfront-map'),g=p.data.continuous.geography;if(!svg||!g)return;let el=svg.querySelector<SVGGElement>('#national-geography');if(!el){el=document.createElementNS('http://www.w3.org/2000/svg','g');el.id='national-geography';el.setAttribute('pointer-events','none');svg.insertBefore(el,svg.querySelector('#control-boundaries'));}
 const signature=JSON.stringify(g);if(el.dataset.signature===signature)return;el.dataset.signature=signature;
 const {fills,border,centres}=geographyPaths(g);el.innerHTML=Object.entries(fills).map(([side,d])=>`<path d="${d}" fill="${side==='GERMAN'?'#658d9d':'#ac7770'}" opacity=".12"/>`).join('')+`<path d="${border}" fill="none" stroke="#202f35" stroke-width="8"/><path d="${border}" fill="none" stroke="#d7c7a0" stroke-width="3" stroke-dasharray="18 10"/>`+Object.entries(centres).map(([side,c])=>`<text x="${c.x/c.n}" y="${c.y/c.n-90}" text-anchor="middle" class="national-name" fill="${side==='GERMAN'?'#c8e1e6':'#ead0c2'}" stroke="#273337" stroke-width="2" paint-order="stroke" font-size="70" letter-spacing="14">${side==='GERMAN'?'德国战区':'苏联战区'}</text>`).join('');
}
