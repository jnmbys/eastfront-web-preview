import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {svgDom} from '../../tests/helpers/performance-dom.mjs';
import '../../tests/helpers/deployment-dom.mjs';
import {perf006} from '../../.ai003-dist/src/local-ai/performance.js';
import {LocalAiClient} from '../../.ai003-dist/src/local-ai/client.js';
const evidence='evidence/ai-perf-006';mkdirSync(evidence,{recursive:true});
const baseline=process.env.PERF006_BASELINE??'/tmp/ai-perf006-baseline-dist';
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
function statusHarness(dir){
 const source=readFileSync(dir+'/src/main.js','utf8');
 const root=svgDom('<section id="local-ai-status"></section><p id="network-match-status"></p>'),document=root.ownerDocument;
 document.querySelector=q=>root.querySelector(q);document.querySelectorAll=q=>root.querySelectorAll(q);
 let exits=0;
 const client={meta:{humanSide:'GERMAN',ownerSide:'SOVIET',paused:false,manual:false,reason:null,accepted:0,rejected:0},state:{}};
 const ctx=vm.createContext({document,root,localAi:client,appStatus:'PLAYING',esc:s=>s,perf006,leaveLocalAi:()=>exits++});
 vm.runInContext(source.slice(source.indexOf('function updateLocalAiStatus('),source.indexOf('function updateTerrainDetailStatus(')),ctx);
 return {ctx,root,document,client,get exits(){return exits;},update:()=>ctx.updateLocalAiStatus()};
}
test('PERF006 same 33 accepted states, three status notifications each: controls retain identity and latest metadata',()=>{
 const rows=[];
 for(const [label,dir] of [['before',baseline],['after','.ai003-dist']]){
  const h=statusHarness(dir);h.update();const exit=h.document.querySelector('#ai-exit'),created=h.document.created,start=performance.now();
  for(let i=1;i<=33;i++){h.client.meta.accepted=i;for(let j=0;j<3;j++)h.update();}
  const same=exit===h.document.querySelector('#ai-exit');
  rows.push({label,accepted:33,notifications:99,createdNodes:h.document.created-created,elapsedSoftwareMs:performance.now()-start,exitIdentityRetained:same});
  assert.equal(same,label==='after');assert(h.document.querySelector('#local-ai-status').textContent.includes('接受 33 / 拒绝 0'));
  if(label==='after'){
   exit.fire('click');assert.equal(h.exits,1);assert.equal(exit._listeners.click.length,1);
   h.client.meta={...h.client.meta,paused:true,reason:'AGENT_STOP:NO_CANDIDATE'};h.update();assert.equal(h.document.querySelector('#ai-takeover').hidden,false);
   h.client.meta={...h.client.meta,paused:false,manual:true,humanSide:'SOVIET',ownerSide:'GERMAN'};h.update();assert(h.document.querySelector('#ai-status-text').textContent.includes('人工接管模式'));assert(h.document.querySelector('#ai-takeover').textContent.includes('德军'));
  }
 }
 writeFileSync(evidence+'/status-before-after.json',JSON.stringify({environment:'Node counted software DOM; NOT browser layout/input latency',rows},null,2));
});
async function workerRun(entry,diagnostics,stopAt=33){
 const worker=new Worker(new URL('../local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL(entry,import.meta.url).href}});
 const frames=[],metrics=[];
 try{return await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{reject(Error('worker deadline'));},20000);worker.on('error',e=>{clearTimeout(timer);reject(e);});
  worker.on('message',m=>{
   const p=m.message?.payload;
   if(p?.view)frames.push({meta:m.meta,view:p.view,model:p.model,revision:p.matchRevision});
   if(m.perf)metrics.push({...m.perf,workerToNodeMs:performance.timeOrigin+performance.now()-m.perf.sentAt});
   if(m.meta.accepted===stopAt){clearTimeout(timer);resolve({frames,metrics});}
  });
  worker.postMessage({kind:'START',epoch:17,options:{humanSide:'GERMAN',scenario:'campaign',seed:17,map,performance:diagnostics}});
 });}finally{await worker.terminate();}
}
test('PERF006 actual module Workers preserve seeded snapshot sequence with diagnostics off/on',async()=>{
 const runs=[];
 for(const [label,entry,enabled] of [['before','file://'+baseline+'/ai/local/worker.js',false],['after-off','../../.ai003-dist/ai/local/worker.js',false],['after-on','../../.ai003-dist/ai/local/worker.js',true]]){
  const r=await workerRun(entry,enabled);const hash=createHash('sha256').update(JSON.stringify(r.frames,(key,value)=>key==='matchId'?'RUN_ID':value)).digest('hex');runs.push({label,hash,frames:r.frames.length,metrics:r.metrics});
 }
 assert.equal(runs[0].hash,runs[1].hash);assert.equal(runs[0].hash,runs[2].hash);assert.equal(runs[2].frames,34);
 writeFileSync(evidence+'/worker-replay.json',JSON.stringify(runs,null,2));
});
test('PERF006 disposed client rejects queued reply and new client has independent state',async()=>{
 const options={humanSide:'GERMAN',scenario:'campaign',seed:17,map};
 const make=()=>({onmessage:null,onerror:null,postMessage(){},terminate(){this.terminated=true;}});
 const oldPort=make(),old=new LocalAiClient(oldPort,options,()=>{throw Error('late update');});
 const ready=old.start(options).catch(e=>e.message),late=oldPort.onmessage;old.dispose();assert.equal(await ready,'CANCELLED');
 const nextPort=make(),next=new LocalAiClient(nextPort,options,()=>{});const boot=next.start(options).catch(e=>e.message);
 late({data:{epoch:1,message:null,meta:{accepted:999}}});assert.equal(old.state.snapshot,null);assert.equal(next.meta.accepted,0);assert.equal(next.state.snapshot,null);next.dispose();await boot;
 assert(oldPort.terminated&&nextPort.terminated);
});
test('PERF006 diagnostics bounded, opt-in, scalar, stopped spans cannot enter restarted report',()=>{
 perf006.start(false);perf006.measure('disabled',()=>1);assert.deepEqual(perf006.report().stages,{});
 perf006.start(true);for(let i=0;i<200;i++)perf006.record('test',i);assert.equal(perf006.report().stages.test.samples.length,128);perf006.stop();perf006.record('late',9);assert(!perf006.report().stages.late);
 perf006.start(true);assert.deepEqual(perf006.report().stages,{});perf006.stop();
});
test('PERF006 input probes separate dispatch queue from RAF and invalidate old-game callbacks',()=>{
 const listeners={},frames=[],observers=[];let now=100;
 const source=readFileSync('.ai003-dist/src/local-ai/performance.js','utf8').replace('export const perf006','const perf006');
 class Element {closest(){return {id:'zoom-in'};}}
 class Observer {static supportedEntryTypes=['longtask'];constructor(f){observers.push(f);}observe(){}}
 const ctx=vm.createContext({performance:{now:()=>now},document:{visibilityState:'visible',addEventListener:(type,f)=>listeners[type]=f},Element,PerformanceObserver:Observer,requestAnimationFrame:f=>frames.push(f),structuredClone});
 vm.runInContext(source+'\nthis.probe=perf006;',ctx);const p=ctx.probe;p.start(true);
 listeners.click({target:new Element(),timeStamp:80});now=116;frames.shift()();
 assert.equal(p.report().stages.zoomEventQueue.lastMs,20);assert.equal(p.report().stages.zoomCallbackToRAF.lastMs,16);
 listeners.click({target:new Element(),timeStamp:115});p.stop();now=200;p.start(true);frames.shift()();
 observers[0]({getEntries:()=>[{startTime:100,duration:60}]});assert.equal(Object.keys(p.report().stages).length,0);
 observers[0]({getEntries:()=>[{startTime:201,duration:55}]});assert.equal(p.report().stages.mainLongTask.maxMs,55);
});
test('PERF006 terminate during real Worker deployment cancels remaining scheduled actions',async()=>{
 const worker=new Worker(new URL('../local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL('../../.ai003-dist/ai/local/worker.js',import.meta.url).href}});
 const accepted=[];let terminateCount;
 try{await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>reject(Error('cancel deadline')),10000);worker.on('error',reject);
  worker.on('message',m=>{accepted.push(m.meta.accepted);if(m.meta.accepted===3){terminateCount=accepted.length;worker.terminate().then(()=>{clearTimeout(deadline);resolve();},reject);}});
  worker.postMessage({kind:'START',epoch:77,options:{humanSide:'GERMAN',scenario:'campaign',seed:17,map}});
 });assert.equal(accepted.length,terminateCount);assert.equal(accepted.at(-1),3);
 writeFileSync(evidence+'/cancel-worker.json',JSON.stringify({accepted,terminatedAt:3,remainingDeploymentActionsNotDelivered:30,scope:'Node module Worker termination; no browser click-latency assertion'},null,2));
 }finally{await worker.terminate();}
});
