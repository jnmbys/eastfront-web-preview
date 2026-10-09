import {Campaign as Base} from '../grand-map-001/authority.mjs';
import {decideAction,eligible} from './policy.mjs';
import {hexKey as key} from '../../vendor/eastfront-digital-core/dist/index.js';
const copy=structuredClone;
export class Campaign extends Base {
 constructor(){super();this.clock.engagements={version:1,serial:0,active:{},ended:[],actions:[]};}
 decideAction(...args){return decideAction(...args);}
 validateOrder(o){super.validateOrder(['ATTACK','SUPPORT'].includes(o?.kind)?{...o,kind:'HOLD'}:o);}
 findBattle(id){return Object.values(this.clock.engagements.active).find(b=>b.id===id);}
 transaction(req){const op=req.operation;
  if(!this.receipts.has(req.id)&&['ATTACK','SUPPORT'].includes(op?.order?.kind)){
   if(op.type!=='DIRECT')throw Error('EXPLICIT_UNIT_ORDER_REQUIRED');
   const view=this.fair(this.viewer).view,u=view.units.find(u=>u.id===op.unit&&u.side===this.viewer);
   const reason=eligible(view,u,u?this.capability(u.id):null,op.order.target);if(reason)throw Error(reason);
   if(op.order.kind==='SUPPORT'){
    const b=this.findBattle(op.battleId);if(!b||key(b.hex)!==key(op.order.target))throw Error('SUPPORT_REQUIRES_ACTIVE_TARGET_BATTLE');
   }
  }
  const replay=this.receipts.has(req.id),result=super.transaction(req);
  if(!replay){if(op.type==='DIRECT'&&['ATTACK','SUPPORT'].includes(op.order?.kind))this.clock.units[op.unit].actionAcceptedAt=this.clock.tick;const ids=op.type==='ORDER'?(this.clock.corps.find(g=>g.id===op.group)?.members??[]).filter(id=>!this.clock.units[id].direct):op.unit?[op.unit]:[];this.clock.engagements.actions=this.clock.engagements.actions.filter(a=>!ids.includes(a.unit));}
  return result;
 }
 combatTrace(ids,intents,arrivals,before,old){
  // One settlement pair is assigned to one stable contact location, never cloned.
  const directed=ids.filter(id=>['ATTACK','SUPPORT'].includes(intents[id]?.action));
  const actor=directed[0]??ids.find(id=>intents[id]?.kind==='FIGHT');
  const prior=old?.contactHex&&ids.every(id=>key(before.units[id].hex)===key(old.positions?.[id]??{}));
  const target=prior?old.contactHex:actor?before.units[intents[actor].target].hex:arrivals.find(a=>ids.includes(a.id))?.to??before.units[ids[1]].hex;
  return {contactHex:copy(target),positions:Object.fromEntries(ids.map(id=>[id,copy(before.units[id].hex)])),sources:ids.filter(id=>intents[id]?.kind==='FIGHT').map(id=>({unit:id,kind:intents[id].action??'ATTACK',target:intents[id].target,from:copy(before.units[id].hex),to:copy(before.units[intents[id].target].hex)}))};
 }
 advance(){
  const before=Object.fromEntries(Object.entries(this.clock.units).map(([id,v])=>[id,{hex:copy(this.state.units[id].hex),org:v.org,personnel:v.personnel}]));
  super.advance();const e=this.clock.engagements,t=this.clock.tick,byHex=new Map();
  const reportViews={};const reportView=side=>reportViews[side]??=(this.fair(side).view);
  for(const raw of this.clock.battles){if(!this.clock.map.active[raw.id])continue;const k=key(raw.contactHex);if(!byHex.has(k))byHex.set(k,[]);byHex.get(k).push(raw);}
  for(const [k,b]of Object.entries(e.active))if(!byHex.has(k)){b.status='ENDED';b.endedAt=t;b.result='本地点交战已脱离；不据此判定胜负';e.ended.push(b);delete e.active[k];}
  for(const [k,pairs]of byHex){const prev=e.active[k],units=[...new Set(pairs.flatMap(b=>b.units))].sort(),b=prev??{id:`engagement-${++e.serial}`,hex:copy(pairs[0].contactHex),since:t,seen:{}};
   Object.assign(b,{units,pairs:pairs.map(p=>p.id),ticks:t-b.since+1,updated:t,status:units.some(id=>key(before[id].hex)!==key(this.state.units[id].hex))?'WITHDRAWING':'ACTIVE',initiators:[...new Set(pairs.flatMap(p=>p.initiators))],sources:pairs.flatMap(p=>p.sources),changes:Object.fromEntries(units.map(id=>[id,{org:this.clock.units[id].org-before[id].org,personnel:this.clock.units[id].personnel-before[id].personnel}]))});e.active[k]=b;
   for(const side of ['GERMAN','SOVIET']){const d=this.groupView(b,reportView(side));if(d)b.seen[side]=d;}
  }
  e.ended=e.ended.slice(-80);e.actions=[];
  for(const b of Object.values(e.active))for(const s of b.sources){const id=`${b.id}:${s.unit}:${s.kind}`;if(!e.actions.some(a=>a.id===id))e.actions.push({...copy(s),id,battleId:b.id,status:'EXECUTING',path:[s.from,s.to],progress:0});}
  // Support never inherits an advance after its target clears, disappears or the
  // supporting formation withdraws. A later attack needs a new explicit command.
  for(const [id,v]of Object.entries(this.clock.units)){
   const o=v.direct;if(!o||o.paused||!['ATTACK','SUPPORT'].includes(o.kind))continue;
   const view=reportView(this.state.units[id].side),enemy=view.units.some(u=>u.side!==view.viewer&&key(u.hex)===key(o.target));
   if(o.kind==='SUPPORT'&&(!e.active[key(o.target)]||key(before[id].hex)!==key(this.state.units[id].hex))){v.direct={kind:'HOLD',target:copy(this.state.units[id].hex),paused:true,risk:o.risk};v.march=null;this.note(this.state.units[id].side,'支援结束，留在当前地块；继续行动需新命令',id);}
   else if(o.kind==='ATTACK'&&!enemy){v.direct={...o,kind:'ADVANCE'};this.note(this.state.units[id].side,'指定目标无已识别敌军，转入有耗时的正常推进',id);}
  }
 }
 groupView(b,view){
  const dto=super.battleView(b,view);if(!dto)return null;
  // Contact location is public only when a known participant occupied it. No
  // concealed target coordinate is released just because its opponent is ours.
  const visible=new Set(view.units.map(u=>key(u.hex)));if(!visible.has(key(b.hex))&&!view.identifiedHexKeys?.includes(key(b.hex)))return null;
  dto.hex=copy(b.hex);dto.terrain=view.hexes.find(h=>key(h.coord)===key(b.hex))?.terrain;
  dto.pairCount=b.pairs.length;dto.outlook='NEUTRAL';dto.assessment='战况未明';
  const own=dto.participants.filter(u=>u.side===view.viewer),org=own.reduce((n,u)=>n+u.org,0)/Math.max(1,own.length),change=own.reduce((n,u)=>n+(b.changes[u.id]?.org??0),0)/Math.max(1,own.length),loss=own.reduce((n,u)=>n-Math.min(0,b.changes[u.id]?.personnel??0),0);
  dto.reason=`本步己方组织度平均变化 ${change.toFixed(1)}，人员损失 ${loss.toFixed(1)}；敌军精确状态未知，不表示胜率`;
  if(own.length&&(org<35||change<-12)){dto.outlook='STRAINED';dto.assessment='己方承压';}
  else if(own.length&&b.ticks>=2&&org>=60&&change>=-5&&loss<8){dto.outlook='FAVORABLE';dto.assessment='己方暂能维持';}
  dto.eligibilityReasons=Object.fromEntries(view.units.filter(u=>u.side===view.viewer).map(u=>[u.id,eligible(view,u,this.capability(u.id),b.hex)]));
  dto.supportEligible=view.units.filter(u=>u.side===view.viewer&&!eligible(view,u,this.capability(u.id),b.hex)).map(u=>u.id);dto.attackEligible=[...dto.supportEligible];
  dto.actions=b.sources.filter(s=>view.units.some(u=>u.id===s.unit&&u.side===view.viewer)).map(x=>copy(x));
  return dto;
 }
 snapshot(draft){const d=super.snapshot(draft),view=d.game.message.payload.view,e=this.clock.engagements;
  const battles=Object.values(e.active).map(b=>this.groupView(b,view)).filter(Boolean),history=e.ended.map(b=>{const dto=copy(b.seen[this.viewer]);return dto?{...dto,status:'ENDED',endedAt:b.endedAt,result:b.result}:null;}).filter(Boolean);
  const actions=e.actions.filter(a=>{const v=this.clock.units[a.unit],u=this.state.units[a.unit],o=this.ownOrder(a.unit);return u?.alive&&u.side===this.viewer&&!o?.paused&&o?.kind!=='RETREAT'&&battles.some(b=>b.id===a.battleId)&&key(u.hex)===key(a.from)&&v.engaged;}).map(x=>copy(x));
  for(const [id,v]of Object.entries(this.clock.units)){const u=this.state.units[id],o=this.ownOrder(id);if(!u.alive||u.side!==this.viewer||o?.paused)continue;
   if(v.march&&!v.engaged){actions.push({id:'march:'+id,unit:id,kind:o?.kind==='RETREAT'?'RETREAT':'MOVE',from:copy(u.hex),to:copy(v.march.to),path:[copy(u.hex),copy(v.march.to)],progress:1-v.march.remaining/v.march.total,status:'EXECUTING',battleId:null,reason:v.reason});}
   else if(['ATTACK','SUPPORT'].includes(o?.kind)&&v.actionAcceptedAt===this.clock.tick&&!actions.some(a=>a.unit===id)){actions.push({id:'accepted:'+id,unit:id,kind:o.kind,from:copy(u.hex),to:copy(o.target),path:[copy(u.hex),copy(o.target)],progress:0,status:'ACCEPTED',battleId:e.active[key(o.target)]?.id??null,reason:'已接受，等待下个共同时间步核验投入'});}
  }
  d.continuous.battles=battles;Object.assign(d.continuous.map,{version:2,battles,history:history.slice(-20),recent:[],actions});return d;
 }
 save(){const s=super.save();s.mapRules='GRAND-MAP-R1';return s;}
 restore(s,pause=true){if(s.mapRules!=='GRAND-MAP-R1'||s.clock?.engagements?.version!==1)throw Error('UNSUPPORTED_ACTION_MAP_SAVE');super.restore(s,pause);}
}
