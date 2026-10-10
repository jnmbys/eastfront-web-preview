import type {GrandPort} from './grand.js';
import {escStatus as esc,ownStatus,statusBars,equipmentDetail} from './unitStatus.js';
type Draft={name:string;regiments:(string|null)[][];support:(string|null)[]};
type Editor={instance:string;id:string|null;version:number;draft:Draft;slot:{column:number;row:number}|null;dirty:boolean;pending:boolean};
const equipmentNames:Record<string,string>={infantry_equipment:'步兵装备',motorized_equipment:'卡车',artillery_equipment:'火炮',anti_tank_equipment:'反坦克炮',medium_tank_chassis:'中型坦克底盘',heavy_tank_chassis:'重型坦克底盘',support_equipment:'支援装备'};
function requirements(d:Draft,reference:any){let manpower=0;const equipment:Record<string,number>={};for(const id of [...d.regiments.flat(),...d.support]){if(!id)continue;const u=reference.units[id];if(!u)throw Error('编制需求资料缺失');manpower+=u.manpower;for(const [k,v]of Object.entries(u.equipment))equipment[k]=(equipment[k]??0)+Number(v);}return {manpower,equipment};}
const editors=new WeakMap<GrandPort,Editor>();
const blank=():Draft=>({name:'新编制草案',regiments:Array.from({length:5},()=>Array(5).fill(null)),support:Array(5).fill(null)});
function editor(p:GrandPort){let e=editors.get(p);if(!e||e.instance!==p.data.instanceId){e={instance:p.data.instanceId,id:null,version:0,draft:blank(),slot:null,dirty:false,pending:false};editors.set(p,e);}return e;}
function choose(p:GrandPort,t:any,copy=false){const e=editor(p);if(e.dirty&&!confirm('放弃尚未保存的草案修改？'))return;e.id=copy?null:t.id;e.version=copy?0:t.version;e.draft={name:t.name+(copy?' 副本':''),regiments:structuredClone(t.regiments),support:[...t.support]};e.dirty=copy;e.slot=null;}
export function divisionPanel(p:GrandPort,unit:string|null){const d=p.data.divisions;if(!d)return '';const e=editor(p),catalog=d.catalog,old=d.templates.find((x:any)=>x.id===e.id),count=(x:Draft)=>x.regiments.flat().filter(Boolean).length,sc=(x:Draft)=>x.support.filter(Boolean).length;
 const slot=(column:number,row:number,value:string|null)=>`<button class="division-slot" data-division-slot="${column}:${row}" aria-label="${column<0?'支援连':'第'+(column+1)+'团'}第${row+1}槽：${value?esc(catalog[value].label):'空'}" aria-pressed="${e.slot?.column===column&&e.slot?.row===row}"><b>${value?esc(catalog[value].symbol):'＋'}</b><small>${value?esc(catalog[value].label):'空槽'}</small></button>`;
 const before=requirements(old??blank(),d.demandReference),after=requirements(e.draft,d.demandReference);
 const demandRows=[['人员',before.manpower,after.manpower],...Array.from(new Set([...Object.keys(before.equipment),...Object.keys(after.equipment)])).sort().map(k=>[equipmentNames[k]??k,before.equipment[k]??0,after.equipment[k]??0])];
 const options=e.slot?Object.entries(catalog).filter(([,x]:any)=>x.role===(e.slot!.column<0?'support':'line')):[];
 return `<section class="division-designer"><fieldset ${e.pending?'disabled':''}><p class="division-review">编制草案 · 尚未开放换编</p><div class="button-row"><button id="division-new">新建</button><button id="division-copy">复制当前</button></div><label>草案库<select id="division-library"><option value="">选择已保存草案</option>${d.templates.map((t:any)=>`<option value="${esc(t.id)}" ${t.id===e.id?'selected':''}>${esc(t.name)} · v${t.version}</option>`).join('')}</select></label><label>名称<input id="division-name" maxlength="48" value="${esc(e.draft.name)}"></label>
 <div class="division-grid"><div class="division-column"><small>支援连</small>${e.draft.support.map((x,r)=>slot(-1,r,x)).join('')}</div>${e.draft.regiments.map((xs,c)=>`<div class="division-column"><small>第${c+1}团</small>${xs.map((x,r)=>slot(c,r,x)).join('')}</div>`).join('')}</div>
 ${e.slot?`<div class="division-palette" aria-label="选择营或支援连">${options.map(([k,x]:any)=>`<button data-division-type="${k}">${esc(x.symbol)} ${esc(x.label)}</button>`).join('')}<button data-division-type="">移除此槽</button></div>`:''}
 <table><thead><tr><th>组成</th><th>保存前</th><th>当前草案</th></tr></thead><tbody><tr><td>战斗营</td><td>${old?count(old):0}</td><td>${count(e.draft)}</td></tr><tr><td>支援连</td><td>${old?sc(old):0}</td><td>${sc(e.draft)}</td></tr></tbody></table>
 <h3>目标满编需求</h3><table><thead><tr><th>人员／装备</th><th>保存前</th><th>当前草案</th></tr></thead><tbody>${demandRows.map(([name,a,b])=>`<tr><td>${esc(String(name))}</td><td>${a}</td><td>${b}</td></tr>`).join('')}</tbody></table><small>按本机1.19.3基础营定义逐项相加；不是当前实装或有效战力。不含科技与学说修正。</small>
 <button id="division-save" ${e.pending||p.locked?'disabled':''}>${e.pending?'草案保存待确认':'保存草案（不换编）'}</button><p>影响现役部队：0。草案不扣资源，也不授予人员、装备或战力。</p>
 <details><summary>属性与费用为何未显示数值？</summary><p>${d.blockers.map(esc).join('；')}。目标人员和装备基础需求已有来源；组织、攻击、防御、速度、供给、修改费用及换编规则仍待完整核实，不以猜测值代替。槽位与可选条目目前仅用于编辑草案，不代表已获原版采用资格。</p></details>
 ${unit?`<h3>所选部队 ${esc(unit)} · 当前实装</h3>${statusBars(ownStatus(p,unit))}${equipmentDetail(ownStatus(p,unit))}<p>仍采用原编制与原结算，草案编辑不会影响其军团、岗位或命令。</p>`:'<p>选中地图部队可并列查看当前人员和装备。</p>'}</fieldset></section>`;
}
export function bindDivision(p:GrandPort,refresh:()=>void){if(!p.data.divisions)return;const e=editor(p),catalog=p.data.divisions.catalog;
 const name=document.querySelector<HTMLInputElement>('#division-name');if(name)name.oninput=()=>{e.draft.name=name.value;e.dirty=true;};
 const lib=document.querySelector<HTMLSelectElement>('#division-library');if(lib)lib.onchange=()=>{const t=p.data.divisions.templates.find((x:any)=>x.id===lib.value);if(t){choose(p,t);refresh();}};
 const on=(id:string,f:()=>void)=>{const el=document.getElementById(id);if(el)el.onclick=f;};
 on('division-new',()=>{choose(p,{...blank(),id:null,version:0});refresh();});
 on('division-copy',()=>{choose(p,{...e.draft,id:e.id,version:e.version},true);refresh();});
 document.querySelectorAll<HTMLElement>('[data-division-slot]').forEach(el=>el.onclick=()=>{const [column,row]=el.dataset.divisionSlot!.split(':').map(Number);e.slot={column:column!,row:row!};refresh();});
 document.querySelectorAll<HTMLElement>('[data-division-type]').forEach(el=>el.onclick=()=>{if(!e.slot)return;const value=el.dataset.divisionType||null;if(value&&e.slot.column<0&&e.draft.support.some((x,r)=>x===value&&r!==e.slot!.row)){p.notice='同一种支援连已存在，请选择其他类型。';refresh();return;}if(value&&!catalog[value])return;if(e.slot.column<0)e.draft.support[e.slot.row]=value;else e.draft.regiments[e.slot.column]![e.slot.row]=value;e.dirty=true;e.slot=null;refresh();});
 on('division-save',()=>{if(e.pending)return;if(!e.draft.name.trim()){p.notice='请填写草案名称。';refresh();return;}e.pending=true;
  let requestId:string|undefined;const submitted=structuredClone(e.draft),priorIds=new Set(p.data.divisions.templates.map((t:any)=>t.id));
  const done=(ev:any)=>{const row=p.wire.history.find((r:any)=>r.command.requestId===ev.detail.requestId);if(ev.detail.requestId!==requestId)return;p.wire.removeEventListener('completed',done);e.pending=false;if(ev.detail.status==='applied'){e.dirty=false;const t=p.data.divisions.templates.find((t:any)=>e.id?t.id===e.id:!priorIds.has(t.id)&&t.name===submitted.name);if(t){e.id=t.id;e.version=t.version;}}refresh();};
  p.wire.addEventListener('completed',done);void p.operation({type:'DIVISION_DRAFT_SAVE',templateId:e.id,expectedTemplateVersion:e.version,draft:submitted}).then(id=>{requestId=id;if(!id){p.wire.removeEventListener('completed',done);e.pending=false;refresh();}});refresh();
 });
}
