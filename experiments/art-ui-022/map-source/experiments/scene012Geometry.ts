import {hexPolygon,hexToPixel,sharedHexEdge,type Point} from '../geometry/hex.js';
import {inside,segmentDistance,type SliceData} from './mapData.js';
import {inSettlement} from './dioramaLayout.js';

/** Visual-only bounded displacement. Canonical edges and bridge registry remain inputs. */
export function sceneGeometry(data:SliceData){
 const polys=data.hexes.filter(inSettlement).map(h=>hexPolygon(h.coord));
 const edges=new Map<string,{a:Point;b:Point;count:number}>();
 const key=(p:Point)=>p.x.toFixed(4)+','+p.y.toFixed(4);
 for(const poly of polys)for(let i=0;i<6;i++){const a=poly[i]!,b=poly[(i+1)%6]!,k=[key(a),key(b)].sort().join('|');const e=edges.get(k);if(e)e.count++;else edges.set(k,{a,b,count:1});}
 const boundary=[...edges.values()].filter(e=>e.count===1);
 const bridges=data.edges.filter(e=>e.bridge&&!e.bridge.destroyed).map(e=>{const p=sharedHexEdge(e.a,e.b)!;return {x:(p[0].x+p[1].x)/2,y:(p[0].y+p[1].y)/2};});
 const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 const weight=(p:Point)=>polys.some(poly=>inside(p,poly))?smooth(8,18,Math.min(...boundary.map(e=>segmentDistance(p,e.a,e.b)))):0;
 const bridgeWeight=(p:Point)=>smooth(11,23,Math.min(...bridges.map(b=>Math.hypot(b.x-p.x,b.y-p.y))));
 const water=(points:Point[])=>points.map((p,i)=>{const a=points[Math.max(0,i-1)]!,b=points[Math.min(points.length-1,i+1)]!,dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;const d=1.45*Math.sin(p.x*.064+p.y*.053)*weight(p)*bridgeWeight(p);return {x:p.x-dy/l*d,y:p.y+dx/l*d};});
 const route=(e:SliceData['edges'][number])=>{const a=hexToPixel(e.a),b=hexToPixel(e.b),dx=b.x-a.x,dy=b.y-a.y,l=Math.hypot(dx,dy)||1;return Array.from({length:33},(_,i)=>{const t=i/32,p={x:a.x+dx*t,y:a.y+dy*t};const d=1.6*Math.sin(Math.PI*t)**2*Math.sin((a.x+b.y)*.13)*weight(p)*bridgeWeight(p);return {...p,x:p.x-dy/l*d,y:p.y+dx/l*d,t};});};
 return {weight,bridgeWeight,water,route};
}
