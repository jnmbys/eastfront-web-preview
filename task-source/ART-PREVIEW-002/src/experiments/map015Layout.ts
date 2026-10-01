import {hexKey,hexNeighbors,hexToPixel,hexPolygon,sharedHexEdge,type Point} from '../geometry/hex.js';
import {corridors,inside,label,segmentDistance,type SliceData} from './mapData.js';
import {settlementCells} from './blend011Layout.js';
import type {Placement} from './blend011Terrain.js';
import {vs2RectangleSegmentDistance} from '../render/vs2Projection.js';

const city=(t:string)=>t.includes('CITY');
const natural=(t:string)=>t==='FOREST'||t==='HILL'||t==='ROUGH';
/** Coordinate-derived art choice only: no engine RNG calls or state changes. */
const style=(h:SliceData['hexes'][number])=>Math.abs(h.coord.q*31+h.coord.r*17);
export function worldContext(data:SliceData){
 const byKey=new Map(data.hexes.map(h=>[hexKey(h.coord),h])),lanes=corridors(data);
 return data.hexes.map(h=>{const c=hexToPixel(h.coord);return {h,c,
  neighbors:hexNeighbors(h.coord).flatMap(p=>byKey.has(hexKey(p))?[byKey.get(hexKey(p))!]:[]),
  lanes:lanes.filter(l=>segmentDistance(c,l.a,l.b)<85)};});
}

/** Replaces the old global scatter. X14 and the seven approved neighbors are golden. */
export function composeWorld(data:SliceData,approved:Placement[],preserveReference=true):Placement[]{
 const out=approved.filter(p=>preserveReference&&settlementCells.has(p.cell)),units=data.counters.map(u=>hexToPixel(u.hex));
 for(const {h,c,neighbors,lanes} of worldContext(data)){
  const cell=label(h.coord);if(preserveReference&&settlementCells.has(cell))continue;
  const s=style(h),poly=hexPolygon(h.coord);
  if(natural(h.terrain)){
   const same=neighbors.filter(n=>h.terrain==='FOREST'?n.terrain==='FOREST':n.terrain==='HILL'||n.terrain==='ROUGH');
   const toward=same.length?hexToPixel(same[s%same.length]!.coord):c;
   const dx=(toward.x-c.x)*.08,dy=(toward.y-c.y)*.08,forest=h.terrain==='FOREST';
   out.push({cell,kind:forest?'forest':h.terrain,x:c.x+dx+(s%3-1)*3,y:c.y+dy-4,width:forest?64+(s%3)*3:60+(s%4)*3,height:forest?55+(s%3)*4:h.terrain==='ROUGH'?58+(s%3)*4:46+(s%3)*4,tile:forest?2:h.terrain==='ROUGH'?1:s%2});
   // One edge canopy, directed toward real neighboring forest or an open local edge.
   if(forest)out.push({cell,kind:'forest',x:c.x-dx+(s%2?8:-8),y:c.y+17-dy*.4,width:44+Math.min(3,same.length)*4,height:28+(s%3)*3,tile:3});
   continue;
  }
  if(!city(h.terrain))continue;
  // Related U, L and paired-yard motifs. Only centers vary orientation; baked
  // roof pixels keep the same light direction and are never mirrored/rotated.
  const motifs=[
   [[-17,-9,16,15],[-17,7,16,15],[-8,17,18,11],[10,17,18,11],[20,5,13,16],[19,-12,15,13]],
   [[-19,-13,16,14],[-19,2,16,16],[-12,17,21,12],[9,17,21,12],[19,-10,16,15]],
   [[-22,-11,14,13],[-7,-17,17,11],[12,-17,19,11],[23,-3,13,15],[-23,7,14,14],[-10,15,18,11],[10,15,18,11],[23,12,13,12]]
  ];
  const motif=motifs[city(h.terrain)&&h.terrain!=='CITY'?2:s%2]!;
  let best:Placement[]=[],bestScore=-Infinity;
  for(let attempt=0;attempt<8;attempt++){
   const turn=(attempt+s)%4,shift=attempt<4?-3:3;
   const candidates:Placement[]=[];
   for(let i=0;i<motif.length;i++){
    const [x,y,w,height]=motif[i]!,rx=turn===0?x!:turn===1?-y!:turn===2?-x!:y!,ry=turn===0?y!:turn===1?x!:turn===2?-y!:-x!;
    const p:Placement={cell,kind:'city',x:c.x+rx,y:c.y+ry+shift,width:w!,height:height!,roof:(i+s)%3};
    const fits=()=>[-1,1].every(a=>[-1,1].every(b=>inside({x:p.x+a*p.width/2,y:p.y+b*p.height/2},poly)))
     &&!lanes.some(l=>vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)<l.width+2)
     &&!units.some(u=>Math.abs(p.x-u.x)<34+p.width/2&&Math.abs(p.y-u.y)<34+p.height/2)
     &&!(Math.abs(p.x-c.x)<10+p.width/2&&Math.abs(p.y-c.y-29)<5+p.height/2)
     &&!candidates.some(q=>Math.abs(p.x-q.x)<(p.width+q.width)*.44&&Math.abs(p.y-q.y)<(p.height+q.height)*.44);
    for(let j=0;j<6&&!fits();j++){p.width*=.94;p.height*=.94;}
    if(fits()&&p.width>=9&&p.height>=8)candidates.push(p);
   }
   const area=candidates.reduce((a,p)=>a+p.width*p.height,0),score=area+candidates.length*30;
   if(score>bestScore){best=candidates;bestScore=score;}
  }
  // Extend surviving wings into actual free pockets instead of dropping a
  // complete courtyard on top of an intersection. Bounded candidates, no scatter.
  const pockets:Placement[]=[];
  for(let y=-29;y<=24;y+=5)for(let x=-29;x<=29;x+=5){
   const p:Placement={cell,kind:'city',x:c.x+x+(s%3-1),y:c.y+y,width:11+(s%2),height:10+(s%3),roof:(s+Math.abs(x+y))%3};
   if(![-1,1].every(a=>[-1,1].every(b=>inside({x:p.x+a*p.width/2,y:p.y+b*p.height/2},poly))))continue;
   if(lanes.some(l=>vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)<l.width+2))continue;
   if(units.some(u=>Math.abs(p.x-u.x)<34+p.width/2&&Math.abs(p.y-u.y)<34+p.height/2))continue;
   if(Math.abs(p.x-c.x)<10+p.width/2&&Math.abs(p.y-c.y-29)<5+p.height/2)continue;
   pockets.push(p);
  }
  const limit=h.terrain==='CITY'?9:12;
  while(best.length<limit){
   const available=pockets.filter(p=>!best.some(q=>Math.abs(p.x-q.x)<(p.width+q.width)/2+.25&&Math.abs(p.y-q.y)<(p.height+q.height)/2+.25));
   if(!available.length)break;
   const gap=(p:Placement)=>best.length?Math.min(...best.map(q=>Math.hypot(Math.max(0,Math.abs(p.x-q.x)-(p.width+q.width)/2),Math.max(0,Math.abs(p.y-q.y)-(p.height+q.height)/2)))):Math.hypot(p.x-c.x,p.y-c.y);
   available.sort((a,b)=>gap(a)-gap(b)||a.y-b.y||a.x-b.x);best.push(available[0]!);
  }
  out.push(...best);
 }
 return out;
}

/** Draw broad material shoulders directly into the existing map canvas. No per-cell
 * canvases, new plant symbols on plains, new paths, or extra decorative scatter. */
export function paintWorldGround(ctx:CanvasRenderingContext2D,data:SliceData,list:Placement[],preserveReference=true){
 const path=(poly:Point[])=>{ctx.moveTo(poly[0]!.x,poly[0]!.y);for(const p of poly.slice(1))ctx.lineTo(p.x,p.y);ctx.closePath();};
 const wash=(x:number,y:number,rx:number,ry:number,color:string)=>{ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,.05,0,0,1);g.addColorStop(0,color);g.addColorStop(.45,color);g.addColorStop(1,'transparent');ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();};
 const grouped=new Map<string,Placement[]>();for(const p of list)grouped.set(p.cell,[...(grouped.get(p.cell)??[]),p]);
 for(const {h,c,neighbors,lanes} of worldContext(data)){
  const cell=label(h.coord);if((preserveReference&&settlementCells.has(cell))||h.terrain==='LAKE')continue;
  ctx.save();ctx.beginPath();path(hexPolygon(h.coord));ctx.clip();
  const local=grouped.get(cell)??[],forest=h.terrain==='FOREST';
  for(const p of local.filter(p=>p.kind!=='city')){
   wash(p.x,p.y+3,p.width*.68,p.height*.72,forest?'rgba(73,88,48,.43)':'rgba(153,144,98,.36)');
   wash(p.x+6,p.y+8,p.width*.48,p.height*.44,forest?'rgba(46,58,39,.24)':'rgba(46,58,39,.13)');
  }
  if(city(h.terrain)){
   wash(c.x,c.y,43,39,'rgba(154,133,90,.72)');
   wash(c.x,c.y+4,29,25,'rgba(198,177,125,.63)');
   for(const p of local)wash(p.x,p.y+2,p.width*.68,p.height*.65,'rgba(185,165,122,.40)');
  }
  for(const n of neighbors){
   const edge=sharedHexEdge(h.coord,n.coord)!,m={x:(edge[0].x+edge[1].x)/2,y:(edge[0].y+edge[1].y)/2};
   // Both sides derive the same broad edge soil; true type remains in the canopy/relief.
   if(h.terrain==='FOREST'||n.terrain==='FOREST')wash(m.x,m.y,24,24,'rgba(80,96,55,.21)');
   else if(natural(h.terrain)||natural(n.terrain))wash(m.x,m.y,24,21,'rgba(153,144,98,.16)');
   if(city(h.terrain)&&city(n.terrain))wash(m.x,m.y,27,27,'rgba(174,152,106,.46)');
  }
  // Broad moist soil under the unchanged water and bridge passes; no new channel.
  for(const l of lanes.filter(l=>l.kind==='river')){
   ctx.lineCap='round';ctx.lineJoin='round';
   for(const [width,color] of [[l.width*2+23,h.terrain==='MARSH'?'rgba(66,99,65,.22)':'rgba(66,99,65,.14)'],[l.width*2+11,'rgba(143,135,91,.22)']] as const){ctx.beginPath();ctx.moveTo(l.a.x,l.a.y);ctx.lineTo(l.b.x,l.b.y);ctx.lineWidth=width;ctx.strokeStyle=color;ctx.stroke();}
  }
  ctx.restore();
 }
}
