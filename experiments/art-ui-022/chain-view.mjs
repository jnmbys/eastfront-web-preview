import {validateChain,renderChainView as originalRender,OPS,nextHint} from '/chain-view.mjs';
export {validateChain,OPS,nextHint};
const $=id=>document.getElementById(id),put=(id,v)=>{$(id).textContent=v;};
const names={REAR_AVAILABLE:'后方可用',REAR_UNAVAILABLE:'后方到账、未可用',PRODUCTION_STORE:'生产库存',FRONT_AVAILABLE:'前线可用',CONSUMED:'已消费',NOT_CREATED:'尚未生成',SOURCE_AVAILABLE:'后备池',SOURCE_ESCROW:'待接驳',IN_TRANSIT:'在途',HELD:'在途留置',REAR_QUARANTINED:'后方隔离',FRONT_QUARANTINED:'前线隔离',TRANSIT_QUARANTINED:'在途隔离'};
export function dockModel(s){
 validateChain(s);
 const x=s.extensions.industry018,b=s.equipmentBudget,p=s.personnelBudget,o=s.operations;
 const units=Object.entries(s.materials).map(([k,m])=>({key:k,quantity:m.quantity,owner:m.owner,custody:m.custody,consumed:m.consumed}));
 const at=id=>units.filter(m=>m.owner===id).map(m=>(m.key==='P'?m.quantity+'P':m.quantity+' E2')).join(' + ')||'0P / 0 E2';
 const front=units.some(m=>m.owner==='RC009-G-C10-GI01');
 const transit=units.filter(m=>['IN_TRANSIT','HELD','TRANSIT_QUARANTINED','SOURCE_ESCROW'].includes(m.custody));
 let mode=o.ALLOCATE_I.enabled||o.PLACE_ORDER.enabled?'order':o.ACTIVATE_PERSONNEL.enabled||o.APPLY_PERSONNEL.enabled?'personnel':o.CARE.enabled?'care':o.RECOVER.enabled?'recover':s.recovery?'done':'wait';
 const active=x.accountStatus.personnel==='ACTIVE';
 const personBudget=active?'余 '+p.availableI+'I · 已支 '+(p.acceptanceCareSpentI+p.carriageSpentI)+'I':'未启用';
 const timeline=!x.order?['T5 下单','E6 到账','T7 可用']:mode==='personnel'?['人员申请','E7 到账','T8 可用']:['装备 '+(x.equipmentBatch?.receivedEpoch==null?'未到账':'E'+x.equipmentBatch.receivedEpoch+'到 / T'+x.equipmentBatch.availableFromTurn+'可用'),'人员 '+(x.personnel?.package?.receivedEpoch==null?'未到账':'E'+x.personnel.package.receivedEpoch+'到 / T'+x.personnel.package.availableFromTurn+'可用')];
 let cost=mode==='order'?'下单预告：支付3I + 托管2I':mode==='personnel'?(o.ACTIVATE_PERSONNEL.enabled?'启用独立人员2I，来自假定后备池':'人员账户：支付1I + 托管1I'):mode==='care'?'照管费用1I · 从装备账户扣款':mode==='recover'?'恢复消耗1P + 2 E2 · RP不扣':s.recovery?'恢复已完成 · 消费1P + 2 E2':s.care?'已付照管 '+s.care.spentI+'I':'未产生新的业务付款';
 let expiry=mode==='care'?'尚未支付；确认后装备余'+(b.freeI-1)+'I，照管至E9结束。':s.recovery?'人员已消费，照管记录保留。':s.expired?'人员已隔离，仍占仓容，不可恢复。':s.care?'照管至E'+s.care.endEpoch+'结束；未使用将隔离。':'未照管且E8结束仍留后方，人员将隔离。';
 const reason=mode==='order'?(o.ALLOCATE_I.enabled?'须先领取原10I拨款，订单尚未创建。':'拨款已领取；下单后需2次合法生产结算。'):mode==='personnel'?'独立人员账户不可与装备合账；启用不是训练。':mode==='care'?'人员独立2I已支出，照管不扣人员账户。':mode==='recover'?'按后端资格恢复G-I-01，共用恢复次数。':s.recovery?'链路已完成，不能再次恢复。':nextHint(s);
 return {mode,personBudget,timeline,cost,expiry,reason,object:front?'C10':'A10',stock:s.recovery?'物资已消费':at(front?'RC009-G-C10-GI01':'RC007-REAR-G-A10'),stockLocation:units.filter(m=>m.quantity>0).map(m=>(m.key==='P'?'人员':'装备')+'：'+(names[m.custody]||m.custody)).join(' / ')||'当前无已生成物资',transit:transit.length?transit.map(m=>m.quantity+(m.key==='P'?'P':' E2')+' '+(names[m.custody]||m.custody)).join(' / '):'无在途物资；未来计划不计库存',route:s.shipment?('前送已提交：E'+s.shipment.dispatchEpoch+'发运 · '+(s.shipment.arrivalEpoch==null?'尚未到账':'E'+s.shipment.arrivalEpoch+'到 / T'+s.shipment.availableFromTurn+'可用')):'前送示意（未执行）：A10 → B10 → C10 · 主路径E8前送/T9可用'};
}
export function renderChainView(s){
 originalRender(s);
 const m=dockModel(s);
 put('personnel-budget',m.personBudget);put('stock-main',m.stock);put('stock-location',m.stockLocation);put('transit-summary','在途：'+m.transit);
 put('object-name',(m.object==='A10'?'后方接收':'前线接收')+' · '+m.object);document.body.dataset.object=m.object;
 put('plan-title',s.extensions.industry018.order?'当前账本与后续时点':'主路径预告 · 尚未下单');
 $('timeline').replaceChildren(...m.timeline.map(v=>{const t=document.createElement('span');t.textContent=v;return t;}));
 put('cost-main',m.cost);put('expiry-main',m.expiry);put('route-summary',m.route);put('action-reason',m.reason);
 $('personnel-icon').hidden=!s.materials.P.quantity;
 for(const[id,op]of OPS){
  if(id==='next')continue;
  const relevant=s.operations[op].enabled||(m.mode==='order'&&id==='order');
  $('card-'+id).hidden=!relevant;
 }
 document.body.dataset.chainMode=m.mode;
 window.dispatchEvent(new CustomEvent('industry-view',{detail:s}));
}

