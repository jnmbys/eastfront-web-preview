import {planArrow} from './actionArrows.js';
import type {GrandPort} from './grand.js';
import {hexDistance,hexKey,hexNeighbors,hexToPixel,hexPolygon,pointString,type HexCoord} from '../geometry/hex.js';
import {escStatus as esc} from './unitStatus.js';
export const FRONT_LIMIT=24;
type Draft={group:string;instance:string;generation:number;front:HexCoord[];target:HexCoord|null;error:string};
export function currentPlan(p:GrandPort):Draft|null{try{return JSON.parse(p.selections['corps-plan']??'null');}catch{return null;}}
function save(p:GrandPort,d:Draft){p.selections['corps-plan']=JSON.stringify(d);}
function begin(p:GrandPort){const c=p.data.continuous,g=c.corps.find((g:any)=>g.id===p.selections['campaign-group'])??c.corps[0];let d=currentPlan(p);if(!d||d.group!==g.id||d.instance!==p.data.instanceId||d.generation!==g.commandGeneration){d={group:g.id,instance:p.data.instanceId,generation:g.commandGeneration,front:structuredClone(g.order.front??[]),target:null,error:''};save(p,d);}return d;}
// A bounded public-geography stroke, not a legal movement/path-safety query.
export function extendFront(front:HexCoord[],to:HexCoord,hexes:any[]|Map<string,any>){
 const cells=hexes instanceof Map?hexes:new Map(hexes.map(h=>[hexKey(h.coord),h]));const allowed=(h:HexCoord)=>cells.has(hexKey(h))&&cells.get(hexKey(h)).terrain!=='LAKE';
 if(!allowed(to))return {front,error:'战线必须在地图陆地上'};
 if(!front.length)return {front:[to],error:''};if(front.some(h=>hexKey(h)===hexKey(to)))return {front,error:''};
 const path=[...front];let from=path.at(-1)!;
 while(hexKey(from)!==hexKey(to)&&path.length<FRONT_LIMIT){const next=hexNeighbors(from).filter(h=>allowed(h)&&!path.some(p=>hexKey(p)===hexKey(h))&&hexDistance(h,to)<hexDistance(from,to)).sort((a,b)=>hexDistance(a,to)-hexDistance(b,to)||hexKey(a).localeCompare(hexKey(b)))[0];if(!next)return {front,error:'此笔跨越不可用地块；请分段沿陆地绘制'};path.push(next);from=next;}
 return hexKey(from)===hexKey(to)?{front:path,error:''}:{front,error:`战线最多${FRONT_LIMIT}格；请缩短本军团责任地段`};
}
export function planPanel(p:GrandPort){const c=p.data.continuous,g=c.corps.find((g:any)=>g.id===p.selections['campaign-group'])??c.corps[0],d=currentPlan(p),draft=d?.group===g.id?d:null,f=c.map.fronts.find((f:any)=>f.id===g.id);
 return `<section class="corps-plan-tools"><h3>军团布防与进攻</h3>${f?.posts?`<p class="front-readiness"><b>${g.order.paused?'暂停':g.order.kind==='ADVANCE'&&g.order.planAdvance?'进攻中':'布防中'}</b> · 已驻守 ${f.occupied} · 在途 ${f.inTransit} · 空缺 ${f.vacant} · 受阻 ${f.blocked} · 预备／机动 ${f.uncommitted??0}队${f.shortage?`<strong>兵力不足 ${f.shortage}队：缩短战线或增派部队</strong>`:''}</p>`:''}<div class="plan-steps"><button data-plan-tool="front">绘制／修改战线</button><button data-plan-tool="attack">设置进攻方向</button><button id="plan-start" ${!draft?.front.length||!draft.target||p.locked?'disabled':''}>开始进攻</button></div><p>${draft?`草案 ${draft.front.length}/${FRONT_LIMIT}格 · ${draft.target?'目标 '+hexKey(draft.target):'未指定进攻目标'}`:`已授权战线 ${g.order.front?.length??0}格`}</p>${draft?.error?`<p role="alert">${esc(draft.error)}</p>`:''}<div class="button-row"><button id="plan-hold" ${!draft?.front.length?'disabled':''}>确认战线并布防</button>${g.order.paused?'<button id="plan-resume" class="plan-primary">▶ 继续军团计划</button>':'<button id="plan-pause" class="plan-primary">Ⅱ 暂停军官</button>'}</div><button id="plan-stop-attack" ${!g.order.front?.length||g.order.kind!=='ADVANCE'?'disabled':''}>停止进攻，回到布防</button><p>${g.order.paused?'军官暂停，手动指挥与敌方攻击继续有效':g.order.kind==='HOLD'?'执行守备：维持责任地段，不向远方进攻':'执行推进：向已授权目标持续行动'}</p><details><summary>编辑／撤销计划</summary><button id="plan-cancel">撤销计划并待命</button></details><div></div><details><summary>计划范围与执行</summary><p>拖划或逐点连线，最多24格；仅指挥当前受托部队。完成战线即开始持续布防；开始进攻需单独授权，必要守军保留岗位。撤退、整补与手动任务优先；可用预备补空缺。宽虚线为草案，正式兵位以实际行军为准。</p><p>暂停军官不会暂停世界或立即脱离战斗。直属部队不会自动编入。</p></details></section>`;
}
export function planStrip(p:GrandPort){const mode=p.selections['plan-tool'];if(!mode)return '';return `<section class="map-plan-strip"><b>${mode==='front'?'绘制战线：拖划或逐格点选陆地':'进攻计划：拖向或点击最终目标'}</b><span id="plan-draw-status" role="status">${esc(currentPlan(p)?.error||('已选 '+(currentPlan(p)?.front.length??0)+' 格，松手保留草案'))}</span><button id="plan-finish-draw">${mode==='front'?'确认战线并布防':'保留进攻目标'}</button><button id="plan-abort-draw">取消此笔</button><small>单指绘线，双指拖图缩放；松手保留草案，不提交命令。</small></section>`;}
export function bindCorpsPlan(p:GrandPort,refresh:()=>void){
 const on=(id:string,fn:()=>void)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
 document.querySelectorAll<HTMLElement>('[data-plan-tool]').forEach(el=>el.onclick=()=>{const before=p.selections['corps-plan']??'null',d=begin(p);p.selections['plan-before']=before;d.error='';if(el.dataset.planTool==='front')d.front=[];save(p,d);p.directDraft=null;p.selections['map-command']='';p.selections['plan-tool']=el.dataset.planTool!;p.selections['ui-panel']='';refresh();});
 on('plan-finish-draw',()=>{if(p.selections['plan-tool']==='front'){submit('HOLD');return;}delete p.selections['plan-tool'];p.selections['ui-panel']='army';refresh();});
 on('plan-abort-draw',()=>{p.selections['corps-plan']=p.selections['plan-before']??'null';delete p.selections['plan-tool'];p.selections['ui-panel']='army';refresh();});
 const submit=(kind:string)=>{const d=currentPlan(p),g=p.data.continuous.corps.find((g:any)=>g.id===d?.group);if(!d||!g)return;if(d.instance!==p.data.instanceId||d.generation!==g.commandGeneration){d.error='军团命令已改变；请重新绘制或选定军团后重试';save(p,d);refresh();return;}if(!d.front.length||kind==='ADVANCE'&&!d.target)return;void p.operation({type:'ORDER',group:g.id,order:{kind,target:kind==='ADVANCE'?d.target:d.front[0],front:d.front,...(kind==='ADVANCE'?{planAdvance:true}:{}),risk:g.order.risk,paused:false}});delete p.selections['corps-plan'];delete p.selections['plan-tool'];p.selections['ui-panel']='army';refresh();};
 on('plan-stop-attack',()=>{const g=p.data.continuous.corps.find((g:any)=>g.id===p.selections['campaign-group'])??p.data.continuous.corps[0];const {planAdvance,...rest}=g.order;void p.operation({type:'ORDER',group:g.id,order:{...rest,kind:'HOLD',target:g.order.front[0],paused:false}});});
 on('plan-start',()=>submit('ADVANCE'));on('plan-hold',()=>submit('HOLD'));
 for(const [id,action]of [['plan-pause','pause'],['plan-resume','resume'],['plan-cancel','cancel']])on(id!,()=>{const g=p.data.continuous.corps.find((g:any)=>g.id===p.selections['campaign-group'])??p.data.continuous.corps[0];void p.operation({type:'ORDER',group:g.id,...(action==='cancel'?{replacePausedOrder:true}:{}),order:action==='cancel'?{kind:'REFIT',target:g.order.target,risk:g.order.risk,paused:true}:{...g.order,paused:action==='pause'}});delete p.selections['corps-plan'];refresh();});
}
export function paintPlanDraft(p:GrandPort){const svg=document.querySelector<SVGSVGElement>('#eastfront-map');if(!svg)return;let g=svg.querySelector('#corps-plan-draft');if(!g){g=document.createElementNS('http://www.w3.org/2000/svg','g');g.id='corps-plan-draft';g.setAttribute('pointer-events','none');svg.append(g);}const d=currentPlan(p);if(!d||d.instance!==p.data.instanceId){g.replaceChildren();return;}const points=d.front.map(h=>hexToPixel(h)),tail=d.target?hexToPixel(d.target):null,from=points[Math.floor(points.length/2)];g.innerHTML=`${d.front.map(h=>`<polygon points="${hexPolygon(h).map(q=>pointString(q)).join(' ')}" fill="#85c49e" fill-opacity=".30" stroke="#bedac8" stroke-width="2"/>`).join('')}<path d="${points.map((p,i)=>`${i?'L':'M'}${p.x} ${p.y}`).join(' ')}" fill="none" stroke="#b4d5c0" stroke-width="8" stroke-dasharray="12 6"/>${from&&tail?`<g data-draft-arrow="true">${planArrow(from,tail,false)}</g><polygon points="${hexPolygon(d.target!).map(pointString).join(' ')}" fill="none" stroke="#d1ebca" stroke-width="5"/>`:''}`;}
/** Uses the viewport's single pointer stream; no competing capture/listener lifecycle. */
export class MapPlanInput {
 private before=''; private active=false; private inverse:DOMMatrix|null=null;
 private cells=new Map<string,any>();private last='';private frame:number|null=null;private pending:PointerEvent|null=null;
 constructor(private port:()=>GrandPort|null,private refresh:()=>void){}
 get enabled(){return !!this.port()?.selections['plan-tool'];}
 start(e:PointerEvent){const p=this.port();if(!p||!this.enabled)return;this.before=p.selections['corps-plan']??'null';this.active=true;this.last='';
  this.inverse=document.querySelector<SVGSVGElement>('#eastfront-map')?.getScreenCTM()?.inverse()??null;
  this.cells=new Map(p.data.game.message.payload.view.hexes.map((h:any)=>[hexKey(h.coord),h]));this.add(e);
 }
 move(e:PointerEvent){if(!this.active)return;this.pending=e;if(this.frame===null)this.frame=requestAnimationFrame(()=>{this.frame=null;const e=this.pending;this.pending=null;if(e)this.add(e);});}
 end(e:PointerEvent,cancel=false){if(!this.active)return;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.pending=null;if(cancel)this.rollback();else this.add(e);this.active=false;this.refresh();}
 interrupt(){if(this.active)this.rollback();this.active=false;if(this.frame!==null)cancelAnimationFrame(this.frame);this.frame=null;this.pending=null;}
 private rollback(){const p=this.port();if(p){p.selections['corps-plan']=this.before;paintPlanDraft(p);this.status('双指操作地图；抬起双指后可继续绘线');}}
 private status(text:string){const el=document.getElementById('plan-draw-status');if(el)el.textContent=text;}
 private add(e:PointerEvent){const p=this.port();if(!p||!this.enabled||!this.inverse)return;
  const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(this.inverse),h=mapPointHex(pt.x,pt.y),k=hexKey(h);if(k===this.last)return;this.last=k;
  if(!this.cells.has(k)){this.status('当前位置不在地图内');return;}
  const d=currentPlan(p)??begin(p);if(p.selections['plan-tool']==='front'){const r=extendFront(d.front,h,this.cells);d.front=r.front;d.error=r.error;}else {if(this.cells.get(k).terrain==='LAKE'){this.status('目标必须为陆地');return;}d.target=h;d.error='';}
  save(p,d);paintPlanDraft(p);this.status(`${k} · ${d.error||('已选 '+d.front.length+' 格，松手保留')}`);
 }
}
/** Exact pointy-hex inverse; no full-map nearest-centre scan on pointermove. */
export function mapPointHex(x:number,y:number):HexCoord {const q=(Math.sqrt(3)*x/3-y/3)/42,r=2*y/3/42,s=-q-r;let a=Math.round(q),b=Math.round(r),c=Math.round(s);const da=Math.abs(a-q),db=Math.abs(b-r),dc=Math.abs(c-s);if(da>db&&da>dc)a=-b-c;else if(db>dc)b=-a-c;return {q:a,r:b};}
