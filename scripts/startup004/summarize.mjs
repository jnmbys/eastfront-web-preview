import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sha256,verify} from './integrity.mjs';
const root='evidence/startup-004',records=root+'/records';
const files=readdirSync(records).filter(n=>/^device-(default|serial)-.*\.json$/.test(n)&&!n.endsWith('.receipt.json')).sort();
const rows=files.map(name=>{
 const file=records+'/'+name,d=JSON.parse(readFileSync(file));
 const review=JSON.parse(execFileSync(process.execPath,['scripts/startup004/review-record.mjs',file],{encoding:'utf8'}));
 const resources=d.resources.filter(r=>r.path.includes('/assets/terrain/'));
 const kinds={};for(const e of d.events)kinds[e.kind]=(kinds[e.kind]??0)+1;
 return {...review,file,clientTimeOrigin:d.clientTimeOrigin,exportedAt:d.exportedAt,elapsedAtExportMs:Date.parse(d.exportedAt)-d.clientTimeOrigin-d.marks.startAt,
  eventKinds:kinds,terrainMilestones:d.events.filter(e=>e.kind==='terrain-complete').map(e=>({lod:e.lod,afterStartMs:e.at-d.marks.startAt})),visibilityEvents:d.events.filter(e=>e.kind==='visibility'),lastCompletedBuildTiming:d.buildTimings.at(-1),
  resourceTiming:{entries:resources.length,uniquePaths:new Set(resources.map(r=>r.path)).size,repeatedPathEntries:resources.length-new Set(resources.map(r=>r.path)).size,recoveryEntries:resources.filter(r=>r.recovery).length,zeroTransferEntries:resources.filter(r=>r.transferSize===0).length,sumDurationMs:resources.reduce((s,r)=>s+r.duration,0),reportedTransferBytes:resources.reduce((s,r)=>s+r.transferSize,0)},
  screenshotCount:d.screenshots.length};
});
const frozen=JSON.parse(readFileSync(root+'/harness-frozen.json'));
const result={task:'STARTUP-004',status:'INCOMPLETE_DEVICE_ACCEPTANCE',createdAt:new Date().toISOString(),candidate:verify(),harnessUnchanged:frozen.files.every(f=>sha256(readFileSync(f.path))===f.sha256),rows,
 deviceRuns:new Set(rows.map(r=>r.clientTimeOrigin)).size,deviceSerialRun:rows.some(r=>r.mode==='serial'),automaticRefreshOrRetry:false,
 remaining:['Close LOD had not completed in the final device export; cause not established.','At the recorded 1302 CSS-pixel viewport, maximum zoom cannot request close LOD; actual close appearance unobserved.','Serial device startup was not opened because default full acceptance remained incomplete.','No default-versus-serial speed comparison or stable speedup conclusion.'],
 limitations:['Resource Timing repeated paths include cache entries and multiple LOD work, not necessarily repeated network downloads.','Native diagnostic history is bounded to the last 12 image jobs; full decode CPU and browser memory/residency peaks are not measured.','Last export elapsed uses the device clock/timeOrigin; individual event milestones use monotonic performance time.','User checked close as visually normal initially, but there was no close mount; retained raw observations do not override this missing coverage.','Two hidden/visible intervals and PNG uploads during later LOD work are retained as actual conditions.','A background close build missing from diagnostics is not a proven crash, deadlock or concurrency root cause.']};
writeFileSync(root+'/summary.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});
const pngs=readdirSync(records).filter(n=>n.endsWith('.png')).map(name=>{const b=readFileSync(records+'/'+name);return{file:'records/'+name,bytes:b.length,sha256:sha256(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20)};});
writeFileSync(root+'/screenshots.json',JSON.stringify(pngs,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({status:result.status,deviceRuns:result.deviceRuns,serial:result.deviceSerialRun,rows:rows.map(r=>({file:r.file,outcome:r.outcome,reasons:r.reasons,elapsedAtExportMs:r.elapsedAtExportMs,terrainMilestones:r.terrainMilestones,resourceTiming:r.resourceTiming})),pngCount:pngs.length},null,2));
