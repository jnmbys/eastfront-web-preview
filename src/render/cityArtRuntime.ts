import type {CityArtView,CityArtSelection,CityArtInteraction} from './cityArtView.js';
import {hexToPixel,hexKey,hexPolygon} from '../geometry/hex.js';
import {CITY_ART_VERSION,districtScene,facilityMarkup,cityWallPlan,wallsMarkup,bridgeStateMarkup,railStateMarkup,type CityLod} from './cityArt.js';
import {terrainImageCacheStats} from './terrainSurface.js';
const NS='http://www.w3.org/2000/svg';
const esc=(s:unknown)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
type Row={el:SVGGElement;stamp:string;wanted?:string};
const scenes=new Map<string,Row>(),walls=new Map<string,Row>(),facilities=new Map<string,Row>(),traffic=new Map<string,Row>(),labels=new Map<string,Row>();
const cache=new Map<string,string>();let bytes=0,timer:ReturnType<typeof setTimeout>|null=null,observer:MutationObserver|null=null;
let svg:SVGSVGElement|null=null,wrap:Element|null=null,viewer:string|null=null,lastView:CityArtView|null=null,lastSelect:CityArtSelection=()=>{},interaction:CityArtInteraction={};
let releaseInput=()=>{};
const jobs=new Map<string,()=>void>();
const districtFacts=new Map<string,{stamp:string;ids:string[]}>();
export const CITY_DETAIL_BUDGET={maxVisible:16,maxEntries:48,maxBytes:2*1024*1024,sliceMs:4};
export function disposeCityArt(){if(timer!==null)clearTimeout(timer);timer=null;jobs.clear();districtFacts.clear();observer?.disconnect();observer=null;releaseInput();releaseInput=()=>{};for(const id of ['city-art-static','city-art-facilities','city-bridges','city-districts'])svg?.querySelector('#'+id)?.remove();document.querySelector('#city-detail-status')?.remove();svg=null;wrap=null;viewer=null;lastView=null;lastSelect=()=>{};interaction={};for(const rows of [scenes,walls,facilities,traffic,labels])rows.clear();cache.clear();bytes=0;}
function geometry(d:any,edges:any[]){return edges.filter(e=>hexKey(e.a)===d.hex||hexKey(e.b)===d.hex).map(e=>({key:e.key,a:e.a,b:e.b,road:e.road,railway:e.railway?{present:e.railway.present}:null,river:e.river,bridge:e.bridge?{kind:e.bridge.kind}:null}));}
function sceneKey(d:any,edges:any[],lod:CityLod){return JSON.stringify([CITY_ART_VERSION,d.id,d.type,d.hex,d.slots,lod,geometry(d,edges)]);}
function getScene(d:any,edges:any[],lod:CityLod,key:string){let s=cache.get(key);if(s){cache.delete(key);cache.set(key,s);return s;}s=districtScene(d,edges,lod);cache.set(key,s);bytes+=s.length*2;while(cache.size>CITY_DETAIL_BUDGET.maxEntries||bytes>CITY_DETAIL_BUDGET.maxBytes){const [k,v]=cache.entries().next().value!;cache.delete(k);bytes-=v.length*2;}return s;}
function layer(id:string,beforeFog=true){let el=svg!.querySelector<SVGGElement>('#'+id);if(!el){el=document.createElementNS(NS,'g');el.id=id;el.setAttribute('pointer-events','none');if(beforeFog)svg!.insertBefore(el,svg!.querySelector('#fog-surface-layer'));else svg!.appendChild(el);}return el;}
function row(rows:Map<string,Row>,id:string,parent:SVGGElement,attribute:string){let r=rows.get(id);if(!r){const el=document.createElementNS(NS,'g');el.setAttribute(attribute,id);parent.appendChild(el);r={el,stamp:''};rows.set(id,r);}return r;}
function patch(r:Row,markup:string){if(r.stamp!==markup){r.el.innerHTML=markup;r.stamp=markup;}}
function prune(rows:Map<string,Row>,keep:Set<string>){for(const[id,r]of rows)if(!keep.has(id)){r.el.remove();rows.delete(id);jobs.delete(id);}}
function clear(rows:Map<string,Row>){for(const r of rows.values())r.el.remove();rows.clear();}
function at(d:any){const[q,r]=d.hex.split(',').map(Number),p=hexToPixel({q,r});return `translate(${p.x} ${p.y})`;}
function attr(el:Element,key:string,value:string){if(el.getAttribute(key)!==value)el.setAttribute(key,value);}
function transform(r:Row,value:string){attr(r.el,'transform',value);}
function status(){if(!svg)return;let node=document.querySelector<HTMLElement>('#city-detail-status');if(!node){node=document.createElement('span');node.id='city-detail-status';node.setAttribute('role','status');document.querySelector('.map-toolbar')?.appendChild(node);}const pending=jobs.size,text=pending?'城区细节加载中':svg.dataset.cityDetail==='far'?'':'城区细节已就绪';if(node.textContent!==text)node.textContent=text;node.dataset.pending=String(pending);svg.dataset.cityCacheBytes=String(bytes);svg.dataset.cityCacheEntries=String(cache.size);svg.dataset.cityImageCache=JSON.stringify(terrainImageCacheStats());}
function flush(){timer=null;const start=performance.now();for(const[id,job]of jobs){jobs.delete(id);job();if(performance.now()-start>=CITY_DETAIL_BUDGET.sliceMs)break;}status();if(jobs.size)timer=setTimeout(flush,0);}
export function scheduleCityArt(){if(lastView)paintAuthorizedCities(lastView,lastSelect,interaction);}
/** Full district footprint; no new overlay steals a counter/route hit. Existing map handlers run first. */
function bindInput(target:SVGSVGElement){const pointers=new Map<number,{x:number;y:number}>();let suppress=false;
 const down=(e:PointerEvent)=>{if(!pointers.size)suppress=false;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1)suppress=true;};
 const move=(e:PointerEvent)=>{const p=pointers.get(e.pointerId);if(p&&Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)suppress=true;};
 const up=(e:PointerEvent)=>{move(e);pointers.delete(e.pointerId);};const cancel=(e:PointerEvent)=>{suppress=true;pointers.delete(e.pointerId);};const wheel=()=>{suppress=true;};
 const allowed=()=>!interaction.canInspect||interaction.canInspect();
 const click=(e:MouseEvent)=>{if(suppress||e.defaultPrevented||e.button!==0||!allowed()||!lastView)return;const hit=e.target instanceof Element?e.target:null;if(hit?.closest('[data-logistics-object],[data-unit-id],[data-hit-unit-id],[data-role],[data-command-hex],button,input,select'))return;const matrix=target.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  for(const c of lastView.cities)for(const d of c.districts){if(d.hidden)continue;const[q,r]=d.hex.split(',').map(Number),polygon=hexPolygon({q:q!,r:r!});let inside=true,sign=0;for(let i=0;i<6;i++){const a=polygon[i]!,b=polygon[(i+1)%6]!,cross=(b.x-a.x)*(point.y-a.y)-(b.y-a.y)*(point.x-a.x);if(Math.abs(cross)<.001)continue;const s=Math.sign(cross);if(sign&&sign!==s){inside=false;break;}sign=s;}if(inside){e.stopPropagation();lastSelect(c.id,d.id);return;}}
 };
 const key=(e:KeyboardEvent)=>{const hit=e.target instanceof Element?e.target.closest<SVGElement>('[data-city-did]'):null;if(hit&&(e.key==='Enter'||e.key===' ')&&allowed()){e.preventDefault();lastSelect(hit.dataset.cityMap!,hit.dataset.cityDid!);}};
 target.addEventListener('click',click);target.addEventListener('keydown',key);target.addEventListener('pointerdown',down,true);target.addEventListener('pointermove',move,true);target.addEventListener('pointerup',up,true);target.addEventListener('pointercancel',cancel,true);target.addEventListener('wheel',wheel,{passive:true});
 return()=>{target.removeEventListener('click',click);target.removeEventListener('keydown',key);target.removeEventListener('pointerdown',down,true);target.removeEventListener('pointermove',move,true);target.removeEventListener('pointerup',up,true);target.removeEventListener('pointercancel',cancel,true);target.removeEventListener('wheel',wheel);};
}
export function paintAuthorizedCities(data:CityArtView,select:CityArtSelection,input:CityArtInteraction={}){
 const target=document.querySelector<SVGSVGElement>('#eastfront-map');if(!target)return;
 if(svg!==target){disposeCityArt();svg=target;releaseInput=bindInput(target);}
 lastView=data;lastSelect=select;interaction=input;
 const currentWrap=document.querySelector('#map-wrap');if(wrap!==currentWrap){observer?.disconnect();wrap=currentWrap;observer=new MutationObserver(()=>scheduleCityArt());if(wrap)observer.observe(wrap,{attributes:true,attributeFilter:['data-zoom']});}
 // A seat change never inherits a prior seat's facility/title/transport DOM, even for equal revisions.
 if(viewer!==data.viewer){clear(facilities);districtFacts.clear();clear(traffic);clear(labels);viewer=data.viewer;}
 const edges=data.edges,cities=data.cities.map(c=>({...c,districts:c.districts.filter(d=>!d.hidden)})),all=cities.flatMap(c=>c.districts.map(d=>({c,d}))),matrix=target.getScreenCTM(),viewport=wrap?.getBoundingClientRect();
 const scale=matrix?Math.hypot(matrix.a,matrix.b):.1,pixels=84*scale,lod:CityLod=pixels<45?'far':pixels<110?'medium':'close';
 const visible=all.filter(({d})=>{if(!matrix||!viewport)return false;const[q,r]=d.hex.split(',').map(Number),p=hexToPixel({q:q!,r:r!}),x=p.x*matrix.a+p.y*matrix.c+matrix.e,y=p.x*matrix.b+p.y*matrix.d+matrix.f;return x>viewport.left-80&&x<viewport.right+80&&y>viewport.top-80&&y<viewport.bottom+80;}).slice(0,CITY_DETAIL_BUDGET.maxVisible),visibleIds=new Set(visible.map(({d})=>d.id));
 const staticLayer=layer('city-art-static'),facilityLayer=layer('city-art-facilities'),transportLayer=layer('city-bridges'),labelLayer=layer('city-districts',false);attr(labelLayer,'class','city-art-labels');
 const sceneIds=new Set<string>(),facilityIds=new Set<string>(),labelIds=new Set<string>(),wallIds=new Set<string>(),edgeIds=new Set<string>();
 for(const{c,d}of all){sceneIds.add(d.id);labelIds.add(d.id);const detail=visibleIds.has(d.id)?lod:'far',r=row(scenes,d.id,staticLayer,'data-scene-id'),key=sceneKey(d,edges,detail);transform(r,at(d));
  if(r.wanted!==key){r.wanted=key;const paint=()=>{if(scenes.get(d.id)!==r||r.wanted!==key)return;patch(r,getScene(d,edges,detail,key));};if(detail==='far'){jobs.delete(d.id);paint();}else{if(!r.stamp)patch(r,getScene(d,edges,'far',sceneKey(d,edges,'far')));jobs.set(d.id,paint);}}
  // Skip even parsing when authoritative facility inputs and local geometry are unchanged.
  const factStamp=JSON.stringify([key,d.facilities,d.sealedConstruction,d.unconfirmed,d.service]);let facts=districtFacts.get(d.id);
  if(facts?.stamp!==factStamp){const parsed=document.createElementNS(NS,'g');parsed.innerHTML=facilityMarkup(d,edges,detail);facts={stamp:factStamp,ids:[]};
   for(const child of Array.from(parsed.children)){const id=d.id+':'+(child.getAttribute('data-facility-id')??'empty:'+child.getAttribute('data-empty-slot'));facts.ids.push(id);const f=row(facilities,id,facilityLayer,'data-city-facility-key');transform(f,at(d));patch(f,child.outerHTML);}
   districtFacts.set(d.id,facts);
  }
  for(const id of facts!.ids)facilityIds.add(id);
  const l=row(labels,d.id,labelLayer,'data-city-did');transform(l,at(d));attr(l.el,'data-city-map',c.id);attr(l.el,'data-city-hex',d.hex);attr(l.el,'role','button');attr(l.el,'tabindex','0');attr(l.el,'aria-label',c.label+' '+d.paper);
  patch(l,`<rect x="-24" y="29" width="48" height="7" rx="1.5" fill="${d.control==='GERMAN'?'#516b70':d.control==='SOVIET'?'#895f4e':'#7e7e68'}" opacity=".82"/><text class="city-art-label" x="0" y="34" text-anchor="middle" font-size="4.5" fill="#f4e9d0">${esc(d.paper+' '+({MAIN:'主城',STATION:'站区',INDUSTRIAL:'工业区',RESIDENTIAL:'近郊'}[d.type])+(d.unconfirmed?' ?':''))}</text>`);
 }
 for(const c of cities){wallIds.add(c.id);const r=row(walls,c.id,staticLayer,'data-city-wall-key'),key=JSON.stringify([c.districts.map(d=>[d.id,d.hex,d.type,geometry(d,edges)]),lod==='close']);if(r.wanted!==key){r.wanted=key;patch(r,wallsMarkup(cityWallPlan(c,edges),lod==='close'?'close':'far'));}}
 const known=new Set(data.knownHexKeys);for(const e of edges){if(!e.bridge&&!e.railway?.present)continue;const markup=railStateMarkup([e],known)+bridgeStateMarkup([e],known);if(!markup)continue;edgeIds.add(e.key);patch(row(traffic,e.key,transportLayer,'data-transport-edge'),markup);}
 for(const id of districtFacts.keys())if(!sceneIds.has(id))districtFacts.delete(id);
 prune(scenes,sceneIds);prune(walls,wallIds);prune(facilities,facilityIds);prune(labels,labelIds);prune(traffic,edgeIds);
 target.dataset.cityVisible=String(visible.length);target.dataset.cityDetail=lod;status();if(jobs.size&&timer===null)timer=setTimeout(flush,0);
}
