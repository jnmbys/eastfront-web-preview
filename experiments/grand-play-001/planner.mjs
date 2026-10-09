// Pure policy: accepts only the player's authorized view, own capabilities and public rules.
// It cannot call the authoritative Campaign or Core legality engine.
import {getNeighbors,hexKey,hexDistance,canonicalEdgeKey} from '../../vendor/eastfront-digital-core/dist/index.js';
import {rules} from './rules.mjs';
export function travel(view,from,to,cap,index=null){
 const h=index?index.hexes.get(hexKey(to)):view.hexes.find(h=>hexKey(h.coord)===hexKey(to));if(!h||h.terrain==='LAKE')return Infinity;
 const e=index?index.edges.get(canonicalEdgeKey(from,to)):view.edges.find(e=>e.key===canonicalEdgeKey(from,to));if(e?.bridge?.destroyed||e?.river==='MAJOR'&&!e.bridge)return Infinity;
 const land={PLAIN:3,FOREST:5,HILL:5,MOUNTAIN:8,MARSH:7,CITY:4}[h.terrain]??4;
 return Math.max(2,Math.ceil(((e?.road?2:land)+(e?.river?3:0))/cap.mobility));
}
export function route(view,start,target,cap,radius=0,budget=rules.searchBudget,index=null){
 // Index this exact authorized view once per search, not once per expanded edge.
 // No path or occupancy is retained across state revisions.
 index??={hexes:new Map(view.hexes.map(h=>[hexKey(h.coord),h])),edges:new Map(view.edges.map(e=>[e.key,e]))};
 const hexes=index?.hexes??new Map(view.hexes.map(h=>[hexKey(h.coord),h])),enemy=new Set(view.units.filter(u=>u.side!==view.viewer).map(u=>hexKey(u.hex)));
 const occupied=new Map();for(const u of view.units.filter(u=>u.side===view.viewer&&u.friendly?.alive))occupied.set(hexKey(u.hex),(occupied.get(hexKey(u.hex))??0)+1);
 const open=[{h:start,g:0}],seen=new Map([[hexKey(start),{g:0,prev:null,h:start}]]);let expanded=0;
 while(open.length&&expanded<Math.min(rules.searchBudget,budget)){open.sort((a,b)=>a.g+hexDistance(a.h,target)*2-(b.g+hexDistance(b.h,target)*2)||hexKey(a.h).localeCompare(hexKey(b.h)));const n=open.shift();if(n.g!==seen.get(hexKey(n.h)).g)continue;expanded++;
  if(hexDistance(n.h,target)<=radius){const path=[];let p=seen.get(hexKey(n.h));while(p.prev){path.unshift(p.h);p=seen.get(p.prev);}return {path,expanded};}
  for(const h of getNeighbors(n.h)){const k=hexKey(h);if(!hexes.has(k)||(occupied.get(k)??0)>=rules.stack||enemy.has(k)&&k!==hexKey(target))continue;const g=n.g+travel(view,n.h,h,cap,index);if(!Number.isFinite(g)||g>=(seen.get(k)?.g??Infinity))continue;seen.set(k,{g,prev:hexKey(n.h),h});open.push({h,g});}
 }return {path:[],expanded,reason:open.length?'搜索预算到达，保留原位':'已知交通或友军满员占位阻挡通行'};
}
export function decide(view,unit,own,order,profile){
 if(!order||order.paused)return {kind:'REST',reason:'直属或命令暂停'};
 const enemies=view.units.filter(e=>e.side!==unit.side),adj=enemies.filter(e=>hexDistance(e.hex,unit.hex)<=1).sort((a,b)=>a.id.localeCompare(b.id));
 const cap=own[unit.id];if(order.kind!=='RETREAT'&&(cap.org<profile.stop||cap.stock<1))return {kind:'REST',reason:cap.stock<1?'补给不足，停止主动进攻':'组织度不足，轮换休整'};
 if(order.kind==='REFIT')return {kind:'REST',reason:'执行整补；等待人员和对应装备'};
 const friends=view.units.filter(u=>u.side===unit.side&&hexDistance(u.hex,unit.hex)<=2).length;
 if(adj.length&&order.kind!=='RETREAT'){
  const e=adj[0],ownFire=cap.fire*profile.assault*(order.risk==='HIGH'?1.3:order.risk==='LOW'?.75:1),enemy=(e.stats?.defense??5);
  if(order.kind==='HOLD'||ownFire*friends/profile.concentration>=enemy*.75)return {kind:'FIGHT',target:e.id,reason:'已识别相邻敌军；按现有火力与附近友军投入',fire:ownFire};
  return {kind:'REST',reason:'等待附近友军集中，当前局部火力不足'};
 }
 if(!order.target)return {kind:'REST',reason:'没有公开目标'};
 const radius=order.kind==='HOLD'||view.units.filter(u=>u.side===unit.side&&u.friendly?.alive&&hexKey(u.hex)===hexKey(order.target)).length>=rules.stack?1:0;const dist=hexDistance(unit.hex,order.target);if(dist<=radius)return {kind:'REST',reason:'已到任务区域，守备与补充'};
 const r=route(view,unit.hex,order.target,cap,radius);return r.path.length?{kind:'MARCH',to:r.path[0],duration:travel(view,unit.hex,r.path[0],cap),expanded:r.expanded,reason:order.kind==='RETREAT'?'向指定防线撤回':'按已知地形向命令目标推进'}:{kind:'REST',reason:r.reason,expanded:r.expanded};
}
