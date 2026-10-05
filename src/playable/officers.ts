import type {LogisticsPort} from './logistics.js';
const esc=(x:unknown)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function officerPanel(p:LogisticsPort,model:any){
 const o=p.data?.officers;if(!o||model.viewerSide!=='GERMAN')return '';
 const group=o.groups.find((g:any)=>g.id===p.officerGroup),own=model.playerView.units.filter((u:any)=>u.side===model.viewerSide);
 const name=(id:string)=>o.groups.find((g:any)=>g.members.includes(id))?.name??'直属';
 return `<section class="panel-block logistics-panel officer-panel"><label><input id="officer-enable" type="checkbox" ${o.enabled?'checked':''}>军官委托（可关闭）</label><p>初始全部直属；只有分配部队并明确下令才自动执行。阶段结束、铁路、工业与后勤仍由你决定。</p>
 ${o.enabled?`<label>军官 <select id="officer-group">${o.groups.map((g:any)=>`<option value="${g.id}" ${g.id===group.id?'selected':''}>${g.name} · ${g.members.length}支</option>`).join('')}</select></label>
 <p>${esc(group.name)}：${esc(group.status)} · 恢复RP额度${group.rp}。</p>
 <label>部队 <select id="officer-unit">${own.map((u:any)=>`<option value="${esc(u.id)}">${esc(u.id)} · ${esc(name(u.id))} · ${u.hex.q},${u.hex.r}</option>`).join('')}</select></label>
 <div class="button-row"><button id="officer-assign">交给此军官</button><button id="officer-recall">调回直属</button></div>
 <label>持续命令 <select id="officer-kind">${[['ATTACK','进攻'],['DEFEND','守备'],['REFIT','整补']].map(([k,n])=>`<option value="${k}" ${p.officerKind===k?'selected':''}>${n}</option>`).join('')}</select></label>
 <p>待下令目标：${p.officerTarget?`${p.officerTarget.q},${p.officerTarget.r}`:'未选择'}；整补无需目标。${group.order?`现行命令：${{ATTACK:'进攻',DEFEND:'守备',REFIT:'整补'}[group.order.kind as 'ATTACK']}${group.order.target?` ${group.order.target.q},${group.order.target.r}`:''}`:''}</p>
 <div class="button-row"><button id="officer-target" ${model.readOnly||model.combat?.pending?'disabled':''}>在地图选择命令目标</button><button id="officer-issue" ${p.officerKind!=='REFIT'&&!p.officerTarget?'disabled':''}>确认下令并执行</button></div>
 <div class="button-row"><button id="officer-pause">暂停并人工接管</button><button id="officer-resume" ${group.order?'':'disabled'}>继续原命令</button><button id="officer-cancel">取消命令</button></div>
 <label>分配恢复RP <select id="officer-rp">${Array.from({length:Math.max(0,Math.min(99,model.playerView.resources.GERMAN?.rp??0))+1},(_,i)=>`<option value="${i}" ${i===group.rp?'selected':''}>${i}</option>`).join('')}</select></label><button id="officer-budget">确认恢复额度</button><small>额度从现有RP划分，初始为0，不赠送资源、不自动补足。跨编组联合攻击需先暂停相关军官。</small>
 <p role="status">${esc(p.officerNotice)}</p>
 <details><summary>任务、直属与后勤需求</summary>${o.groups.map((g:any)=>`<p>${esc(g.name)}：${g.paused?'暂停':'授权'}；${g.members.map(esc).join('、')||'无部队'}。${g.needs.length?'请求玩家关注：'+g.needs.map((u:any)=>`${esc(u.id)} 步损${u.damage}${u.supply==='SUPPLIED'?'':'、缺供'}`).join('；'):'无已知伤损/缺供需求'}</p>`).join('')}<p>直属：${own.filter((u:any)=>name(u.id)==='直属').map((u:any)=>esc(u.id)).join('、')}</p></details>
 <details open><summary>任务记录（真实提交）</summary>${o.reports.slice(-5).reverse().map((r:any)=>`<p>T${r.turn} ${esc(r.officer)} · ${r.accepted?'已执行':'已拒绝'} ${esc(r.action.type)} ${esc(r.action.unitId??r.action.attackerUnitIds?.join('、')??'战后处理')}：${esc(r.reason)}</p>`).join('')||'<p>尚无军官行动。普通计划标记不构成授权。</p>'}</details>`:''}</section>`;
}
export function bindOfficers(p:LogisticsPort,pick:()=>void){
 const listen=(id:string,fn:()=>void)=>document.getElementById(id)?.addEventListener('click',fn);
 const value=(id:string)=>(document.getElementById(id)as HTMLSelectElement)?.value;
 const config=(type:string,extra={})=>void p.officerConfig({type,group:p.officerGroup,...extra});
 document.querySelector<HTMLInputElement>('#officer-enable')?.addEventListener('change',e=>config('ENABLE',{enabled:(e.target as HTMLInputElement).checked}));
 document.getElementById('officer-group')?.addEventListener('change',()=>p.officerChoose(value('officer-group')));
 document.getElementById('officer-kind')?.addEventListener('change',()=>{p.officerKind=value('officer-kind');p.officerChoose(p.officerGroup);});
 listen('officer-assign',()=>config('ASSIGN',{unit:value('officer-unit'),direct:false}));
 listen('officer-recall',()=>config('ASSIGN',{unit:value('officer-unit'),direct:true}));
 listen('officer-target',pick);
 listen('officer-issue',()=>config('ORDER',{order:{kind:p.officerKind,target:p.officerKind==='REFIT'?null:p.officerTarget}}));
 listen('officer-pause',()=>config('PAUSE'));listen('officer-resume',()=>config('RESUME'));listen('officer-cancel',()=>config('CANCEL'));
 listen('officer-budget',()=>config('RP',{amount:Number(value('officer-rp'))}));
}
