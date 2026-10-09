import type {GrandPort} from './grand.js';
type Point={x:number;y:number};
const NS='http://www.w3.org/2000/svg';
const labels:Record<string,string>={MOVE:'行军',ATTACK:'正面攻击',SUPPORT:'支援攻击，不自动跟进',RETREAT:'撤回'};
const colors:Record<string,string>={MOVE:'#6eaa70',ATTACK:'#ce5948',SUPPORT:'#66a9d4',RETREAT:'#b1b2aa'};
const esc=(s:any)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function actionProgressText(a:any){if(a.segment){const s=a.segment;return `当前路段 ${Math.round(s.completed/s.total*100)}% · ${a.status==='COMPLETED'?'已到达':`预计${s.remainingMinutes}游戏分钟后到达`}`;}return `${a.activity??'等待执行'}${a.estimate?' · '+a.estimate.scope+'：'+a.estimate.label:''}`;}
function set(e:Element,k:string,v:string){if(e.getAttribute(k)!==v)e.setAttribute(k,v);}
function patch(e:Element,s:string){if(e.getAttribute('data-markup')!==s){e.innerHTML=s;e.setAttribute('data-markup',s);}}
function line(ps:Point[]){return ps.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join('');}
function head(a:Point,b:Point,length:number,width:number){const t=Math.atan2(b.y-a.y,b.x-a.x),c=Math.cos(t),s=Math.sin(t);return `${b.x},${b.y} ${b.x-length*c+width*s},${b.y-length*s-width*c} ${b.x-length*.72*c},${b.y-length*.72*s} ${b.x-length*c-width*s},${b.y-length*s+width*c}`;}
export function planArrow(a:Point,b:Point,paused:boolean){const d=Math.hypot(b.x-a.x,b.y-a.y);if(d<1)return '';const end={x:a.x+(b.x-a.x)*Math.max(0,(d-23))/d,y:a.y+(b.y-a.y)*Math.max(0,(d-23))/d};return `<g opacity="${paused?'.18':'.32'}"><path d="${line([a,end])}" fill="none" stroke="#f1cb70" stroke-width="21" stroke-linecap="butt"/><polygon points="${head(a,b,38,26)}" fill="#f1cb70" stroke="#746139" stroke-width="1"/></g>`;}
/** Draw only accepted authoritative actions. Planned targets never become routes. */
export function paintActionArrows(layer:SVGElement,p:GrandPort,point:(h:any)=>Point,size:number,canInspect:()=>boolean,refresh:()=>void){
 const c=p.data.continuous,actions=c.map.actions??[],keep=new Set<string>(),selectedUnit=p.selections['map-selected-unit'],group=c.corps.find((g:any)=>g.id===(p.selections['campaign-group']??c.corps[0].id)),emphasis=p.selections['map-emphasis'];
 for(const a of actions){if(!a.path?.length||a.path.length<2)continue;keep.add(a.id);let el=Array.from(layer.children).find(e=>e.getAttribute('data-action-id')===a.id) as SVGGElement|undefined;if(!el){el=document.createElementNS(NS,'g');set(el,'data-action-id',a.id);layer.append(el);}
  const chosen=emphasis==='battle'?a.battleId===p.selections.battle:emphasis==='group'?group?.members.includes(a.unit):emphasis==='action'?a.id===p.selections.action:a.unit===selectedUnit;
  const prominent=chosen||!!p.selections.allArrows,ps:Point[]=a.path.map((h:any)=>point(h));
  // Same origin/target attacks retain separate stable lanes; movement routes are never displaced.
  const siblings=['ATTACK','SUPPORT'].includes(a.kind)?actions.filter((x:any)=>['ATTACK','SUPPORT'].includes(x.kind)&&x.from.q===a.from.q&&x.from.r===a.from.r&&x.to.q===a.to.q&&x.to.r===a.to.r).slice().sort((x:any,y:any)=>String(x.unit).localeCompare(String(y.unit))||String(x.id).localeCompare(String(y.id))):[];
  let lane=0;if(siblings.length>1){lane=(siblings.findIndex((x:any)=>x.id===a.id)/(siblings.length-1)*2-1)*7*size;const start=ps[0]!,stop=ps[ps.length-1]!,dx=stop.x-start.x,dy=stop.y-start.y,span=Math.hypot(dx,dy);if(span>.1)ps.splice(1,ps.length-2,...[.25,.60].map(t=>({x:start.x+dx*t-dy/span*lane,y:start.y+dy*t+dx/span*lane})));}
  set(el,'data-lane-offset',String(lane/size));
  // Keep the true anchor in metadata; trim visible shafts to the edge of compact counters.
  // All points stay within the accepted segment/corridor; no new path or destination is inferred.
  const trimEnd=(path:Point[],amount:number)=>{while(path.length>1&&amount>0){const a=path[0]!,b=path[1]!,d=Math.hypot(b.x-a.x,b.y-a.y);if(d<=amount&&path.length>2){path.shift();amount-=d;}else{const t=Math.min(amount,d*.8)/Math.max(.001,d);path[0]={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};break;}}};
  trimEnd(ps,18*size);ps.reverse();trimEnd(ps,18*size);ps.reverse();
  const first=ps[0]!,end=ps[ps.length-1]!,before=ps[ps.length-2]!,length=Math.hypot(end.x-before.x,end.y-before.y);if(length<.1){patch(el,'');continue;}
  const d=line(ps),color=colors[a.kind]??'#b1b2aa',preview=a.status==='ACCEPTED',shaft=(prominent?8:6)*size,tip=Math.min(21*size,length*.65),width=tip*.55,back={x:end.x+(before.x-end.x)*tip*.65/length,y:end.y+(before.y-end.y)*tip*.65/length},shaftPath=line([...ps.slice(0,-1),back]);
  const title=`${a.unit} · ${labels[a.kind]??a.kind} · ${a.from.q},${a.from.r} → ${a.to.q},${a.to.r} · ${a.status==='COMPLETED'?'已到达':preview?'已接受，等待执行':'执行中'} · ${actionProgressText(a)} · ${a.reason??''}`;
  set(el,'data-segment-progress',a.segment?String(a.progress):'none');set(el,'class','actual-action-arrow');set(el,'data-kind',a.kind);set(el,'data-unit',a.unit);set(el,'data-battle',a.battleId??'');set(el,'data-status',a.status);set(el,'opacity',prominent?'1':p.selections['map-scale-mode']==='far'?'.18':((emphasis==='battle'&&p.selections.battle)||(emphasis==='unit'&&selectedUnit))?'.22':a.kind==='ATTACK'||a.kind==='SUPPORT'?'.94':'.72');set(el,'role','button');set(el,'tabindex','0');set(el,'aria-label',title);set(el,'pointer-events','none');
  const dash=a.kind==='RETREAT'?`${7*size} ${4*size}`:preview?`${3*size} ${3*size}`:'none';
  const support=a.kind==='SUPPORT'?`<circle cx="${first.x}" cy="${first.y}" r="${4*size}" fill="#253a46" stroke="${color}" stroke-width="${1.5*size}"/><path d="M${first.x-2*size},${first.y}H${first.x+2*size}M${first.x},${first.y-2*size}V${first.y+2*size}" stroke="${color}" stroke-width="${size}"/>`:'';
  const attack=a.kind==='ATTACK'?`<path d="M${first.x-3*size},${first.y-3*size}L${first.x+3*size},${first.y+3*size}M${first.x-3*size},${first.y+3*size}L${first.x+3*size},${first.y-3*size}" stroke="#f5c4a6" stroke-width="${1.8*size}"/>`:'';
  const isSegment=!!a.segment,pct=Math.min(100,Math.max(0,(a.progress??0)*100)),maskId='segment-'+String(a.id).replace(/[^a-zA-Z0-9_-]/g,'-'),shape=head(before,end,tip,width),base=isSegment?'#263e32':preview?'#26372e':color;
  // Full silhouette is the mask: the front traverses the actual polyline, including the arrowhead.
  // No wall-clock animation; only authoritative work changes the fill, including after reconnect.
  const progress=isSegment?`<defs><mask id="${maskId}"><path d="${shaftPath}" fill="none" stroke="white" stroke-width="${shaft}" stroke-linejoin="round"/><polygon points="${shape}" fill="white"/></mask></defs><g mask="url(#${maskId})"><path d="${d}" pathLength="100" fill="none" stroke="${a.kind==='RETREAT'?'#deded4':'#a4d48d'}" stroke-width="${Math.max(shaft,width*2+2*size)}" stroke-linejoin="round" stroke-linecap="butt" stroke-dasharray="${pct} 101"/></g>`:'';
  patch(el,`<path d="${shaftPath}" fill="none" stroke="#182720" stroke-width="${shaft+2*size}" stroke-linejoin="round" stroke-dasharray="${dash}"/><path d="${shaftPath}" fill="none" stroke="${base}" stroke-width="${shaft}" stroke-linejoin="round" stroke-dasharray="${dash}"/><polygon points="${shape}" fill="${base}" stroke="#182720" stroke-width="${1.2*size}"/>${progress}${support}${attack}<path d="${d}" fill="none" stroke="transparent" stroke-width="${6*size}" pointer-events="${canInspect()?'stroke':'none'}"/><title>${esc(title)}</title>`);
  let down:Point|null=null;el.onpointerdown=e=>{down={x:e.clientX,y:e.clientY};};const choose=()=>{p.selections.action=a.id;p.selections['map-emphasis']='action';p.selections['ui-panel']=a.battleId?'battle':'tools';if(a.battleId)p.selections.battle=a.battleId;refresh();};el.onclick=e=>{if(!canInspect()||down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;e.stopPropagation();const card=document.elementsFromPoint(e.clientX,e.clientY).map(n=>n.closest<SVGGElement>('[data-stack-key]')).find(Boolean);if(card?.onclick){card.onclick.call(card,e);return;}choose();};el.onkeydown=e=>{if(canInspect()&&(e.key==='Enter'||e.key===' ')){e.preventDefault();choose();}};
 }
 for(const el of Array.from(layer.children))if(!el.hasAttribute('data-pending-id')&&!keep.has(el.getAttribute('data-action-id')!))el.remove();
}
