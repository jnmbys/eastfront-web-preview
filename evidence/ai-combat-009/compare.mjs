// Paired analysis against archived AI-MOVE-006 games, with the same frozen AI005 opponent.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {replayMetrics} from './metrics.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-combat-009',comparisons=[],controls=[],corrections=[],openings=[];
for(const seed of [17,18])for(const seat of ['GERMAN','SOVIET']){
 const id=`tune-${seed}-${seat}`,oldDir=`evidence/ai-move-006/batch/${id}`,newDir=`${out}/batch/${id}`;
 assert(existsSync(newDir+'/record.json'),'Finish the authorized four games before comparing');
 const control=JSON.parse(readFileSync(oldDir+'/record.json')),candidate=JSON.parse(readFileSync(newDir+'/record.json'));
 for(const key of ['baselineRuntimeHash','rulesHash','scenarioHash','mapHash'])assert.equal(control.build[key],candidate.build[key]);
 for(const key of ['baseline','parameters','agentSeeds'])assert.deepEqual(control.config[key],candidate.config[key]);
 for(const [dir,r] of [[oldDir,control],[newDir,candidate]]){
  const raw=readFileSync(dir+'/trace.ndjson'),rows=raw.toString().trim().split('\n').map(JSON.parse);
  assert.equal(raw.length,r.traceBytes);assert.equal(rows.length,r.decisions);assert.equal(hash(rows),r.traceHash);assert.equal(r.integrity,'PASS');
 }
 const before=replayMetrics(seed,readFileSync(oldDir+'/trace.ndjson','utf8').trim().split('\n').map(JSON.parse),control.finalHash);
 assert.deepEqual(before.turnDistances,control.turnDistances);controls.push({id,...before});
 const after=candidate.replay;
 for(const side of ['GERMAN','SOVIET'])if(candidate.sides[side].rejections!==after.sides[side].rejections){
  corrections.push({id,side,oldRejections:candidate.sides[side].rejections,correctRejections:after.sides[side].rejections,reason:'Include final REJECTION_LIMIT adjudication; original trace and replay metrics already include it.'});
  candidate.sides[side].rejections=after.sides[side].rejections;
 }
 atomic(newDir+'/record.json',candidate);
 for(const side of ['GERMAN','SOVIET']){
  assert.equal(before.sides[side].attacks,control.sides[side].attacks);assert.equal(after.sides[side].attacks,candidate.sides[side].attacks);
  assert.equal(before.sides[side].movedHexes,control.sides[side].movedHexes);assert.equal(after.sides[side].movedHexes,candidate.sides[side].movedHexes);
  assert.equal(after.sides[side].rejections,candidate.sides[side].rejections);
 }
 // Evidence of an opened hex: enemy destroyed in a joint battle, then a later
 // accepted ordinary MOVE of that side enters the same target. No strategic causality claim.
 const rows=readFileSync(newDir+'/trace.ndjson','utf8').trim().split('\n').map(JSON.parse);
 if(candidate.status==='GAME_OVER')for(const a of after.attacks.filter(a=>a.intent.attackerUnitIds.length>1)){
  const next=rows[a.n+1]?.choice?.intent,battleId=next?.battleId;
  if(next?.type!=='PASS_REACTION'||!battleId)continue;
  const destroyed=after.losses.filter(l=>l.event.type==='UnitDestroyed'&&l.event.battleId===battleId&&l.side!==a.side);
  if(!destroyed.length)continue;
  const move=rows.find(r=>r.n>destroyed.at(-1).n&&r.side===a.side&&r.result.status==='ACCEPTED'&&r.choice?.intent?.type==='MOVE'&&r.choice.intent.path.some(h=>h.q===a.intent.target.q&&h.r===a.intent.target.r));
  if(move&&openings.length<3)openings.push({id,attack:a,battleId,destroyed,subsequentMove:{n:move.n,turn:move.turn,intent:move.choice.intent}});
 }
 const brief=r=>({status:r.status,winner:r.winner,turn:r.turn,nearestGermanCapital:r.objectiveProgress.nearestGermanToCapital,capitalHexesControlled:r.objectiveProgress.germanControlledCapitalHexes,elapsedMs:r.elapsedMs});
 comparisons.push({id,seed,candidateSide:seat,validOutcomeComparison:control.status==='GAME_OVER'&&candidate.status==='GAME_OVER',control:{...brief(control),sides:before.sides,turnDistances:before.turnDistances},candidate:{...brief(candidate),sides:after.sides,turnDistances:after.turnDistances},candidateRejections:after.rejected});
}
writeFileSync(`${out}/control-metrics.json`,JSON.stringify(controls,null,2)+'\n');
if(corrections.length)writeFileSync(`${out}/rejection-count-corrections.json`,JSON.stringify(corrections,null,2)+'\n');
writeFileSync(`${out}/opened-hex-examples.json`,JSON.stringify(openings,null,2)+'\n');
writeFileSync(`${out}/comparison.json`,JSON.stringify({control:'f4c9b9732f3725fb067d4b29a6cff12e66eb3e53',sourceParent:'3640246770921fb907eb68fd7e8a37f8f368af11',opponent:'695ca0524eb039808491b18c69cea1fb74da0cca',parameters:{attackRatio:1.5,penaltyWeight:0.75},newGames:4,comparisons},null,2)+'\n');
console.log(JSON.stringify(comparisons.map(({id,validOutcomeComparison,control,candidate})=>({id,validOutcomeComparison,control,candidate}))));
