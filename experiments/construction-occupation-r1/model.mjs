export const VERSION='CONSTRUCTION-OCCUPATION-R1-1';
export const active=q=>q.status!=='DONE';
export const upgrade=q=>q.kind==='INFRA'||q.kind==='FORT';
export function controlled(c,q){return q.kind==='INFRA'?c.clock.provinces.items.find(p=>p.id===q.province)?.cells.every(k=>c.state.hexes[k]?.control===q.side):c.state.hexes[q.hex]?.control===q.side;}
export function actual(c,q){return q.kind==='INFRA'?c.clock.infrastructure.levels[q.province]:(c.clock.forts.levels[q.hex]??0);}
export function nextLevel(c,side,kind,target,level,cap){const used=new Set(c.econ.modern.queue.filter(q=>active(q)&&q.side===side&&q.kind===kind&&q.target===target).map(q=>q.targetLevel));for(let n=level+1;n<=cap;n++)if(!used.has(n))return n;return null;}
export function reconcile(c){if(!c.clock.constructionOccupation)return;for(const q of c.econ.modern.queue)if(active(q)&&upgrade(q)&&controlled(c,q)&&actual(c,q)>=q.targetLevel){q.status='DONE';q.satisfied=true;q.assigned=[];q.rate=0;q.outcome='原目标等级已由实际设施满足；不再施工、不转移进度、不退款';}}
// Pure allocation check: only own reservations compete, physical facilities always count.
export function reason(c,q,slots){if(!controlled(c,q))return '失守停工';if(upgrade(q)){const n=actual(c,q);if(n>=q.targetLevel)return '原目标已满足';return n<q.targetLevel-1?'等待前级；可补建缺失等级':'';}
 if(['CIV','MIL'].includes(q.kind)){const d=c.econ.cities.items.flatMap(x=>x.districts).find(x=>x.id===q.target);if(!d||d.type!=='INDUSTRIAL')return '原工业区不再可用';const used=slots.get(d.id)??Object.values(c.econ.modern.facilities).filter(f=>f.district===d.id).length;if(used>=d.slots)return '实际工厂槽位已满';slots.set(d.id,used+1);}return '';}
