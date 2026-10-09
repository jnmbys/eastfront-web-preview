import {Campaign as Base} from '../grand-map-r1/authority.mjs';
import {band,estimate} from './estimates.mjs';
const copy=structuredClone,key=h=>h.q+','+h.r;
const visibleSamples=(row,side)=>{const xs=row?.samples??[];const lastMissing=xs.findLastIndex(s=>!s.authorized?.includes(side));return xs.slice(lastMissing+1);};
export class Campaign extends Base {
 constructor(){super();this.clock.displayForecast={version:1,contacts:{},completed:[],audit:[]};}
 restore(s,pause=true){super.restore(s,pause);this.clock.displayForecast??={version:1,contacts:{},completed:[],audit:[]};if(this.clock.displayForecast.version!==1)throw Error('UNSUPPORTED_FORECAST_VERSION');}
 transaction(req){const replay=this.receipts.has(req.id),r=super.transaction(req);if(!replay&&this.clock.displayForecast){const op=req.operation;const ids=op.type==='ORDER'?(this.clock.corps.find(g=>g.id===op.group)?.members??[]):op.unit?[op.unit]:[];this.clock.displayForecast.completed=this.clock.displayForecast.completed.filter(a=>!ids.includes(a.unit));}return r;}
 advance(){
  const marching=Object.entries(this.clock.units).filter(([,v])=>v.march).map(([id,v])=>({id,from:copy(this.state.units[id].hex),march:copy(v.march)}));
  super.advance();const f=this.clock.displayForecast,t=this.clock.tick;
  f.completed=marching.filter(a=>!this.clock.units[a.id].march&&this.state.units[a.id].alive&&key(this.state.units[a.id].hex)===key(a.march.to)).map(a=>({id:'arrived:'+a.id+':'+t,unit:a.id,kind:'MOVE',from:a.from,to:a.march.to,path:[a.from,a.march.to],progress:1,status:'COMPLETED',battleId:null,segment:{completed:a.march.total,total:a.march.total,remainingMinutes:0},reason:'当前路段已由权威状态确认到达',tick:t}));
  const active=Object.values(this.clock.engagements.active);
  const reportViews={};const reportView=side=>reportViews[side]??=(this.fair(side).view);
  for(const b of active){
   // Authorized close-contact coarse assessment. Never passed to fair()/AI.
   // Keep exact opposing state server-side. Quantize BEFORE trend calculations.
   const units=b.units.map(id=>{const v=this.clock.units[id],u=this.state.units[id];return {id,side:u.side,org:band(v.org,10),strength:band(v.personnel/v.max*100,10),blocked:/退路受阻|包围损失/.test(v.reason??''),supply:this.econ.supply[id].stock>0?'AVAILABLE':'EMPTY',hex:key(u.hex)};});
   const signature=JSON.stringify(units.map(u=>[u.id,u.hex,u.supply,u.blocked]));
   const prior=f.contacts[b.id],row=prior?.signature===signature?prior:{signature,samples:[],changedAt:t};
   const authorized=['GERMAN','SOVIET'].filter(side=>{const d=this.groupView(b,reportView(side));return d&&!d.unknownParticipants;});
   row.samples.push({tick:t,units,authorized});row.samples=row.samples.slice(-6);row.updated=t;f.contacts[b.id]=row;
   for(const side of ['GERMAN','SOVIET']){const dto=this.groupView(b,reportView(side));if(!dto)continue;const e=dto.unknownParticipants?{status:'ASSESSING',label:'评估中',scope:'本次接触',minutes:null,reason:'参战对象尚未完全识别，不推算整场结束'}:estimate(visibleSamples(row,side),side);f.audit.push({tick:t,battle:b.id,viewer:side,...e});}
  }
  for(const id of Object.keys(f.contacts))if(!active.some(b=>b.id===id))delete f.contacts[id];
  f.audit=f.audit.slice(-600);
 }
 snapshot(draft){const d=super.snapshot(draft),f=this.clock.displayForecast;if(!f)return d;
  for(const b of d.continuous.map.battles){const row=f.contacts[b.id];b.estimate=b.unknownParticipants?{status:'ASSESSING',label:'评估中',scope:'本次接触',minutes:null,reason:'参战对象尚未完全识别'}:estimate(visibleSamples(row,this.viewer),this.viewer);if(row)b.estimate.changedAt=row.changedAt;}
  for(const a of d.continuous.map.actions){const v=this.clock.units[a.unit];if(v?.march&&!v.engaged&&['MOVE','RETREAT'].includes(a.kind)){a.segment={completed:v.march.total-v.march.remaining,total:v.march.total,remainingMinutes:v.march.remaining*5};a.progress=a.segment.completed/a.segment.total;}
   else {delete a.progress;a.activity=a.status==='ACCEPTED'?'已接受，待执行':a.kind==='SUPPORT'?'支援中（不跟进）':'交战中（无行军段）';a.estimate=d.continuous.map.battles.find(b=>b.id===a.battleId)?.estimate;}
  }
  d.continuous.map.actions.push(...f.completed.filter(a=>a.tick===this.clock.tick&&this.state.units[a.unit].side===this.viewer&&key(this.state.units[a.unit].hex)===key(a.to)).map(x=>copy(x)));
  return d;
 }
}
