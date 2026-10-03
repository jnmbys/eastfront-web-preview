import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root='evidence/mp-012/',hash=b=>createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(readFileSync(root+p));
const normal=read('local-browser-original.json'),delay=read('local-delay-original.json'),failure=read('synthetic-map404-original.json');
assert.deepEqual(normal.runs.map(r=>r.version),['candidate','control']);
assert.ok(normal.runs.every(r=>r.report.actions.length===1&&r.report.actions[0].completionCount===1&&r.report.actions[0].missing.length===0));
assert.equal(delay.runs.length,1);assert.equal(delay.runs[0].mode,'delay');
assert.ok(delay.runs[0].report.actions[0].intervals.sendToAck>=1800);
assert.deepEqual(failure.runs.map(r=>r.version),['candidate','control']);
assert.ok(failure.runs.every(r=>r.fixtureFault==='map404'&&r.report.actions.length===0&&r.report.events.some(e=>e.status===404)&&r.report.events.some(e=>e.kind==='caught-startup-error'&&e.frames.length>0)));
const summarize=r=>({version:r.version,sourceSha:r.sourceSha,diagnosticSha256:r.diagnosticSha256,mode:r.mode,fixtureFault:r.fixtureFault??'none (initial observer export)',stage:r.stage,
  buildMatches:r.sourceSha===r.startup?.build,serviceWorkerControlled:r.report.events.find(e=>e.kind==='build')?.serviceWorkerControlled??null,imageJobs:r.startup?.imageJobs,
  actions:r.report.actions,failures:r.report.events.filter(e=>e.kind.includes('failed')||e.kind.includes('error')||e.status>=400),dropped:r.report.dropped});
const finalHash=delay.runs[0].diagnosticSha256;
const files=['trace.mjs','entry.mjs','panel.mjs'];const hashes=Object.fromEntries(files.map(p=>[p,hash(readFileSync('scripts/mp012/'+p))]));
assert.equal(hash(JSON.stringify(hashes)),finalHash);assert.ok(failure.runs.every(r=>r.diagnosticSha256===finalHash));
const runtimeMatches=['client.js','networkSession.js','actionCompletion.js'].map(p=>({path:p,matches:hash(readFileSync('dist/app/multiplayer/'+p))===hash(readFileSync('.mp010-build/artifacts/candidate/app/multiplayer/'+p))}));
assert.ok(runtimeMatches.every(r=>r.matches),'Existing regression test dist must be the pinned candidate');
const all=[...normal.runs,...delay.runs,...failure.runs];
const encoded=JSON.stringify(all);assert.ok(!/"(?:reconnectToken|cookie|authorization|units|hexes|payload)"\s*:/i.test(encoded));
writeFileSync(root+'review.json',JSON.stringify({evidenceKinds:{realField:'Existing MP011 Huawei evidence retained; not rerun',local:normal.runs.map(summarize),syntheticDelay:delay.runs.map(summarize),syntheticResourceFailure:failure.runs.map(summarize)},finalDiagnosticSha256:finalHash,hashes,runtimeMatches,
  observerRevisions:'Initial local A/B capture predates batching, explicit fixture label and terrain-relative asset mapping. Kept unchanged. Final observer validated by delay and map404 runs.',
  limitations:['No Huawei error reproduced; cannot infer original 404, cache failure, network cause or device fault.','No historical receive/decode times can be recovered from old exports.','Loopback browser negotiated permessage-deflate; field rows reported none. Never compare as performance improvement.','Instrumentation adds work; no instrumentation-off paired benchmark.','Only frame opportunity observed, actual visible feedback remains missing.','No full suite; three historical freeze failures retained.']},null,2)+'\n');
const inventory=Object.fromEntries([...readdirSync('scripts/mp012').map(p=>'scripts/mp012/'+p),'tests/mp012-diagnostics.test.mjs',...readdirSync(root).filter(p=>p!=='checksums.json').map(p=>root+p)].map(p=>[p,hash(readFileSync(p))]));
writeFileSync(root+'checksums.json',JSON.stringify(inventory,null,2)+'\n');
console.log(JSON.stringify({replayPassed:true,localRuns:normal.runs.length,delayRuns:delay.runs.length,failureRuns:failure.runs.length,finalDiagnosticSha256:finalHash}));
