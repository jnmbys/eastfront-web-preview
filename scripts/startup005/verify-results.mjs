import {readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const root='evidence/startup-005',read=p=>JSON.parse(readFileSync(p));
const manifest=read(root+'/candidate-manifest.json');
const references={chromium:read('evidence/startup-003/chromium.json').reports.find(r=>r.label==='baseline'&&r.lifecycle).lifecycle.hashes.close,webkit:read('evidence/startup-003-r1/webkit-lifecycle.json').reports.find(r=>r.lifecycle).lifecycle.hashes.close};
const results=[];
for(const engine of ['chromium','webkit']){
 const baseline=read(`${root}/baseline-${engine}/result.json`),final=read(`${root}/final-${engine}/result.json`);
 assert(baseline.complete&&final.complete);
 const served=read(`${root}/final-${engine}/input-files.json`).files;
 assert.deepEqual([...served].sort((a,b)=>a.path.localeCompare(b.path)),[...manifest.files].sort((a,b)=>a.path.localeCompare(b.path)));
 for(const row of final.rows){
  const before=baseline.rows.find(r=>r.mode===row.mode),d=row.diagnostic.terrainBuild;
  assert.equal(row.diagnostic.build,manifest.sourceCommit);assert.equal(row.pixel.rgbaSha256,references[engine]);
  assert.equal(before.geometry.zoom,2.5);assert.equal(before.geometry.mountedLod,'medium');assert.equal(row.geometry.zoom,2.7);assert.equal(row.geometry.mountedLod,'close');
  assert.deepEqual(d.pipeline.ready,['far','medium','close']);assert.equal(d.active.length,0);assert.equal(d.pipeline.running,null);assert.equal(row.errors.length,0);
  assert(row.live.every(s=>s.active.length<=4&&s.recent.length<=12));
  const closeProgress=row.live.flatMap(s=>s.active.filter(w=>w.lod==='close'&&w.stage==='rasterizeVS2WorldSurface').map(w=>({sampledAt:s.sampledAt,steps:w.steps,lastAdvancedAt:w.lastAdvancedAt,state:w.state})));
  assert(closeProgress.length>1);assert(closeProgress.at(-1).steps>closeProgress[0].steps);
  results.push({engine,mode:row.mode,browserVersion:row.browserVersion,actualDevice:false,before:before.geometry,after:row.geometry,closeRgbaSha256:row.pixel.rgbaSha256,exactPriorClosePixels:true,imageJobs:row.diagnostic.imageJobs,closeBuild:d.pipeline.lods.close,closeProgress});
 }
 const lifecycle=read(`${root}/final-${engine}/lifecycle.json`);assert(lifecycle.browserClosed&&lifecycle.serverClosed);
}
const native=read(root+'/final-webkit-native.json');assert(native.complete&&native.rows.length===4);assert(native.rows.every(r=>r.hash===native.reference.hash));
const downloads=read(root+'/final-diagnostic/result.json');assert(downloads.pass&&downloads.freshAtEachClick&&downloads.downloadAndTextareaEqual);
for(let i=0;i<2;i++)assert.equal(read(`${root}/final-diagnostic/export-${i}.json`).build,manifest.sourceCommit);
const result={sourceCommit:manifest.sourceCommit,servedFilesMatchPackage:true,actualDevice:false,results,nativeWebKit:native,diagnosticDownloads:downloads};
writeFileSync(root+'/verified-results.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,sourceCommit:manifest.sourceCommit,exactClosePixelRows:results.length,nativeWebKitColdWarmRows:native.rows.length}));
