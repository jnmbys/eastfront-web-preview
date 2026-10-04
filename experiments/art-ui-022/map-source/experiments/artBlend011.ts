import {createSlice,label,semanticAudit,type SliceData} from './mapData.js';
import {paintBlend011} from './blend011Terrain.js';
import {paintTerrain010} from './terrain010Terrain.js';
import {hexKey,hexToPixel,polygonPointsString,type Point} from '../geometry/hex.js';
import {renderCounter,viewBoxForHexes} from '../render/coreSvg.js';
import {beginMapGesture,updateMapGesture,gesturePanViewport,dragSuppressesTap,type MapGestureState} from '../web/mapInteraction.js';
import type {MapViewport} from '../web/preview.js';
// Full-map camera range only; pointer routing and unit contract unchanged.
function zoomMapAt(view:MapViewport,requested:number,focus:Point):MapViewport{const zoom=Math.max(1,Math.min(8,requested)),ratio=zoom/view.zoom;return {zoom,panX:focus.x-(focus.x-view.panX)*ratio,panY:focus.y-(focus.y-view.panY)*ratio};}
function pinchMapViewport(view:MapViewport,startA:Point,startB:Point,a:Point,b:Point):MapViewport{const from={x:(startA.x+startB.x)/2,y:(startA.y+startB.y)/2},to={x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance=Math.hypot(startA.x-startB.x,startA.y-startB.y),next=zoomMapAt(view,view.zoom*Math.hypot(a.x-b.x,a.y-b.y)/(distance||1),from);return {...next,panX:next.panX+to.x-from.x,panY:next.panY+to.y-from.y};}
const $=<T extends Element=HTMLElement>(s:string)=>document.querySelector<T>(s)!;
const scene015=document.documentElement.dataset.scene==='015';
const scene014=scene015||document.documentElement.dataset.scene==='014';
const scene012=scene014||document.documentElement.dataset.scene==='012';
const taskName=scene015?'ART-MAP-015':scene014?'ART-IMPLEMENT-014':scene012?'ART-SCENE-012':'ART-BLEND-011';
const query=new URLSearchParams(location.search);let variant=query.get('variant')==='baseline'?'baseline':'candidate';
const events:Record<string,unknown>[]=[];const started=performance.now();
let data:SliceData,view:MapViewport={zoom:1,panX:0,panY:0},selected:string|null=null,cell:string|null=null;
const terrainNames:Record<string,string>={MARSH:'沼泽',LAKE:'湖泊',MAIN_CITY:'主城',OUTER_CITY:'外城',PLAIN:'平原',FOREST:'森林',HILL:'丘陵',ROUGH:'崎岖地',CITY:'城市'};
const typeNames:Record<string,string>={PANZER:'装甲',INFANTRY:'步兵',ENGINEER:'工兵'};
const longTasks:{start:number;duration:number}[]=[];if(PerformanceObserver.supportedEntryTypes.includes('longtask'))new PerformanceObserver(list=>list.getEntries().forEach(e=>longTasks.push({start:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});
let stats:Record<string,unknown>={};let switching=false;
function log(action:string,detail:Record<string,unknown>={}){events.push({action,at:Math.round(performance.now()),...detail});}
function paintView(){
 $('#world').style.transform=`translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`;
 $('#zoom-value').textContent=`${Math.round(view.zoom*100)}%`;$('#view-mode').textContent=view.zoom>4?'近景 · 材质检查':view.zoom>1.6?'中景 · 战术阅读':'远景 · 全图概览';
}
async function setVariant(next:string){
 if(switching)return;switching=true;($<HTMLButtonElement>('#variant')).disabled=true;
 try{const begin=performance.now();stats={...stats,...await (scene012?paintBlend011($<HTMLCanvasElement>('#terrain'),data,scene015?(next==='candidate'?'015':'014'):scene014?(next==='candidate'?'014':true):next==='candidate'):(next==='candidate'?paintBlend011:paintTerrain010)($<HTMLCanvasElement>('#terrain'),data))};variant=next;const townLabel=document.querySelector<SVGTextElement>('[data-terrain-label="X14"]');if(townLabel){const town=data.hexes.find(h=>label(h.coord)==='X14')!,c=hexToPixel(town.coord);townLabel.setAttribute('y',String(c.y+(-22)));townLabel.setAttribute('text-anchor','middle');}$('#variant').textContent=variant==='candidate'?'查看当前版':'查看精修版';$('#variant').setAttribute('aria-pressed',String(variant==='baseline'));$('#variant-label').textContent=scene015?(variant==='candidate'?'015 · 全图统一材质':'014 · 局部对照版'):scene014?(variant==='candidate'?'014 · 连续街区与地貌':'012 · 对照版'):scene012?(variant==='candidate'?'012 · 地貌与街区':'011 · 对照版'):(variant==='candidate'?'011 · 自然衔接':'010 · 对照版');log('variant',{variant,switchMs:performance.now()-begin});}finally{switching=false;($<HTMLButtonElement>('#variant')).disabled=false;}
}
function drawUnits(){
 $('#units').innerHTML=data.counters.map(c=>{const peers=data.counters.filter(u=>hexKey(u.hex)===hexKey(c.hex));return renderCounter({...c,selected:c.id===selected},peers.indexOf(c),peers.length);}).join('');
 $('#selection').innerHTML=cell?`<polygon points="${polygonPointsString(data.hexes.find(h=>hexKey(h.coord)===cell)!.coord)}"/>`:'';
}
function details(){
 const h=data.hexes.find(h=>hexKey(h.coord)===cell);if(!h)return;
 const peers=data.counters.filter(u=>hexKey(u.hex)===cell),edges=data.edges.filter(e=>hexKey(e.a)===cell||hexKey(e.b)===cell);
 const info=edges.filter(e=>e.road||e.railway?.present||e.river||e.bridge).map(e=>`${label(e.a)}—${label(e.b)}：${[e.road?'道路':'',e.railway?.present?'铁路':'',e.river?(e.river==='MAJOR'?'主河':'支流'):'',e.bridge?`${e.bridge.destroyed?'损坏':'完好'}桥梁`: ''].filter(Boolean).join(' / ')}`);
 $('#cell-name').textContent=label(h.coord);$('#terrain-name').textContent=terrainNames[h.terrain]??h.terrain;
 $('#unit-list').innerHTML=peers.length?`<p>${peers.length>1?'同格单位 · 点选其中一个':'当前格单位'}</p>${peers.map(c=>`<button class="unit-choice ${c.id===selected?'active':''}" data-pick="${c.id}" aria-pressed="${c.id===selected}"><span>${c.id} · ${typeNames[c.type]??c.type}</span><small>${c.step?'已受损':'完整'} · 攻 ${c.stats.attack} / 防 ${c.stats.defense} / 移 ${c.stats.movement}</small></button>`).join('')}`:'<p class="muted">此格没有展示单位</p>';
 $('#edge-list').innerHTML=info.map(s=>`<li>${s}</li>`).join('')||'<li>没有河流或交通边</li>';
 $('#unit-list').querySelectorAll<HTMLButtonElement>('[data-pick]').forEach(b=>b.onclick=()=>chooseUnit(b.dataset.pick!));
}
function chooseUnit(id:string){const begin=performance.now(),u=data.counters.find(c=>c.id===id)!;selected=id;cell=hexKey(u.hex);drawUnits();details();log('select-unit',{id,cell,handlerMs:performance.now()-begin});requestAnimationFrame(()=>log('select-next-raf',{id,ms:performance.now()-begin}));}
function chooseCell(key:string){const begin=performance.now();cell=key;selected=null;drawUnits();details();log('inspect-cell',{cell:key,label:label(data.hexes.find(h=>hexKey(h.coord)===key)!.coord),handlerMs:performance.now()-begin});}
function bindGestures(){
 const wrap=$('#map-wrap');const points=new Map<number,Point>();let gesture:MapGestureState|null=null,pinch:{view:MapViewport;a:Point;b:Point}|null=null,suppress=false;
 const local=(e:PointerEvent|WheelEvent)=>{const r=wrap.getBoundingClientRect();return {x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};};
 const rebase=()=>{const p=[...points.entries()];gesture=null;pinch=null;if(p.length>=2)pinch={view:{...view},a:{...p[0]![1]},b:{...p[1]![1]}};else if(p.length){gesture=beginMapGesture(p[0]![0],p[0]![1].x,p[0]![1].y,view);gesture.dragging=suppress;}};
 wrap.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(!points.size)suppress=false;points.set(e.pointerId,local(e));rebase();if(points.size>=2){suppress=true;points.forEach((_,id)=>{try{wrap.setPointerCapture(id);}catch{}});}});
 wrap.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const p=local(e);points.set(e.pointerId,p);if(pinch){const [a,b]=[...points.values()];view=pinchMapViewport(pinch.view,pinch.a,pinch.b,a!,b!);paintView();e.preventDefault();return;}if(!gesture)return;gesture=updateMapGesture(gesture,p.x,p.y);if(gesture.dragging){wrap.setPointerCapture(e.pointerId);view=gesturePanViewport(gesture,p.x,p.y,view.zoom);paintView();e.preventDefault();}});
 const finish=(e:PointerEvent,cancelled=false)=>{if(!points.has(e.pointerId))return;if(gesture){suppress=suppress||dragSuppressesTap(gesture,cancelled);if(gesture.dragging)log('pan',{...view,cancelled});}if(pinch)log('pinch',{...view,cancelled});points.delete(e.pointerId);rebase();if(wrap.hasPointerCapture(e.pointerId))wrap.releasePointerCapture(e.pointerId);};
 wrap.addEventListener('pointerup',e=>finish(e));wrap.addEventListener('pointercancel',e=>finish(e,true));wrap.addEventListener('lostpointercapture',e=>finish(e,true));
 wrap.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();return;}const target=e.target as Element;const unit=target.closest('[data-unit-id]');if(unit){chooseUnit(unit.getAttribute('data-unit-id')!);return;}const hex=target.closest('[data-cell]');if(hex)chooseCell(hex.getAttribute('data-cell')!);},true);
 wrap.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const t=e.target as Element;const u=t.closest('[data-unit-id]'),h=t.closest('[data-cell]');if(u){e.preventDefault();chooseUnit(u.getAttribute('data-unit-id')!);}else if(h){e.preventDefault();chooseCell(h.getAttribute('data-cell')!);}});
 wrap.addEventListener('wheel',e=>{e.preventDefault();view=zoomMapAt(view,view.zoom+(e.deltaY<0?.12:-.12),local(e));paintView();log('wheel',{...view});},{passive:false});
 $('#zoom-in').onclick=()=>{view=zoomMapAt(view,view.zoom+.25,{x:0,y:0});paintView();log('zoom-in',{...view});};
 $('#zoom-out').onclick=()=>{view=zoomMapAt(view,view.zoom-.25,{x:0,y:0});paintView();log('zoom-out',{...view});};
 $('#focus').onclick=()=>{const h=data.hexes.find(h=>label(h.coord)==='X14')!,p=hexToPixel(h.coord),box=viewBoxForHexes(data.hexes,8),scale=$('#world').clientWidth/box.width;view={zoom:5,panX:-(p.x-box.minX-box.width/2)*scale*5,panY:-(p.y-box.minY-box.height/2)*scale*5};paintView();log('focus',{...view});};
 $('#fit').onclick=()=>{view={zoom:1,panX:0,panY:0};paintView();log('fit');};
}
async function sample(){const frames:number[]=[];let previous=performance.now();const end=previous+5000;$('#sample').textContent='采样中 · 可拖动';await new Promise<void>(resolve=>{function tick(now:number){frames.push(now-previous);previous=now;if(now<end)requestAnimationFrame(tick);else resolve();}requestAnimationFrame(tick);});const sorted=[...frames].sort((a,b)=>a-b),result={variant,visibility:document.visibilityState,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,frames:frames.length,mean:frames.reduce((a,b)=>a+b,0)/frames.length,p95:sorted[Math.floor(sorted.length*.95)],over33:frames.filter(v=>v>33).length,raw:frames};log('raf-sample',result);$('#sample').textContent='采样 5 秒';$('#metrics').textContent=`${variant} · ${frames.length} 帧 · 均值 ${result.mean.toFixed(2)}ms · P95 ${result.p95?.toFixed(2)}ms（RAF，非 GPU）`;}
async function boot(){
 // Strictly public map + explicit visual fixtures; no session, rules action or backend connection.
 data=createSlice(await (await fetch('./map.json')).json());const box=viewBoxForHexes(data.hexes,8);
 const svg=$<SVGSVGElement>('#map-svg');svg.setAttribute('viewBox',`${box.minX} ${box.minY} ${box.width} ${box.height}`);
 $('#hexes').innerHTML=data.hexes.map(h=>`<polygon data-cell="${hexKey(h.coord)}" data-label="${label(h.coord)}" data-terrain="${h.terrain}" points="${polygonPointsString(h.coord)}" role="button" tabindex="0" aria-label="${label(h.coord)} ${terrainNames[h.terrain]??h.terrain}"/>`).join('');
 $('#labels').innerHTML=data.hexes.map(h=>{const p=hexToPixel(h.coord);return `<text data-terrain-label="${label(h.coord)}" x="${p.x}" y="${p.y+29}">${label(h.coord)}</text>`;}).join('');
 const world=$('#world'),wrap=$('#map-wrap');const fitSize=()=>{const width=Math.min(wrap.clientWidth-30,(wrap.clientHeight-28)*box.width/box.height),height=width*box.height/box.width;world.style.width=width+'px';world.style.height=height+'px';world.style.left=(wrap.clientWidth-width)/2+'px';world.style.top=(wrap.clientHeight-height)/2+'px';};new ResizeObserver(fitSize).observe(wrap);fitSize();
 await setVariant(variant);drawUnits();bindGestures();paintView();$('#focus').click();chooseCell(hexKey(data.hexes.find(h=>label(h.coord)==='X14')!.coord));
 $('#variant').onclick=()=>{void setVariant(variant==='candidate'?'baseline':'candidate').catch(e=>{console.error(e);$('#variant-label').textContent='候选加载失败，请刷新重试';});};
 $('#grid').onclick=()=>{svg.classList.toggle('grid-off');$('#grid').setAttribute('aria-pressed',String(!svg.classList.contains('grid-off')));};
 $('#sample').onclick=()=>{void sample();};
 $('#export').onclick=()=>{const blob=new Blob([JSON.stringify(report(),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=taskName+'-observation.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 $('#loading').remove();stats.readyMs=performance.now()-started;stats.navigationToReadyMs=performance.now();log('ready',{ms:stats.readyMs});document.documentElement.dataset.ready='true';
 Object.assign(window,{sliceDebug:{report,inspect:(key:string)=>chooseCell(key),data:semanticAudit(data)}});
}
function report(){return {task:taskName,longTasks,variant,view,selected,cell,stats,events,resources:performance.getEntriesByType('resource').map(r=>{const x=r as PerformanceResourceTiming;return {name:x.name.split('/').slice(-3).join('/'),duration:x.duration,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize,decodedBodySize:x.decodedBodySize};}),conditions:{viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,visibility:document.visibilityState,userAgent:navigator.userAgent},limits:['58 visual fixtures, not a live match','RAF samples are not GPU measurements','No Huawei acceptance','Texture decoding/canvas backing memory is an estimate, not process memory']};}
boot().catch(e=>{$('#loading').textContent=`地图加载失败：${String(e)}。请刷新重试。`;console.error(e);});
