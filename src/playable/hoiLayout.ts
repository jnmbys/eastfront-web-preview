import type {GrandPort} from './grand.js';
import {ownStatus,escStatus as esc} from './unitStatus.js';
import {officerPortrait} from './officerPortrait.js';
import {saveStatus} from './release.js';

// Original line symbols; no Paradox artwork or unsupported game controls.
export function commandIcon(kind:string){const paths:Record<string,string>={
 armor:'M3 12h18v7H3Zm4-5h9v5M16 9h7M5 22h14M6 15v2m5-2v2m5-2v2',
 artillery:'M12 3v18M3 12h18M6 6l12 12M18 6 6 18',
 motor:'M2 7h13v11H2Zm13 4h5l3 4v3h-8M6 18v4m13-4v4',
 production:'M3 21V10l6 3V8l6 4V4h5v17ZM7 17h2m3 0h2m3 0h2',
 supply:'M3 7h13v11H3ZM16 11h4l2 4v3h-6M6 18v3m13-3v3M6 4h9',
 construction:'m5 20 12-13m-9-3 12 12M4 5l3-3 15 15-3 3ZM2 18l4 4',
 army:'M3 5h18v14H3ZM3 5l18 14M21 5 3 19',
 division:'M4 3h6v6H4Zm10 0h6v6h-6ZM4 15h6v6H4Zm10 0h6v6h-6ZM7 9v6m10-6v6M7 12h10',
 war:'m4 3 16 18M20 3 4 21m0-6 5 5m6 0 5-5',
 settings:'M3 6h18M3 12h18M3 18h18M8 3v6m8 0v6m-9 0v6',
 city:'M3 21V9h6v12m0 0V3h6v18m0 0V12h6v9M1 21h22',
 map:'m2 6 6-3 8 3 6-3v16l-6 3-8-3-6 3Zm6-3v16m8-13v16'};
 return `<svg viewBox="0 0 24 24" aria-hidden="true" class="hoi-icon"><path d="${paths[kind]??paths.army}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
export function hoiTop(p:GrandPort,summary:any){const d=p.data,c=d.continuous,m=d.modern,side=d.viewer==='GERMAN'?'德国':'苏联';
 const pending=Array.from(p.wire?.pending.values()??[]).find((r:any)=>r.command?.payload?.type==='CLOCK') as any;
 const state=pending?'时间命令待确认':c.ended?'战役结束':c.paused?'暂停':d.release?.runtime?.limited?'推进受限':'推进';
 const nav=(label:string,icon:string,attr:string,value:string)=>`<button ${attr}="${value}" title="${label}" aria-label="${label}">${commandIcon(icon)}<span>${label}</span></button>`;
 return `<header class="hoi-top"><button class="hoi-country" data-ui-panel="war" aria-label="战争概览"><b>${side}</b><small>东线战区</small></button><div class="hoi-national" aria-label="本方国家资源"><button data-modern-tab="supply" title="可用人力，不含现役人员">人力 <b>${m?Math.floor(m.manpower).toLocaleString():'—'}</b></button><button data-modern-tab="production" title="当前受控军厂与民厂">军厂 <b>${m?.facilities.filter((f:any)=>f.kind==='MIL').length??'—'}</b> 民厂 <b>${m?.facilities.filter((f:any)=>f.kind==='CIV').length??'—'}</b></button><button data-ui-panel="division" title="真实国家陆军经验">陆军经验 <b>${d.divisions?.integrated?.xp?.toFixed(1)??'—'}</b></button><button data-modern-tab="supply" title="国家库存／运输需求">火车 <b>${d.ux.vehicles.TRAIN.available}/${d.ux.vehicles.TRAIN.needed??'—'}</b></button></div><div class="hoi-time"><strong>${esc(c.calendar??c.minutes+'分钟')}</strong><span role="status">${state}</span><button id="campaign-toggle" ${c.ended||p.locked||pending?'disabled':''}>${pending?'待确认':c.paused?'▶ 继续':'Ⅱ 暂停'}</button>${[1,2,4].map(n=>`<button data-campaign-speed="${n}" aria-pressed="${c.speed===n}">${n}×</button>`).join('')}<button id="campaign-save">保存</button>${saveStatus(p)}</div><nav class="hoi-management" aria-label="国家管理">${nav('建设','construction','data-modern-tab','construction')}${nav('生产','production','data-modern-tab','production')}${nav('编制','division','data-ui-panel','division')}${nav('后勤','supply','data-modern-tab','supply')}${nav('部队','army','data-ui-panel','direct')}${nav('城市','city','data-ui-panel','city')}${nav('设置','settings','data-ui-panel','settings')}</nav><button class="hoi-alert" data-ui-panel="alerts">⚑ ${summary.low.length+summary.supply.length+summary.equipment.length}项部队警报</button></header>`;
}
export function hoiRoster(p:GrandPort,selected:string|null,ids:string[]){const c=p.data.continuous,f=p.data.divisions?.integrated;return `<div class="hoi-roster" aria-label="部队列表">${ids.map(id=>{const u=c.units[id],s=ownStatus(p,id);if(!s||!u?.alive)return '';const g=c.corps.find((g:any)=>g.members.includes(id)),t=f?.templates.find((t:any)=>t.id===f.units.find((x:any)=>x.id===id)?.templateId);return `<button data-ui-unit="${esc(id)}" class="hoi-roster-row" aria-pressed="${id===selected}" style="--corps:${['#8fb9c9','#c6a58d','#b1b889'][Math.max(0,c.corps.indexOf(g))%3]}"><span class="hoi-unit-symbol">${commandIcon(t?.regiments?.flat().includes('LIGHT_ARMOR')?'armor':t?.regiments?.flat().includes('MOTORIZED')?'motor':t?.regiments?.flat().includes('ARTILLERY')?'artillery':'army')}</span><span><b>${esc(id)}</b><small>${esc(t?.name??g?.name??'独立部队')}</small></span><span class="hoi-roster-bars" title="组织 ${Math.round(s.orgRatio*100)}% / 人员 ${Math.round(s.personnelRatio*100)}%"><i><em style="height:${s.orgRatio*100}%"></em></i><i><em style="height:${s.personnelRatio*100}%"></em></i></span><span class="hoi-row-state">${s.low?'! ':''}${esc(s.action)}<small>${u.hex.q},${u.hex.r}</small></span></button>`;}).join('')}</div>`;}
export function hoiCommanders(p:GrandPort){const c=p.data.continuous;return `<nav class="ui-corps-bar hoi-commanders" aria-label="常驻军团栏">${c.corps.map((g:any,i:number)=>`<div class="ui-corps-card ${p.selections['campaign-group']===g.id?'selected':''}" style="--corps:${['#8fb9c9','#c6a58d','#b1b889'][i%3]}"><button data-ui-corps="${esc(g.id)}" aria-label="选择${esc(g.name)}">${officerPortrait(g.officer)}<span><b>${esc(g.name)}</b><small>${g.members.filter((id:string)=>c.units[id]?.alive).length}队 · ${g.order.paused?'暂停':g.order.kind==='ADVANCE'?'进攻':'布防'}</small></span></button><button data-ui-locate="${esc(g.id)}" aria-label="定位${esc(g.name)}">◎</button></div>`).join('')}</nav><nav class="hoi-map-modes" aria-label="地图工具">${p.data.provinces?'<button data-ui-panel="province">省份地图</button>':''}<button data-ui-panel="tools">${commandIcon('map')}战线／图层</button><button data-ui-panel="vision">视野情报</button></nav>`;}
