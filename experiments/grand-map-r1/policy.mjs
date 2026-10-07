import {decide,travel} from '../grand-play-001/planner.mjs';
import {hexDistance as distance,hexKey as key} from '../../vendor/eastfront-digital-core/dist/index.js';
// Adjacent combined-arms support only. No indirect fire/range bonus is invented.
export function eligible(view,unit,cap,target){
 if(!unit?.friendly?.alive)return '部队不可用';
 if(!cap||cap.org<45)return '组织度不足45';
 if(cap.stock<1)return '库存不足1q';
 if(cap.fire<=0||['HQ','TRANSPORT'].includes(unit.type))return '兵种没有地面交战能力';
 if(distance(unit.hex,target)!==1)return '本版支援仅限相邻地块，无跨格射程';
 if(!Number.isFinite(travel(view,unit.hex,target,cap)))return '公开交通不可跨越';
 if(!view.units.some(e=>e.side!==view.viewer&&key(e.hex)===key(target)))return '目标没有已识别敌军';
 return null;
}
export function decideAction(view,unit,own,order,profile){
 if(!['ATTACK','SUPPORT'].includes(order?.kind))return decide(view,unit,own,order,profile);
 if(order.paused)return {kind:'REST',reason:'直属命令暂停'};
 const reason=eligible(view,unit,own[unit.id],order.target);
 if(reason)return {kind:'REST',reason};
 const target=view.units.filter(e=>e.side!==view.viewer&&key(e.hex)===key(order.target)).sort((a,b)=>a.id.localeCompare(b.id))[0];
 return {kind:'FIGHT',target:target.id,action:order.kind,reason:order.kind==='SUPPORT'?'相邻支援：照常付出战斗消耗与承受反击；结束留在原位':'向指定相邻敌军攻击；目标清空后按行军规则推进'};
}
