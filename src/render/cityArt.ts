import {hexToPixel,hexPolygon,hexNeighbors,sharedHexEdge,hexKey,type Point} from '../geometry/hex.js';
export const CITY_ART_VERSION='city-art-002-f3-1';
export type CityLod='far'|'medium'|'close';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const n=(x:number)=>Number(x.toFixed(2));
const pt=(p:Point)=>`${n(p.x)},${n(p.y)}`;
const coord=(key:string)=>{const[q,r]=key.split(',').map(Number);return {q:q!,r:r!};};
const line=(a:Point,b:Point,color:string,w:number,extra='')=>`<path d="M${pt(a)} L${pt(b)}" fill="none" stroke="${color}" stroke-width="${w}" ${extra}/>`;
const rect=(x:number,y:number,w:number,h:number,fill:string,extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra}/>`;
const circle=(x:number,y:number,r:number,fill:string,extra='')=>`<circle cx="${n(x)}" cy="${n(y)}" r="${r}" fill="${fill}" ${extra}/>`;
const poly=(points:Point[],fill:string,extra='')=>`<polygon points="${points.map(pt).join(' ')}" fill="${fill}" ${extra}/>`;
/** F3 light roof / shaded lower roof, cream walls, southeast cast shadow. World units, not icons. */
export function building(x:number,y:number,w:number,h:number,lod:CityLod,kind='house'):string{
 const factory=kind==='factory',civic=kind==='civic',roof=factory?'#9aaba3':civic?'#9ea99b':'#b78460',dark=factory?'#516660':civic?'#526960':'#76543f';
 let s=rect(x+2,y+2,w+1,h+3,'#353d32','opacity=".28"')+rect(x-.7,y-.7,w+1.4,h+2.8,'#c4b18c')+rect(x,y+h*.48,w,h*.6,'#dac7a2')+rect(x+w-.8,y+h*.48,.8,h*.6,'#87765d');
 s+=`<path d="M${x} ${y+h*.48} L${x+w*.13} ${y} H${x+w*.87} L${x+w} ${y+h*.48}Z" fill="${roof}"/><path d="M${x} ${y+h*.48} H${x+w} L${x+w*.87} ${y+h*.85} H${x+w*.13}Z" fill="${dark}"/>`;
 if(lod!=='far'){
  s+=line({x:x+.5,y:y+h*.48},{x:x+w-.5,y:y+h*.48},'#ddd0ad',.24);
  for(let i=1;i<w/2;i++)s+=rect(x+i*2-.6,y+h*.88,.65,.65,'#394b48');
  if(factory)s+=rect(x+w*.15,y+h*.86,w*.26,h*.23,'#504f45')+rect(x+w*.67,y-4,1.5,6,'#766455')+rect(x+w*.67,y-4,1.5,.7,'#d0bda0');
  else s+=rect(x+w*.46,y+h*.83,1.4,h*.3,'#695846');
 }
 if(lod==='close'){
  for(let i=1;i<w;i+=1.2)s+=line({x:x+i,y:y+.45},{x:x+i+.7,y:y+h*.43},'#d9c7a4',.12,'opacity=".5"');
  for(let i=1;i<h*.4;i+=.8)s+=line({x:x+w*.16,y:y+i},{x:x+w*.84,y:y+i},dark,.12,'opacity=".35"');
  if(factory)for(let i=2;i<w-2;i+=3)s+=rect(x+i,y+h*.17,1.5,h*.17,'#b1c4bf','stroke="#596b64" stroke-width=".2"');
 }
 if(civic){s+=rect(x+w*.33,y+h*.9,w*.34,1.8,'#e2d2ae');for(let i=0;i<4;i++)s+=rect(x+w*.35+i*w*.08,y+h*.58,.5,h*.42,'#efe1bd');s+=circle(x+w*.5,y+h*.44,1,'#d1cda9','stroke="#4a635c" stroke-width=".3"');}
 return `<g data-building="${kind}">${s}</g>`;
}
function tree(x:number,y:number,r=1.7){return circle(x+.7,y+1,r,'#40503c','opacity=".3"')+circle(x,y,r,'#71805a')+circle(x-.35,y-.4,r*.67,'#8e986a');}
function routeVectors(d:any,edges:any[]){const h=coord(d.hex),center=hexToPixel(h);return edges.filter(e=>(hexKey(e.a)===d.hex||hexKey(e.b)===d.hex)&&(e.road||e.railway?.present||e.river)).map(e=>{const other=hexKey(e.a)===d.hex?e.b:e.a,p=hexToPixel(other),len=Math.hypot(p.x-center.x,p.y-center.y);return {edge:e,x:(p.x-center.x)/len,y:(p.y-center.y)/len};});}
const distanceRay=(x:number,y:number,v:{x:number;y:number})=>{const t=Math.max(0,Math.min(42,x*v.x+y*v.y));return Math.hypot(x-t*v.x,y-t*v.y);};
export function facilitySlots(d:any,edges:any[]):Point[]{const roads=routeVectors(d,edges).filter(v=>v.edge.road||v.edge.railway?.present),points:Point[]=[];
 for(const y of [-17,16,-3,26,-26])for(const x of [-18,17,0])if(Math.hypot(x,y)<30&&roads.every(v=>distanceRay(x,y,v)>10)&&points.every(p=>Math.hypot(p.x-x,p.y-y)>15))points.push({x,y});
 for(const p of [{x:-18,y:-17},{x:17,y:16},{x:17,y:-17},{x:-18,y:16}])if(points.length<d.slots&&points.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>12))points.push(p);
 return points.slice(0,d.slots);
}
function pavement(d:any,lod:CityLod){const shape=[{x:-29,y:-18},{x:-17,y:-28},{x:15,y:-26},{x:29,y:-9},{x:26,y:19},{x:7,y:30},{x:-21,y:24},{x:-30,y:8}];const palette:any={MAIN:'#b9ad8a',STATION:'#a49f86',INDUSTRIAL:'#a19b82',RESIDENTIAL:'#9aa17a'};let out=poly(shape,palette[d.type]??palette.MAIN,'opacity=".88"');
 if(lod==='close'){for(let y=-24;y<=24;y+=2.5)for(let x=-24;x<=24;x+=3.1)if(Math.hypot(x,y)<26)out+=rect(x+((y%2)*.4),y,2.3,.14,d.type==='RESIDENTIAL'?'#839369':'#d1c3a4','opacity=".36"');}
 return out;
}
export function districtScene(d:any,edges:any[],lod:CityLod):string{
 const routes=routeVectors(d,edges),streets=routes.filter(v=>v.edge.road||v.edge.railway?.present);let s=pavement(d,lod);
 const slots=facilitySlots(d,edges);const safe=(x:number,y:number,w:number,h:number)=>streets.every(v=>distanceRay(x+w/2,y+h/2,v)>Math.max(w,h)/2+2)&&slots.every(p=>Math.hypot(p.x-(x+w/2),p.y-(y+h/2))>10);
 const house=(x:number,y:number,w:number,h:number,k='house')=>{if(safe(x,y,w,h))s+=building(x,y,w,h,lod,k);};
 const path=(a:Point,b:Point,w=2)=>{s+=line(a,b,'#8f866c',w+1)+line(a,b,'#cdbb94',w);};
 if(d.type==='MAIN'){
  s+=rect(-12,-10,24,23,'#d3c6a4','rx="2" stroke="#9b9378" stroke-width=".7"');
  if(lod!=='far')s+=circle(1,6,3,'#a6af9b','stroke="#efdbb3" stroke-width="1"')+circle(1,6,1,'#566c62');
  // Civic hall offsets from the center corridor; never a factory instance.
  const civic=streets.some(v=>distanceRay(0,-16,v)<10)?{x:-25,y:7}:{x:-10,y:-23};s+=building(civic.x,civic.y,20,10,lod,'civic');
  for(const y of [-23,-13,14,23])for(const x of [-25,-15,10,20])house(x,y,7,5);
  path({x:-28,y:1},{x:27,y:1},3);path({x:-5,y:-27},{x:-5,y:27},2);
  for(const x of [-13,14])for(const y of [-7,12])s+=tree(x,y,1.3);
 }else if(d.type==='STATION'){
  const rail=routes.find(v=>v.edge.railway?.present),angle=rail?Math.atan2(rail.y,rail.x)*180/Math.PI:0;
  s+=`<g data-station-axis="${n(angle)}" transform="rotate(${n(angle)})">`;
  s+=rect(-25,-6,50,12,'#888974')+rect(-24,-9,48,3,'#d4c8a8')+rect(-20,5,43,3,'#c9bc9a');
  s+=building(-14,-22,24,10,lod,'station')+rect(13,-20,12,11,'#bab095');
  if(lod!=='far'){for(const x of [-18,-6,6])s+=rect(x,5,8,2,'#536b62')+rect(x+1,7,1,1.3,'#504e40');for(let x=14;x<23;x+=3)s+=rect(x,-18,2,3,'#886849','stroke="#b39a6f" stroke-width=".3"');}
  if(lod==='close'){for(let x=-22;x<23;x+=2)s+=line({x,y:-7},{x,y:-8.5},'#f1dec0',.22);s+=rect(-19,15,34,6,'#afa386');for(let x=-17;x<14;x+=4)s+=rect(x,16,3,3,'#8d795b');}
  s+='</g>';
 }else if(d.type==='INDUSTRIAL'){
  path({x:-28,y:0},{x:28,y:0},4);path({x:0,y:-28},{x:0,y:27},3);
  for(const p of slots){s+=rect(p.x-8,p.y-6,16,13,'#b8ad91','rx=".7" stroke="#817e67" stroke-width=".4"');if(lod!=='far')s+=line({x:p.x-7,y:p.y+6},{x:p.x+7,y:p.y+6},'#d9c7a2',.6);}
  if(lod==='close'){s+=rect(-5,21,10,4,'#c7b795');for(let x=-4;x<4;x+=2)s+=rect(x,22,1,1,'#78664c');s+=tree(25,-16,1.4)+tree(-27,12,1.2);}
 }else{
  path({x:-23,y:-20},{x:23,y:20},2);path({x:-17,y:25},{x:17,y:-22},1.6);
  for(const [x,y] of [[-22,-20],[6,-22],[-25,5],[10,12]] as const){s+=rect(x-2,y-2,14,12,'#a6ad7a','rx="2"');house(x,y,8,5);if(lod!=='far')s+=line({x:x-2,y:y+10},{x:x+12,y:y+10},'#b7aa87',.6);}
  for(const [x,y] of [[-14,17],[20,-6],[-5,-24],[25,23],[2,20]] as const)s+=tree(x,y,2.3);
  if(lod==='close')for(let x=-10;x<2;x+=2)s+=line({x,y:10},{x:x+2,y:16},'#6e7951',.6);
 }
 // Real edge directions, over yard material. These are drawings, not new logistics edges.
 for(const v of streets){const a={x:0,y:0},length=v.edge.bridge?23:37,b={x:v.x*length,y:v.y*length};if(v.edge.road)s+=line(a,b,'#777767',3.8)+line(a,b,'#c3b493',2.2);if(v.edge.railway?.present){s+=line(a,b,'#777a70',4.2);for(const off of [-.8,.8])s+=line({x:-v.y*off,y:v.x*off},{x:b.x-v.y*off,y:b.y+v.x*off},'#414c45',.4);if(lod!=='far')for(let t=1;t<length;t+=2)s+=line({x:v.x*t-v.y*1.6,y:v.y*t+v.x*1.6},{x:v.x*t+v.y*1.6,y:v.y*t-v.x*1.6},'#686759',.45);}}
 return `<g data-district-art="${esc(d.type)}" data-detail="${lod}" pointer-events="none">${s}</g>`;
}
/** One shell per connected membership component. Internal sides never enter the wall plan. */
export function cityWallPlan(city:any,edges:any[]){const members=new Set<string>(city.districts.map((d:any)=>d.hex)),segments:any[]=[];const seen=new Set<string>();let components=0;
 for(const key of members)if(!seen.has(key)){components++;const queue=[key];seen.add(key);for(let i=0;i<queue.length;i++)for(const h of hexNeighbors(coord(queue[i]!))){const k=hexKey(h);if(members.has(k)&&!seen.has(k)){seen.add(k);queue.push(k);}}}
 for(const d of city.districts){const h=coord(d.hex),center=hexToPixel(h);
  for(const nb of hexNeighbors(h)){if(members.has(hexKey(nb)))continue;const shared=sharedHexEdge(h,nb)!;const e=edges.find(e=>(hexKey(e.a)===d.hex&&hexKey(e.b)===hexKey(nb))||(hexKey(e.b)===d.hex&&hexKey(e.a)===hexKey(nb)));
   // Boundary edge endpoints are pulled into the district only; cannot swallow wilderness.
   // The midpoint recess makes a courtyard edge rather than a hard hex outline.
   const mid={x:(shared[0].x+shared[1].x)/2,y:(shared[0].y+shared[1].y)/2};
   const inset=(p:Point,f:number)=>({x:center.x+(p.x-center.x)*f,y:center.y+(p.y-center.y)*f});
   segments.push({district:d.id,type:d.type,hex:d.hex,neighbor:hexKey(nb),a:inset(shared[0],.83),b:inset(shared[1],.83),mid:inset(mid,.79),gate:e?.road?'road':e?.railway?.present?'rail':e?.river?'river':null,river:!!e?.river,bridge:!!e?.bridge});
  }
 }
 // Weld adjoining boundary endpoints around concave member joins; never add interior edges.
 for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++)for(const a of ['a','b'])for(const b of ['a','b'])if(Math.hypot(segments[i][a].x-segments[j][b].x,segments[i][a].y-segments[j][b].y)<14){const p={x:(segments[i][a].x+segments[j][b].x)/2,y:(segments[i][a].y+segments[j][b].y)/2};segments[i][a]=p;segments[j][b]=p;}
 return {cityId:city.id,components,segments};
}
export function wallsMarkup(plan:ReturnType<typeof cityWallPlan>,lod:CityLod){let out='';for(const s of plan.segments){const lerp=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});const halves=s.gate?[[s.a,lerp(s.a,s.mid,.58)],[lerp(s.mid,s.b,.42),s.b]]:[[s.a,s.mid],[s.mid,s.b]];
 for(const [a,b] of halves as Point[][]){out+=line({x:a!.x+1.1,y:a!.y+1.6},{x:b!.x+1.1,y:b!.y+1.6},'#384335',2.3,'opacity=".28"');const fence=s.type==='RESIDENTIAL';out+=line(a!,b!,'#6e6b56',fence?.65:1.8)+line({x:a!.x,y:a!.y-.55},{x:b!.x,y:b!.y-.55},fence?'#6f7868':'#c3b193',fence?.3:.9);if(fence&&lod!=='far'){const len=Math.hypot(b!.x-a!.x,b!.y-a!.y);for(let t=0;t<=len;t+=2.5){const p=lerp(a!,b!,t/len);out+=line({x:p.x,y:p.y+.35},{x:p.x,y:p.y-1.3},'#626e5e',.3);}}if(lod==='close'&&!fence){const len=Math.hypot(b!.x-a!.x,b!.y-a!.y);for(let t=1;t<len;t+=1.8){const p=lerp(a!,b!,t/len);out+=line({x:p.x,y:p.y-.5},{x:p.x,y:p.y+.5},'#8e7d65',.2);}}}
 if(s.gate&&!s.river)for(const p of [lerp(s.a,s.mid,.58),lerp(s.mid,s.b,.42)])out+=rect(p.x-1,p.y-1.7,2,2.6,'#a9997b','stroke="#665e4d" stroke-width=".3"');
 }return `<g data-city-wall="${esc(plan.cityId)}" data-components="${plan.components}" pointer-events="none">${out}</g>`;}
export function facilityMarkup(d:any,edges:any[],lod:CityLod){const slots=facilitySlots(d,edges),records=[...(d.facilities??[]),...(d.sealedConstruction??[]).filter((f:any)=>!(d.facilities??[]).some((v:any)=>v.id===f.id)).map((f:any)=>({...f,status:'SEIZED_CONSTRUCTION'}))];const assigned=new Map<number,any>(),used=new Set<string>();for(const f of records){if(used.has(f.id))continue;const slot=Number.isInteger(f.slot)&&f.slot>=0&&f.slot<slots.length&&!assigned.has(f.slot)?f.slot:Array.from({length:slots.length},(_,i)=>i).find(i=>!assigned.has(i));if(slot!==undefined){assigned.set(slot,f);used.add(f.id);}}let out='';
 for(let i=0;i<slots.length;i++){const p=slots[i]!,f=assigned.get(i);if(!f){out+=`<g data-empty-slot="${i}">${rect(p.x-7,p.y-5,14,10,'#b7af92','stroke="#a2997d" stroke-width=".3"')}${lod==='close'?line({x:p.x-6,y:p.y+4},{x:p.x+6,y:p.y-4},'#96967a',.3):''}</g>`;continue;}
 const sealed=f.status==='SEIZED_CONSTRUCTION'||f.status==='SEIZED'||f.status==='SEALED'||f.status==='OCCUPATION'||(d.sealedConstruction??[]).some((s:any)=>s.id===f.id);const complete=f.status==='BUILT';
 let art=complete?building(p.x-7,p.y-5,14,9,lod,'factory'):rect(p.x-7,p.y-5,14,10,'#948e75','stroke="#c0aa7b" stroke-width=".8"');
 if(!complete){for(let x=p.x-6;x<p.x+6;x+=3)art+=line({x,y:p.y-4},{x,y:p.y+4},'#c7bda0',.7);art+=line({x:p.x-5,y:p.y+4},{x:p.x-5,y:p.y-10},'#866d4d',.7)+line({x:p.x-5,y:p.y-10},{x:p.x+6,y:p.y-10},'#b39a6b',.7)+rect(p.x+4,p.y+2,3,2,'#ad8060');}
 const reason=sealed?'占领封存':d.unconfirmed?'状态待确认':f.kind?(({ACTIVE:'生产中',MISSING:'缺原料',IDLE:'未分配',DAMAGED:'厂房损坏',BUILDING:'施工中',QUEUED:'排队施工',OCCUPIED:'失守停工'} as any)[f.workState]??'')+(f.damage?' · 厂房损坏'+Math.round(f.damage*100)+'%':''):!d.service?'运输服务不可用':'';
 if(reason)art+=rect(p.x-5,p.y+5,10,1.2,sealed?'#94764c':'#797f6b')+(sealed?line({x:p.x-2,y:p.y+2},{x:p.x+2,y:p.y-2},'#d8bf8f',.65):'');
 if(f.kind){const colors:any={ACTIVE:'#6d9984',MISSING:'#c3a063',IDLE:'#7f8a83',DAMAGED:'#b77963',BUILDING:'#c1b38a',QUEUED:'#a6a991',OCCUPIED:'#a1766a'};const color=colors[f.workState]??'#899b8e';
 art+=`<rect x="${p.x-6}" y="${p.y+3}" width="12" height="5" fill="#293c39" stroke="${color}" stroke-width=".5"/><text x="${p.x-4}" y="${p.y+7}" font-size="4" fill="#e2dfc4">${f.kind==='MIL'?'军':'民'}</text><path d="M${p.x+1} ${p.y+5.5}h4" stroke="${color}" stroke-width="1.5"/>`;
 if(f.workState==='MISSING')art+=`<path d="M${p.x+7} ${p.y-8}l3 5h-6z" fill="#d5b077" stroke="#574e38" stroke-width=".5"/>`;
 if(f.damage)art+=`<path d="M${p.x+1} ${p.y-8}l-3 4 4 1-2 4" fill="none" stroke="#423d34" stroke-width="1"/>`;
 if(f.progressRatio!=null)art+=`<path d="M${p.x-6} ${p.y+9}h12" stroke="#39443b" stroke-width="1.5"/><path d="M${p.x-6} ${p.y+9}h${12*f.progressRatio}" stroke="${color}" stroke-width="1.5"/>`;
 }
 out+=`<g class="${complete?'built-factory':'factory-site'}" data-facility-id="${esc(f.id)}" data-status="${esc(f.status)}" data-facility-reason="${reason}" pointer-events="none"><title>${esc(f.id)} · ${complete?'已建':'施工'}${f.kind?' · '+(f.kind==='MIL'?'军厂':'民厂')+' '+(f.product??''):''}${reason?' · '+reason:''}</title>${art}</g>`;
 }return out;
}
/** Public geometry may be known while operational status is not. Never draw an intact unknown deck. */
export function bridgeStateMarkup(edges:any[],known:Set<string>){return edges.filter(e=>e.bridge).map(e=>{const a=hexToPixel(e.a),b=hexToPixel(e.b),x=(a.x+b.x)/2,y=(a.y+b.y)/2,angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;const confirmed=known.has(hexKey(e.a))||known.has(hexKey(e.b)),status=!confirmed||typeof e.bridge.destroyed!=='boolean'?'unknown':e.bridge.destroyed?'damaged':'intact';let art='';
 const span=Math.hypot(b.x-a.x,b.y-a.y)/2;const approaches=line({x:-span,y:0},{x:-11,y:0},'#a79e83',e.railway?.present?3:2)+line({x:11,y:0},{x:span,y:0},'#a79e83',e.railway?.present?3:2);
 if(status==='intact'){art=rect(-11,-3.3,22,6.6,'#a99b7e','stroke="#665e4d" stroke-width=".5"');for(let i=-10;i<11;i+=2)art+=line({x:i,y:-3},{x:i,y:3},'#796f59',.3);art+=line({x:-11,y:-3.4},{x:11,y:-3.4},'#d7c49c',.7);}
 else if(status==='damaged')art=rect(-11,-3.2,7,6.4,'#877b63')+rect(5,-3.2,6,6.4,'#877b63')+`<path d="M-4 -3 L-1 -1 L-3 2 M4 -2 L1 1 L4 3" fill="none" stroke="#64594a" stroke-width="1.2"/>`;
 else art=line({x:-11,y:0},{x:11,y:0},'#ada68b',1.5,'stroke-dasharray="2 3"');
 return `<g data-bridge-key="${esc(e.key)}" data-bridge-status="${status}" transform="translate(${n(x)} ${n(y)}) rotate(${n(angle)})" pointer-events="none"><title>桥梁 · ${status==='unknown'?'状态未确认':status==='damaged'?'已知损坏':'已知完整'}</title>${approaches}${art}</g>`;}).join('');}

export function railStateMarkup(edges:any[],known:Set<string>){return edges.filter(e=>e.railway?.present&&!e.bridge&&(known.has(hexKey(e.a))||known.has(hexKey(e.b)))).map(e=>{const a=hexToPixel(e.a),b=hexToPixel(e.b),r=e.railway,status=r.destroyed?'damaged':r.repairedBy?'repaired':'unrepaired';return `<g data-rail-key="${esc(e.key)}" data-rail-status="${status}" pointer-events="none"><title>铁路 · ${status==='damaged'?'已知损坏':status==='repaired'?'已知修复（不等于整线可用）':'尚未修复'}</title>${line(a,b,status==='damaged'?'#9a654b':status==='repaired'?'#698477':'#9e9576',.75,status==='damaged'?'stroke-dasharray="1 3"':status==='unrepaired'?'stroke-dasharray="2 4"':'')}</g>`;}).join('');}
