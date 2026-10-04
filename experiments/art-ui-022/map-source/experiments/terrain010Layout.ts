import {hexToPixel,hexPolygon,type Point} from '../geometry/hex.js';
import {corridors,label,type SliceData} from './mapData.js';
import {composeSettlement as compose009,paintSettlementGround as ground009,settlementCells,inSettlement} from './dioramaLayout.js';
import type {Placement} from './terrain010Terrain.js';
export {settlementCells,inSettlement};

// Continuous canopies and distinct ridge profiles replace repeated small hill/tree stamps.
// Rectangles are visual envelopes; actual alpha is clipped to terrain and public clearances.
export function composeSettlement(data:SliceData,base:Placement[]):Placement[]{
 const old=compose009(data,base),list:Placement[]=old.filter(p=>!settlementCells.has(p.cell)||p.kind==='city');
 const specs:Record<string,number[][]>={
  W14:[[-3,-5,76,49,0]], V14:[[0,3,58,69,1]], Y15:[[2,-1,72,37,1]],
  W13:[[-6,-21,63,30,2],[10,20,51,27,3]],
  V13:[[-5,-3,65,61,2],[8,17,52,33,3]]
 };
 for(const h of data.hexes.filter(inSettlement)){
  const cell=label(h.coord),c=hexToPixel(h.coord);
  for(const [dx,dy,width,height,tile] of specs[cell]??[])list.push({cell,kind:h.terrain==='FOREST'?'forest':h.terrain,x:c.x+dx!,y:c.y+dy!,width:width!,height:height!,tile:tile!});
 }
 return list;
}
function polygon(ctx:CanvasRenderingContext2D,points:Point[]){ctx.moveTo(points[0]!.x,points[0]!.y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();}

/** Subtract every real water/transport corridor and counter rectangle independently.
 * Sequential clips cannot reintroduce overlaps as a single even-odd compound path could.
 * All terrain alpha, including its shadow, is masked by this contract.
 */
export function clipNaturalSpace(ctx:CanvasRenderingContext2D,data:SliceData,h:SliceData['hexes'][number]){
 const c=hexToPixel(h.coord);ctx.beginPath();polygon(ctx,hexPolygon(h.coord));ctx.clip();
 const outer=()=>{ctx.beginPath();ctx.rect(c.x-60,c.y-60,120,120);};
 for(const l of corridors(data)){
  if(Math.max(l.a.x,l.b.x)+l.width<c.x-45||Math.min(l.a.x,l.b.x)-l.width>c.x+45||Math.max(l.a.y,l.b.y)+l.width<c.y-45||Math.min(l.a.y,l.b.y)-l.width>c.y+45)continue;
  const dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,w=l.width+.6;
  outer();polygon(ctx,[{x:l.a.x-ux*w-uy*w,y:l.a.y-uy*w+ux*w},{x:l.b.x+ux*w-uy*w,y:l.b.y+uy*w+ux*w},{x:l.b.x+ux*w+uy*w,y:l.b.y+uy*w-ux*w},{x:l.a.x-ux*w+uy*w,y:l.a.y-uy*w-ux*w}]);ctx.clip('evenodd');
 }
 for(const u of data.counters){const q=hexToPixel(u.hex);if(Math.abs(q.x-c.x)>80||Math.abs(q.y-c.y)>80)continue;outer();ctx.rect(q.x-34,q.y-34,68,68);ctx.clip('evenodd');}
}

export function paintSettlementGround(ctx:CanvasRenderingContext2D,data:SliceData,list:Placement[]){
 // Keep 009 courtyard/buildings exactly; replace only the terrain's broad underlying masses.
 ground009(ctx,data,list);
 ctx.save();ctx.beginPath();data.hexes.filter(inSettlement).forEach(h=>polygon(ctx,hexPolygon(h.coord)));ctx.clip();
 for(const h of data.hexes.filter(h=>inSettlement(h)&&h.terrain!=='CITY')){
  const c=hexToPixel(h.coord),forest=h.terrain==='FOREST';
  const g=ctx.createRadialGradient(c.x-11,c.y-8,5,c.x,c.y,49);
  g.addColorStop(0,forest?'rgba(62,77,38,.23)':'rgba(181,165,114,.14)');g.addColorStop(.65,forest?'rgba(66,87,43,.13)':'rgba(130,130,78,.09)');g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(c.x-49,c.y-49,98,98);
 }
 ctx.restore();
}

/** Soft broad bank materials sampled only from original river edges.
 * No new centerline, crossing, bridge or water polygon is introduced.
 */
export function paintNaturalBanks(ctx:CanvasRenderingContext2D,data:SliceData){
 ctx.save();ctx.beginPath();data.hexes.filter(inSettlement).forEach(h=>polygon(ctx,hexPolygon(h.coord)));ctx.clip();
 const local=data.hexes.filter(inSettlement).map(h=>hexToPixel(h.coord));
 const wash=(x:number,y:number,r:number,color:string)=>{const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.40,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,2*r,2*r);};
 for(const l of corridors(data).filter(l=>l.kind==='river')){
  const dx=l.b.x-l.a.x,dy=l.b.y-l.a.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len;
  if(!local.some(c=>Math.hypot(c.x-(l.a.x+l.b.x)/2,c.y-(l.a.y+l.b.y)/2)<80))continue;
  const n=Math.ceil(len/4);
  for(let i=0;i<=n;i++){
   const t=i/n,x=l.a.x+dx*t,y=l.a.y+dy*t;
   for(const side of [-1,1]){
    const variation=Math.sin(x*.09+y*.065+side)*1.7,offset=6.8+variation;
    wash(x+nx*side*10,y+ny*side*10,9,'rgba(61,92,64,.16)');
    wash(x+nx*side*offset,y+ny*side*offset,4.4,'rgba(133,125,90,.27)');
    wash(x+nx*side*(offset-1.2),y+ny*side*(offset-1.2),2.9,side<0?'rgba(192,178,126,.21)':'rgba(67,89,69,.22)');
   }
  }
 }
 ctx.restore();
}
