// Same two saved fair inputs only. Diagnostic restoration of PZ-04 proposals,
// not a strategy patch and not an Action submission/new match.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
const dir='.ai-dist/ai/fair/',out='evidence/ai-move-007';
let source=readFileSync(dir+'move007-candidates.js','utf8');
const marker='const base = unique(actions).slice(0, CANDIDATE_LIMIT);';assert(source.includes(marker));
source=source.replace(marker,"const base = unique(actions).slice(0, CANDIDATE_LIMIT); for(const a of actions)if(a.unitId==='G-PZ-04'&&!base.some(b=>JSON.stringify(a)===JSON.stringify(b)))base.push(a);");
writeFileSync(dir+'move007-restored-candidates.js',source);
writeFileSync(dir+'move007-restored-agent.js',readFileSync(dir+'move007-basicAgent.js','utf8').replace("from './move007-candidates.js'","from './move007-restored-candidates.js'"));
const {basicAgent:restored}=await import('../../.ai-dist/ai/fair/move007-restored-agent.js');
const {diagnostics}=await import('../../.ai-dist/ai/fair/move007-routing.js');
const reports=[];
for(const seed of [17,18]){
 const input=JSON.parse(gunzipSync(readFileSync(`${out}/seed-${seed}-input.json.gz`)));
 const before=JSON.parse(readFileSync(`${out}/seed-${seed}-before.json`));
 const untouched=structuredClone(input);diagnostics.scoreCalls=[];diagnostics.candidates=null;
 const choice=restored(input);assert.deepEqual(input,untouched);assert.deepEqual(choice,before.recordedChoice);
 const restoredBranches=diagnostics.scoreCalls.filter(x=>x.intent.unitId==='G-PZ-04');
 assert.equal(restoredBranches.length,6);assert(restoredBranches.every(x=>x.reason==='identified-enemy-adjacency'));
 reports.push({seed,n:before.n,kind:'diagnostic-only counterfactual; not original branch trace',restoredUnit:'G-PZ-04',restoredCandidates:6,restoredBranches,choice,choiceUnchanged:true,inputUnchanged:true});
}
writeFileSync(`${out}/capped-front-check.json`,JSON.stringify(reports,null,2)+'\n');
console.log('Both saved decisions: six restored PZ-04 candidates all hit adjacency stop; selected Action unchanged; no Actions submitted.');
