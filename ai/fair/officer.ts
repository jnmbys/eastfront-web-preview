import {hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import {observationCandidates} from './candidates.js';
import {createMoveScorer} from './routing.js';
import {scoreIntent} from './basicAgent.js';
import {basicAgent} from './basicAgent.js';
import {refitOptions,estimatedRecoveryBases} from './refit.js';
import {agentOrder} from './minimalAgent.js';
import type {FairInput,FairIntent,DeepReadonly} from './types.js';
export type Order={kind:'ATTACK'|'DEFEND'|'REFIT';target:{q:number;r:number}|null};
// Stable authored dispositions, server-side policy data; never sent in player reports.
// No randomness, no combat-RNG imports, no match-state or legality callback.
const profiles=[
 {ratio:1.5,loss:.25,logistics:0,concentration:.08},
 {ratio:2.1,loss:1,logistics:2,concentration:.18},
 {ratio:1.8,loss:.6,logistics:1,concentration:.45}
] as const;
export function intentUnits(a:DeepReadonly<FairIntent>):readonly string[]{
 if('unitId'in a)return[a.unitId];if('attackerUnitIds'in a)return a.attackerUnitIds;
 if('unitIdsByStep'in a)return a.unitIdsByStep;if('retreats'in a)return a.retreats.map(r=>r.unitId);return[];
}
export function pendingUnits(input:DeepReadonly<FairInput>):readonly string[]{
 const p=input.view.pendingDecision;if(!p)return[];
 return 'unitIds'in p?p.unitIds:'eligibleUnitIds'in p?p.eligibleUnitIds:[];
}
export function officerDecision(original:DeepReadonly<FairInput>,members:readonly string[],order:Order,profile:number,services?:{typedRecoveryReady?:string[];warehouses:{hex:string;P:number;E2:number;controlled:boolean}[]}){
 const stop=(reason:string)=>({intent:null as FairIntent|null,reason,metrics:{expanded:0,searches:0,exhausted:false}});
 const own=original.view.units.filter(u=>'friendly'in u&&u.friendly.controllerId===original.scope.controllerId);
 const ids=new Set(members.filter(id=>own.some(u=>u.id===id))),p=profiles[profile];
 if(!p||!ids.size)return stop('没有当前可指挥部队');
 if(original.deployment||original.view.phase.endsWith('_REINFORCEMENT'))return stop('部署或增援由玩家处理');
 if(original.view.victory.winner||original.view.phase==='GAME_OVER')return stop('战役已结束');
 const input=structuredClone(original) as FairInput;
 // Keep ALL friendly occupancy; restrict capabilities, never erase other groups from the map.
 for(const u of input.view.units)if('friendly'in u&&!ids.has(u.id))u.friendly.controllerId='__not_delegated__';
 const pending=input.view.pendingDecision;
 if(pending){
  if(pending.decisionOwnerControllerId!==input.scope.controllerId)return stop('等待当前待决方');
  const affected=pendingUnits(input);
  // Unscoped reactions and mixed-group decisions must be handed to the player.
  if(!affected.length||affected.some(id=>!ids.has(id)))return stop('待决涉及直属、其他编组或全局选择，请玩家处理');
  if(pending.kind==='ADVANCE_AFTER_COMBAT'&&order.kind==='REFIT')return{intent:{type:'PASS_ADVANCE',battleId:pending.battleId}as FairIntent,reason:'整补命令：放弃主动推进，保留原战斗结果',metrics:{expanded:0,searches:0,exhausted:false}};
  if(order.target)input.rules.objectives=[{...order.target}];
  const d=basicAgent(input),a=d.kind==='INTENT'?d.intent:null;
  if(!a||a.type==='READY_FOR_PHASE_END'||intentUnits(a).some(id=>!ids.has(id)))return stop('待决需要玩家接管');
  return{intent:a,reason:'按原战后规则处理所属部队；推进仍保留新增敌邻接保护',metrics:{expanded:0,searches:0,exhausted:false}};
 }
 if(input.view.activeSide!==input.scope.side)return stop('等待己方阶段');
 if(order.kind!=='REFIT'&&(!order.target||!input.view.hexes.some(h=>hexKey(h.coord)===hexKey(order.target!))))return stop('目标已失效，请修改命令');
 const troops=own.filter(u=>ids.has(u.id)),enemies=input.view.units.filter(u=>u.side!==input.scope.side);
 const refused=new Set(input.history.filter(h=>h.outcome==='REJECTED').map(h=>JSON.stringify(h.intent)));
 if(input.history.filter(h=>h.observationKey===input.observationKey&&h.outcome==='REJECTED').length>=3)return stop('拒绝上限：请玩家检查');
 if(/_(RECOVERY|ENTRENCHMENT)$/.test(input.view.phase)){
  const opts=refitOptions(input).filter(x=>!refused.has(JSON.stringify(x.intent))).filter(x=>{if(!services||x.intent.type!=='REPAIR_UNIT')return true;const a=x.intent;if(services.typedRecoveryReady)return services.typedRecoveryReady.includes(a.unitId);const u=input.view.units.find(u=>u.id===a.unitId);return !!u&&services.warehouses.some(w=>w.controlled&&w.hex===hexKey(u.hex)&&w.P>=1&&w.E2>=2);});
  const a=opts[0];return a?{intent:a.intent,reason:a.intent.type==='REPAIR_UNIT'?services?.typedRecoveryReady?'恢复所属受损部队；已配送本兵种装备和人员，共用原恢复次数':services?'恢复所属受损部队；同格已可用1P＋2E2，使用全军本回合剩余恢复次数':'恢复未动未攻的受损部队；按损伤、RP费用排序，使用本阶段实际剩余额度':'所属部队未移动且未筑垒，提交原筑垒动作',metrics:{expanded:0,searches:0,exhausted:false}}:stop('无可提出的恢复/筑垒；后勤需求请玩家确认');
 }
 let goals=order.target?[order.target]:[];
 if(order.kind==='ATTACK'&&order.target&&[...enemies,...input.view.contacts].some(e=>hexKey(e.hex)===hexKey(order.target!))){goals=input.view.hexes.filter(h=>hexDistance(h.coord,order.target!)===1).map(h=>h.coord);}
 if(order.kind==='REFIT'){const bases=estimatedRecoveryBases(input);goals=input.view.hexes.filter(h=>bases.has(hexKey(h.coord))).map(h=>h.coord);}
 const moves=createMoveScorer(input,goals),choices:{intent:FairIntent;score:number;reason:string;tie:number}[]=[];
 const candidates=observationCandidates(input,false);
 for(let i=0;i<candidates.length;i++){
  let a=candidates[i]!,score=-Infinity,reason='';
  if(a.type==='MOVE'){
   const unitId=a.unitId,u=troops.find(u=>u.id===unitId);if(!u||!goals.length)continue;
   if(order.kind==='REFIT'&&u.step===0&&u.supplyState==='SUPPLIED')continue;
   if(order.kind==='DEFEND'&&order.target&&hexDistance(u.hex,order.target)===0)continue;
   score=moves.score(a);if(!Number.isFinite(score))continue;a=moves.prefix(a);if(a.type!=='MOVE')continue;
   const to=a.path.at(-1)!,adj=enemies.filter(e=>hexDistance(to,e.hex)===1);
   if(order.kind!=='REFIT'&&p.logistics===2&&u.supplyState!=='SUPPLIED')continue;
   if(adj.length&&u.step>0&&p.loss>=.6)continue;
   const peers=troops.filter(t=>t.id!==u.id),spread=peers.length?peers.reduce((s,t)=>s+hexDistance(to,t.hex)-hexDistance(u.hex,t.hex),0)/peers.length:0;
   score-=spread*p.concentration+u.step*p.loss+(u.supplyState==='SUPPLIED'?0:p.logistics*.65);
   reason=`执行${order.kind==='REFIT'?'靠近公开恢复基地':order.kind==='DEFEND'?'前往守备位置':'向命令目标推进'}；${spread<0?'靠拢同组部队':spread>0?'接受与同组部队拉开距离':'保持编组间距'}${u.step?'，已计入本方损伤':''}${u.supplyState!=='SUPPLIED'?'，已计入缺供代价':''}`;
  }else if(a.type==='ATTACK'&&order.kind!=='REFIT'&&order.target&&hexDistance(a.target,order.target)<=(order.kind==='DEFEND'?1:2)){
   const attackers=troops.filter(u=>a.type==='ATTACK'&&a.attackerUnitIds.includes(u.id));
   if(p.logistics===2&&attackers.some(u=>u.supplyState!=='SUPPLIED'))continue;
   score=scoreIntent(input,a,{attackRatio:p.ratio,penaltyWeight:.75})-attackers.reduce((s,u)=>s+u.step*p.loss,0)+p.concentration*(attackers.length-1);
   reason=`命令区域内可见目标；${attackers.length}支所属部队的公开攻防与地形估计达到出击标准，已计入损伤与集中程度`;
  }
  if(score>0&&Number.isFinite(score)&&!refused.has(JSON.stringify(a))&&intentUnits(a).every(id=>ids.has(id)))choices.push({intent:a,score,reason,tie:agentOrder(input.agentRandom.seed,i)});
 }
 choices.sort((a,b)=>b.score-a.score||a.tie-b.tie);
 return choices[0]?{intent:choices[0].intent,reason:choices[0].reason,metrics:moves.metrics}: {...stop('当前无符合命令与风险取舍的行动；不自动结束阶段'),metrics:moves.metrics};
}
