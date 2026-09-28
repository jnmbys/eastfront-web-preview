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
      case 'ADVANCE_AFTER_COMBAT':return [{type:'PASS_ADVANCE',battleId}];
      case 'BREAKTHROUGH_OPTION':return [{type:'PASS_BREAKTHROUGH',battleId}];
      case 'SCHWERPUNKT_OPTION':return [{type:'PASS_SCHWERPUNKT',battleId}];
      case 'RETREAT':return []; // Explicitly unsupported, never invent a forced retreat.
      case 'LOSS_ALLOCATION':{
        const eligible=own.filter(u=>p.eligibleUnitIds.includes(u.id)).sort((a,b)=>a.id.localeCompare(b.id));
        const actions:FairIntent[]=[];
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
