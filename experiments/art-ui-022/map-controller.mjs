// UI adapter for the unmodified 015 terrain painter, SVG counter and gesture helpers.
import {label} from './map/app/experiments/mapData.js';
import {paintBlend011} from './map/app/experiments/blend011Terrain.js';
import {hexKey,hexToPixel,polygonPointsString} from './map/app/geometry/hex.js';
import {renderCounter,viewBoxForHexes} from './map/app/render/coreSvg.js';
import {beginMapGesture,updateMapGesture,gesturePanViewport,dragSuppressesTap} from './map/app/web/mapInteraction.js';
const $=id=>document.getElementById(id),names={PLAIN:'平原',FOREST:'森林',HILL:'丘陵',ROUGH:'崎岖地',MARSH:'沼泽',LAKE:'湖泊',CITY:'城市',MAIN_CITY:'主城',OUTER_CITY:'外城'};
let data,box,view={zoom:3,panX:0,panY:0},cell=null,selected=null,ready=false,live=null,stats={},worldScale=1;
const events=[],start=performance.now();const log=(action,detail={})=>{events.push({action,...detail});if(events.length>100)events.shift();};
window.addEventListener('industry-view',e=>{live=e.detail;if(ready){updateTarget();drawUnits();details();visibility();}});
function updateTarget(){
 const t=data.target;
 // Position is a verified invariant of the fixed 018 chain. Only published target state updates here.
 data.counters=live?[{...t,step:live.target.step,stats:{attack:0,defense:0,movement:0},controllerId:'GERMAN',selected:false,supplyState:'SUPPLIED',entrenched:false}]:[];
}
function visibility(){
 if(!ready)return;
 const coordName=document.body.dataset.object||'A10',el=document.querySelector('[data-label="'+coordName+'"]');
 const r=el?.getBoundingClientRect(),w=$('map-wrap').getBoundingClientRect();
 const visible=r&&r.left>=w.left&&r.right<=w.right&&r.top>=w.top&&r.bottom<=w.bottom;
 $('object-visibility').textContent=visible?'当前镜头内':'镜头外';
 document.body.dataset.objectVisible=String(!!visible);
}
function paintView(){const w=$('world');w.style.transform=`translate(${view.panX}px,${view.panY}px) scale(${view.zoom})`;$('zoom-value').textContent=Math.round(view.zoom*100)+'%';visibility();}
function zoomAt(requested,p){const zoom=Math.max(1,Math.min(8,requested)),ratio=zoom/view.zoom;view={zoom,panX:p.x-(p.x-view.panX)*ratio,panY:p.y-(p.y-view.panY)*ratio};paintView();}
function focus(name,zoom=4){const h=data.hexes.find(h=>label(h.coord)===name);if(!h)return;const p=hexToPixel(h.coord);view={zoom,panX:-(p.x-box.minX-box.width/2)*worldScale*zoom,panY:-(p.y-box.minY-box.height/2)*worldScale*zoom};paintView();log('focus',{name});}
function drawUnits(){
 $('units').innerHTML=data.counters.map(c=>{const peers=data.counters.filter(u=>hexKey(u.hex)===hexKey(c.hex));return renderCounter({...c,selected:c.id===selected},peers.indexOf(c),peers.length);}).join('');
 // 018 does not publish combat stats/supply as live map data; never display guessed 0-0-0 values.
 for(const el of $('units').querySelectorAll('.counter-stats'))el.textContent='步损 '+live.target.step;
 for(const el of $('units').querySelectorAll('[data-unit-id]')){const description=live.target.id+' · C10 · 步损'+live.target.step+'；战斗数值与补给状态未由此接口公开';el.setAttribute('aria-label',description);el.querySelector('title').textContent=description;}
 $('selection').innerHTML=cell?`<polygon points="${polygonPointsString(data.hexes.find(h=>hexKey(h.coord)===cell).coord)}"/>`:'';
}
function details(){
 const h=data.hexes.find(h=>hexKey(h.coord)===cell);if(!h)return;
 $('cell-name').textContent=label(h.coord);$('terrain-name').textContent=names[h.terrain]||h.terrain;
 const peers=data.counters.filter(u=>hexKey(u.hex)===cell);
 $('unit-list').replaceChildren(...peers.map(c=>{const b=document.createElement('button');b.dataset.pick=c.id;b.textContent=c.id+' · 步兵 · 步损'+c.step;b.setAttribute('aria-pressed',String(c.id===selected));b.onclick=()=>chooseUnit(c.id);return b;}));
 if(!peers.length)$('unit-list').textContent='没有接口公开的恢复目标；不推断其他兵力。';
 const info=data.edges.filter(e=>hexKey(e.a)===cell||hexKey(e.b)===cell).filter(e=>e.road||e.railway?.present||e.river||e.bridge);
 $('edge-list').replaceChildren(...info.map(e=>{const li=document.createElement('li');li.textContent=label(e.a)+'—'+label(e.b)+'：'+[e.road?'道路':'',e.railway?.present?'铁路':'',e.river?'河流':'',e.bridge?(e.bridge.destroyed?'损坏桥梁':'桥梁'):''].filter(Boolean).join(' / ');return li;}));
}
function chooseUnit(id){const c=data.counters.find(c=>c.id===id);if(!c)return;selected=id;cell=hexKey(c.hex);drawUnits();details();$('map-inspector').hidden=false;log('select-unit',{id});}
function chooseCell(key){cell=key;selected=null;drawUnits();details();$('map-inspector').hidden=false;log('select-cell',{key});}
function gestures(){
 const wrap=$('map-wrap'),points=new Map();let gesture=null,pinch=null,suppress=false;
 const local=e=>{const r=wrap.getBoundingClientRect();return{x:e.clientX-r.left-r.width/2,y:e.clientY-r.top-r.height/2};};
 const rebase=()=>{const p=[...points.entries()];gesture=null;pinch=null;if(p.length>=2)pinch={view:{...view},a:{...p[0][1]},b:{...p[1][1]}};else if(p.length){gesture=beginMapGesture(p[0][0],p[0][1].x,p[0][1].y,view);gesture.dragging=suppress;}};
 wrap.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('nav,aside'))return;if(!points.size)suppress=false;points.set(e.pointerId,local(e));rebase();if(points.size>=2){suppress=true;points.forEach((_,id)=>{try{wrap.setPointerCapture(id);}catch{}});}});
 wrap.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;const p=local(e);points.set(e.pointerId,p);if(pinch){const[a,b]=[...points.values()],from={x:(pinch.a.x+pinch.b.x)/2,y:(pinch.a.y+pinch.b.y)/2},to={x:(a.x+b.x)/2,y:(a.y+b.y)/2};view={...pinch.view};zoomAt(view.zoom*Math.hypot(a.x-b.x,a.y-b.y)/(Math.hypot(pinch.a.x-pinch.b.x,pinch.a.y-pinch.b.y)||1),from);view.panX+=to.x-from.x;view.panY+=to.y-from.y;paintView();e.preventDefault();return;}if(!gesture)return;gesture=updateMapGesture(gesture,p.x,p.y);if(gesture.dragging){wrap.setPointerCapture(e.pointerId);view=gesturePanViewport(gesture,p.x,p.y,view.zoom);paintView();e.preventDefault();}});
 const finish=(e,cancelled=false)=>{if(!points.has(e.pointerId))return;if(gesture){suppress=suppress||dragSuppressesTap(gesture,cancelled);if(gesture.dragging)log('pan',{...view});}if(pinch)log('pinch',{...view});points.delete(e.pointerId);rebase();if(wrap.hasPointerCapture(e.pointerId))wrap.releasePointerCapture(e.pointerId);};
 wrap.addEventListener('pointerup',e=>finish(e));wrap.addEventListener('pointercancel',e=>finish(e,true));wrap.addEventListener('lostpointercapture',e=>finish(e,true));
 wrap.addEventListener('click',e=>{if(e.target.closest('nav,aside'))return;if(suppress){e.preventDefault();return;}const u=e.target.closest('[data-unit-id]'),h=e.target.closest('[data-cell]');if(u)chooseUnit(u.getAttribute('data-unit-id'));else if(h)chooseCell(h.getAttribute('data-cell'));});
 wrap.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key))return;const u=e.target.closest('[data-unit-id]'),h=e.target.closest('[data-cell]');if(u){e.preventDefault();chooseUnit(u.getAttribute('data-unit-id'));}else if(h){e.preventDefault();chooseCell(h.getAttribute('data-cell'));}});
 wrap.addEventListener('wheel',e=>{if(e.target.closest('aside'))return;e.preventDefault();zoomAt(view.zoom+(e.deltaY<0?.16:-.16),local(e));log('wheel',{...view});},{passive:false});
 $('zoom-in').onclick=()=>zoomAt(view.zoom+.25,{x:0,y:0});$('zoom-out').onclick=()=>zoomAt(view.zoom-.25,{x:0,y:0});
 $('focus').onclick=()=>focus('X14',3);$('locate-rear').onclick=()=>focus('A10',3);$('locate-target').onclick=()=>{focus('C10',3);chooseUnit('G-I-01');};
 $('locate-object').onclick=()=>focus(document.body.dataset.object||'A10',3);
 $('fit').onclick=()=>{view={zoom:1,panX:0,panY:0};paintView();};
 $('grid').onclick=()=>{$('map-svg').classList.toggle('grid-off');$('grid').setAttribute('aria-pressed',String(!$('map-svg').classList.contains('grid-off')));};
 $('close-inspector').onclick=()=>{$('map-inspector').hidden=true;};
}
async function boot(){
 data=await(await fetch('./map-data.json')).json();box=viewBoxForHexes(data.hexes,8);
 // Reserve the known target footprint during precomposition without inventing display units.
 data.counters=[{...data.target,step:1,stats:{attack:0,defense:0,movement:0}}];
 $('map-svg').setAttribute('viewBox',`${box.minX} ${box.minY} ${box.width} ${box.height}`);
 $('hexes').innerHTML=data.hexes.map(h=>`<polygon data-cell="${hexKey(h.coord)}" data-label="${label(h.coord)}" data-terrain="${h.terrain}" points="${polygonPointsString(h.coord)}" role="button" tabindex="0" aria-label="${label(h.coord)} ${names[h.terrain]||h.terrain}"/>`).join('');
 $('labels').innerHTML=data.hexes.map(h=>{const p=hexToPixel(h.coord);return `<text x="${p.x}" y="${p.y+29}">${label(h.coord)}</text>`;}).join('');
 const fitSize=()=>{const w=$('map-wrap'),world=$('world'),width=Math.min(w.clientWidth-24,(w.clientHeight-24)*box.width/box.height),old=worldScale;worldScale=width/box.width;world.style.width=width+'px';world.style.height=width*box.height/box.width+'px';world.style.left=(w.clientWidth-width)/2+'px';world.style.top=(w.clientHeight-width*box.height/box.width)/2+'px';if(ready){view.panX*=worldScale/old;view.panY*=worldScale/old;paintView();}};
 new ResizeObserver(fitSize).observe($('map-wrap'));fitSize();
 stats=await paintBlend011($('terrain'),data,'015');
 live=window.industryConfirmedView||live;updateTarget();ready=true;drawUnits();gestures();focus('X14',3);
 $('loading').remove();stats.readyMs=performance.now()-start;document.body.dataset.mapReady='true';
 window.candidateMap={focus,report:()=>({view:{...view},cell,selected,hexes:data.hexes.length,edges:data.edges.length,counters:data.counters.map(c=>({id:c.id,hex:c.hex,step:c.step})),stats,events,canvasBytes:$('terrain').width*$('terrain').height*4,dom:document.querySelectorAll('*').length})};
}
boot().catch(e=>{$('loading').textContent='地图未能载入：'+e.message;console.error(e);});

