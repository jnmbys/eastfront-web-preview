import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex');
const input='evidence/startup-004',out=process.argv[2]??'evidence/startup-005';mkdirSync(out,{recursive:true});
const manifest=JSON.parse(readFileSync('evidence/startup-003-r1/candidate-manifest.json'));
const zip='../startup-003-r1/.startup003/r1/startup-003-r1-candidate-b9927e072d30fac8b732b815c0d817ce490d7d6e.zip';
assert.equal(sha(readFileSync(zip)),manifest.zipSha256);
const root='../startup-004-device-acceptance/.startup004/candidate';
for(const f of manifest.files){const b=readFileSync(root+'/'+f.path);assert.equal(b.length,f.bytes);assert.equal(sha(b),f.sha256);}
assert.equal(execFileSync('git',['diff','--name-only','b9927e072d30fac8b732b815c0d817ce490d7d6e','07187cf9e1214aa8507c3c2b4da9ca1444992f0e','--','src','public'],{encoding:'utf8'}).trim(),'');
const files=['device-default-1791048958396-6ce97a37','device-default-1791049149631-0154bc3c','device-default-1791049432132-10107739'];
const reports=files.map(id=>{const b=readFileSync(input+'/records/'+id+'.json'),d=JSON.parse(b),receipt=JSON.parse(readFileSync(input+'/records/'+id+'.receipt.json'));
 assert.equal(sha(b),receipt.sha256);assert.equal(b.length,receipt.bytes);
 for(const s of d.screenshots){const p=readFileSync(input+'/records/'+s.id);assert.equal(sha(p),s.sha256);assert.equal(p.length,s.bytes);}
 return {id,sha256:sha(b),bytes:b.length,mode:d.mode,source:d.sourceCommit,viewport:d.viewport,current:d.current,progress:d.progress,imageJobs:d.diagnostics.imageJobs,
  start:d.marks.startAt,exportElapsedMs:Date.parse(d.exportedAt)-d.clientTimeOrigin-d.marks.startAt,
  events:d.events.filter(e=>['terrain-complete','lod-mounted','visibility','progress-stage'].includes(e.kind)),buildTimings:d.buildTimings,
  gestureEvidence:{trustedInputs:d.events.filter(e=>e.kind==='map-input'&&e.trusted).length,zoomRange:[Math.min(...d.events.filter(e=>e.kind==='map-transform').map(e=>+e.zoom)),Math.max(...d.events.filter(e=>e.kind==='map-transform').map(e=>+e.zoom))]},
  lastLoadAssets:d.diagnostics.recent.map(r=>({asset:r.asset,outcome:r.outcome,attempts:r.attempts})),screenshots:d.screenshots};});
const result={source:'b9927e072d30fac8b732b815c0d817ce490d7d6e',evidenceHead:'07187cf9e1214aa8507c3c2b4da9ca1444992f0e',zip,zipSha256:manifest.zipSha256,filesVerified:manifest.files.length,sourceMatches004:true,reports};
writeFileSync(out+'/input-audit.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({source:result.source,filesVerified:result.filesVerified,zipSha256:result.zipSha256,reports:reports.map(r=>({id:r.id,sha256:r.sha256,progress:r.progress,buildStages:r.buildTimings.map(t=>t.stage),gestureEvidence:r.gestureEvidence}))},null,2));
