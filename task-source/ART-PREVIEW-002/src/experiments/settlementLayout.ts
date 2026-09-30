import {hexToPixel,hexPolygon,type Point} from '../geometry/hex.js';
import {corridors,inside,label,type SliceData} from './mapData.js';
import {vs2RectangleSegmentDistance} from '../render/vs2Projection.js';
import type {Placement} from './settlementTerrain.js';

// A connected eight-cell composition, not a new whole-map distribution rule.
export const settlementCells=new Set(['X14','W13','W14','V13','V14','W15','X15','Y15']);
export const inSettlement=(h:SliceData['hexes'][number])=>settlementCells.has(label(h.coord));
export function composeSettlement(data:SliceData,base:Placement[]):Placement[]{
 const lanes=corridors(data),out=base.filter(p=>!settlementCells.has(p.cell));
 const specs:Record<string,number[][]>={
  // Buildings face shared open court ground. Three roof families and one civic accent.
  X14:[[-25,13,13,12,0],[-10,13,14,13,1],[6,13,14,13,0],[24,12,12,11,2],[-13,26,12,11,2],[1,27,14,17,3],[14,25,11,11,1],[-28,-14,13,12,1],[28,-14,13,12,0]],
  // Two connected canopy masses divided only by the real railway corridor.
  W13:[[-16,-18,32,23],[5,-20,33,27],[22,-14,22,18],[7,17,30,23],[19,15,20,18]],
  V13:[[-11,-4,32,25],[9,-7,27,24],[-17,12,30,25],[2,9,32,28],[18,15,22,23],[-1,24,25,18]],
  // Different relief scale/aspect and ridge center; old hill cutout reused without mirroring light.
  W14:[[-7,-5,67,48]],V14:[[-1,5,48,68]],Y15:[[4,-3,58,42]]
 };
 for(const h of data.hexes.filter(inSettlement)){
  const cell=label(h.coord),c=hexToPixel(h.coord),poly=hexPolygon(h.coord);
  for(const [dx,dy,width,height,roof] of specs[cell]??[]){
   const p:Placement={cell,kind:h.terrain==='CITY'?'city':h.terrain==='FOREST'?'forest':h.terrain,x:c.x+dx!,y:c.y+dy!,width:width!,height:height!,...(roof===undefined?{}:{roof})};
   // Forest/roof rectangles fit canonical cells and leave all actual transport/water corridors open.
   // Relief alpha can be clipped to its original cell; roads/water paint above relief as in 007.
   if(p.kind==='city'||p.kind==='forest'){
    const fits=()=>[-1,1].every(a=>[-1,1].every(b=>inside({x:p.x+a*p.width/2,y:p.y+b*p.height/2},poly)))
     &&!lanes.some(l=>vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)<l.width+.5)
     &&!data.counters.some(u=>{const q=hexToPixel(u.hex);return Math.abs(q.x-p.x)<34+p.width/2&&Math.abs(q.y-p.y)<34+p.height/2;});
    for(let attempt=0;attempt<20&&!fits();attempt++){p.width*=.95;p.height*=.95;}
    if(!fits()||p.width<(p.kind==='city'?9:15))throw Error('Unsafe composition '+cell+' '+dx+','+dy);

   }
   out.push(p);
  }
 }
 return out;
}

/** Broad, feathered material masses. No new linear tracks, crossings or settlement symbols. */
export function paintSettlementGround(ctx:CanvasRenderingContext2D,data:SliceData,list:Placement[]){
 const polygon=(points:Point[])=>{ctx.moveTo(points[0]!.x,points[0]!.y);for(const p of points.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();};
 const wash=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,.1,0,0,1);g.addColorStop(0,color);g.addColorStop(.5,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();};
 ctx.save();ctx.beginPath();data.hexes.filter(inSettlement).forEach(h=>polygon(hexPolygon(h.coord)));ctx.clip();
 const city=hexToPixel(data.hexes.find(h=>label(h.coord)==='X14')!.coord);
 // One readable town ground mass and broad cultivated approach, not a halo per tiny house.
 wash(city.x,city.y+13,43,34,'rgba(153,132,99,.53)');
 wash(city.x-11,city.y+18,26,16,'rgba(190,170,134,.60)');
 wash(city.x+12,city.y+19,22,15,'rgba(181,160,123,.52)');
 wash(city.x,city.y-25,14,17,'rgba(164,145,111,.48)');
 wash(city.x-27,city.y-13,14,17,'rgba(153,135,103,.43)');
 wash(city.x+28,city.y-13,14,17,'rgba(153,135,103,.43)');
 // Forest litter and damp meadow extend under the existing bank/transport paint, unifying seams.
 for(const cell of ['W13','V13']){const h=data.hexes.find(h=>label(h.coord)===cell)!,c=hexToPixel(h.coord);wash(c.x,c.y,49,48,'rgba(57,72,42,.27)');for(const p of list.filter(p=>p.cell===cell))wash(p.x+2,p.y+3,p.width*.67,p.height*.64,'rgba(31,49,35,.28)');}
 for(const cell of ['W14','V14','Y15']){const h=data.hexes.find(h=>label(h.coord)===cell)!,c=hexToPixel(h.coord);wash(c.x+13,c.y+12,43,27,'rgba(87,83,52,.22)');wash(c.x-12,c.y-12,33,27,'rgba(171,157,108,.22)');}
 for(const lane of corridors(data).filter(l=>l.kind==='river')){
  // Only segments near this small composition; broad banks fade rather than add a new hard ribbon.
  if(!data.hexes.filter(inSettlement).some(h=>{const c=hexToPixel(h.coord);return Math.hypot(c.x-(lane.a.x+lane.b.x)/2,c.y-(lane.a.y+lane.b.y)/2)<60;}))continue;
  for(let i=0;i<=4;i++){const t=i/4,x=lane.a.x+(lane.b.x-lane.a.x)*t,y=lane.a.y+(lane.b.y-lane.a.y)*t;wash(x,y,19,19,'rgba(60,83,58,.17)');}
 }
 ctx.restore();
}
