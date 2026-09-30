// Offline evaluation only. Authoritative state and event diagnostics never enter policies.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {initial} from '../../ai/lab/match.mjs';
import {hash} from '../../ai/lab/common.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
export function metrics(seed,rows,expected,eventFile){
 let state=initial(seed);const engine=new RulesEngine(defaultRules,defaultScenario),losses=[],advances=[],rejected=[],events=[],turnProgress=[];
 const sides=Object.fromEntries(['GERMAN','SOVIET'].map(s=>[s,{attacks:0,advances:0,passAdvances:0,lossSteps:0,destroyedUnits:0,rejections:0}]));
 const distance=h=>Math.min(...defaultScenario.capitalCoreHexes.map(g=>hexDistance(h,g)));
 const progress=()=>({germanControlledCapitalHexes:defaultScenario.capitalCoreHexes.filter(h=>state.hexes[hexKey(h)]?.control==='GERMAN').length,capitalHexes:defaultScenario.capitalCoreHexes.length,capitalControl:defaultScenario.capitalCoreHexes.map(h=>({hex:h,control:state.hexes[hexKey(h)]?.control??null})),nearestGermanToCapital:Math.min(...Object.values(state.units).filter(u=>u.alive&&u.side==='GERMAN').map(u=>distance(u.hex)))});
 for(const row of rows){
  if(row.choice?.kind!=='INTENT')continue;
  const before=state,a=row.choice.intent,r=engine.apply(state,toCoreAction(a,row.controllerId));
  if(['REJECTED','REJECTION_LIMIT'].includes(row.result.status)){assert(!r.accepted,'rejection '+row.n);sides[row.side].rejections++;rejected.push({n:row.n,turn:row.turn,side:row.side,intent:a,issues:r.issues});continue;}
  assert(r.accepted,'replay '+row.n);state=r.state;
  if(a.type==='ATTACK')sides[row.side].attacks++;
  if(a.type==='PASS_ADVANCE')sides[row.side].passAdvances++;
  for(const event of r.events){
   if(['UnitStepLost','UnitDestroyed'].includes(event.type)){
    const side=state.units[event.unitId].side;sides[side][event.type==='UnitStepLost'?'lossSteps':'destroyedUnits']++;
    losses.push({n:row.n,turn:before.turn,phase:before.phase,activeSide:before.activeSide,side,event});
   }
   if(event.type==='UnitAdvanced'){
    const side=state.units[event.unitId].side;sides[side].advances++;
    advances.push({n:row.n,turn:before.turn,phase:before.phase,side,unitId:event.unitId,from:event.from,to:event.to,distanceBefore:distance(event.from),distanceAfter:distance(event.to),nextEnemyTurn:before.turn+(side==='SOVIET'?1:0),enemySide:side==='GERMAN'?'SOVIET':'GERMAN',enemyWindowCompleted:false});
   }
  }
  for(const x of advances)if(state.phase!=='GAME_OVER'&&state.activeSide===x.side&&(state.turn>x.nextEnemyTurn||(x.side==='SOVIET'&&state.turn===x.nextEnemyTurn)))x.enemyWindowCompleted=true;
  events.push({n:row.n,turn:before.turn,phase:before.phase,activeSide:before.activeSide,events:r.events,random:state.random});
  if(before.turn!==state.turn||state.phase==='GAME_OVER')turnProgress.push({turn:before.turn,...progress()});
 }
 for(const x of advances){
  x.losses=losses.filter(y=>y.n>x.n&&y.turn===x.nextEnemyTurn&&y.activeSide===x.enemySide&&y.event.unitId===x.unitId);
  x.lossSteps=x.losses.filter(y=>y.event.type==='UnitStepLost').length;x.destroyedUnits=x.losses.filter(y=>y.event.type==='UnitDestroyed').length;
  x.censored=!x.enemyWindowCompleted;
 }
 assert.equal(hash(state),expected);writeFileSync(eventFile,events.map(x=>JSON.stringify(x)).join('\n')+'\n');
 return {finalHash:hash(state),sides,objectiveProgress:progress(),turnProgress,losses,advances,rejected,eventsHash:hash(events),initialHash:hash(initial(seed))};
}
