import {Worker} from 'node:worker_threads';
import {FairHost} from '../../.ai003-preview/ai/authority/FairHost.js';
const copy=structuredClone,names=['埃里克·林德','玛拉·沃斯','尤里·索科林'];
const units=a=>a.unitId?[a.unitId]:a.attackerUnitIds??a.unitIdsByStep??a.retreats?.map(x=>x.unitId)??[];
const affected=p=>p?.unitIds??p?.eligibleUnitIds??[];
export class Delegation {
 constructor(c){this.c=c;this.seats=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,{side,enabled:false,revision:0,cursor:0,groups:names.map((name,i)=>({id:String(i),name,members:[],order:null,paused:true,rp:0,spentRP:0,status:'尚未授权'})),reports:[]}]));this.receipts=new Map();this.busy=false;}
 seat(){return this.seats[this.c.viewer];}
 active(s=this.seat()){return s.enabled?s.groups.filter(g=>g.order&&!g.paused&&g.members.length):[];}
 public(view){const s=copy(this.seats[view.viewer]),own=view.units.filter(u=>u.side===view.viewer&&'friendly'in u);for(const g of s.groups){g.members=g.members.filter(id=>own.some(u=>u.id===id));g.needs=own.filter(u=>g.members.includes(u.id)&&(u.step||u.supplyState!=='SUPPLIED')).map(u=>({id:u.id,damage:u.step,supply:u.supplyState}));}s.reports=s.reports.slice(-12);return s;}
 config(q){const s=this.seat(),view=this.c.projection().view;if(q.revision!==s.revision)throw Error('OFFICER_ORDER_CHANGED');const c=q.command,g=s.groups.find(g=>g.id===c.group);
  if(c.type==='ENABLE'){if(typeof c.enabled!=='boolean')throw Error('INVALID_ENABLE');s.enabled=c.enabled;if(!s.enabled)for(const x of s.groups){x.paused=true;x.status='模式关闭，控制交还统帅';}}
  else {if(!g)throw Error('UNKNOWN_OFFICER');switch(c.type){
   case 'ASSIGN':if(typeof c.direct!=='boolean'||!view.units.some(u=>u.id===c.unit&&u.side===s.side&&u.friendly?.alive))throw Error('UNIT_NOT_AUTHORIZED');for(const x of s.groups)x.members=x.members.filter(id=>id!==c.unit);if(!c.direct)g.members.push(c.unit);break;
   case 'ORDER':if(!c.order||!['ATTACK','DEFEND','REFIT'].includes(c.order.kind))throw Error('INVALID_ORDER');if(c.order.kind!=='REFIT'&&!view.hexes.some(h=>h.coord.q===c.order.target?.q&&h.coord.r===c.order.target?.r))throw Error('INVALID_PUBLIC_TARGET');g.order={kind:c.order.kind,target:c.order.kind==='REFIT'?null:copy(c.order.target)};g.paused=false;g.status='命令生效';break;
   case 'PAUSE':g.paused=true;g.status='已暂停，待决保留给统帅';break;
   case 'RESUME':if(!g.order)throw Error('NO_ORDER');g.paused=false;break;
   case 'CANCEL':g.order=null;g.paused=true;break;
   case 'RP':if(!Number.isSafeInteger(c.amount)||c.amount<0||c.amount+s.groups.filter(x=>x!==g).reduce((n,x)=>n+x.rp,0)>(view.resources[s.side]?.rp??0))throw Error('RP_INSUFFICIENT');g.rp=c.amount;break;
   default:throw Error('UNKNOWN_COMMAND');
  }}s.revision++;return {ok:true,revision:s.revision};
 }
 pauseSide(side){const s=this.seats[side];for(const g of s.groups){g.paused=true;g.status='统帅接管，待决完整保留';}s.revision++;}
 manual(a){const p=this.c.state.pendingDecision,ids=p?affected(p):units(a);if(p&&!ids.length)return true;return !this.active().some(g=>p?ids.every(id=>g.members.includes(id)):ids.some(id=>g.members.includes(id)));}
 observe(side,g){const c=this.c;const host=new FairHost({matchId:c.id,initialState:c.state,rules:c.rules,scenario:c.scenario,agentSeeds:{GERMAN:101,SOVIET:202}});const input=copy(host.observe(side));input.view.resources[side].rp=Math.min(input.view.resources[side].rp,g.rp);return input;}
 async tick(q){const c=this.c,s=this.seat(),signature=JSON.stringify({...q,side:s.side});if(this.receipts.has(q.id)){const old=this.receipts.get(q.id);if(old.signature!==signature)throw Error('ID_CONFLICT');return copy(old.result);}if(this.busy)throw Error('OFFICER_BUSY');if(q.version!==c.version||q.revision!==s.revision)throw Error('OFFICER_STALE');if(c.owner()!==s.side)return {ok:false,reason:'等待对方或统帅待决'};
  this.busy=true;const start=performance.now();let result={ok:false,reason:'当前无行动；全军阶段由统帅结束'};
  try{for(let offset=0;offset<3;offset++){const index=(s.cursor+offset)%3,g=s.groups[index];if(!this.active(s).includes(g))continue;
    const input=this.observe(s.side,g),services={warehouses:Object.values(c.econ.warehouses).filter(w=>w.owner===s.side).map(w=>({hex:w.node,P:c.available(w,'P'),E2:c.available(w,'E2'),controlled:input.view.hexes.some(h=>`${h.coord.q},${h.coord.r}`===w.node&&h.control===s.side)}))};
    const decision=await new Promise((resolve,reject)=>{const w=new Worker(new URL('./officer-worker.mjs',import.meta.url),{workerData:{input,members:[...g.members],order:copy(g.order),profile:index,services}});const timer=setTimeout(()=>{w.terminate();reject(Error('OFFICER_SEARCH_TIMEOUT'));},3000);w.once('message',m=>{clearTimeout(timer);w.terminate();m.error?reject(Error(m.error)):resolve(m);});w.once('error',e=>{clearTimeout(timer);reject(e);});});
    // Configuration, takeover and normal actions remain responsive during search.
    if(c.viewer!==s.side||q.version!==c.version||q.revision!==s.revision){result={ok:false,reason:'局面或授权已变化，丢弃尚未提交的决定'};break;}
    g.status=decision.reason;if(!decision.intent)continue;const a=decision.intent;if(['END_PHASE','READY_FOR_PHASE_END'].includes(a.type)||units(a).some(id=>!g.members.includes(id)))throw Error('OFFICER_CAPABILITY_ESCAPE');
    const beforeRP=c.state.rp[s.side];try{const receipt=c.transaction({id:q.id,version:q.version,action:a},true);const paid=Math.max(0,beforeRP-c.state.rp[s.side]);g.rp=Math.max(0,g.rp-paid);g.spentRP+=paid;result={ok:true,receipt,action:a};}catch(e){g.paused=true;g.status='真实事务拒绝，已停止；由统帅处理，不重试探测';result={ok:false,reason:g.status,retryOthers:this.active(s).length>0};}
    s.reports.push({officer:g.name,turn:input.view.turn,phase:input.view.phase,action:a,accepted:result.ok,reason:g.status,metrics:decision.metrics,ms:performance.now()-start,policyMs:decision.policyMs});s.cursor=(index+1)%3;break;
   }}catch(e){if(q.revision===s.revision)this.pauseSide(s.side);result={ok:false,reason:'军官停止：'+e.message};}finally{this.busy=false;}
  result.ms=performance.now()-start;this.receipts.set(q.id,{signature,result:copy(result)});return result;
 }
}
