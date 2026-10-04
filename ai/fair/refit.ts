import {hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import type {DeepReadonly,FairInput,FairIntent} from './types.js';
type Input=DeepReadonly<FairInput>;
export interface RefitOption {intent:FairIntent;reason:string;damage:number;cost:number;}
/** Public-map estimate only. Unknown occupation never becomes known passability.
 * Linear traversal, at most one visit per public cell/edge. Core may reject it. */
export function estimatedRecoveryBases(input:Input):Set<string> {
 const r=input.rules.refit,side=input.view.viewer,bases=new Set<string>();if(!r)return bases;
 const board=new Map(input.view.hexes.map(h=>[hexKey(h.coord),h]));
 const blocked=new Set([...input.view.units.filter(u=>u.side!==side).map(u=>hexKey(u.hex)),...input.view.contacts.filter(c=>c.side!==side).map(c=>hexKey(c.hex))]);
 const sources=(side==='GERMAN'?r.germanWestEntries:[...r.sovietEastExits,...r.sovietSources]).map(hexKey);
 const adjacency=new Map<string,{other:string;edge:string}[]>();
 for(const e of input.view.edges){const rail=e.railway;if(!rail?.present||rail.destroyed||side==='GERMAN'&&rail.repairedBy!=='GERMAN'||hexDistance(e.a,e.b)!==1)continue;
  const a=hexKey(e.a),b=hexKey(e.b);if(!board.has(a)||!board.has(b))continue;
  for(const [from,to] of [[a,b],[b,a]] as [string,string][]){const list=adjacency.get(from)??[];list.push({other:to,edge:e.key});adjacency.set(from,list);}
 }
 const queue=[...new Set(sources)].filter(k=>board.has(k)&&!blocked.has(k)&&adjacency.has(k)),visited=new Set(queue),edges=new Set<string>(),degree=new Map<string,number>();
 for(let n=0;n<queue.length;n++)for(const link of adjacency.get(queue[n]!)??[]){if(blocked.has(link.other))continue;
  if(!edges.has(link.edge)){edges.add(link.edge);for(const k of [queue[n]!,link.other])degree.set(k,(degree.get(k)??0)+1);}
  if(!visited.has(link.other)){visited.add(link.other);queue.push(link.other);}
 }
 for(const k of degree.keys())if(['CITY','MAIN_CITY','OUTER_CITY'].includes(board.get(k)!.terrain))bases.add(k);
 if(side==='GERMAN'){const entries=new Set(sources);for(const [k,d] of degree)if(d===1&&!entries.has(k))bases.add(k);}
 else for(const h of r.sovietSources){const k=hexKey(h);if(board.has(k)&&!blocked.has(k))bases.add(k);}
 return bases;
}
/** Sorted, explainable maintenance proposals; no action or outcome oracle. */
export function refitOptions(input:Input):RefitOption[] {
 const {view,rules}=input,r=rules.refit,receipts=input.refit;
 if(!r||!receipts||receipts.rejected||view.pendingDecision||view.activeSide!==view.viewer||view.victory.winner)return [];
 const recovery=view.phase===view.viewer+'_RECOVERY',entrench=view.phase===view.viewer+'_ENTRENCHMENT';if(!recovery&&!entrench)return [];
 let limit=r.limits.GERMAN;
 if(view.viewer==='SOVIET'){const bands=[...r.limits.SOVIET].filter(b=>b.fromTurn<=view.turn).sort((a,b)=>b.fromTurn-a.fromTurn||b.maxUnits-a.maxUnits);limit=bands[0]?.maxUnits??0;}
 if(recovery&&receipts.recoveredUnitIds.length>=limit)return [];
 const bases=recovery?estimatedRecoveryBases(input):new Set<string>();
 const coords=view.hexes.filter(h=>bases.has(hexKey(h.coord))).map(h=>h.coord);
 const rp=view.resources[view.viewer]?.rp;
 const enemyHexes=[...view.units.filter(u=>u.side!==view.viewer).map(u=>u.hex),...view.contacts.filter(c=>c.side!==view.viewer).map(c=>c.hex)];
 const options:RefitOption[]=[];
 for(const u of view.units){
  if(!('friendly' in u)||u.friendly.controllerId!==input.scope.controllerId||!u.friendly.alive||u.friendly.hasMoved||u.friendly.dedicatedRailRepair)continue;
  const t=r.templates[u.friendly.templateId];if(!t)continue;
  if(entrench){if(t.canEntrench&&!u.entrenched&&!rules.objectives.some(h=>hexKey(h)===hexKey(u.hex)))options.push({intent:{type:'ENTRENCH',unitId:u.id},reason:'OWN_UNMOVED_ELIGIBLE_NOT_ENTRENCHED',damage:u.step,cost:0});continue;}
  if(u.step<=0||u.supplyState!=='SUPPLIED'||u.friendly.hasAttacked||u.friendly.artillerySupportUsed||receipts.recoveredUnitIds.includes(u.id)||rp===undefined||!Number.isFinite(t.cost)||t.cost<0||rp<t.cost)continue;
  if(enemyHexes.some(h=>hexDistance(h,u.hex)<=1)||!coords.some(h=>hexDistance(h,u.hex)<=r.maxDistance))continue;
  options.push({intent:{type:'REPAIR_UNIT',unitId:u.id},reason:'MOST_DAMAGE_THEN_LOWEST_RP_THEN_ID;VISIBLE_BASE_ESTIMATE',damage:u.step,cost:t.cost});
 }
 // Most current damage first, then cheapest one-step repair, then stable ID.
 return options.sort((a,b)=>(recovery?b.damage-a.damage||a.cost-b.cost:0)||('unitId' in a.intent&&'unitId' in b.intent?a.intent.unitId.localeCompare(b.intent.unitId):0)).slice(0,127);
}
