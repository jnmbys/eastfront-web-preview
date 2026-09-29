// Preserve observed incomplete journals; recover only from a complete byte-equivalent
// JSON trace whose digest already equals the affected run's persisted traceHash.
import assert from 'node:assert/strict';
import {readFileSync,copyFileSync,writeFileSync,existsSync} from 'node:fs';
import {hash} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
const root='evidence/ai-lab-002',out=[];
for(const [seed,to,from] of [[17,'SOVIET','GERMAN'],[18,'GERMAN','SOVIET']]){
 const dir=`${root}/batch/tune-${seed}-${to}/attempt-1/`,source=`${root}/batch/tune-${seed}-${from}/attempt-1/trace.ndjson`;
 const record=JSON.parse(readFileSync(dir+'record.json')),full=records(source),target=dir+'trace.ndjson',raw=dir+'trace-incomplete.ndjson';
 assert.equal(hash(full),record.traceHash);assert.equal(full.length,record.decisions);
 if(!existsSync(raw))copyFileSync(target,raw);
 const prefix=records(raw);assert.deepEqual(prefix,full.slice(0,prefix.length));assert(prefix.length<full.length);
 copyFileSync(source,target);
 out.push({id:record.job.id,classification:'JOURNAL_INTEGRITY_RECOVERED',raw,source,target,originalLines:prefix.length,completeLines:full.length,expectedTraceHash:record.traceHash,observedPrefixHash:hash(prefix),cause:'unknown; detected after batch, no game error inferred'});
}
writeFileSync(root+'/journal-integrity.json',JSON.stringify(out,null,2)+'\n');console.log('Recovered 2 journals by pre-existing digest; originals preserved');
