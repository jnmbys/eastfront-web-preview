import type {GrandPort} from './grand.js';
import {hexToPixel,hexPolygon,pointString} from '../geometry/hex.js';
import {makeDirectDraft,directIssue} from './directCommand.js';
export function selectedUnits(p:GrandPort):string[]{
 try{return JSON.parse(p.selections['multi-units']??'[]').filter((id:string)=>p.data.continuous.units[id]?.alive&&p.data.game.message.payload.view.units.some((u:any)=>u.id===id&&u.side===p.data.viewer));}catch{return [];}
}
export function unitsInBox(p:GrandPort,a:{x:number;y:number},b:{x:number;y:number}):string[]{
 const v=p.data.game.message.payload.view;
 return v.units.filter((u:any)=>u.side===v.viewer&&p.data.continuous.units[u.id]?.alive).filter((u:any)=>{
  const q=hexToPixel(u.hex);return q.x>=Math.min(a.x,b.x)&&q.x<=Math.max(a.x,b.x)&&q.y>=Math.min(a.y,b.y)&&q.y<=Math.max(a.y,b.y);
 }).map((u:any)=>u.id).sort();
}
export function multiTarget(p:GrandPort,target:any){
 const ids=selectedUnits(p);if(ids.length<2)return false;
 const v=p.data.game.message.payload.view,enemy=v.units.some((u:any)=>u.side!==v.viewer&&u.hex.q===target.q&&u.hex.r===target.r);
 const kind=p.selections['multi-kind']|| (enemy?'ATTACK':'ADVANCE');
 let sent=0;for(const id of ids){const d=makeDirectDraft(p,id,kind,target),reason=directIssue(p,d);if(reason)p.directFeedback[id]=reason;else {p.submitDirectIntent(d);sent++;}}
 p.notice=`${sent}/${ids.length}队命令已提交；各队分别裁决通路与占位`;return true;
}
export function selectionTools(p:GrandPort){const ids=selectedUnits(p);return `<div class="map-selection-tools"><button id="map-box-select" aria-pressed="${p.selections['plan-tool']==='box'}">▧ 框选部队</button>${ids.length>1?`<b>已选 ${ids.length}队</b><button id="multi-clear">清除多选</button>`:''}</div>`;}
export function bindSelection(p:GrandPort,refresh:()=>void){
 const start=document.getElementById('map-box-select');if(start)start.onclick=()=>{p.selections['plan-tool']=p.selections['plan-tool']==='box'?'':'box';p.selections['ui-panel']='';p.directDraft=null;refresh();};
 const clear=document.getElementById('multi-clear');if(clear)clear.onclick=()=>{delete p.selections['multi-units'];delete p.selections['multi-kind'];refresh();};
}
export function paintSelection(p:GrandPort){const svg=document.querySelector('#eastfront-map');if(!svg)return;let g=svg.querySelector('#multi-selection');if(!g){g=document.createElementNS('http://www.w3.org/2000/svg','g');g.id='multi-selection';g.setAttribute('pointer-events','none');svg.append(g);}const cells=new Set<string>(),polys:string[]=[];
 for(const id of selectedUnits(p)){const h=p.data.continuous.units[id]?.hex;if(!h)continue;const key=h.q+','+h.r;if(cells.has(key))continue;cells.add(key);polys.push(`<polygon points="${hexPolygon(h).map(pointString).join(' ')}" fill="#d4e2b0" fill-opacity=".10" stroke="#dfedbb" stroke-width="3"/>`);}
 const html=polys.join('');if(g.innerHTML!==html)g.innerHTML=html;
}
