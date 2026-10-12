import {provincePanel,bindProvince} from './provinces.js';
import {hoiTop,hoiRoster,hoiCommanders} from './hoiLayout.js';
import {selectionTools,bindSelection} from './multiCommand.js';
import {divisionPanel,bindDivision} from './divisionDesigner.js';
import {joystickSettings,bindJoystickSettings} from '../interaction/mapJoystick.js';
import {bindOnce} from '../ui/bindOnce.js';
import {planPanel,planStrip,bindCorpsPlan} from './corpsPlan.js';
import {directCommand} from './directCommand.js';
import {officerPortrait} from './officerPortrait.js';
import {warPanel,bindWar} from './warOverview.js';
import {saveStatus,releaseMode,roomStatus} from './release.js';
import {industryEnabled} from './industryModel.js';
import {corpsLogistics} from './logisticsPlanning.js';
import {visionPanel} from './territoryVision.js';
import {modernPanel,modernUnit,bindModern} from './modernEconomy.js';
import type {GrandPort} from './grand.js';
import {campaignUnit,campaignOrders,campaignEconomy,recoveryPanel} from './campaign.js';
import {mapPanel} from './battleMap.js';
import {cityMarkup} from './cities.js';
import {stackPanel} from './compactForces.js';
import {ownStatus,aggregateStatus,gearSummary,escStatus as esc,numberStatus} from './unitStatus.js';
export const corpsColors=['#8fb9c9','#c6a58d','#b1b889'];
export const tasks:Record<string,string>={HOLD:'守住防线',ADVANCE:'向目标推进',RETREAT:'撤回防线',REFIT:'整顿补充',ATTACK:'攻击',SUPPORT:'支援'};
export function commandedMembers(c:any,g:any){return g.members.filter((id:string)=>c.units[id]?.alive);}
export function directMembers(c:any){return Object.keys(c.units).filter(id=>c.units[id].alive);}
export function commandSummary(p:GrandPort){const d=p.data,c=d.continuous,ss=Object.keys(c.units).map(id=>ownStatus(p,id)).filter(Boolean),a=aggregateStatus(ss),types=d.ux.products;
 const stock:Record<string,number>={...(d.modern?.stock??{})};for(const w of d.warehouses.filter((w:any)=>w.controlled))for(const l of w.lots)if(l.qty>0&&l.availableTurn<=d.turn)stock[l.type]=(stock[l.type]??0)+l.qty;
 return {a,stock,equipment:ss.filter((s:any)=>s.gear?.some((g:any)=>g.missing>0)).map((s:any)=>s.id),low:ss.filter((s:any)=>s.low).map((s:any)=>s.id),supply:ss.filter((s:any)=>d.modern?(d.modern.network.rows[s.id]?.ratio??1)<.99:s.stock<=0).map((s:any)=>s.id),lines:d.ux.lines.filter((l:any)=>l.controlled&&l.product!=='IDLE').length,blocked:[...new Set(d.modern?Object.values(d.modern.network.rows).filter((r:any)=>r.ratio<.99).map((r:any)=>r.reason):(d.ux.last?.blocked??[]).map((x:any)=>x.reason))],stockText:Object.entries(stock).map(([k,v])=>(types[k]?.label??k)+' '+v).join('、')||'暂无可用仓储'};
}
const bottlenecks:Record<string,string>={TRUCK_SHORTAGE:'卡车不足',TRAIN_SHORTAGE:'火车不足',LINE_CAPACITY:'线路容量不足',ROUTE_UNAVAILABLE:'线路中断',MATERIAL_SHORTAGE:'缺物资',LINE_OR_SERVICE_RANGE:'线路或配送范围受限'};
export function commandDock(p:GrandPort,id:string|null,extra:string){const d=p.data,c=d.continuous,s=commandSummary(p),mode=p.selections['ui-panel']??'',group=c.corps.find((g:any)=>g.id===p.selections['campaign-group'])??c.corps[0],direct=directMembers(c),time=c.calendar??(String(Math.floor(c.minutes/60)).padStart(2,'0')+':'+String(c.minutes%60).padStart(2,'0'));
 const clockPending=Array.from(p.wire?.pending.values()??[]).find((r:any)=>r.command?.payload?.type==='CLOCK') as any;
 const toolbar=hoiTop(p,s);
 let body='',title='';
 if(mode==='division'){title='师编制设计';body=divisionPanel(p,id);}
 if(mode==='war'){title='战争概览';body=warPanel(p);}
 if(mode==='army'){title=group.name;body=planPanel(p)+`<details><summary>部队与补给 · ${commandedMembers(c,group).length}队</summary>${corpsLogistics(p,commandedMembers(c,group))}${campaignOrders(p,id,false)}</details>`;}
 if(mode==='unit'){title='部队指挥';body=stackPanel(p)+(id?campaignUnit(p,id)+combinedUnit(p,id)+(d.modern?modernUnit(p,id):recoveryPanel(p,id))+`<button data-ui-locate-unit="${esc(id)}">定位所选部队</button>`:'<p>点击地图部队，查看状态并下令。</p>');}
 if(mode==='direct'){title='全部部队 · '+direct.length+'队';body='<p>点击任意己方部队直接下令，保留原军团归属。</p>'+direct.map((id:string)=>`<button class="ui-unit-choice" data-ui-unit="${esc(id)}">${esc(id)} · ${esc(ownStatus(p,id)?.action)}<small>${ownStatus(p,id)?.low?'低组织 · ':''}${esc(gearSummary(ownStatus(p,id)))}</small></button>`).join('');}
 if(mode==='battle'||mode==='tools'){title=mode==='battle'?'战斗指挥':'战线与图层';body=mapPanel(p,id)+(mode==='tools'?`<div hidden>${campaignOrders(p,id,false)}</div>`:'');}
 if(mode==='city'){title='城市管理';body=cityMarkup(p);}
 if(mode==='economy'){title=({production:'生产',supply:'后勤',construction:'建设'} as Record<string,string>)[p.selections['modern-tab']??'production']??'生产';body=d.modern?modernPanel(p):`<p>可用仓储：${esc(s.stockText)}</p><p>库存仅计当前已可用的本方仓储；不加在制、在途或部队持有量。</p>`+campaignEconomy(p,id);}
 if(mode==='province'){title='省份';body=provincePanel(p);}
 if(mode==='alerts'){title='统帅待办';body=(d.modern?'<p>缺人、缺装备与日常供给独立处理。点击单位查看缺额与通达。</p>':recoveryPanel(p))+`<h3>低组织 ${s.low.length}队</h3>${s.low.map(id=>`<button data-ui-unit="${id}">${id} · 查看并接管</button>`).join('')||'<p>当前无低组织部队。</p>'}<h3>${d.modern?'日常供给不足':'补给已耗尽'} ${s.supply.length}队</h3>${s.supply.map(id=>`<button data-ui-unit="${id}">${id}</button>`).join('')}<h3>装备缺额 ${s.equipment.length}队</h3>${s.equipment.map((id:string)=>`<button data-ui-unit="${id}">${id} · ${esc(gearSummary(ownStatus(p,id)))}</button>`).join('')}<h3>运输瓶颈</h3><p>${s.blocked.map(x=>bottlenecks[String(x)]??String(x)).join('、')||'尚无已报告瓶颈'}</p><button data-ui-panel="economy">管理生产与配送</button><h3>正在交战 ${c.map.battles.length}处</h3>${c.map.battles.map((b:any)=>`<button data-open-battle="${b.id}">⚔ ${b.hex.q},${b.hex.r} · ${esc(b.role)}</button>`).join('')}`;}
 if(mode==='vision'){title='领土视野与历史情报';body=visionPanel(p);}
 if(mode==='settings'){title='战役与连接';body=`${joystickSettings()}<p>舒缓时钟：1×每5游戏分钟至少间隔2秒；计算忙时减速，不连跳追赶。</p>${d.divisions?.integrated?`<section><b>${d.divisions.integrated.tempo?.id==='DIVISION-TEMPO-2'?'快战节奏 · 步兵3km/h':'原编制战斗节奏'}</b>${d.divisions.integrated.tempo?.id!=='DIVISION-TEMPO-2'?'<p>暂停后可启用：步兵基础行军4→3km/h；交战损耗速率24倍（双方相同）。已开始路段不改，存档保留选择。</p><button id="tempo-upgrade" '+(!c.paused?'disabled':'')+'>采用较慢行军／较快战斗</button>':'<small>项目节奏适配；不改变生产、补充速率。</small>'}</section>`:''}<label><input id="industry-art-toggle" type="checkbox" ${industryEnabled(p)?'checked':''}>工业与后勤地图细化（关闭恢复原显示）</label><button id="campaign-load">${p.selections['load-confirm']?'确认加载并替换当前':'加载存档（默认暂停）'}</button>${p.selections['load-confirm']?'<button id="campaign-load-cancel">取消加载</button>':''}<p>离开前暂停并保存。加载会使旧请求失效；只会读取当前战役存档。</p><p>${esc(p.wireStatus)}</p><label>连接模拟<select id="campaign-link"><option value="clean">正常本机</option><option value="rtt1000" ${p.wire?.profile==='rtt1000'?'selected':''}>约1000ms往返</option><option value="constrained" ${p.wire?.profile==='constrained'?'selected':''}>300ms＋抖动限速</option></select></label><button id="campaign-disconnect">短暂断线并重连</button><button id="campaign-resync">重新读取授权状态</button><label><input id="campaign-autopause" type="checkbox" ${c.autopause?'checked':''}>首次接敌自动暂停</label><details><summary>目标、图例与口径</summary><p>${esc(c.victoryText??'夺取中央枢纽，保有西岸或东岸站区，连续守住120分钟且已进行12小时30分；15小时截止按原地点控制判断。')}暂停军官不停止敌军，暂停世界才停止演算。</p><p>绿条组织，金条人员。人员数字四舍五入为整数，比例仍由原始值计算。堆叠组织为各队比例均值，人员为总现有/总满编。低组织低于18，可能触发撤退，退路受阻仍会留在战场。</p><p>实线是当前已知控制交界；灰点线是对侧未知；彩色点划线为所选军团最多24格责任地段，宽箭头是计划。${c.vision?'己方实控区持续可见。灰色斜线地块仅为最后已知；失守不提供敌军后续位置。':'地图没有全域领土记忆，城市的最后已知归属另有待确认标记。'}</p></details><details><summary>连接诊断</summary><button id="release-diagnostic">生成通信报告</button><textarea id="release-diagnostic-output" readonly hidden aria-label="通信诊断报告"></textarea></details><details><summary>普通计划与原操作工具</summary>${extra}</details><button id="ui-exit">返回入口（保留进度）</button>${releaseMode()?'': '<a href="http://127.0.0.1:4241/">打开旧候选</a>'}`;}
 const bar=hoiCommanders(p);
 if(mode==='army')body=hoiRoster(p,id,commandedMembers(c,group))+body;
 if(mode==='direct')body=hoiRoster(p,id,direct);
 if(!mode&&id&&!p.selections['hoi-list-hidden']){title='选中部队';body=hoiRoster(p,id,direct)+`<button data-ui-panel="unit">所选部队详情</button>`;}
 return `<div class="r2-dock command-ui hoi-ui">${toolbar}${roomStatus(p)}${c.ended||p.notice?`<div class="ui-notice" role="status">${c.ended?esc((c.ended.winner==='GERMAN'?'德军获胜':c.ended.winner==='SOVIET'?'苏军获胜':'战役未分胜负')+' · '+c.ended.reason):esc(p.notice)}</div>`:''}${mode||(id&&!p.selections['hoi-list-hidden'])?`<aside class="ui-sidebar" data-mode="${mode||'unit-list'}"><header><h2>${esc(title)}</h2><button id="ui-close" aria-label="收起详情">×</button></header><div class="ui-content">${body}</div></aside>`:''}<div class="ui-map-legend">绿条 组织 · 金条 人员　<span>金色虚线 初始战区 · 浅色实线 已知控制交界</span></div>${id?directCommand(p,id):''}${planStrip(p)}${selectionTools(p)}${bar}</div>`;
}
export function bindCommandInterface(p:GrandPort,id:string|null,refresh:()=>void,select:(id:string)=>void,locate:(h:any)=>void){const c=p.data.continuous;window.dispatchEvent(new CustomEvent('map-ui-layout',{detail:[p.selections['ui-panel']??'',!!id,!!p.selections['plan-tool']].join(':')}));const tempoButton=document.getElementById('tempo-upgrade');if(tempoButton)tempoButton.onclick=()=>void p.operation({type:'DIVISION_TEMPO',policy:'DIVISION-TEMPO-2'});bindProvince(p,refresh);bindSelection(p,refresh);bindJoystickSettings();bindDivision(p,refresh);bindCorpsPlan(p,refresh);bindModern(p,refresh);bindWar(p,refresh);
 document.querySelectorAll<HTMLElement>('[data-ui-panel]').forEach(el=>el.onclick=()=>{document.getElementById('direct-cancel')?.click();p.selections['ui-panel']=el.dataset.uiPanel!;if(el.dataset.uiPanel==='province'){p.selections['map-command']='inspect';p.directDraft=null;p.directPreview=null;}refresh();});
 document.querySelectorAll<HTMLElement>('[data-vision-locate]').forEach(el=>el.onclick=()=>{const [q,r]=el.dataset.visionLocate!.split(',').map(Number);locate({q,r});});
 document.querySelectorAll<HTMLElement>('[data-ui-locate-force]').forEach(el=>el.onclick=()=>{const u=p.data.game.message.payload.view.units.find((u:any)=>u.id===el.dataset.uiLocateForce);if(u)locate(u.hex);});
 bindOnce("src/playable/commandInterface.ts:10678",document.getElementById('ui-close'),'click',()=>{p.selections['ui-panel']='';p.selections['hoi-list-hidden']='1';refresh();});
 bindOnce("src/playable/commandInterface.ts:10788",document.getElementById('release-diagnostic'),'click',()=>{const f=document.getElementById('release-diagnostic-output') as HTMLTextAreaElement;f.hidden=false;f.value=JSON.stringify(p.wire?.export(),null,2);});
 bindOnce("src/playable/commandInterface.ts:11017",document.getElementById('ui-exit'),'click',()=>document.getElementById('ai-exit')?.click());
 document.querySelectorAll<HTMLElement>('[data-ui-corps]').forEach(el=>el.onclick=()=>{document.getElementById('direct-cancel')?.click();const g=c.corps.find((g:any)=>g.id===el.dataset.uiCorps);p.directDraft=null;p.directPreview=null;delete p.selections['plan-tool'];p.selections['map-command']='';p.selections['campaign-group']=g.id;p.selections['campaign-kind']=g.order.kind;p.selections['campaign-risk']=g.order.risk;p.officerTarget={...g.order.target};p.selections['map-emphasis']='group';p.selections['ui-panel']='army';refresh();});
 document.querySelectorAll<HTMLElement>('[data-ui-locate]').forEach(el=>el.onclick=()=>{const g=c.corps.find((g:any)=>g.id===el.dataset.uiLocate),us=commandedMembers(c,g);if(us.length)locate(c.units[us[0]].hex);});
 document.querySelectorAll<HTMLElement>('[data-ui-locate-unit]').forEach(el=>el.onclick=()=>{const u=c.units[el.dataset.uiLocateUnit!];if(u)locate(u.hex);});
 document.querySelectorAll<HTMLElement>('[data-ui-stop]').forEach(el=>el.onclick=()=>{const g=c.corps.find((g:any)=>g.id===el.dataset.uiStop);void p.operation({type:'ORDER',group:g.id,order:{...g.order,paused:true}});});
 document.querySelectorAll<HTMLElement>('[data-ui-unit]').forEach(el=>el.onclick=()=>{document.getElementById('direct-cancel')?.click();p.selections['ui-panel']='unit';select(el.dataset.uiUnit!);});
}

function combinedUnit(p:GrandPort,id:string){const v=p.data.continuous.units[id],a=v?.division;if(!p.data.divisions?.integrated?.catalog||!a)return '';return `<section class="combined-unit"><b>编制实际能力</b><p>软攻 ${a.effective.softAttack.toFixed(1)}／满编 ${a.paper.softAttack.toFixed(1)} · 硬攻 ${a.effective.hardAttack.toFixed(1)} · 硬度 ${Math.round(a.effective.hardness*100)}%</p><p>装甲 ${a.effective.armor.toFixed(1)} · 穿甲 ${a.effective.piercing.toFixed(1)} · 速度 ${a.effective.speed.toFixed(1)} km/h</p>${v.fuel?.capacity?`<p>燃料 ${v.fuel.held.toFixed(1)} / ${v.fuel.capacity.toFixed(1)} · ${v.fuel.consumptionHour.toFixed(2)}/行动小时</p><small>${esc(v.fuel.reason)}</small>`:''}<details><summary>满编、缺装与燃料</summary><p>攻击、防御、突破按各组成的实际人员装备计算；混编取最慢营。燃料缺口会限制机动与进攻。此为已批准的项目适配。</p></details></section>`;}
