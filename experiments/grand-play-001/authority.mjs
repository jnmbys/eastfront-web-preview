import crypto from 'node:crypto';
import {Campaign as City} from '../city-001/authority.mjs';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import * as gear from '../grand-ux-001/equipment.mjs';
import {rules as defaultRules,sides,profiles,goals} from './rules.mjs';
import {decide,travel} from './planner.mjs';
const spec=defaultRules;
const copy=structuredClone,kh=core.hexKey,dist=core.hexDistance;
const paper=s=>{const m=/^([A-Z]+)(\d+)$/.exec(s);let col=0;for(const x of m[1])col=col*26+x.charCodeAt(0)-64;return {q:col-1,r:Number(m[2])-1-Math.floor((col-1)/2)};};
const fail=s=>{throw Error(s);};
export class Campaign extends City {
 constructor(){super();this.continuous=true;this.viewer='GERMAN';this.state.activeSide='GERMAN';this.state.phase='GERMAN_MOVEMENT';this.state.pendingDecision=null;
  this.clock={rules:spec.version,tick:0,paused:true,speed:1,rng:219031,autopause:true,contactSeen:false,ended:null,hold:{GERMAN:0,SOVIET:0},units:{},corps:[],battles:[],reports:[],history:[],metrics:{ticks:0,maxMs:0,totalMs:0,expanded:0},goals:goals.map(g=>({...g,hex:paper(g.paper)}))};
  // The short central-front scenario deploys 18 formations per side. Off-theatre
  // formations keep their equipment in the archive, never become available stock.
  this.archive={units:{},gear:{}};const selected=new Set();
  for(const side of sides)for(let group=0;group<3;group++){
   const members=[];const indices=[25,26,29,30,31,32].map(n=>n+group*12-12);
   for(let j=0;j<indices.length;j++){
    const id=(side==='GERMAN'?'G-':'S-')+String(indices[j]).padStart(3,'0'),u=this.state.units[id];selected.add(id);members.push(id);
    const center=paper(side==='GERMAN'?'W17':'AC17'),row=group*2-2+Math.floor(j/3),col=side==='GERMAN'?-1+j%3:1-j%3;
    let h={q:center.q+col,r:center.r+row-Math.floor(col/2)};if(!this.state.hexes[kh(h)]||this.state.hexes[kh(h)].terrain==='LAKE')h=center;
    u.hex=h;u.alive=true;u.step=0;u.entrenched=false;this.state.hexes[kh(h)].control=side;
    const max=this.econ.gear.units[id].base.maxDamageSteps*100;
    this.clock.units[id]={org:85,personnel:max,max,losses:0,rest:0,march:null,direct:null,reason:'等待统帅命令',engaged:0,retreat:false};
    this.placements.find(p=>p.id===id).army=`${side==='GERMAN'?'西':'东'}-${group+1}集团军`;
   }
   this.clock.corps.push({id:`${side}:${group}`,side,name:['第一机动军团','第二中央军团','第三预备军团'][group],officer:profiles[group].name,profile:group,members,order:{kind:'HOLD',target:paper(side==='GERMAN'?'W17':'AC17'),risk:'NORMAL',paused:side==='GERMAN'}});
  }
  for(const[id,u]of Object.entries(this.state.units))if(!selected.has(id)){this.archive.units[id]=u;this.archive.gear[id]=this.econ.gear.units[id];delete this.state.units[id];delete this.econ.gear.units[id];delete this.econ.supply[id];}
  this.placements=this.placements.filter(p=>selected.has(p.id));
  for(const side of sides){const lines=Object.values(this.econ.ux.lines).filter(l=>l.side===side);lines.forEach((l,i)=>l.product=['RIFLE','TANK','GUN','TRUCK','IDLE'][i]);this.econ.ux.armies[side]=this.econ.ux.armies[side].slice(0,3);}
  this.capture({type:'CAMPAIGN_INITIAL'});this.initialControl=Object.fromEntries(this.clock.goals.map(g=>[g.paper,this.state.hexes[kh(g.hex)].control]));
 }
 owner(){return this.viewer;}
 capability(id){const u=this.state.units[id],v=this.clock.units[id],g=this.econ.gear.units[id],h=g.held,b=g.base.steps[0],full=v.personnel/v.max;
  const ratio=k=>(g.recipe[k]?Math.min(1,(h[k]??0)/(g.recipe[k]*g.base.maxDamageSteps)):0),rifle=ratio('RIFLE'),gun=ratio('GUN'),tank=ratio('TANK')+ratio('HEAVY'),at=ratio('AT'),kit=ratio('KIT');
  return {org:v.org,stock:this.econ.supply[id].stock,fire:(2+5*rifle+9*gun+7*tank+5*at+kit)*full*(.3+.7*v.org/100)*(this.econ.supply[id].stock>0?1:.4),protection:1+1.2*tank+.3*kit+(u.entrenched?.4:0),armor:tank,antiArmor:at,mobility:Math.max(.65,1+.7*ratio('TRUCK')+.45*tank+.3*ratio('SCOUT')),base:b};
 }
 note(side,text,unit=null){this.clock.reports.push({tick:this.clock.tick,side,text,unit});if(this.clock.reports.length>300)this.clock.reports.shift();}
 ownOrder(id){const v=this.clock.units[id];return v.direct??this.clock.corps.find(g=>g.members.includes(id))?.order;}
 enemyPlan(view){
  if(this.territoryStrategy)return this.territoryStrategy(view);
  const own=view.units.filter(u=>u.side==='SOVIET'),enemies=view.units.filter(u=>u.side==='GERMAN');
  for(const g of this.clock.corps.filter(g=>g.side==='SOVIET')){
   const alive=own.filter(u=>g.members.includes(u.id)),org=alive.reduce((n,u)=>n+this.clock.units[u.id].org,0)/Math.max(1,alive.length),stock=alive.reduce((n,u)=>n+this.econ.supply[u.id].stock,0)/Math.max(1,alive.length);
   const threatened=enemies.filter(e=>dist(e.hex,paper('AC17'))<=3).sort((a,b)=>dist(a.hex,paper('AC17'))-dist(b.hex,paper('AC17'))||a.id.localeCompare(b.id));
   g.order={kind:org<38||stock<1?'RETREAT':g.profile===2&&!threatened.length?'HOLD':'ADVANCE',target:org<38?paper('AC17'):threatened[0]?.hex??paper(g.profile===2?'AC17':'Z17'),risk:org>65?'NORMAL':'LOW',paused:false};
  }
  if(!this.economyV2&&this.clock.tick%spec.epochTicks===1){const deficit={};for(const u of own){const g=this.econ.gear.units[u.id];for(const[k,n]of Object.entries(gear.capacity(this,u.id)))deficit[k]=(deficit[k]??0)+Math.max(0,n-g.held[k])+(u.step?g.recipe[k]:0);}
   const shortages=this.econ.ledger.at(-1)?.transport.find(t=>t.side==='SOVIET')?.blocked??[];if(shortages.some(b=>b.reason==='TRAIN_SHORTAGE'))deficit.TRAIN=(deficit.TRAIN??0)+20;if(shortages.some(b=>b.reason==='TRUCK_SHORTAGE'))deficit.TRUCK=(deficit.TRUCK??0)+20;const products=Object.entries(deficit).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(x=>x[0]);const lines=Object.values(this.econ.ux.lines).filter(l=>l.side==='SOVIET');lines.forEach((l,i)=>{l.product=i===4?'IDLE':products[i%Math.max(1,products.length)]??'RIFLE';});
  }
 }
 transaction(req){
  if(['PRODUCTION_LINE','ARMY_PRIORITY','BUILD_FACTORY'].includes(req.operation?.type)){if(this.clock.ended)fail('CAMPAIGN_FINISHED');return super.transaction(req);}
  if(typeof req.id!=='string'||req.id.length<8)fail('REQUEST_ID_REQUIRED');const signature=JSON.stringify(req);if(this.receipts.has(req.id)){const r=this.receipts.get(req.id);if(r.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(r.result);}
  if(req.version!==this.version&&!['CLOCK','ORDER','DIRECT','ASSIGN','AUTOPAUSE'].includes(req.operation?.type))fail('STALE_VERSION');if(req.action)fail('CONTINUOUS_COMMAND_REQUIRED');const op=req.operation;
  if(!op||this.clock.ended)fail('CAMPAIGN_FINISHED');
  if(['PRODUCTION_LINE','ARMY_PRIORITY','BUILD_FACTORY'].includes(op.type))return super.transaction(req);
  if(op.type==='CLOCK'){if(typeof op.paused!=='boolean'||!spec.speeds.includes(op.speed))fail('INVALID_CLOCK');this.clock.paused=op.paused;this.clock.speed=op.speed;}
  else if(op.type==='ORDER'){
   const g=this.clock.corps.find(g=>g.id===op.group&&g.side===this.viewer);if(!g)fail('GROUP_NOT_OWNED');this.validateOrder(op.order);g.order=copy(op.order);for(const id of g.members){if(!this.clock.units[id].direct)this.clock.units[id].march=null;}
   this.note(this.viewer,`${g.name}：${op.order.paused?'暂停':op.order.kind}，在途命令停止；已发生消耗保留`);
  }else if(op.type==='ASSIGN'){const u=this.state.units[op.unit],g=this.clock.corps.find(g=>g.id===op.group&&g.side===this.viewer);if(!u?.alive||u.side!==this.viewer||!g)fail('UNIT_OR_GROUP_NOT_OWNED');for(const old of this.clock.corps)old.members=old.members.filter(id=>id!==u.id);g.members.push(u.id);g.members.sort();this.placements.find(p=>p.id===u.id).army=`${g.side==='GERMAN'?'西':'东'}-${g.profile+1}集团军`;this.clock.units[u.id].direct=null;this.clock.units[u.id].march=null;this.note(this.viewer,'明确编入'+g.name+'，按该军团现有命令行动',u.id);
  }else if(op.type==='DIRECT'){
   const u=this.state.units[op.unit];if(!u?.alive||u.side!==this.viewer)fail('UNIT_NOT_OWNED');this.validateOrder(op.order);const v=this.clock.units[u.id];v.direct=copy(op.order);v.march=null;this.note(this.viewer,'接管直属命令；既有战斗与损失保留',u.id);
  }else if(op.type==='AUTOPAUSE'){if(typeof op.enabled!=='boolean')fail('INVALID_AUTOPAUSE');this.clock.autopause=op.enabled;}
  else fail('COMMAND_NOT_SUPPORTED');
  this.version++;this.match.matchRevision=this.version;const result={ok:true,version:this.version};this.receipts.set(req.id,{signature,result});return result;
 }
 validateOrder(o){if(!o||!['HOLD','ADVANCE','RETREAT','REFIT'].includes(o.kind)||!['LOW','NORMAL','HIGH'].includes(o.risk)||typeof o.paused!=='boolean'||!o.target||!Number.isSafeInteger(o.target.q)||!Number.isSafeInteger(o.target.r)||!this.state.hexes[kh(o.target)])fail('INVALID_PUBLIC_ORDER');}
 random(){let x=this.clock.rng;x^=x<<13;x^=x>>>17;x^=x<<5;this.clock.rng=x>>>0;return this.clock.rng/4294967296;}
 tick(){if(this.clock.paused||this.clock.ended)return false;const t=performance.now(),backup=this.save();try{this.advance();this.clock.metrics.ticks++;const ms=performance.now()-t;this.clock.metrics.totalMs+=ms;this.clock.metrics.maxMs=Math.max(ms,this.clock.metrics.maxMs);return true;}catch(e){this.restore(backup,false);this.clock.paused=true;this.note(this.viewer,'模拟已安全暂停：'+e.message);throw e;}}
 decideAction(...args){return decide(...args);}
 combatTrace(){return {};}
 advance(){
  const spec=this.simRules??defaultRules;
  const clock=this.clock;clock.tick++;const views=Object.fromEntries(sides.map(s=>[s,this.fair(s).view]));this.enemyPlan(views.SOVIET);
  const units=Object.values(this.state.units).filter(u=>u.alive).sort((a,b)=>a.id.localeCompare(b.id)),caps=Object.fromEntries(units.map(u=>[u.id,this.capability(u.id)])),before=copy(this.state),intents={},arrivals=[];
  for(const u of units){const v=clock.units[u.id],g=clock.corps.find(g=>g.members.includes(u.id));v.engaged=0;
   const own=views[u.side].units.find(x=>x.id===u.id),decision=this.decideAction(views[u.side],own,Object.fromEntries(Object.entries(caps).filter(([id])=>this.state.units[id].side===u.side)),this.ownOrder(u.id),profiles[g.profile]);intents[u.id]=decision;v.reason=decision.reason;clock.metrics.expanded+=decision.expanded??0;
   if(v.march){if(--v.march.remaining<=0)arrivals.push({id:u.id,...v.march});}
   else if(decision.kind==='MARCH'){u.entrenched=false;v.march={to:decision.to,remaining:decision.duration,total:decision.duration};v.org=Math.max(0,v.org-.8);}
  }
  // Calculate engagements before applying any arrival or damage. Both opponents
  // participate from the same snapshot; ordered iteration only names RNG draws.
  const pairs=new Map();const contact=(a,b)=>{if(!a||!b||a.side===b.side)return;const ids=[a.id,b.id].sort();pairs.set(ids.join('|'),ids);};
  for(const u of units){const d=intents[u.id];if(d.kind==='FIGHT')contact(u,this.state.units[d.target]);}
  for(const a of arrivals){const u=this.state.units[a.id];for(const enemy of units)if(enemy.side!==u.side&&kh(enemy.hex)===kh(a.to))contact(u,enemy);for(const b of arrivals)if(b.id!==a.id&&this.state.units[b.id].side!==u.side&&(kh(a.to)===kh(b.to)||kh(a.to)===kh(this.state.units[b.id].hex)&&kh(b.to)===kh(u.hex)))contact(u,this.state.units[b.id]);}
  const fighting=new Set([...pairs.values()].flat()),incoming=new Map();for(const a of arrivals){const k=kh(a.to);if(!incoming.has(k))incoming.set(k,[]);incoming.get(k).push(a);}
  for(const [k,as] of [...incoming.entries()].sort()){
   const stationary=units.filter(u=>kh(u.hex)===k).length;
   // Same-side overcrowding uses a rotating time-keyed priority, never side order.
   as.sort((a,b)=>{const key=x=>crypto.createHash('sha256').update(clock.tick+':'+x.id).digest('hex');return key(a).localeCompare(key(b));});let room=spec.stack-stationary;
   for(const a of as){const u=this.state.units[a.id],v=clock.units[a.id];if(fighting.has(u.id)){v.march=null;continue;}
    if(room<=0){v.march=null;v.reason='友军拥堵，保留当前位置后重新规划';continue;}
    const duration=travel(views[u.side],u.hex,a.to,caps[u.id]);if(!Number.isFinite(duration)){v.march=null;v.reason='公开交通已改变，路线停止';continue;}
    u.hex=copy(a.to);u.entrenched=false;v.march=null;v.org=Math.max(0,v.org-1.2);v.rest=0;this.spend(u.id,spec.moveQ);room--;this.state.hexes[k].control=u.side;
   }
  }
  const damage={},orgDamage={},battles=[];
  for(const ids of [...pairs.values()].sort((a,b)=>a.join().localeCompare(b.join()))){const [a,b]=ids.map(id=>this.state.units[id]),ca=caps[a.id],cb=caps[b.id];
   const old=clock.battles.find(x=>x.id===ids.join('|')),battle={id:ids.join('|'),units:ids,initiators:ids.filter(id=>intents[id]?.kind==='FIGHT'||arrivals.some(x=>x.id===id)),hex:copy(b.hex),since:old?.since??clock.tick,ticks:(old?.ticks??0)+1};Object.assign(battle,this.combatTrace(ids,intents,arrivals,before,old));battles.push(battle);
   for(const [u,e,c,ec]of[[a,b,ca,cb],[b,a,cb,ca]]){const risk=this.ownOrder(u.id)?.risk,pressure=risk==='HIGH'?1.3:risk==='LOW'?.75:1,terrain=this.state.hexes[kh(e.hex)].terrain,cover=terrain==='FOREST'||terrain==='CITY'?1.25:1;
    const hit=c.fire*pressure*(.8+.4*this.random())/(ec.protection*cover)*(1+c.antiArmor*ec.armor*.8);damage[e.id]=(damage[e.id]??0)+hit*(spec.damageScale??1);orgDamage[e.id]=(orgDamage[e.id]??0)+(3+hit*.3)*(spec.orgDamageScale??1);clock.units[u.id].engaged++;this.spend(u.id,spec.combatQ);}
  }
  clock.battles=battles;
  if(battles.length&&!clock.contactSeen){clock.contactSeen=true;if(clock.autopause)clock.paused=true;this.note(this.viewer,'首次持续交战：可增援、改变力度，或下达撤回命令；时间已'+(clock.paused?'暂停':'继续'));}
  for(const u of units){const v=clock.units[u.id],d=damage[u.id]??0;v.personnel=Math.max(0,v.personnel-d);v.losses+=d;v.org=Math.max(0,v.org-(orgDamage[u.id]??0));u.step=Math.min(this.econ.gear.units[u.id].base.maxDamageSteps-1,Math.floor((v.max-v.personnel)/100));if(v.personnel<=0)u.alive=false;
   if(v.engaged){v.rest=0;v.march=null;}else if(!v.march&&!this.isWithdrawalInProgress?.(u.id)){v.rest++;v.org=Math.min(100,v.org+(this.restOrgRate?this.restOrgRate(u.id):(this.econ.supply[u.id].stock>0?2:.25)));if(v.rest>=6)u.entrenched=true;}
  }
  if(this.recordEquipmentLoss)this.recordEquipmentLoss(before);else gear.recordLoss(this,before);
  // Withdrawal is adjudicated simultaneously against the tick's occupied map.
  const beforeRetreat=copy(this.state),retreats=[];if(!this.resolveTimedWithdrawal?.(units,views,caps)){for(const u of units.filter(u=>u.alive)){const v=clock.units[u.id],order=this.ownOrder(u.id);if(v.org<spec.orgRetreat||v.engaged&&order?.kind==='RETREAT'){
   const known=views[u.side],enemies=known.units.filter(e=>e.side!==u.side),target=order?.kind==='RETREAT'?order.target:paper(u.side==='GERMAN'?'W17':'AC17');
   const options=core.getNeighbors(u.hex).filter(h=>Number.isFinite(travel(known,u.hex,h,caps[u.id]))&&!enemies.some(e=>dist(e.hex,h)===0)).sort((a,b)=>dist(a,target)-dist(b,target)||kh(a).localeCompare(kh(b)));
   const h=options[0];if(h&&!units.some(e=>e.alive&&e.side!==u.side&&kh(e.hex)===kh(h))&&units.filter(e=>e.alive&&kh(e.hex)===kh(h)).length<spec.stack)retreats.push({u,h});else{v.personnel=Math.max(0,v.personnel-12);v.losses+=12;v.reason='退路受阻，包围损失';if(!v.personnel)u.alive=false;}
  }}
  const retreatSlots=new Map();retreats.sort((a,b)=>crypto.createHash('sha256').update(clock.tick+':'+a.u.id).digest('hex').localeCompare(crypto.createHash('sha256').update(clock.tick+':'+b.u.id).digest('hex')));for(const {u,h}of retreats){if(retreats.some(r=>r.u.side!==u.side&&kh(r.h)===kh(h)))continue;const key=kh(h),used=retreatSlots.get(key)??units.filter(e=>e.alive&&kh(e.hex)===key).length;if(used>=spec.stack)continue;retreatSlots.set(key,used+1);u.hex=copy(h);const v=clock.units[u.id];v.org=Math.max(25,v.org);v.personnel=Math.max(0,v.personnel-4);v.losses+=4;v.march=null;v.retreat=true;v.reason='撤回与追击造成额外人员损失';this.note(u.side,v.reason,u.id);}}
  for(const u of units){const v=clock.units[u.id];u.step=Math.min(this.econ.gear.units[u.id].base.maxDamageSteps-1,Math.floor((v.max-v.personnel)/100));if(v.personnel<=0)u.alive=false;}if(this.recordEquipmentLoss)this.recordEquipmentLoss(beforeRetreat);else gear.recordLoss(this,beforeRetreat);this.capture({type:'CAMPAIGN_TICK'});
  if(this.economyStep){this.economyStep();}else if(clock.tick%spec.epochTicks===0){const epoch=clock.tick/spec.epochTicks;const prior=copy(this.state);super.finishEpoch(epoch);for(const u of units){const lost=u.step-prior.units[u.id].step;if(lost>0||!u.alive&&prior.units[u.id].alive){const v=clock.units[u.id],loss=u.alive?Math.min(v.personnel,lost*100):v.personnel;v.personnel-=loss;v.losses+=loss;}}gear.recordLoss(this,prior);for(const side of sides)this.econ.ux.vehicles[side]=this.econ.ux.vehicles[side].filter(v=>v.qty>0);this.state.turn=epoch+1;this.note(this.viewer,'生产、维护与车辆配送已按同一周期结算；新批次现已到可用时点');}
  for(const u of units.filter(u=>u.alive)){const v=clock.units[u.id];if(!this.economyV2&&v.rest>=6&&u.step>0&&this.econ.supply[u.id].stock>0&&!gear.repairPlan(this,u.id).missing.length){const viewer=this.viewer;this.viewer=u.side;gear.payRepair(this,u.id,`CONT:${clock.tick}:${u.id}`);this.viewer=viewer;u.step--;v.personnel=Math.min(v.max,v.personnel+100);v.rest=0;this.note(u.side,'消耗已到货人员及对应装备，完成一组补充',u.id);}}
  gear.sync(this);for(const u of units)u.supplyState=this.econ.supply[u.id].stock>0?'SUPPLIED':'OUT_OF_SUPPLY';
  const controls=clock.goals.slice(0,3).map(g=>this.state.hexes[kh(g.hex)].control);for(const side of spec.territorialSurrender?[]:sides)clock.hold[side]=controls[1]===side&&controls.filter(s=>s===side).length>=2?clock.hold[side]+1:0;
  const won=clock.tick>=spec.victoryFrom?sides.find(s=>clock.hold[s]>=spec.holdTicks):null,exhausted=sides.find(s=>!units.some(u=>u.alive&&u.side===s));
  if(!spec.territorialSurrender&&(won||exhausted||clock.tick>=spec.duration)){let winner=won??(exhausted?sides.find(s=>s!==exhausted):null);if(!winner){const score=sides.map(s=>controls.filter(x=>x===s).length);winner=score[0]===score[1]?null:score[0]>score[1]?'GERMAN':'SOVIET';}clock.ended={winner,reason:won?(spec.holdText??'保持枢纽及一侧站区两小时'):exhausted?'战役兵力失去作战能力':(spec.deadlineText??'十五小时作战期限；按三个战略地点控制判定')};clock.paused=true;this.note(this.viewer,'战役结束：'+clock.ended.reason);}
  this.version++;this.match.matchRevision=this.version;clock.history.push({tick:clock.tick,controls,units:units.map(u=>({id:u.id,hex:kh(u.hex),personnel:clock.units[u.id].personnel,org:clock.units[u.id].org,stock:this.econ.supply[u.id].stock})),battles:clock.battles.length,epoch:this.econ.epoch});
 }
 spend(id,q){const s=this.econ.supply[id],paid=Math.min(q,s.stock);s.stock-=paid;s.debt+=q-paid;}
 save(){const spec=this.simRules??defaultRules;return {format:spec.version,version:spec.saveVersion,instanceId:this.id,revision:this.version,state:copy(this.state),econ:copy(this.econ),clock:copy(this.clock),nodes:copy(this.nodes),placements:copy(this.placements),archive:copy(this.archive),receipts:[...this.receipts],httpOutcomes:[...(this.httpOutcomes??new Map())]};}
 restore(s,pause=true){const spec=this.simRules??defaultRules;if(s?.format!==spec.version||s.version!==spec.saveVersion||!s.clock||!Number.isSafeInteger(s.clock.tick)||s.clock.tick<0||(spec.duration!==null&&s.clock.tick>spec.duration))fail('UNSUPPORTED_OR_INVALID_SAVE');if(!s.state?.units||!s.econ?.gear||!Array.isArray(s.receipts))fail('INVALID_SAVE');
  this.id=s.instanceId;this.match.id=this.id;this.match.matchId=this.id;this.version=s.revision;this.match.matchRevision=this.version;this.match.authoritative.state=copy(s.state);this.econ=copy(s.econ);this.clock=copy(s.clock);if(pause)this.clock.paused=true;this.nodes=copy(s.nodes);this.placements=copy(s.placements);this.archive=copy(s.archive);this.receipts=new Map(s.receipts);this.httpOutcomes=new Map(s.httpOutcomes);gear.sync(this);
 }
 snapshot(draft){const spec=this.simRules??defaultRules;const d=super.snapshot(draft),visible=new Set(d.game.message.payload.view.units.map(u=>u.id));d.continuous={version:spec.version,tick:this.clock.tick,minutes:this.clock.tick*spec.minutes,paused:this.clock.paused,speed:this.clock.speed,ended:this.clock.ended,autopause:this.clock.autopause,nextEconomy:spec.epochTicks-this.clock.tick%spec.epochTicks,
   goals:this.clock.goals.map(g=>({...g,control:d.game.message.payload.view.hexes.find(h=>kh(h.coord)===kh(g.hex))?.control??this.econ.ux.known[this.viewer][kh(g.hex)]??null})),corps:copy(this.clock.corps.filter(g=>g.side===this.viewer)).map(g=>{delete g.profile;return g;}),units:Object.fromEntries(Object.entries(this.clock.units).filter(([id])=>this.state.units[id].side===this.viewer).map(([id,u])=>[id,{...copy(u),...this.capability(id),hex:copy(this.state.units[id].hex),alive:this.state.units[id].alive}])),battles:copy(this.clock.battles.filter(b=>b.units.some(id=>this.state.units[id].side===this.viewer)||b.units.every(id=>visible.has(id)))),reports:copy(this.clock.reports.filter(r=>r.side===this.viewer).slice(-12))};return d;}
}
