// Manual intent is an overlay on corps membership, never a reassignment.
export const MANUAL_VERSION='MANUAL-INTENT-1';
const copy=structuredClone;
export function beforeManual(c,op){
 const ids=op.type==='ORDER'?(c.clock.corps.find(g=>g.id===op.group)?.members??[]):['DIRECT','RESUME_PLAN'].includes(op.type)?[op.unit]:[];
 return Object.fromEntries(ids.filter(id=>c.clock.tactical?.withdrawals[id]).map(id=>[id,copy(c.clock.tactical.withdrawals[id])]));
}
export function afterManual(c,op,withdrawals){
 Object.assign(c.clock.tactical.withdrawals,withdrawals);
 if(op.type==='DIRECT'){
  const v=c.clock.units[op.unit];v.manual={version:MANUAL_VERSION,kind:op.order.kind,target:copy(op.order.target),since:c.clock.tick,persistent:op.order.paused||['HOLD','REFIT'].includes(op.order.kind)};
  c.note(c.viewer,'手动命令优先；保留军团归属'+(v.manual.persistent?'，待明确恢复军团计划':'，完成后恢复军团计划'),op.unit);
 }
 if(op.type==='ASSIGN')delete c.clock.units[op.unit].manual;
}
export function resumeManual(c,req){
 const signature=JSON.stringify(req),prior=c.receipts.get(req.id);if(prior){if(prior.signature!==signature)throw Error('ID_REUSE_CONFLICT');return copy(prior.result);}
 if(typeof req.id!=='string'||req.id.length<8)throw Error('REQUEST_ID_REQUIRED');
 if(c.clock.ended)throw Error('CAMPAIGN_FINISHED');if(req.version!==c.version)throw Error('STALE_VERSION');
 const id=req.operation.unit,u=c.state.units[id],v=c.clock.units[id],g=c.clock.corps.find(g=>g.members.includes(id)&&g.side===c.viewer);
 if(!u?.alive||u.side!==c.viewer||!g)throw Error('UNIT_OR_GROUP_NOT_OWNED');
 v.direct=null;delete v.manual;v.march=null;
 delete c.clock.tactical.states[id];delete c.clock.tactical.orders[id];
 // An accepted withdrawal is physical business and survives every command change.
 c.note(c.viewer,'已恢复所属军团计划；在途撤出继续执行',id);
 c.version++;c.match.matchRevision=c.version;const result={ok:true,version:c.version};c.receipts.set(req.id,{signature,result});return result;
}
export function completeManual(c){
 for(const [id,v]of Object.entries(c.clock.units)){
  const m=v.manual,u=c.state.units[id];if(!m||m.persistent||!u?.alive||v.march||c.clock.tactical.withdrawals[id]||c.clock.tick<=m.since)continue;
  const arrived=u.hex.q===m.target.q&&u.hex.r===m.target.r;
  const supportDone=m.kind==='SUPPORT'&&v.direct?.kind!=='SUPPORT';
  if(!arrived&&!supportDone)continue;
  v.direct=null;delete v.manual;delete c.clock.tactical.states[id];delete c.clock.tactical.orders[id];
  c.note(u.side,'手动任务完成，恢复原军团计划',id);
 }
}
