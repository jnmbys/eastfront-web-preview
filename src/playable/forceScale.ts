export type ScaleMode='far'|'middle'|'near';
export type Point={x:number;y:number};
export type DisplayUnit={id:string;side:string;hex:{q:number;r:number};type:string};
export type ForceGroup={key:string;affiliation:string;name:string;color:string;units:DisplayUnit[];at:Point;crossHex:boolean};
/** Width of an on-screen hex, not a nominal zoom slider. Exit bands keep wheel jitter from changing modes. */
export function scaleMode(hexPixels:number,previous?:ScaleMode):ScaleMode {
 if(previous==='far'&&hexPixels<38)return 'far';if(previous==='near'&&hexPixels>57)return 'near';
 if(previous==='middle'&&hexPixels>=31&&hexPixels<=69)return 'middle';return hexPixels<34?'far':hexPixels>63?'near':'middle';
}
const distance=(a:any,b:any)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
/** Own current corps only. Direct control overrides the historical roster. Enemies have no inferred corps. */
export function forceAffiliation(u:DisplayUnit,viewer:string,corps:any[],ownUnits:Record<string,any>){
 if(u.side!==viewer)return {id:'enemy:'+u.side,name:'已识别敌军',color:'#be8a7b'};
 const i=ownUnits[u.id]?.direct?-1:corps.findIndex(g=>g.members.includes(u.id));
 return i<0?{id:'direct:'+viewer,name:'直属部队',color:'#b5bbb0'}:{id:corps[i].id,name:corps[i].name,color:['#8fb9c9','#c6a58d','#b1b889'][i%3]!};
}
export function groupForces(units:DisplayUnit[],viewer:string,corps:any[],ownUnits:Record<string,any>,mode:ScaleMode,scale:number,point:(h:any)=>Point):ForceGroup[]{
 const result:ForceGroup[]=[];
 for(const u of [...new Map(units.map(u=>[u.id,u])).values()].sort((a,b)=>a.id.localeCompare(b.id))){const aff=forceAffiliation(u,viewer,corps,ownUnits),at=point(u.hex);
  const group=result.find(g=>g.affiliation===aff.id&&g.units.every(v=>{const d=distance(v.hex,u.hex);if(mode==='near')return d===0;if(d>(mode==='far'?4:3))return false;const p=point(v.hex);return Math.hypot(p.x-at.x,p.y-at.y)*scale<=(mode==='far'?120:64);}));
  if(group)group.units.push(u);else result.push({key:aff.id+':'+u.id,affiliation:aff.id,name:aff.name,color:aff.color,units:[u],at,crossHex:false});
 }
 for(const g of result){const ps=g.units.map(u=>point(u.hex));g.at={x:ps.reduce((s,p)=>s+p.x,0)/ps.length,y:ps.reduce((s,p)=>s+p.y,0)/ps.length};g.crossHex=new Set(g.units.map(u=>u.hex.q+','+u.hex.r)).size>1;}
 return result;
}
/** Match identities by surviving members; position follows real members, never source array order. */
export function retainGroupKeys(next:ForceGroup[],previous:ForceGroup[]){const used=new Set<string>();for(const g of next){const ids=new Set(g.units.map(u=>u.id)),best=previous.filter(x=>x.affiliation===g.affiliation&&!used.has(x.key)).map(x=>({x,n:x.units.filter(u=>ids.has(u.id)).length})).sort((a,b)=>b.n-a.n||a.x.key.localeCompare(b.x.key))[0];if(best?.n){g.key=best.x.key;}while(used.has(g.key))g.key+='~'+g.units[0]!.id;used.add(g.key);}return next;}

/** R1: a marker is a physical hex, not a screen-distance cluster. No zoom input. */
export function fixedHexForces(units:DisplayUnit[],viewer:string,corps:any[],ownUnits:Record<string,any>,point:(h:any)=>Point):ForceGroup[]{
 const cells=new Map<string,ForceGroup>();
 for(const u of [...new Map(units.map(u=>[u.id,u])).values()].sort((a,b)=>a.id.localeCompare(b.id))){
  const key=u.hex.q+','+u.hex.r,aff=forceAffiliation(u,viewer,corps,ownUnits);let g=cells.get(key);
  if(!g){g={key:'hex:'+key,affiliation:aff.id,name:aff.name,color:aff.color,units:[],at:point(u.hex),crossHex:false};cells.set(key,g);}
  g.units.push(u);
  if(g.affiliation!==aff.id){g.affiliation='mixed';g.name='同格部队';g.color='#aebac0';}
 }
 return [...cells.values()];
}
