import {getNeighbors,hexKey} from '../../vendor/eastfront-digital-core/dist/core/hex.js';
import type {DeepReadonly,FairInput,FairIntent} from './types.js';
export const CANDIDATE_LIMIT=128;
/** Proposals, NOT an oracle of legal actions. No engine, preview, GameState or callback. */
export function observationCandidates(input:DeepReadonly<FairInput>):FairIntent[] {
  const {view,deployment}=input,p=view.pendingDecision;
  if(view.phase==='GAME_OVER'||view.victory.winner)return [];
  const own=view.units.filter(u=>'friendly' in u&&u.friendly.controllerId===input.scope.controllerId);
  if(p){
    if(p.decisionOwnerControllerId!==input.scope.controllerId)return [];
    const battleId=p.battleId;
    switch(p.kind){
      case 'DEFENDER_REACTION':return [{type:'PASS_REACTION',battleId}];
      case 'ADVANCE_AFTER_COMBAT':return [{type:'PASS_ADVANCE',battleId},...p.eligibleUnitIds.filter(id=>own.some(u=>u.id===id)).map(unitId=>({type:'ADVANCE_AFTER_COMBAT' as const,battleId,unitId}))];
      case 'BREAKTHROUGH_OPTION':return [{type:'PASS_BREAKTHROUGH' as const,battleId},...own.filter(u=>p.eligibleUnitIds.includes(u.id)).flatMap(u=>getNeighbors(u.hex).filter(h=>view.hexes.some(b=>hexKey(b.coord)===hexKey(h)&&b.terrain!=='LAKE')).map(h=>({type:'BREAKTHROUGH' as const,battleId,unitId:u.id,path:[h]})))].slice(0,CANDIDATE_LIMIT);
      case 'SCHWERPUNKT_OPTION':return [{type:'PASS_SCHWERPUNKT' as const,battleId},...own.filter(u=>p.eligibleUnitIds.includes(u.id)).flatMap(u=>{
        const adjacent=new Set(getNeighbors(u.hex).map(hexKey));
        return view.units.filter(v=>v.side!==view.viewer&&adjacent.has(hexKey(v.hex))).map(v=>({type:'SCHWERPUNKT_ATTACK' as const,sourceBattleId:battleId,unitId:u.id,target:{...v.hex}}));
      })].slice(0,CANDIDATE_LIMIT);
      case 'RETREAT':return retreatCandidates(input);
      case 'LOSS_ALLOCATION':{
        const eligible=own.filter(u=>p.eligibleUnitIds.includes(u.id)).sort((a,b)=>a.id.localeCompare(b.id));
        const actions:FairIntent[]=[];
        // A simple balanced allocation also covers losses across several surviving units.
        const balanced:string[]=[];const capacity=eligible.map(u=>'friendly' in u?(input.rules.templates[u.friendly.templateId]?.maxDamageSteps??0)-u.step:0);
        for(let round=0;balanced.length<p.lossSteps&&capacity.some(n=>n>0);round++){
          const index=round%eligible.length;if(capacity[index]!>0){balanced.push(eligible[index]!.id);capacity[index]!--;}
        }
        if(balanced.length===p.lossSteps)actions.push({type:'ALLOCATE_LOSSES',battleId,unitIdsByStep:balanced});
        for(let start=0;start<eligible.length&&actions.length<CANDIDATE_LIMIT;start++){
          const ids:string[]=[];
          for(let i=0;i<eligible.length;i++){
            const u=eligible[(start+i)%eligible.length]!;
            if(!('friendly' in u))continue;
            const capacity=(input.rules.templates[u.friendly.templateId]?.maxDamageSteps??0)-u.step;
            for(let n=0;n<capacity&&ids.length<p.lossSteps;n++)ids.push(u.id);
          }
          if(ids.length===p.lossSteps)actions.push({type:'ALLOCATE_LOSSES',battleId,unitIdsByStep:ids});
        }
        return unique(actions);
      }
    }
  }
  if(view.activeSide!==view.viewer)return [];
  if(deployment){
    const placed=new Set(own.map(u=>u.id)),next=deployment.roster.find(u=>!placed.has(u.id));
    if(!next)return [{type:'READY_FOR_PHASE_END'}];
    // Occupancy is known OWN occupancy only; never consult the opposing deployment.
    return deployment.zone.filter(h=>own.filter(u=>hexKey(u.hex)===hexKey(h)).length<input.rules.stackingLimit)
      .slice(0,CANDIDATE_LIMIT).map(h=>({type:'DEPLOY_INITIAL_UNIT',deploymentUnitId:next.id,hex:{q:h.q,r:h.r}}));
  }
  if(view.phase==='SOVIET_REINFORCEMENT_SUPPLY'&&input.reinforcements){
    const id=input.reinforcements.availableIds[0];
    const entries=input.reinforcements.entries.filter(h=>own.filter(u=>hexKey(u.hex)===hexKey(h)).length<input.rules.stackingLimit);
    return [...(id?entries.slice(0,CANDIDATE_LIMIT-1).map(h=>({type:'DEPLOY_REINFORCEMENT' as const,reinforcementId:id,entryHex:{q:h.q,r:h.r}})):[]),{type:'READY_FOR_PHASE_END'}];
  }
  const actions:FairIntent[]=[{type:'READY_FOR_PHASE_END'}],board=new Set(view.hexes.map(h=>hexKey(h.coord)));
  if(view.phase.endsWith('_MOVEMENT'))for(const u of own){
    if(!('friendly' in u)||u.friendly.hasMoved)continue;
    for(const h of getNeighbors(u.hex))if(board.has(hexKey(h)))actions.push({type:'MOVE',unitId:u.id,path:[h]});
  }
  if(view.phase.endsWith('_COMBAT'))for(const u of own){
    if(!('friendly' in u)||u.friendly.hasAttacked||u.stats.attack<=0)continue;
    const adjacent=new Set(getNeighbors(u.hex).map(hexKey));
    for(const target of view.units.filter(v=>v.side!==view.viewer&&adjacent.has(hexKey(v.hex))))
      actions.push({type:'ATTACK',attackerUnitIds:[u.id],target:{q:target.hex.q,r:target.hex.r}});
  }
  return unique(actions).slice(0,CANDIDATE_LIMIT);
}
function unique(actions:FairIntent[]):FairIntent[]{return [...new Map(actions.map(a=>[JSON.stringify(a),a])).values()];}

/** Bounded observation search, not authoritative retreat legality. Hidden blockers can reject it.
 * Keep shorter and empty proposals: only the engine may decide that retreat is impossible.
 * Ordered positions use own proposed moves; CONTACT/Last Known never become invented units. */
function retreatCandidates(input:DeepReadonly<FairInput>):FairIntent[]{
  const p=input.view.pendingDecision;if(p?.kind!=='RETREAT'||p.retreatSteps>2)return [];
  const units=input.view.units,own=units.filter(u=>u.side===input.scope.side);
  if(p.unitIds.some(id=>!own.some(u=>u.id===id&&'friendly' in u&&u.friendly.controllerId===input.scope.controllerId)))return [];
  const board=new Map(input.view.hexes.map(h=>[hexKey(h.coord),h]));
  const enemies=units.filter(u=>u.side!==input.scope.side);
  const occupied=new Set(enemies.map(u=>hexKey(u.hex))),zoc=new Set<string>();
  for(const u of enemies){
    const templates=Object.values(input.rules.templates).filter(t=>t.side===u.side&&t.type===u.type);
    if(templates.length&&templates.every(t=>t.exertsZoc))for(const h of getNeighbors(u.hex))zoc.add(hexKey(h));
  }
  type H={q:number;r:number};type R={unitId:string;path:H[]};
  const groups:FairIntent[][]=[];let budget=4096;
  // Reserve search capacity for shorter/empty families, rather than spending all retries
  // on full-length routes blocked by the same unseen ZOC. These remain unvalidated intents.
  for(let ceiling=p.retreatSteps;ceiling>=0;ceiling--){
    const out:FairIntent[]=[];const limit=Math.floor(CANDIDATE_LIMIT/(p.retreatSteps+1));
    const assign=(ids:readonly string[],done:R[],positions:Map<string,H>):void=>{
      if(--budget<0||out.length>=limit)return;
      if(!ids.length){out.push({type:'RETREAT',battleId:p.battleId,retreats:done});return;}
      const id=ids[0]!,start=positions.get(id)!;const paths:H[][]=[];
      const walk=(from:H,path:H[]):void=>{
        if(path.length<ceiling)for(const h of getNeighbors(from)){
          const k=hexKey(h),b=board.get(k);
          if(!b||b.terrain==='LAKE'||occupied.has(k)||zoc.has(k))continue;
          if([...positions].filter(([other,pos])=>other!==id&&hexKey(pos)===k).length>=input.rules.stackingLimit)continue;
          walk(h,[...path,h]);
        }
        paths.push(path);
      };
      walk(start,[]);paths.sort((a,b)=>b.length-a.length);
      for(const path of paths){const next=new Map(positions);next.set(id,path.at(-1)??start);assign(ids.slice(1),[...done,{unitId:id,path}],next);if(out.length>=limit||budget<0)break;}
    };
    assign([...p.unitIds].sort(),[],new Map(own.map(u=>[u.id,{...u.hex}])));
    groups.push(out);
  }
  const proposals:FairIntent[]=[];
  for(let i=0;i<CANDIDATE_LIMIT;i++)for(const group of groups)if(group[i])proposals.push(group[i]!);
  // Always reserve the explicit no-route proposal, even if the search budget was exhausted.
  const empty:FairIntent={type:'RETREAT',battleId:p.battleId,retreats:[...p.unitIds].sort().map(unitId=>({unitId,path:[]}))};
  proposals.splice(Math.min(2,proposals.length),0,empty);
  return unique(proposals).slice(0,CANDIDATE_LIMIT);
}
