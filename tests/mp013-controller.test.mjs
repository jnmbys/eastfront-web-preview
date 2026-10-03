import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as api from '../scripts/mp013/web/export.mjs';
async function harness(){
  const nodes=Object.fromEntries(['game','device','start','export','version','status','fallback','result'].map(k=>['#'+k,{disabled:true,value:'',textContent:'',hidden:true}]));
  const posted=[],timers=[],downloads=[],listeners={};let createdBlob;
  nodes['#game'].contentWindow={postMessage:(data,origin)=>posted.push({data,origin})};nodes['#game'].src='about:blank';
  const config={origin:'https://owner.example',entryVersion:'control',versions:{control:'control-fixed'},diagnosticSha256:'diag-fixed',snapshotFormat:'v3',serverSha:'server-fixed'};
  const context={api,location:{origin:config.origin},performance:{now:()=>123},Date,Blob,URL:{createObjectURL:b=>{createdBlob=b;return 'blob:local';},revokeObjectURL:()=>{}},fetch:async()=>({ok:true,json:async()=>config}),setTimeout:(f,delay)=>timers.push({f,delay}),addEventListener:(type,f)=>listeners[type]=f,document:{querySelector:s=>nodes[s],createElement:()=>{const a={click:()=>downloads.push({download:a.download,href:a.href})};return a;}}};
  const source=readFileSync('scripts/mp013/web/controller.mjs','utf8').replace(/^import .*;\r?\n/,'const {diagnosticMatches,sampleOf,exportRecord}=api;\n');
  await runInNewContext('(async()=>{'+source+'})()',context);
  return {nodes,config,posted,timers,downloads,blob:()=>createdBlob,message:data=>listeners.message({origin:config.origin,source:nodes['#game'].contentWindow,data}),foreign:()=>listeners.message({origin:'https://foreign.example',source:nodes['#game'].contentWindow,data:{source:'MP010',type:'ready'}})};
}
test('MP013 single control startup, origin isolation, sticky failure, local export then stop',async()=>{
  const h=await harness(),n=h.nodes;n['#start'].onclick();assert.equal(n['#game'].src,'about:blank');
  n['#device'].value='Huawei / fixture';n['#start'].onclick();assert.match(n['#game'].src,/^\/v\/control\/move\/real\//);assert.equal(n['#start'].disabled,true);
  n['#game'].src='already-started';n['#start'].onclick();assert.equal(n['#game'].src,'already-started');
  const before=n['#status'].textContent;h.foreign();assert.equal(n['#status'].textContent,before);
  h.message({source:'MP012',version:'control',sourceSha:'control-fixed',diagnosticSha256:'diag-fixed',stage:'manifest/map',report:{actions:[],events:[{kind:'caught-startup-error',at:10}]}});
  h.message({source:'MP010',type:'ready'});assert.match(n['#status'].textContent,/异常/);
  n['#export'].onclick();assert.equal(h.posted.length,2);assert.ok(h.posted.every(p=>p.origin===h.config.origin));
  h.timers.find(t=>t.delay===500).f();const record=JSON.parse(await h.blob().text());
  assert.equal(record.diagnostic.stage,'manifest/map');assert.equal(record.sample,null);assert.equal(record.missing.interactive,true);assert.equal(n['#game'].src,'about:blank');assert.equal(h.downloads[0].download,'mp013-owner-diagnostics.json');assert.equal(n['#result'].hidden,false);
  h.message({source:'MP010',type:'ready'});assert.match(n['#status'].textContent,/已结束/);
});
test('MP013 successful move export retains original clock metrics; unresponsive startup stays missing',async()=>{
  for(const responds of [true,false]){
    const h=await harness(),n=h.nodes;n['#device'].value='Huawei / fixture';n['#start'].onclick();
    if(responds){h.message({source:'MP010',type:'waiting',remainingMs:5000});assert.match(n['#status'].textContent,/5 秒/);h.message({source:'MP010',type:'ready'});assert.match(n['#status'].textContent,/五秒前台等待已完成/);}
    n['#export'].onclick();
    if(responds){h.message({source:'MP010',type:'result',build:{sourceSha:'control-fixed'},result:{ackMs:100,authorizedAppliedMs:200,interactiveMs:400},finalState:{interactive:true}});h.message({source:'MP012',version:'control',sourceSha:'control-fixed',diagnosticSha256:'diag-fixed',stage:'map-loaded',report:{clock:'iframe performance.now',events:[],actions:[]}});}
    h.timers.find(t=>t.delay===500).f();const record=JSON.parse(await h.blob().text());assert.equal(record.missing.diagnostic,!responds);assert.equal(record.missing.actionMetrics,!responds);
    if(responds){assert.equal(record.sample.metrics.authorizedAppliedMs,200);assert.equal(record.parentAttempt.at,123);assert.equal(record.diagnostic.report.clock,'iframe performance.now');}else assert.equal(record.diagnostic,null);
  }
});
