// Pure tactical policy. Inputs contain current authorized contacts and own resources only.
import {hexKey as key,hexDistance as distance,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
import {travel} from '../grand-play-001/planner.mjs';
import {eligible} from '../grand-map-r1/policy.mjs';
import {profiles,rules} from '../grand-play-001/rules.mjs';
export const VERSION='GRAND-OFFICER-001';
const copy=structuredClone;
export function retreatSite(view,u,cap,target,toward=false){
 const enemies=view.units.filter(x=>x.side!==view.viewer),own=view.units.filter(x=>x.side===view.viewer),known=new Map(view.hexes.map(h=>[key(h.coord),h]));
 return getNeighbors(u.hex).filter(h=>known.get(key(h))?.control===view.viewer&&Number.isFinite(travel(view,u.hex,h,cap))&&!enemies.some(e=>distance(e.hex,h)<=1)&&own.filter(v=>key(v.hex)===key(h)).length<rules.stack).sort((a,b)=>(toward?distance(a,target)-distance(b,target):distance(b,target)-distance(a,target))||key(a).localeCompare(key(b)))[0]??null;
}
export function planSide(view,own,groups,memory,tick){
 const states=copy(memory??{}),orders={},events=[];let examined=0;
 const set=(u,row)=>{const old=memory?.[u.id];states[u.id]={...old,...row};if(old?.reason!==row.reason||old?.phase!==row.phase)events.push({unit:u.id,text:row.reason});};
 for(const g of groups){
  const us=view.units.filter(u=>u.side===view.viewer&&g.members.includes(u.id)&&own[u.id]&&!own[u.id].direct),profile=profiles[g.profile],stamp=JSON.stringify(g.order),enemies=view.units.filter(e=>e.side!==view.viewer&&(g.order.front?.length?g.order.front.some(h=>distance(e.hex,h)<=1):distance(e.hex,g.order.target)<=3));
  for(const u of us){const old=states[u.id];if(old?.stamp!==stamp)delete states[u.id];else if(['RESERVE','ACTIVE','BLOCKED'].includes(old?.phase))delete states[u.id];}
  if(g.order.paused){for(const u of us)delete states[u.id];continue;}
  const threshold=profile.stop+12+(g.order.risk==='LOW'?6:g.order.risk==='HIGH'?-6:0),returnOrg=Math.min(90,threshold+22),reserved=new Set();
  // Carry actual withdrawal/recovery across steps; resume only after the wider recovery threshold and cooldown.
  for(const u of us){const v=own[u.id],s=states[u.id];examined++;
   if(s?.phase==='WITHDRAW'){reserved.add(u.id);orders[u.id]={kind:'RETREAT',target:s.target,risk:'LOW',paused:false};continue;}
   if(s?.phase==='RECOVER'){
    if(v.org>=returnOrg&&v.stock>=2&&v.personnel/v.max>=.6&&tick>=s.until&&!v.engaged){set(u,{phase:'ACTIVE',stamp,reason:'整补条件达成，重新接受军团任务'});}
    else {reserved.add(u.id);orders[u.id]={kind:'REFIT',target:u.hex,risk:'LOW',paused:false};set(u,{...s,reason:v.stock<2?'等待补给，保持整补':v.personnel/v.max<.6?'人员损失严重，等待真实补充':'撤出整补，尚未达到重新投入条件'});}
   }
   if(s?.phase==='RELIEF'){reserved.add(u.id);orders[u.id]={kind:'ADVANCE',target:s.target,risk:g.order.risk,paused:false};if(distance(u.hex,s.target)===0){delete orders[u.id];reserved.delete(u.id);set(u,{phase:'ACTIVE',stamp,replacing:null,committedUntil:tick+6,reason:'接替已到达原防区，继续军团任务'});}}
   if(s?.phase==='SUPPORT'&&v.org>=threshold&&v.personnel/v.max>=.6&&v.stock>=1&&enemies.some(e=>key(e.hex)===key(s.target))&&!eligible(view,u,v,s.target)){reserved.add(u.id);orders[u.id]={kind:'SUPPORT',target:s.target,risk:g.order.risk,paused:false};}
   if(s?.phase==='SUPPORT'&&!enemies.some(e=>key(e.hex)===key(s.target))){reserved.add(u.id);orders[u.id]={kind:'REFIT',target:u.hex,risk:'LOW',paused:false};set(u,{phase:'RECOVER',stamp,until:tick+2,reason:'支援接触结束，原地整理；未自动跟进'});}
  }
  const fresh=us.filter(u=>!reserved.has(u.id)&&own[u.id].org>=returnOrg&&own[u.id].stock>=2&&own[u.id].personnel/own[u.id].max>=.75&&!own[u.id].engaged&&!own[u.id].march&&(states[u.id]?.committedUntil??0)<=tick).sort((a,b)=>distance(b.hex,g.order.target)-distance(a.hex,g.order.target)||a.id.localeCompare(b.id));
  const reserve=us.length>=4&&!['RETREAT','REFIT'].includes(g.order.kind)?(fresh.find(u=>memory?.[u.id]?.phase==='RESERVE')??fresh[0]):null;
  if(reserve){reserved.add(reserve.id);orders[reserve.id]={kind:'HOLD',target:reserve.hex,risk:g.order.risk,paused:true};set(reserve,{phase:'RESERVE',stamp,reason:'保留真实预备队，等待接替需求'});}
  const tired=us.filter(u=>!reserved.has(u.id)&&(own[u.id].engaged||view.units.some(e=>e.side!==view.viewer&&distance(e.hex,u.hex)<=1))&&(own[u.id].org<threshold||own[u.id].personnel/own[u.id].max<.6||own[u.id].stock<1)).sort((a,b)=>own[a.id].org-own[b.id].org||a.id.localeCompare(b.id));
  for(const u of tired){const v=own[u.id],site=retreatSite(view,u,v,g.order.target,g.order.kind==='RETREAT'),old=states[u.id],emergency=v.org<rules.orgRetreat+12||v.personnel/v.max<.45||v.stock<1;
   const relief=us.find(x=>x.id!==u.id&&states[x.id]?.replacing===u.id&&['RELIEF','SUPPORT'].includes(states[x.id]?.phase))??(reserve&&!states[reserve.id]?.replacing?reserve:fresh.find(x=>x.id!==u.id&&!reserved.has(x.id)));
   const enemy=view.units.filter(e=>e.side!==view.viewer&&distance(e.hex,u.hex)<=1).sort((a,b)=>distance(a.hex,g.order.target)-distance(b.hex,g.order.target)||a.id.localeCompare(b.id))[0];
   if(!site){reserved.add(u.id);orders[u.id]={kind:'REFIT',target:u.hex,risk:'LOW',paused:false};set(u,{phase:'BLOCKED',stamp,reason:'退路受阻：没有已知、未满员且脱离相邻敌军的后方格；停止主动攻击'});continue;}
   let ready=false;if(relief){reserved.add(relief.id);ready=!!enemy&&!eligible(view,relief,own[relief.id],enemy.hex);orders[relief.id]=ready?{kind:'SUPPORT',target:enemy.hex,risk:g.order.risk,paused:false}:{kind:'ADVANCE',target:copy(u.hex),risk:g.order.risk,paused:false};set(relief,{phase:ready?'SUPPORT':'RELIEF',stamp,replacing:u.id,target:copy(ready?enemy.hex:u.hex),reason:ready?`${relief.id} 接替 ${u.id}，已在合法相邻位置投入支援`:`${relief.id} 正在行军接替 ${u.id}，到达前不计入支援`});}
   const wait=old?.phase==='WAIT'?old.since:tick;
   if(!emergency&&relief&&!ready&&tick-wait<2){orders[u.id]={...g.order};set(u,{phase:'WAIT',stamp,since:wait,reason:`等待 ${relief.id} 接替，最多再等 ${2-(tick-wait)} 个时间步`});}
   else {reserved.add(u.id);orders[u.id]={kind:'RETREAT',target:site,risk:'LOW',paused:false};set(u,{phase:'WITHDRAW',stamp,target:site,until:tick+6,reason:relief?`${u.id} 撤出整补；${ready?'接替已具备参战条件':'紧急脱离，接替尚在途中，可能留下缺口'}`:`${u.id} 撤出整补；缺少预备队，可能留下缺口`});}
  }
  // A relief task persists until it reaches the wounded formation's former position.
  for(const u of us){const s=states[u.id];if(s?.phase==='RELIEF'&&!orders[u.id]){orders[u.id]={kind:'ADVANCE',target:s.target,risk:g.order.risk,paused:false};if(distance(u.hex,s.target)===0)set(u,{phase:'ACTIVE',stamp,replacing:null,reason:'接替部队已到达原防区，继续军团任务'});}}
  const attackers=us.filter(u=>!reserved.has(u.id)&&!orders[u.id]&&own[u.id].org>=threshold&&own[u.id].stock>=1);
  const targets=enemies.filter(e=>attackers.some(u=>distance(u.hex,e.hex)===1)).sort((a,b)=>distance(a.hex,g.order.target)-distance(b.hex,g.order.target)||a.id.localeCompare(b.id));
  if(g.order.kind!=='RETREAT'&&g.order.kind!=='REFIT')for(const e of targets.slice(0,2)){
   const eligibleUnits=attackers.filter(u=>!orders[u.id]&&!eligible(view,u,own[u.id],e.hex)).sort((a,b)=>own[b.id].armor-own[a.id].armor||own[b.id].fire-own[a.id].fire||a.id.localeCompare(b.id));
   for(const [i,u]of eligibleUnits.entries()){const kind=i===0?'ATTACK':'SUPPORT';orders[u.id]={kind,target:copy(e.hex),risk:g.order.risk,paused:false};set(u,{phase:kind==='SUPPORT'?'SUPPORT':'ACTIVE',stamp,target:copy(e.hex),reason:kind==='SUPPORT'?'协同相邻支援；照常承担消耗与反击，胜后不跟进':'承担本军团目标附近主攻'});}
  }
  for(const u of us)if(!orders[u.id]&&(!states[u.id]||states[u.id].phase==='SUPPORT'))set(u,{phase:'ACTIVE',stamp,reason:us.length<4?'缺少可保留的预备队，沿原军团任务行动':'沿原军团任务行动'});
 }
 // A current direct order or reassignment immediately excludes the unit from this planner.
 for(const id of Object.keys(states))if(!groups.some(g=>g.members.includes(id)&&!g.order.paused)||!own[id]||own[id].direct)delete states[id];
 return {states,orders,events,examined};
}
