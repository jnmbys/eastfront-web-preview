import {getNeighbors,hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import type {DeepReadonly,FairInput,FairIntent} from './types.js';
type Input=DeepReadonly<FairInput>;
type Hex={readonly q:number;readonly r:number};
type Unit=Input['view']['units'][number];
export const ROUTE_UNIT_LIMIT=768,ROUTE_DECISION_LIMIT=32768,ROUTE_PATH_LIMIT=16;
const edgeKey=(a:Hex,b:Hex)=>[hexKey(a),hexKey(b)].sort().join('|');

/** Decision-local indexes and lazy per-unit reverse Dijkstra. No retained match state,
 * callbacks, authoritative validators or inferred hidden obstacles. A route is an estimate
 * across future turns: submit one budgeted path prefix per MOVE, then replan from the next view. */
export function createMoveScorer(input:Input){
  const {view,rules}=input;
  const board=new Map(view.hexes.map(h=>[hexKey(h.coord),h]));
  const edges=new Map(view.edges.map(e=>[edgeKey(e.a,e.b),e]));
  const own=view.units.filter(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId);
  const enemies=view.units.filter(u=>u.side!==view.viewer);
  const occupied=new Set([...enemies.map(u=>hexKey(u.hex)),...view.contacts.map(c=>hexKey(c.hex))]);
  const friendlyCounts=new Map<string,number>();
  for(const u of view.units.filter(u=>u.side===view.viewer))friendlyCounts.set(hexKey(u.hex),(friendlyCounts.get(hexKey(u.hex))??0)+1);
  const zoc=new Set<string>();
  for(const e of enemies){
    const templates=Object.values(rules.templates).filter(t=>t.side===e.side&&t.type===e.type);
    if(templates.length&&templates.every(t=>t.exertsZoc))for(const h of getNeighbors(e.hex))zoc.add(hexKey(h));
  }
  // Keep only bounded, own feedback since the last accepted phase end. An unrelated
  // unit move changes observationKey but must not retry this unit's rejected edge.
  // These are temporary failed intentions, NOT newly discovered enemy locations.
  let end=-1;for(let i=0;i<input.history.length;i++){const h=input.history[i]!;if(h.outcome==='ACCEPTED'&&h.intent?.type==='READY_FOR_PHASE_END')end=i;}
  const recent=input.history.slice(end+1);
  const rejectedMoves=recent.filter(h=>h.outcome==='REJECTED'&&h.intent?.type==='MOVE').map(h=>h.intent).filter((a):a is Extract<FairIntent,{type:'MOVE'}>=>a?.type==='MOVE');
  const failed=new Set(rejectedMoves.map(a=>JSON.stringify({...a,path:a.path.slice(0,1)})));
  // A rejected multi-step path reveals no blocker position. Conservatively rest this
  // unit while that own receipt remains in bounded phase-local history; never probe its prefixes.
  const failedUnits=new Set(rejectedMoves.filter(a=>a.path.length>1).map(a=>a.unitId));
  const metrics={expanded:0,searches:0,exhausted:false};
  type Plan={distance:Map<string,number>;safe:Set<string>};
  const plans=new Map<string,Plan>();
  const safeCell=(u:Unit,k:string):boolean=>{
    const cell=board.get(k);
    if(!cell||rules.terrainMovementCost[cell.terrain]==='IMPASSABLE'||occupied.has(k))return false;
    if((friendlyCounts.get(k)??0)-(k===hexKey(u.hex)?1:0)>=rules.stackingLimit)return false;
    const adjacent=enemies.filter(e=>hexDistance(cell.coord,e.hex)===1);
    const attack=u.supplyState==='OUT_OF_SUPPLY'?Math.ceil(u.stats.attack*rules.oosAttackMultiplier):u.stats.attack;
    return adjacent.reduce((n,e)=>n+e.stats.attack,0)<=Math.max(1,u.stats.defense)*2&&!adjacent.some(e=>e.stats.defense>attack*2);
  };
  // R1 public cost calculation, reused for every future one-step edge. Unknown ZOC
  // never cancels a possible road bonus; only the engine can adjudicate that uncertainty.
  const stepCost=(u:Unit,from:Hex,to:Hex):number=>{
    const cell=board.get(hexKey(to));if(!cell)return Infinity;
    const terrain=rules.terrainMovementCost[cell.terrain];if(terrain==='IMPASSABLE'||terrain===undefined)return Infinity;
    const edge=edges.get(edgeKey(from,to)),road=edge?.road===true;
    const bridge=road&&edge?.bridge&&!edge.bridge.destroyed&&['ROAD','BOTH'].includes(edge.bridge.kind);
    const terrainCost=road?rules.road.movementCost:u.type==='JAGER'&&['FOREST','HILL'].includes(cell.terrain)?Math.max(1,terrain-1):terrain;
    const step=terrainCost+(edge?.river&&!(bridge&&rules.road.bridgeCancelsRiverMovementSurcharge)?rules.riverMovementSurcharge[edge.river]??0:0);
    return step;
  };
  const cost=(u:Unit,from:Hex,to:Hex):number=>{
    // Newly movable adjacent units may leave known ZOC, but ordinary first hops
    // must not cross directly between two known enemy ZOC hexes. Conservative
    // for recon too: this planner does not spend its special ZOC exception.
    if(hexKey(from)===hexKey(u.hex)&&zoc.has(hexKey(from))&&zoc.has(hexKey(to)))return Infinity;
    const step=stepCost(u,from,to),road=edges.get(edgeKey(from,to))?.road===true;
    const knownZoc=zoc.has(hexKey(from))||zoc.has(hexKey(to));
    const bonus=road&&rules.road.wholeMoveBonusEnabled&&!knownZoc?rules.road.wholeMoveBonusMP:0;
    const mp=Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0)+bonus);
    return step<=mp?step:Infinity;
  };
  const plan=(u:Unit):Plan=>{
    const cached=plans.get(u.id);if(cached)return cached;
    const start=hexKey(u.hex),safe=new Set([...board.keys()].filter(k=>safeCell(u,k)));
    const distance=new Map<string,number>(),out={distance,safe};plans.set(u.id,out);metrics.searches++;
    if(u.stats.movement<=0)return out;
    // The current adjacent hex is not a destination for this MOVE. Keeping it
    // as a zero-distance goal would silently reinstate the old origin stop.
    const goals=enemies.length?[...safe].filter(k=>k!==start&&enemies.some(e=>hexDistance(board.get(k)!.coord,e.hex)===1)):rules.objectives.map(hexKey).filter(k=>safe.has(k));
    // Heap order includes a coordinate tie breaker, independent of insertion/container order.
    type Node={k:string;d:number};const heap:Node[]=[];
    const less=(a:Node,b:Node)=>a.d<b.d||a.d===b.d&&a.k<b.k;
    const push=(x:Node)=>{heap.push(x);let i=heap.length-1;while(i){const p=(i-1)>>1;if(!less(heap[i]!,heap[p]!))break;[heap[i],heap[p]]=[heap[p]!,heap[i]!];i=p;}};
    const pop=():Node=>{const first=heap[0]!,last=heap.pop()!;if(heap.length){heap[0]=last;let i=0;for(;;){let j=i;for(const c of [i*2+1,i*2+2])if(c<heap.length&&less(heap[c]!,heap[j]!))j=c;if(j===i)break;[heap[i],heap[j]]=[heap[j]!,heap[i]!];i=j;}}return first;};
    const best=new Map<string,number>();for(const k of new Set(goals)){best.set(k,0);push({k,d:0});}
    let expanded=0;
    while(heap.length){
      if(expanded>=ROUTE_UNIT_LIMIT||metrics.expanded>=ROUTE_DECISION_LIMIT){metrics.exhausted=true;break;}
      const n=pop();if(distance.has(n.k)||best.get(n.k)!==n.d)continue;
      distance.set(n.k,n.d);expanded++;metrics.expanded++;
      if(n.k===start)break; // every strictly lower-distance neighbor is now settled
      const to=board.get(n.k)!.coord;
      for(const from of getNeighbors(to)){
        const k=hexKey(from);if((k!==start&&!safe.has(k))||!board.has(k)||distance.has(k))continue;
        if(k===start&&failed.has(JSON.stringify({type:'MOVE',unitId:u.id,path:[to]})))continue;
        const step=cost(u,from,to);if(!Number.isFinite(step))continue;
        // Existing route potential preserves the first-hop preference. Positive weights give
        // a strictly descending potential: fixed goals/occupancy cannot produce A-B-A.
        const d=n.d+10+step;if(d<(best.get(k)??Infinity)){best.set(k,d);push({k,d});}
      }
    }
    return out;
  };
  const score=(a:FairIntent):number=>{
    if(a.type!=='MOVE'||a.path.length!==1||failed.has(JSON.stringify(a)))return -Infinity;
    const u=own.find(u=>u.id===a.unitId),to=a.path[0];
    if(!u||!to||!('friendly' in u)||u.friendly.hasMoved||u.friendly.dedicatedRailRepair||failedUnits.has(u.id)||hexDistance(u.hex,to)!==1)return -Infinity;
    // Origin adjacency may now seek another position; all destination risk,
    // observed occupancy, public cost and bounded prefix stops still apply.
    const step=cost(u,u.hex,to);if(!Number.isFinite(step))return -Infinity;
    const p=plan(u),before=p.distance.get(hexKey(u.hex)),after=p.distance.get(hexKey(to));
    if(!p.safe.has(hexKey(to))||before===undefined||after===undefined||after>=before)return -Infinity;
    const total=10+step+after;
    return 3+1/(1+total/10)-(total-before)/10;
  };
  const prefix=(a:FairIntent):FairIntent=>{
    if(a.type!=='MOVE'||!Number.isFinite(score(a)))return a;
    const u=own.find(u=>u.id===a.unitId)!,p=plan(u);
    const path:{q:number;r:number}[]=[];
    const base=Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0));
    let from=u.hex,next=a.path[0]!,spent=0,allRoad=true,clean=!zoc.has(hexKey(from));
    while(path.length<ROUTE_PATH_LIMIT){
      const k=hexKey(next),edge=edges.get(edgeKey(from,next));
      const nextRoad:boolean=allRoad&&edge?.road===true,nextClean:boolean=clean&&!zoc.has(k);
      const bonus=nextRoad&&nextClean&&rules.road.wholeMoveBonusEnabled?rules.road.wholeMoveBonusMP:0;
      const step=stepCost(u,from,next);
      // Safe cells also constrain intermediate stacking/contact/risk conservatively.
      // All-road bonus is conditional on the WHOLE submitted path, never paid per edge.
      if(!p.safe.has(k)||spent+step>base+bonus)break;
      path.push({q:next.q,r:next.r});spent+=step;allRoad=nextRoad;clean=nextClean;from=next;
      const d=p.distance.get(k)!;
      // Preserve the existing stop at identified adjacency, even for non-ZOC units.
      if(d===0||zoc.has(k)||enemies.some(e=>hexDistance(from,e.hex)<=1))break;
      const options=getNeighbors(from).filter(h=>p.safe.has(hexKey(h))&&(p.distance.get(hexKey(h))??Infinity)<d)
        .map(h=>({h,total:10+cost(u,from,h)+(p.distance.get(hexKey(h))??Infinity)}))
        .filter(x=>Number.isFinite(x.total)).sort((a,b)=>a.total-b.total||hexKey(a.h).localeCompare(hexKey(b.h)));
      if(!options.length)break;
      next=options[0]!.h;
    }
    return path.length?{...a,path}:a;
  };
  // Reuse the same observed destination risk/occupancy guard for optional advance.
  // This does not assert phase legality, remaining MP, or safety from unseen units.
  const safeDestination=(unitId:string,to:Hex):boolean=>{
    const u=own.find(u=>u.id===unitId);return !!u&&safeCell(u,hexKey(to));
  };
  return {score,prefix,metrics,safeDestination};
}
