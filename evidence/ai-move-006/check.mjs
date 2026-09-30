// Post-game integrity and rejection diagnosis. No policy inputs or new decisions.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {initial} from '../../ai/lab/match.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {hash} from '../../ai/lab/common.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
const out='evidence/ai-move-006/batch',report=[];
for(const seed of [17,18])for(const seat of ['GERMAN','SOVIET']){
 const dir=`${out}/tune-${seed}-${seat}`,r=JSON.parse(readFileSync(dir+'/record.json')),rows=records(dir+'/trace.ndjson');
 assert.equal(hash(rows),r.traceHash);assert.equal(rows.length,r.decisions);assert.equal(readFileSync(dir+'/trace.ndjson').length,r.traceBytes);
 let state=initial(seed);const engine=new RulesEngine(defaultRules,defaultScenario),rejected=[];
 for(const row of rows){
  if(row.choice?.kind!=='INTENT')continue;
  const applied=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));
  if(row.result.status==='REJECTED'){
   assert(!applied.accepted,'Host admission rejected an actually accepted Core move: investigate');
   rejected.push({n:row.n,turn:row.turn,side:row.side,intent:row.choice.intent,issues:applied.issues});
  }else{assert(applied.accepted);state=applied.state;}
 }
 assert.equal(hash(state),r.finalHash);
 report.push({id:r.job.id,integrity:'PASS',decisions:rows.length,traceHash:r.traceHash,finalHash:r.finalHash,rejected});
}
writeFileSync(out+'/integrity.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
