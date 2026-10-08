import {Conservative} from '../grand-officer-002-r1/authority.mjs';
import {cfg,rules,VERSION,products,sides} from './config.mjs';
import * as economy from './economy.mjs';
import {hexKey as key} from '../../vendor/eastfront-digital-core/dist/index.js';
const copy=structuredClone,fail=x=>{throw Error(x);};
export class Campaign extends Conservative{
 constructor(){super();this.economyV2=true;this.simRules=rules;this.clock.rules=VERSION;economy.initialize(this);}
 serviceAllowed(w,side){if(!this.economyV2)return super.serviceAllowed(w,side);return this.state.hexes[w.node]?.control===side;}
 spend(){/* Daily need includes fighting/marching. No parallel SP deductions. */}
 recordEquipmentLoss(){economy.equipmentLoss(this);}
 restOrgRate(id){return .2*(.1+.9*(this.clock.units[id].dailySupply?.effective??1));}
 economyStep(){economy.step(this);}
 capability(id){const r=super.capability(id);if(!this.economyV2)return r;const v=this.clock.units[id],g=this.econ.gear.units[id],effective=v.dailySupply?.effective??1,ratio=k=>Math.min(1,(g.held[k]??0)/(this.econ.modern.establishment[id]?.[k]||Infinity));
  r.fire*=.3+.7*effective;r.mobility*=.4+.6*effective;r.protection+=.4*ratio('HEAVY');r.fire+=ratio('HEAVY')*(v.personnel/v.max)*(v.org/100);return r;
 }
 decideAction(...args){const d=super.decideAction(...args);if(this.economyV2&&d.kind==='MARCH')d.duration=Math.max(1,Math.ceil(d.duration*cfg.marchScale));return d;}
 enemyPlan(view){super.enemyPlan(view);if(!this.economyV2||this.clock.tick%288!==1)return;
  const e=this.econ.modern,side='SOVIET',n=e.nations[side],need={};
  for(const u of view.units.filter(u=>u.side===side))for(const[k,v]of Object.entries(e.establishment[u.id]))need[k]=(need[k]??0)+Math.max(0,v-this.econ.gear.units[u.id].held[k]);
  need.TRAIN=Math.max(0,(e.net[side]?.trainNeed??0)-n.stock.TRAIN);need.TRUCK=Math.max(0,(e.net[side]?.truckNeed??0)-n.stock.TRUCK);
  const fs=Object.values(e.facilities).filter(f=>f.kind==='MIL'&&economy.available(this,f,side)),ls=Object.values(e.lines).filter(l=>l.side===side);
  // Own shortages only. One production adjustment per day; no free resources.
  const ranked=Object.keys(products).sort((a,b)=>((need[b]??0)-n.stock[b])-((need[a]??0)-n.stock[a])||a.localeCompare(b));
  for(const f of fs){const existing=ls.find(l=>l.factories.includes(f.id));if(existing&&(need[existing.product]??0)>n.stock[existing.product])continue;const target=ls.find(l=>l.product===ranked[0]);if(!target||existing===target)continue;for(const l of ls)l.factories=l.factories.filter(id=>id!==f.id);economy.setLine(e,side,{line:target.id,product:target.product,priority:target.priority,factories:[...target.factories,f.id]});break;}
  const repairs=Object.values(e.rails).filter(r=>r.damage>0&&[this.state.edges[r.id].a,this.state.edges[r.id].b].every(h=>view.hexes.find(x=>key(x.coord)===key(h))?.control===side));
  if(repairs[0]&&!e.queue.some(q=>q.side===side&&q.status!=='DONE'))this.enqueue(side,{kind:'REPAIR_RAIL',target:repairs[0].id});
 }
 enqueue(side,op){const e=this.econ.modern;if(!cfg.construction[op.kind])fail('INVALID_CONSTRUCTION');if(e.queue.some(q=>q.target===op.target&&q.kind===op.kind&&q.status!=='DONE'))fail('PROJECT_ALREADY_QUEUED');
  let hex,other;
  if(['RAIL','REPAIR_RAIL'].includes(op.kind)){const r=e.rails[op.target],x=this.state.edges[op.target];if(!r||!x)fail('RAIL_NOT_FOUND');hex=key(x.a);other=key(x.b);if(op.kind==='RAIL'&&r.level>=5)fail('RAIL_AT_MAX_LEVEL');if(op.kind==='REPAIR_RAIL'&&!r.damage&&!x.bridge?.destroyed)fail('RAIL_NOT_DAMAGED');}
  else if(op.kind==='HUB'){const h=e.hubs[op.target];if(!h||h.level>=3)fail('HUB_UNAVAILABLE');hex=h.hex;}
  else if(op.kind==='REPAIR_FACTORY'){const f=e.facilities[op.target];if(!f||!f.damage)fail('FACTORY_NOT_DAMAGED');hex=f.hex;}
  else {const d=this.econ.cities.items.flatMap(c=>c.districts).find(d=>d.id===op.target);if(!d)fail('DISTRICT_NOT_FOUND');hex=d.hex;const used=Object.values(e.facilities).filter(f=>f.district===d.id).length+e.queue.filter(q=>q.target===d.id&&['MIL','CIV'].includes(q.kind)&&q.status!=='DONE').length;if(used>=d.slots)fail('FACTORY_SLOTS_FULL');}
  if(this.state.hexes[hex]?.control!==side||other&&this.state.hexes[other]?.control!==side)fail('CONSTRUCTION_NOT_CONTROLLED');
  const serial=++e.serial,q={id:'BUILD:'+serial,serial,side,kind:op.kind,target:op.target,hex,other,cost:cfg.construction[op.kind],progress:0,priority:3,status:'QUEUED'};e.queue.push(q);return q.id;
 }
 transaction(req){const op=req.operation;if(!op?.type?.startsWith('ECON_')){if(['PRODUCTION_LINE','BUILD_FACTORY','ARMY_PRIORITY'].includes(op?.type))fail('OLD_ECONOMY_DISABLED');return super.transaction(req);}
  if(typeof req.id!=='string'||req.id.length<8)fail('REQUEST_ID_REQUIRED');const signature=JSON.stringify(req),prior=this.receipts.get(req.id);if(prior){if(prior.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(prior.result);}
  if(req.version!==this.version)fail('STALE_VERSION');if(this.clock.ended)fail('CAMPAIGN_FINISHED');const e=this.econ.modern,side=this.viewer,backup=copy(e);
  try{
   if(op.type==='ECON_LINE'){
    if(!Array.isArray(op.factories)||op.factories.some(id=>!e.facilities[id]||e.facilities[id].kind!=='MIL'||!economy.available(this,e.facilities[id],side)))fail('FACTORY_NOT_AVAILABLE');
    economy.setLine(e,side,op);for(const l of Object.values(e.lines))if(l.id!==op.line)l.factories=l.factories.filter(id=>!op.factories.includes(id));
   }else if(op.type==='ECON_BUILD')this.enqueue(side,op);
   else if(op.type==='ECON_QUEUE'){const q=e.queue.find(q=>q.id===op.id&&q.side===side&&q.status!=='DONE');if(!q||![1,2,3,4,5].includes(op.priority))fail('INVALID_QUEUE_PRIORITY');q.priority=op.priority;}
   else if(op.type==='ECON_HUB'){const h=e.hubs[op.hub];if(!h||this.state.hexes[h.hex].control!==side||![0,1].includes(op.motor))fail('HUB_NOT_CONTROLLED');h.motor=op.motor;}
   else if(op.type==='ECON_PRIORITY'){if(!this.econ.ux.armies[side].some(a=>a.id===op.army)||![1,2,3,4,5].includes(op.priority))fail('INVALID_ARMY_PRIORITY');e.priorities[op.army]=op.priority;}
   else fail('UNKNOWN_ECONOMY_COMMAND');
   economy.production(this,false);economy.refreshNetwork(this);this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version};this.receipts.set(req.id,{signature,result});return result;
  }catch(error){this.econ.modern=backup;throw error;}
 }
 advance(){super.advance();this.econ.modern.ledger=this.econ.modern.ledger.slice(-3000);this.clock.history=this.clock.history.slice(-288);}
 save(){const s=super.save();s.economyRules=VERSION;return s;}
 restore(s,pause=true){if(s.economyRules!==VERSION||s.econ?.modern?.version!==VERSION)fail('ECONOMY_RULE_VERSION_REQUIRES_NEW_GAME');this.economyV2=true;this.simRules=rules;super.restore(s,pause);}
 snapshot(draft){const d=super.snapshot(draft);if(!this.economyV2)return d;const e=this.econ.modern,side=this.viewer,own=f=>this.state.hexes[f.hex]?.control===side,visible=new Set(d.game.message.payload.view.hexes.filter(h=>h.control===side).map(h=>key(h.coord))),n=e.nations[side],facilities=Object.values(e.facilities).filter(own),net=e.net[side];
  d.modern={version:VERSION,config:cfg,products,stock:copy(n.stock),manpower:n.manpower,produced:copy(n.produced),reinforced:copy(n.reinforced),personnelSent:n.personnelSent,resources:copy(n.resources),resourceUsed:copy(n.resourceUsed),facilities:copy(facilities),lines:copy(Object.values(e.lines).filter(l=>l.side===side)),network:copy(net),queue:copy(e.queue.filter(q=>q.side===side)),priorities:copy(Object.fromEntries(this.econ.ux.armies[side].map(a=>[a.id,e.priorities[a.id]]))),rails:copy(Object.values(e.rails).filter(r=>[this.state.edges[r.id].a,this.state.edges[r.id].b].every(h=>visible.has(key(h)))).map(r=>({...r,a:key(this.state.edges[r.id].a),b:key(this.state.edges[r.id].b)}))),sites:this.econ.cities.items.flatMap(c=>c.districts).filter(x=>visible.has(x.hex)&&x.slots>0).map(x=>({id:x.id,label:x.paper,hex:x.hex,slots:x.slots,used:facilities.filter(f=>f.district===x.id).length})),events:copy(e.ledger.filter(l=>l.side===side).slice(-20))};
  const date=new Date(Date.parse(cfg.date)+this.clock.tick*rules.minutes*60000);d.continuous.calendar=date.toISOString().slice(5,16).replace('T',' ');d.continuous.victoryText='七日战役；第五日后中央枢纽与任一侧站区保持24小时可提前结束。';d.continuous.economyRules=VERSION;
  d.ux.vehicles={TRAIN:{available:n.stock.TRAIN,needed:net.trainNeed},TRUCK:{available:n.stock.TRUCK,needed:net.truckNeed}};
  for(const g of d.ux.equipment){g.required=copy(e.establishment[g.id]);g.repair={recipe:{},missing:[]};}
  for(const[id,v]of Object.entries(d.continuous.units)){v.dailySupply=copy(this.clock.units[id].dailySupply??net.rows[id]);v.refillStatus=copy(this.clock.units[id].refillStatus);v.reason=v.reason.replace('等待人员和对应装备','按通达率逐步补人补装、恢复组织');}
  // No legacy P packets, cash income, expiry or warehouse demand presented as active rules.
  d.continuous.recovery={waiting:d.units.filter(u=>u.alive&&(this.clock.units[u.id].personnel<this.clock.units[u.id].max-.01||Object.entries(e.establishment[u.id]).some(([k,n])=>this.econ.gear.units[u.id].held[k]<n-.001))).length,rows:[],rule:'人员与装备分别自动补充，无100人门槛'};
  return d;
 }
}
