import {Campaign as Base} from '../grand-play-001/authority.mjs';
import {hexKey as key,hexDistance as distance} from '../../vendor/eastfront-digital-core/dist/index.js';
import {assignFront,validateFront} from './front.mjs';
const copy=structuredClone;
export class Campaign extends Base {
 constructor(){super();this.clock.map={version:1,serial:0,active:{},ended:[]};this.frontAssignments={};}
 validateOrder(o){super.validateOrder(o);validateFront(o.front,this.fair(this.viewer).view);}
 ownOrder(id){const order=super.ownOrder(id),target=this.frontAssignments?.[id];return target&&!this.clock.units[id].direct?{...order,target}:order;}
 findBattle(id){return Object.values(this.clock.map.active).find(b=>b.id===id);}
 transaction(req){const op=req.operation;
  if(op?.battleId&&!this.receipts.has(req.id)){
   const b=this.findBattle(op.battleId);
   if(!b||!b.units.some(id=>this.state.units[id]?.side===this.viewer))throw Error('BATTLE_ENDED_REVIEW_CURRENT_STATE');
   if(op.type!=='DIRECT')throw Error('BATTLE_INTERVENTION_REQUIRES_OWN_UNIT');
  }
  return super.transaction(req);
 }
 advance(){
  this.frontAssignments={};for(const side of ['GERMAN','SOVIET']){const view=this.fair(side).view;for(const g of this.clock.corps.filter(g=>g.side===side&&g.order.front?.length&&!g.order.paused))Object.assign(this.frontAssignments,assignFront(view,g,this.clock.units).assigned);}
  const before=Object.fromEntries(Object.values(this.state.units).map(u=>[u.id,copy(u.hex)]));super.advance();
  const m=this.clock.map,t=this.clock.tick,live=new Set();
  for(const raw of this.clock.battles){
   const existing=m.active[raw.id];const b=existing??{...copy(raw),pair:raw.id,id:`battle-${++m.serial}`,since:t,seen:{}};
   b.ticks=existing?b.ticks+1:1;b.units=raw.units;b.initiators=raw.initiators??[];
   const moved=raw.units.filter(id=>key(before[id])!==key(this.state.units[id].hex));
   const destroyed=raw.units.some(id=>!this.state.units[id].alive);
   b.status=moved.length?'WITHDRAWING':'ACTIVE';b.updated=t;
   // A displayed location is always derived anew from the requesting player's view.
   m.active[raw.id]=b;
   for(const side of ['GERMAN','SOVIET']){const dto=this.battleView(b,this.fair(side).view);if(dto)b.seen[side]=dto;}
   if(destroyed||moved.length&&distance(...raw.units.map(id=>this.state.units[id].hex))>1){this.endBattle(raw.id,destroyed?'已脱离：参战部队损失殆尽':'撤出接触，当前交战结束');}else live.add(raw.id);
  }
  for(const pair of Object.keys(m.active))if(!live.has(pair))this.endBattle(pair,'本时间步未继续交战；不代表已获胜');
  m.ended=m.ended.slice(-80);
 }
 endBattle(pair,result){const m=this.clock.map,b=m.active[pair];if(!b)return;b.endedAt=this.clock.tick;b.result=result;for(const d of Object.values(b.seen)){d.status='ENDED';d.endedAt=b.endedAt;d.result=result;}m.ended.push(b);delete m.active[pair];}
 battleView(b,view){
  const own=b.units.filter(id=>this.state.units[id]?.side===view.viewer),visible=new Map(view.units.map(u=>[u.id,u]));
  if(!own.length&&!b.units.every(id=>visible.has(id)))return null;
  const known=b.units.filter(id=>visible.has(id));const anchor=known.find(id=>!own.includes(id))??own.find(id=>visible.has(id));if(!anchor)return null;
  const hex=copy(visible.get(anchor).hex),terrain=view.hexes.find(h=>key(h.coord)===key(hex))?.terrain;
  const participants=known.map(id=>{const u=visible.get(id),terrain=view.hexes.find(h=>key(h.coord)===key(u.hex))?.terrain,cover=terrain==='FOREST'||terrain==='CITY'?1.25:1;if(!own.includes(id))return {id,side:u.side,type:u.type,hex:copy(u.hex),terrain,cover,org:null,personnel:null,equipment:null,supply:null};
   const v=this.clock.units[id],gear=this.econ.gear.units[id];return {id,side:u.side,type:u.type,hex:copy(u.hex),terrain,cover,org:v.org,personnel:v.personnel,max:v.max,equipment:copy(gear.held),equipmentCapacity:Object.fromEntries(Object.entries(gear.recipe).map(([k,v])=>[k,v*gear.base.maxDamageSteps])),supply:this.econ.supply[id].stock/4,reason:v.reason};});
  const attacking=b.initiators.some(id=>own.includes(id)),defending=b.initiators.some(id=>!own.includes(id));
  return {id:b.id,hex,since:b.since,ticks:b.ticks,status:b.status,role:attacking&&defending?'双方投入':attacking?'我方进攻':defending?'我方防守':'相遇交战',participants,unknownParticipants:b.units.length-known.length,
   assessment:'态势未知',reason:'敌方实时组织度、人员与装备未授权；不推算胜率',terrain,cover:terrain==='FOREST'||terrain==='CITY'?1.25:1,
   factors:['双方同一步计算伤害','目标为森林或城区时承伤除以1.25','组织度、装备、库存与进攻力度参与结算','河流影响行军耗时和通行；本规则无额外渡河战斗系数']};
 }
 snapshot(draft){const d=super.snapshot(draft),view=d.game.message.payload.view,m=this.clock.map;if(!m)return d;
  const active=Object.values(m.active).map(b=>this.battleView(b,view)).filter(Boolean),history=m.ended.map(b=>b.seen[this.viewer]).filter(Boolean);
  d.continuous.battles=active;d.continuous.map={version:1,battles:active,recent:history.filter(b=>this.clock.tick-b.endedAt<=2),history:history.slice(-20),fronts:d.continuous.corps.map(g=>({id:g.id,...assignFront(view,g,this.clock.units)}))};return d;
 }
 restore(s,pause=true){super.restore(s,pause);this.clock.map??={version:1,serial:0,active:{},ended:[]};if(this.clock.map.version!==1)throw Error('UNSUPPORTED_MAP_SAVE');this.frontAssignments={};}
}
