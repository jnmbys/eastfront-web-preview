// Projection only: input is the already authorized, seat-private snapshot. No planner or hidden-state probe.
const sum=(lots,type,predicate=()=>true)=>lots.filter(l=>l.type===type&&predicate(l)).reduce((n,l)=>n+l.qty,0);
export function recoveryStatus(d){
 const c=d.continuous,turn=d.turn,products=d.ux.products,warehouses=d.warehouses.filter(w=>w.controlled),lines=d.ux.lines.filter(l=>l.controlled),last=d.ux.last,rows=[];
 for(const u of d.units.filter(u=>u.alive)){
  const v=c.units[u.id],g=d.ux.equipment.find(g=>g.id===u.id);if(!v||!g)continue;
  const recipe=u.step>0?g.recipe:{},cargo={};for(const k of Object.keys(g.recipe))cargo[k]=Math.max(0,(g.required[k]??0)-(g.held[k]??0))+(recipe[k]??0);if(u.step>0)cargo.P=1;
  const items=Object.entries(cargo).filter(([,n])=>n>0).map(([type,need])=>{
   const ready=sum(g.staged,type,l=>l.availableTurn<=turn),pending=sum(g.staged,type,l=>l.availableTurn>turn&&l.availableTurn<Number.MAX_SAFE_INTEGER),quarantined=sum(g.staged,type,l=>l.availableTurn===Number.MAX_SAFE_INTEGER),short=Math.max(0,need-ready-pending),stock=warehouses.reduce((n,w)=>n+sum(w.lots,type,l=>l.availableTurn<=turn),0),notReady=warehouses.reduce((n,w)=>n+sum(w.lots,type,l=>l.availableTurn>turn&&l.availableTurn<Number.MAX_SAFE_INTEGER),0),making=lines.filter(l=>l.product===type&&l.factories.length),blocked=(last?.blocked??[]).filter(b=>b.unit===u.id&&b.type===type);
   let reason=ready>=need?'部队已收到，材料齐备':pending&&ready+pending>=need?'已到部队待用，等待可用时点':short?type==='P'?stock>0?'仓库有人，等待配送':notReady>0?'人员已接驳，等待下一周期配送':d.account.reserve<=0?'已训练后备耗尽':d.account.I<2?'接驳预算不足（2I／组）':'等待自动接驳（每周期最多2组）':stock>0?'仓库有货，尚未到部队':notReady>0?'已出厂待用，下一周期可发运':making.length?'生产线正在生产，尚无可配送成品':'尚未安排对应装备生产':'材料待用';
   if(short&&blocked.length){const b=blocked.at(-1);reason+='；上次'+({TRUCK_SHORTAGE:'卡车不足',TRAIN_SHORTAGE:'火车不足',LINE_CAPACITY:'线路容量不足',TRANSPORT_CAPACITY:'共享运输不足或路线受阻',ROUTE_UNAVAILABLE:'路线受阻',MATERIAL_SHORTAGE:'可配送来源不足',LINE_OR_SERVICE_RANGE:'线路或配送范围不满足'}[b.reason]??'配送未完成');}
   if(quarantined)reason+='；另有照管欠费冻结材料';
   return {type,label:type==='P'?'补充人员':products[type]?.label??type,need,ready,pending,short,quarantined,warehouse:stock,warehousePending:notReady,reason,lines:making.map(l=>l.id),action:type==='P'?'查看行政预算与人员来源':'查看生产线与配送优先级'};
  });
  const withdrawal=c.tactical?.units[u.id]?.phase==='WITHDRAW',conditions=[];
  if(v.engaged)conditions.push('正在交战，暂不能补充');else if(v.march||withdrawal)conditions.push('正在行军或撤出，尚未开始驻留整补');else if(v.rest<6)conditions.push(`驻留休整不足30分钟，已${v.rest*5}分钟`);
  if(v.stock<=0)conditions.push('补给已耗尽，等待补给配送');
  if(u.step===0&&v.personnel<v.max)conditions.push('人员损失未满100人编制组，现规则暂不补员');
  const materialShort=items.some(x=>x.ready<x.need),reason=u.step>0?conditions[0]??(materialShort?'待到货：'+items.filter(x=>x.ready<x.need).map(x=>x.label+' '+Math.max(0,x.need-x.ready)).join('、'):'材料齐备，下一模拟步满足资格时自动补充'):items.length?'补齐现存编制装备':conditions[0]??'编制完整';
  const army=d.ux.armies.find(a=>a.id===u.army);if(army&&!army.materials&&items.some(x=>x.short))conditions.unshift('该军团自动材料配送已关闭，请在配送优先级中开启');
  rows.push({id:u.id,hex:u.hex,group:v.direct?null:c.corps.find(g=>g.members.includes(u.id))?.id,step:u.step,personnel:v.personnel,max:v.max,reason:army&&!army.materials&&items.some(x=>x.short)?conditions[0]:reason,conditions,items,attention:u.step>0||items.some(i=>i.short),lastEpoch:d.epoch,army:u.army});
 }
 return {version:1,rows,waiting:rows.filter(r=>r.attention).length,rule:'一个人员编制组100人；补充消耗1P及本兵种配套装备。',rail:'共同时间模式目前没有铁路修复命令；旧阶段控件不可用。线路中断时可改变路线附近的行动或转移至已有可服务地点，不能靠增加车辆跨越断线。'};
}
