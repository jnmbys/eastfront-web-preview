import {hexKey as key,canonicalEdgeKey as edgeKey,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
import {cfg} from './config.mjs';
// Read-only bounded search of current authorized cells/edges; no authoritative probes.
export function preview(view,e,side,op,version){
 const cells=new Map(view.hexes.map(h=>[key(h.coord),h])),edges=new Map(view.edges.map(x=>[x.key,x])),blocked=new Set(view.units.filter(u=>u.side!==side).map(u=>key(u.hex))),own=k=>cells.get(k)?.control===side&&!blocked.has(k)&&!['LAKE','MOUNTAIN'].includes(cells.get(k)?.terrain),out={version,kind:op.kind,start:op.start,end:op.end,valid:false,path:[],segments:[],cost:0,expanded:0,reason:''};
 const stop=s=>({...out,reason:s});
 if(!['NEW_RAIL','NEW_HUB'].includes(op.kind))return stop('请选择新铁路或新枢纽');
 if(!own(op.end))return stop('终点必须是当前受控、无已知敌军的非湖泊／山地格');
 if(op.kind==='NEW_HUB'){
  if(Object.values(e.hubs).some(h=>h.hex===op.end)||e.queue.some(q=>q.side===side&&q.hex===op.end&&q.kind==='NEW_HUB'&&q.status!=='DONE'))return stop('此格已有枢纽或在建枢纽');
  if(!['PLAIN','CITY','FOREST'].includes(cells.get(op.end).terrain))return stop('枢纽只可建在平原、城市或森林');
  if(![...edges.values()].some(x=>[key(x.a),key(x.b)].includes(op.end)&&(x.road||e.rails[x.key])))return stop('选址须邻接现有道路或铁路；建成不保证接通后方');
  return {...out,valid:true,path:[op.end],cost:cfg.construction.NEW_HUB,reason:'可施工；孤立时没有后方供给'};
 }
 if(!own(op.start))return stop('起点不符合当前控制与地形条件');
 if(op.start===op.end)return stop('起终点不能相同');
 if(!Object.values(e.rails).some(r=>{const x=edges.get(r.id);return x&&[key(x.a),key(x.b)].includes(op.start);}))return stop('起点须接入现有铁路格');
 const queue=[{at:op.start,path:[op.start],segments:[],cost:0}],best=new Map();
 while(queue.length&&out.expanded<cfg.planBudget){queue.sort((a,b)=>a.cost-b.cost||a.path.length-b.path.length||a.at.localeCompare(b.at));const x=queue.shift();if(best.has(x.at))continue;best.set(x.at,x.cost);out.expanded++;
  if(x.at===op.end){if(!x.segments.length)return stop('已有铁路连接，无需重复新建');return {...out,...x,valid:true,reason:'预览为民用工时；排队、损坏与失守会延长实际完成时间'};}
  if(x.path.length>cfg.maxRailLength)continue;
  for(const n of getNeighbors(cells.get(x.at).coord)){const k=key(n),id=edgeKey(cells.get(x.at).coord,n),ed=edges.get(id)??{a:cells.get(x.at).coord,b:n};if(!own(k)||best.has(k)||ed.bridge?.destroyed||ed.river&&ed.river!=='NONE'&&!ed.bridge)continue;
   const existing=e.rails[id];if(e.queue.some(q=>q.side===side&&q.status!=='DONE'&&q.segments?.some(s=>s.id===id)))continue;
   const cost=existing?0:cfg.construction.NEW_RAIL*(['FOREST','MARSH'].includes(cells.get(k).terrain)?2:1)+(ed.bridge?4:0);
   queue.push({at:k,path:[...x.path,k],segments:existing?x.segments:[...x.segments,{id,a:x.at,b:k,cost}],cost:x.cost+cost});
  }
 }
 return stop(out.expanded>=cfg.planBudget?'有界规划预算已用尽，缩短起终点距离':'本次有界规划未找到路线：控制、地形、过河、在建重叠或24格上限受限');
}
export function fairUnits(units,priority,epoch){const sorted=[...units].sort((a,b)=>priority(a)-priority(b)||a.id.localeCompare(b.id)),groups=new Map();for(const u of sorted){const p=priority(u);if(!groups.has(p))groups.set(p,[]);groups.get(p).push(u);}return [...groups.values()].flatMap(a=>{const k=epoch%a.length;return [...a.slice(k),...a.slice(0,k)];});}
