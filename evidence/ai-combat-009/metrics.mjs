// Post-game evaluator only. Neither state, events nor error reasons enter policy input.
import assert from 'node:assert/strict';
import {initial} from '../../ai/lab/match.mjs';
import {hash} from '../../ai/lab/common.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
export function replayMetrics(seed,rows,expectedHash){
 let state=initial(seed);const engine=new RulesEngine(defaultRules,defaultScenario),rejected=[],attacks=[],losses=[];
 const sides=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{attacks:0,jointAttacks:0,lossSteps:0,destroyedUnits:0,movedHexes:0,rejections:0}]));
 let previousTurn=null;const turnDistances=[];
 const distance=()=>Math.min(...Object.values(state.units).filter(u=>u.alive&&u.side==='GERMAN').flatMap(u=>defaultScenario.capitalCoreHexes.map(h=>hexDistance(u.hex,h))));
 for(const row of rows){
  if(previousTurn!==null&&row.turn!==previousTurn)turnDistances.push({turn:previousTurn,nearest:distance()});
  previousTurn=row.turn;
  if(row.choice?.kind!=='INTENT')continue;
  const a=row.choice.intent,r=engine.apply(state,toCoreAction(a,row.controllerId));
  if(row.result.status==='REJECTED'||row.result.status==='REJECTION_LIMIT'){
   assert(!r.accepted,`Expected Core rejection n${row.n}`);sides[row.side].rejections++;rejected.push({n:row.n,turn:row.turn,side:row.side,intent:a,issues:r.issues});continue;
  }
  assert(r.accepted,`Replay rejected n${row.n}`);state=r.state;
  if(a.type==='MOVE')sides[row.side].movedHexes+=a.path.length;
  if(a.type==='ATTACK'){
   sides[row.side].attacks++;if(a.attackerUnitIds.length>1)sides[row.side].jointAttacks++;
   attacks.push({n:row.n,turn:row.turn,side:row.side,intent:a});
  }
  for(const event of r.events)if(event.type==='UnitStepLost'||event.type==='UnitDestroyed'){
   const side=state.units[event.unitId].side;sides[side][event.type==='UnitStepLost'?'lossSteps':'destroyedUnits']++;
   losses.push({n:row.n,turn:row.turn,side,event});
  }
 }
 turnDistances.push({turn:previousTurn,nearest:distance()});
 const finalHash=hash(state);assert.equal(finalHash,expectedHash);
 return {finalHash,sides,turnDistances,rejected,attacks,losses};
}
