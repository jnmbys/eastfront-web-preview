// @ts-nocheck
// Selectively ported from COMMAND-001 39f0fd0; authorized render model only.
import { hexToPixel, polygonPointsString } from '../geometry/hex.js';
import { observePresentationTransitions } from '../presentation/transitionBus.js';
import { enumLabel, phaseName } from '../localization/index.js';
const sessions=new WeakMap();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=h=>`${h.q},${h.r}`;
const kindNames={move:'实际移动',retreat:'实际撤退',advance:'实际推进',breakthrough:'实际突破',hit:'实际损失 1 步',destroyed:'确认被消灭'};
export function scope(session,viewer){
    let s=sessions.get(session);if(!s){s={viewers:new Map()};sessions.set(session,s);}
    if(!s.viewers.has(viewer))s.viewers.set(viewer,{members:[],target:null,origin:null,picking:null,events:[],previous:new Map(),seen:new Set()});
    return s.viewers.get(viewer);
}
// No GameState access. Events are already filtered by the original player-view boundary.
export function observe(session,readAuthorized){
    const s=sessions.get(session)??{viewers:new Map()};sessions.set(session,s);
    if(s.observing)return;s.observing=true;
    observePresentationTransitions(session,events=>{
        const {viewer,view}=readAuthorized();const p=scope(session,viewer);
        for(const e of events){
            if(!kindNames[e.kind]||p.seen.has(e.id))continue;p.seen.add(e.id);
            const unit=view.units.find(u=>u.id===e.unitId);
            p.events.push({id:e.id,unitId:e.unitId,kind:e.kind,turn:view.turn,phase:view.phase,
                text:e.path?`${e.unitId} ${kindNames[e.kind]}：${key(e.path[0])} → ${key(e.path.at(-1))}`:`${e.unitId} ${kindNames[e.kind]}`,
                // Solid trails only for friendly, confirmed travel. Never follow hidden enemies.
                path:unit?.side===view.viewer&&e.path?structuredClone(e.path):null,
                position:e.position?{...e.position}:null});
        }
        p.events=p.events.slice(-12);
    });
}
export function toggleMember(p,model,id){
    if(model.deployment||model.combat?.pending||model.readOnly||!model.playerView.units.some(u=>u.id===id&&u.side===model.viewerSide&&u.friendly?.controllerId===model.viewerControllerId))return false;
    p.members=p.members.includes(id)?p.members.filter(x=>x!==id):[...p.members,id];return true;
}
export function mark(p,model,hex){
    if(model.combat?.pending||model.readOnly||!model.hexes.some(h=>key(h.coord)===key(hex)))return false;
    if(p.picking==='origin')p.origin={...hex};
    else if(p.picking==='target'){
        p.target={...hex};
        const u=model.playerView.units.find(u=>u.id===p.members[0]&&u.side===model.viewerSide);
        p.origin??=u?{...u.hex}:null;
    }else return false;
    p.picking=null;return true;
}
export function nextText(model){
    if(model.combat?.pending)return `先处理${enumLabel(model.combat.pending.kind)}；当前由${enumLabel(model.viewerSide)}决定。未完成前不能推进。`;
    const u=model.playerView.units.find(u=>u.id===model.selectedCounter?.id&&u.side===model.viewerSide);
    if(model.phase.endsWith('_MOVEMENT'))return u?.friendly?.hasMoved?'所选部队已移动。可查看目标，攻击需进入战斗阶段。':'现在可选择己方部队移动；攻击在随后战斗阶段。';
    if(model.phase.endsWith('_COMBAT'))return u?.friendly?.hasAttacked?'所选部队已攻击；是否还有特殊选择以原规则面板为准。':'现在可选择攻击部队和已知敌军目标，预览通过后自行确认。';
    if(model.phase.endsWith('_RECOVERY'))return '现在检查恢复资格与 RP 费用；筑垒需等恢复阶段结束。';
    if(model.phase.endsWith('_ENTRENCHMENT'))return '现在检查筑垒资格；此阶段不能补做移动、攻击或恢复。';
    return `当前：${phaseName(model.phase)}。先处理原规则面板内的补给、铁路或增援选择。`;
}
export function panel(session,model){
    const p=scope(session,model.viewerControllerId),own=model.playerView.units.filter(u=>u.side===model.viewerSide),pending=!!model.combat?.pending;
    const selected=own.find(u=>u.id===model.selectedCounter?.id&&u.friendly?.controllerId===model.viewerControllerId);
    const members=p.members.map(id=>{const u=own.find(u=>u.id===id);return `<button class="mini-button" data-command-unit="${esc(id)}" ${u?'':'disabled'}>${esc(id)}${u?` · ${key(u.hex)}`:' · 当前不可定位'}</button>${u?'':`<button class="mini-button" data-command-remove="${esc(id)}">移除记录</button>`}`;}).join('');
    return `<section class="panel-block command-brief"><span class="eyebrow">COMMAND-001 · 战役指挥候选</span><h3>${p.target?`关注目标 ${key(p.target)}`:'选择一个关注目标'}</h3><p class="command-next" role="status">${esc(nextText(model))}</p><div class="command-problems"><span>己方 ${own.length}</span><span>受损 ${own.filter(u=>u.step>0).length}</span><span>补给需关注 ${own.filter(u=>u.supplyState!=='SUPPLIED').length}</span></div><details><summary>需要支援的己方部队</summary><div class="command-unit-list">${own.filter(u=>u.step>0||u.supplyState!=='SUPPLIED').map(u=>`<button class="mini-button" data-command-locate="${esc(u.id)}">${esc(u.id)} · 步损 ${u.step} · ${esc(enumLabel(u.supplyState))}</button>`).join('')||'无已知问题'}</div></details>
    <div class="command-plan-members">${members||'<small>选中己方部队后，点击下方按钮加入计划。</small>'}</div>
    <div class="button-row"><button id="command-member" class="mini-button" ${selected&&!pending?'':'disabled'}>${selected&&p.members.includes(selected.id)?'移出计划':'选中部队加入计划'}</button><button id="command-target" class="mini-button" ${pending||model.readOnly?'disabled':''}>${p.target?'修改目标':'标记目标'}</button></div>
    <div class="button-row"><button id="command-origin" class="mini-button" ${p.target&&!pending&&!model.readOnly?'':'disabled'}>修改主攻起点</button><button id="command-focus" class="mini-button" ${p.target?'':'disabled'}>定位目标</button><button id="command-clear" class="mini-button">取消计划</button></div>
    <small>虚线箭头＝计划，不保证可达，不自动执行。标记持续到修改或取消；不同控制者各自保留。</small>
    ${p.picking?`<p class="command-picking">在地图点选${p.picking==='target'?'目标':'主攻起点'} <button id="command-cancel-pick" class="mini-button">取消点选</button></p>`:''}</section>`;
}
export function overlay(session,model){
    const p=scope(session,model.viewerControllerId),parts=[];
    parts.push(`<g class="command-control">${model.hexes.filter(h=>['GERMAN','SOVIET'].includes(h.control)).map(h=>`<polygon points="${polygonPointsString(h.coord)}" class="command-control-${h.control==='GERMAN'?'german':'soviet'}"/>`).join('')}</g>`);
    for(const u of model.playerView.units.filter(u=>u.side===model.viewerSide)){
        const v=hexToPixel(u.hex);
        if(p.members.includes(u.id))parts.push(`<circle cx="${v.x}" cy="${v.y}" r="32" class="command-member-ring"/>`);
        if(u.step>0||u.supplyState!=='SUPPLIED')parts.push(`<text x="${v.x+25}" y="${v.y-24}" class="command-problem-mark">${u.step>0?'伤':'补'}</text>`);
    }
    if(p.target){
        const t=hexToPixel(p.target);parts.push(`<polygon points="${polygonPointsString(p.target)}" class="command-goal"/><text x="${t.x+40}" y="${t.y-20}" class="command-plan-label">计划目标 ${key(p.target)}</text>`);
        if(p.origin){const a=hexToPixel(p.origin);parts.push(`<defs><marker id="command-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="#e6c87b"/></marker></defs><line x1="${a.x}" y1="${a.y}" x2="${t.x}" y2="${t.y}" class="command-plan-arrow" marker-end="url(#command-arrow)"/>`);}
    }
    for(const e of p.events.filter(e=>e.turn===model.turn&&e.path).slice(-3))parts.push(`<polyline points="${e.path.map(h=>{const a=hexToPixel(h);return `${a.x},${a.y}`;}).join(' ')}" class="command-actual-path"/>`);
    for(const e of p.events.filter(e=>e.turn===model.turn&&e.position&&['hit','destroyed'].includes(e.kind)).slice(-4))parts.push(`<circle cx="${e.position.x}" cy="${e.position.y}" r="34" class="command-loss-record"/><text x="${e.position.x+34}" y="${e.position.y+30}" class="command-plan-label">${e.kind==='hit'?'损失1步':'被消灭'}·历史位置</text>`);
    return `<g id="command-overlay" pointer-events="none">${parts.join('')}</g>`;
}
export function picker(session,model){
    const p=scope(session,model.viewerControllerId);
    if(!p.picking||model.combat?.pending||model.readOnly)return '';
    return `<g id="command-picker">${model.hexes.map(h=>`<polygon data-command-hex="${key(h.coord)}" points="${polygonPointsString(h.coord)}" fill="transparent" role="button" tabindex="0" aria-label="计划标记 ${key(h.coord)}"/>`).join('')}</g>`;
}
export function summary(session,model){
    const p=scope(session,model.viewerControllerId),events=p.events.slice(-4);
    const u=model.selectedCounter;
    const b=model.combat?.battle,r=b?.resolution;
    return `<div id="command-map-note"><strong>${u?`${esc(u.id)} · 实际位置 ${key(u.hex)} · 步损 ${u.step}`:'作战态势'}</strong><span>底色＝已知控制区；算子／接触点＝已知接敌位置；未知区域不推断战线。</span><span>金色虚线＝计划；绿色实线＝本回合已执行的己方路线。</span>${r?`<span>最近战斗 ${esc(r.crtResult)} · ${b.stage==='CLOSED'?'已结束':'仍有待决'}；要求步损 攻${r.attackerLossSteps}/守${r.defenderLossSteps}，撤退 攻${r.attackerRetreatSteps}/守${r.defenderRetreatSteps}。执行事实见下方。</span>`:''}${events.length?events.map(e=>`<span>T${e.turn} ${esc(e.text)}</span>`).join(''):'<span>尚无本视角观察到的新行动；计划标记不算战果。</span>'}</div>`;
}
