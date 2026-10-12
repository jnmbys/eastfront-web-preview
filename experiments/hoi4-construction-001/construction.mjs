import {locked as conversionLocked,reason as conversionReason} from '../hoi4-factory-conversion-001/model.mjs';
import {reason as occupationReason} from '../construction-occupation-r1/model.mjs';
import {blocked as fortBlocked} from '../hoi4-fortification-001/model.mjs';
import {constructionFactor,blocked} from '../hoi4-infrastructure-001/model.mjs';
export const VERSION='HOI4-CONSTRUCTION-001-1';
export const active=q=>q.status!=='DONE';
export const sortQueue=(a,b)=>(a.queueRank??a.serial)-(b.queueRank??b.serial)||a.serial-b.serial;
export function allocation(c,side){
 const e=c.econ.modern,cfg=e.balanceConfig,facilities=Object.values(e.facilities).filter(f=>f.kind==='CIV'&&c.state.hexes[f.hex]?.control===side).sort((a,b)=>a.id.localeCompare(b.id));
 const usable=facilities.filter(f=>f.damage<1&&!conversionLocked(c,f,side)),pool=[...usable],rows=[],slots=new Map();
 for(const q of e.queue.filter(q=>q.side===side&&active(q)).sort(sortQueue)){
  let reason=c.clock.constructionOccupation?occupationReason(c,q,slots):(c.clock.forts?fortBlocked(c,q):'')||(c.clock.infrastructure?blocked(c,q):'');if([q.hex,q.other,...(q.path??[])].filter(Boolean).some(h=>c.state.hexes[h]?.control!==side))reason='失守停工';
  if(!reason&&c.clock.factoryConversion)reason=conversionReason(c,q);
  if(!reason&&q.kind==='CONVERT'&&!q.started){const target=facilities.find(f=>f.id===q.target),index=pool.findIndex(f=>f.id===q.target);if(target&&index<0)reason='等待原厂结束当前施工分配';else if(!pool.some(f=>f.id!==q.target))reason=target?'需要另一座可用民厂':'等待民厂';else if(index>=0)pool.splice(index,1);}
  const assigned=reason?[]:pool.splice(0,15),rate=assigned.reduce((n,f)=>n+cfg.civilWorkDay*(1-f.damage)*constructionFactor(c,q),0);
  rows.push({id:q.id,assigned:assigned.map(f=>f.id),rate,reason:reason||(!assigned.length?'等待民厂':rate<assigned.length*cfg.civilWorkDay?'厂房受损':'施工中'),etaDays:rate>0?Math.max(0,q.cost-q.progress)/rate:null});
 }
 const used=rows.reduce((n,r)=>n+r.assigned.length,0);return {version:VERSION,cap:15,total:facilities.length,unavailable:facilities.filter(f=>f.damage>=1&&!conversionLocked(c,f,side)).length,occupied:facilities.filter(f=>conversionLocked(c,f,side)).length,available:usable.length,allocated:used,idle:usable.length-used,workDay:cfg.civilWorkDay,rows};
}
