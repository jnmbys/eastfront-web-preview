import type {GrandPort} from './grand.js';
import {hexPolygon,pointString} from '../geometry/hex.js';
const NS='http://www.w3.org/2000/svg';
const time=(n:number)=>`${Math.floor(n/60)}小时${n%60}分`;
const side=(s:string)=>s==='GERMAN'?'德军':s==='SOVIET'?'苏军':'中立';
export function visionPanel(p:GrandPort){const v=p.data.continuous.vision;if(!v)return '';
 return `<p><b>己方实际控制区持续可见</b>，与部队侦察范围合并。离开部队的己方后方仍显示当前情况。</p><p>实控 ${v.controlled}格 · 实时识别 ${v.visible}/${v.total}格。敌方、未控制与中立地区不会自动点亮。</p><p>灰色斜线和虚线轮廓表示历史地点，绝非实时控制或敌军。失守只告知该格已失去；重新侦察前不追踪敌军。</p><p>看见不等于可调用。敌方精确组织、人员、装备和库存仍不公开。</p><h3>最后已知地点 ${v.stale.length}格</h3>${v.stale.map((h:any)=>`<p><button data-vision-locate="${h.hex}">${h.hex} · ${h.lost?'已失守，现控制待确认':'最后见为'+side(h.control)}</button><small>最后观察 ${time(h.lastSeenMinute)}${h.lost?' · 获知失守 '+time(h.lostAt):''}；历史设施 ${h.facilities.length}处</small></p>`).join('')||'<p>当前没有脱离视野的已知地块。</p>'}<h3>历史敌情 ${v.sightings.length}处</h3>${v.sightings.map((h:any)=>`<p><button data-vision-locate="${h.hex.q},${h.hex.r}">${h.hex.q},${h.hex.r} · 曾见${side(h.side)}</button><small>最后观察 ${time(h.lastSeenMinute??0)} · 位置未确认，不表示敌军仍在</small></p>`).join('')||'<p>无历史敌情。</p>'}<details><summary>规则版本与存档</summary>GRAND-VISION-001；本候选独立存档，拒绝直接载入旧视野版本。此记录不包含后来发生的隐藏变化。</details>`;
}
/** Memory is drawn separately over fog. It never changes real-time ownership or renders a current unit. */
export function paintTerritoryMemory(layer:SVGGElement,p:GrandPort,point:(h:any)=>{x:number;y:number}){
 const v=p.data.continuous.vision,records=v?.stale??[],signature=JSON.stringify(records);if(layer.getAttribute('data-memory')===signature)return;layer.setAttribute('data-memory',signature);
 const wanted=new Set<string>();for(const h of records){wanted.add(h.hex);let el=Array.from(layer.children).find(x=>x.getAttribute('data-memory-hex')===h.hex);if(!el){el=document.createElementNS(NS,'g');el.setAttribute('data-memory-hex',h.hex);layer.append(el);}const [q,r]=h.hex.split(',').map(Number),coord={q,r},at=point(coord),path='M'+hexPolygon(coord).map(p=>pointString(p)).join('L')+'Z';
 el.innerHTML=`<path d="${path}" fill="#626c69" fill-opacity=".18" stroke="#abb4b1" stroke-width="1.4" stroke-dasharray="4 5"/><path d="M${at.x-12},${at.y+12}l24,-24M${at.x-5},${at.y+15}l20,-20" fill="none" stroke="#abb4b1" stroke-width="1.2"/><title>${h.hex}：${h.lost?'已失守，现控制待确认':'最后见为'+side(h.control)}；最后观察 ${time(h.lastSeenMinute)}，并非实时</title>`;}
 for(const el of Array.from(layer.children))if(!wanted.has(el.getAttribute('data-memory-hex')!))el.remove();
}
