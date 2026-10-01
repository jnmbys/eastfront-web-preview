import {hexToPixel,hexPolygon,type Point} from '../geometry/hex.js';
import {corridors,label,inside,segmentDistance,type SliceData} from './mapData.js';
import {composeSettlement as compose009,settlementCells,inSettlement} from './dioramaLayout.js';
import type {Placement} from './blend011Terrain.js';
import {vs2RectangleSegmentDistance} from '../render/vs2Projection.js';
export {settlementCells,inSettlement};

// Continuous canopies and distinct ridge profiles replace repeated small hill/tree stamps.
// Rectangles are visual envelopes; actual alpha is clipped to terrain and public clearances.
export function composeSettlement(data:SliceData,base:Placement[],scene:boolean|'014'=false):Placement[]{
 const implement=scene==='014';
 const old=compose009(data,base),list:Placement[]=old.filter(p=>!settlementCells.has(p.cell)||p.kind==='city');
 const specs:Record<string,number[][]>={
  W14:[[-3,-5,76,49,0]], V14:[[0,3,58,69,1]], Y15:[[2,-1,72,37,1]],
  W13:[[-6,-21,63,30,2],[10,20,51,27,3]],
  V13:[[-5,-3,65,61,2],[8,17,52,33,3]]
 };
 if(implement){
  // Keep the seven original mass stamps; reposition their volume, not extra ornament.
  specs.W14=[[-5,-12,74,52,0]];specs.V14=[[-2,4,56,70,1]];
  specs.W13=[[-5,-20,62,37,2],[9,19,56,32,3]];
  specs.V13=[[-5,-4,68,64,2],[7,19,51,35,3]];
 }
 for(const h of data.hexes.filter(inSettlement)){
  const cell=label(h.coord),c=hexToPixel(h.coord);
  for(const [dx,dy,width,height,tile] of specs[cell]??[])list.push({cell,kind:h.terrain==='FOREST'?'forest':h.terrain,x:c.x+dx!,y:c.y+dy!,width:width!,height:height!,tile:tile!});
 }
 if(scene){
  const town=data.hexes.find(h=>label(h.coord)==='X14')!,c=hexToPixel(town.coord),poly=hexPolygon(town.coord),lanes=corridors(data);
  const blocks=implement?[
   [-25,-14,19,18,0],[25,-14,19,18,0],
   // Two stepped wings meet a southern range around one shared open court.
   [-23,13,20,12,0],[23,13,20,12,2],
   [-16,20,20,14,0],[16,20,20,14,2],
   [-7,26,18,10,0],[7,26,18,10,2]
  ]:[[-25,-14,13,15,1],[24,-14,13,15,0],[-28,11,12,14,0],[-16,14,13,14,2],[16,14,13,14,1],[28,11,12,14,2],[-13,26,11,12,1],[-5,32,9,10,0],[5,32,9,10,2],[13,26,11,12,0],[0,15,16,17,3]];
  const roofs:Placement[]=blocks.map(([x,y,w,h,roof])=>({cell:'X14',kind:'city',x:c.x+x!,y:c.y+y!,width:w!,height:h!,roof:roof!}));
  for(const p of roofs){const fits=()=>[-1,1].every(a=>[-1,1].every(b=>inside({x:p.x+a*p.width/2,y:p.y+b*p.height/2},poly)))&&!lanes.some(l=>vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)<l.width+2)&&!data.counters.some(u=>{const q=hexToPixel(u.hex);return Math.abs(q.x-p.x)<34+p.width/2&&Math.abs(q.y-p.y)<34+p.height/2;});for(let i=0;i<20&&!fits();i++){p.width*=.96;p.height*=.96;}if(!fits())throw Error('Scene roof clearance '+JSON.stringify(p));}
  return [...list.filter(p=>p.cell!=='X14'),...roofs];
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

const smooth=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const noise=(x:number,y:number)=>Math.sin(x*.17+y*.11)*.55+Math.sin(x*.39-y*.23)*.25+Math.cos(x*.073-y*.13)*.20;

/** Bake soft clearance shoulders into each original static stamp, before the strict
 * 010 ownership clip. No transport geometry or public hit polygon is changed. */
export function bakeNatural(source:HTMLCanvasElement,p:Placement,data:SliceData,scene:boolean|'014'=false){
 const tile=document.createElement('canvas'),scale=3;tile.width=Math.ceil(p.width*scale);tile.height=Math.ceil(p.height*scale);
 const ctx=tile.getContext('2d')!;
 if(scene==='014'){ctx.shadowColor='rgba(28,37,26,.38)';ctx.shadowOffsetX=3;ctx.shadowOffsetY=5;ctx.shadowBlur=5;}
 ctx.drawImage(source,0,0,tile.width,tile.height);ctx.shadowColor='transparent';
 const h=data.hexes.find(h=>label(h.coord)===p.cell)!,poly=hexPolygon(h.coord),c=hexToPixel(h.coord);
 const lanes=corridors(data).filter(l=>segmentDistance(p,l.a,l.b)<65),units=data.counters.map(u=>hexToPixel(u.hex)).filter(u=>Math.hypot(u.x-c.x,u.y-c.y)<100);
 const pixels=ctx.getImageData(0,0,tile.width,tile.height),a=pixels.data;
 for(let y=0;y<tile.height;y++)for(let x=0;x<tile.width;x++){
  const q={x:p.x-p.width/2+(x+.5)/tile.width*p.width,y:p.y-p.height/2+(y+.5)/tile.height*p.height};
  let margin=Math.min(...poly.map((v,i)=>segmentDistance(q,v,poly[(i+1)%6]!)));
  if(!inside(q,poly))margin=0;
  for(const l of lanes)margin=Math.min(margin,segmentDistance(q,l.a,l.b)-l.width-.8);
  for(const u of units)margin=Math.min(margin,Math.max(Math.abs(q.x-u.x)-34,Math.abs(q.y-u.y)-34));
  const feather=scene==='014'?(p.kind==='forest'?4.6:3.0):scene?(p.kind==='forest'?3.7:3.0):(p.kind==='forest'?6.5:9);
  const alpha=smooth(0,feather+noise(q.x,q.y)*1.4,margin);
  a[(y*tile.width+x)*4+3]=Math.round(a[(y*tile.width+x)*4+3]!*alpha);
 }
 ctx.putImageData(pixels,0,0);return tile;
}

/** A single bounded material field replaces 009+010 stacked ground/bank washes.
 * Broad weights meet across internal hex edges; only the region's outer boundary
 * fades. Dirt/litter is visual surface, never a new road, obstacle or terrain type. */
export function paintSettlementGround(ctx:CanvasRenderingContext2D,data:SliceData,list:Placement[],scene:boolean|'014'=false){
 const local=data.hexes.filter(inSettlement),polys=local.map(h=>hexPolygon(h.coord));
 const edges=new Map<string,{a:Point;b:Point;n:number}>();
 const key=(p:Point)=>p.x.toFixed(4)+','+p.y.toFixed(4);
 for(const poly of polys)for(let i=0;i<6;i++){const a=poly[i]!,b=poly[(i+1)%6]!,k=[key(a),key(b)].sort().join('|'),e=edges.get(k);if(e)e.n++;else edges.set(k,{a,b,n:1});}
 const boundary=[...edges.values()].filter(e=>e.n===1),points=polys.flat(),minX=Math.floor(Math.min(...points.map(p=>p.x))),minY=Math.floor(Math.min(...points.map(p=>p.y))),maxX=Math.ceil(Math.max(...points.map(p=>p.x))),maxY=Math.ceil(Math.max(...points.map(p=>p.y)));
 const scale=2,can=document.createElement('canvas');can.width=(maxX-minX)*scale;can.height=(maxY-minY)*scale;const b=can.getContext('2d')!,im=b.createImageData(can.width,can.height),a=im.data;
 const natural=list.filter(p=>settlementCells.has(p.cell)&&p.kind!=='city'),city=hexToPixel(local.find(h=>label(h.coord)==='X14')!.coord);
 const rivers=corridors(data).filter(l=>l.kind==='river'&&local.some(h=>segmentDistance(hexToPixel(h.coord),l.a,l.b)<70));
 for(let y=0;y<can.height;y++)for(let x=0;x<can.width;x++){
  const p={x:minX+(x+.5)/scale,y:minY+(y+.5)/scale};if(!polys.some(poly=>inside(p,poly)))continue;
  const fade=smooth(0,6,Math.min(...boundary.map(e=>segmentDistance(p,e.a,e.b))));if(!fade)continue;
  const n=noise(p.x,p.y);let alpha=0,red=0,green=0,blue=0;
  const mix=(r:number,g:number,b:number,w:number)=>{w=Math.max(0,Math.min(.85,w));red=r*w+red*(1-w);green=g*w+green*(1-w);blue=b*w+blue*(1-w);alpha=w+alpha*(1-w);};
  for(const v of natural){const forest=v.kind==='forest',dx=(p.x-v.x-2)/(v.width*.67),dy=(p.y-v.y-4)/(v.height*.73),dist=Math.hypot(dx,dy);const w=(1-smooth(.40+n*.07,1.22,dist));if(w>0){
   if(scene==='014'){
    // Broad soil/litter shoulder and downhill contact shade share the existing bake.
    const facing=(p.x-v.x)/v.width+(p.y-v.y)/v.height;
    mix(forest?73:153,forest?88:144,forest?48:98,w*(forest?.46:.40));
    mix(46,58,39,w*smooth(-.12,.55,facing)*(forest?.24:.15));
   }else mix(forest?64:147,forest?79:139,forest?42:88,w*(forest?.40:.30));
  }}
  // Continuous town surface meets only existing transport; no line or invented entrance.
  const town=Math.hypot((p.x-city.x)/44,(p.y-city.y-13)/37),court=Math.hypot((p.x-city.x+2)/29,(p.y-city.y-22)/21);
  mix(154,133,90,(1-smooth(.55,1.25+n*.06,town))*(scene?.76:.62));
  mix(198,177,125,(1-smooth(.35,1.16,court))*(scene==='014'?.74:scene?.66:.52));
  if(scene==='014'){
   const dx=p.x-city.x,dy=p.y-city.y;
   // One warm paving surface ties the wings together; its northern mouth meets
   // the existing transport axis. No added lane, wall or obstacle symbol.
   const courtShape=Math.max(Math.abs(dx)/22,Math.abs(dy-18)/13);
   mix(185,165,122,(1-smooth(.68,1.12,courtShape))*.68);
   const seam=(Math.abs(Math.sin((dx+dy*.45)*.76))<.10)?.045:0;
   mix(112,105,78,(1-smooth(.7,1,courtShape))*seam);
  }
  const distance=Math.min(...rivers.map(l=>segmentDistance(p,l.a,l.b)));
  const width=7.5+2.0*Math.sin(p.x*.082+p.y*.047)+.8*n;
  mix(66,99,65,(1-smooth(width+1,width+(scene==='014'?14:11),distance))*(scene==='014'?.40:.32));
  // Asymmetric sunlit silt/earth skirt with a bounded, smoothly varying width.
  mix(143+8*n,135+7*n,91+4*n,(1-smooth(width-1,width+3.5,distance))*.53);
  mix(96,111,77,(1-smooth(3.4,5.6,distance))*.30);
  const i=(y*can.width+x)*4;if(alpha){a[i]=red/alpha;a[i+1]=green/alpha;a[i+2]=blue/alpha;a[i+3]=255*alpha*fade;}
 }
 b.putImageData(im,0,0);ctx.save();ctx.beginPath();polys.forEach(poly=>polygon(ctx,poly));ctx.clip();ctx.drawImage(can,minX,minY,maxX-minX,maxY-minY);ctx.restore();
 return {groundFieldBytes:can.width*can.height*4,groundFieldPixels:can.width*can.height};
}
// River shore material is already baked into the one ground field; no second wash layer.
export function paintNaturalBanks(_ctx:CanvasRenderingContext2D,_data:SliceData){}
