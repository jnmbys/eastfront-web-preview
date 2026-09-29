import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {Worker} from 'node:worker_threads';
import {fixture,host,G} from '../../ai/tests/helpers.mjs';
import {basicAgent} from '../../.ai003-preview/ai/fair/basicAgent.js';
import {measuredPolicy,measuredThink} from '../../.ai003-preview/ai/local/worker-perf.js';
const root=new URL('../../',import.meta.url);
test('preview overlay preserves policy return identity and exports only numeric timings',()=>{
 const input=host(fixture()).observe(G),expected=basicAgent(input);let actual;
 const measured=measuredPolicy(x=>actual=basicAgent(x));assert.deepEqual(measured(input),expected);
 const packets=[];globalThis.self={postMessage:x=>packets.push(x)};const snapshot={authorized:'fixture'};
 measuredThink({think:()=>snapshot},x=>assert.equal(x,snapshot));assert.equal(packets.length,1);
 assert.equal(packets[0].policy.count,1);assert(packets[0].policy.maxMs>=0);assert(packets[0].workerStepMs>=0);
 assert.deepEqual(Object.keys(packets[0]).sort(),['kind','policy','source','strategy','workerStepMs']);delete globalThis.self;
});
test('published module Worker runs through the existing transport with metrics and correct recipient',async()=>{
 const worker=new Worker(new URL('../../ai/local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL('../../.ai003-preview/ai/local/worker.js',import.meta.url).href}});
 const map=JSON.parse(readFileSync(new URL('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',root)));
 const messages=[];let done;const complete=new Promise((resolve,reject)=>{done=resolve;worker.on('error',reject);});
 worker.on('message',m=>{messages.push(m);if(m.kind==='AI_PREVIEW_PERF'&&messages.some(x=>x.message?.payload?.canAct))done();});
 const timer=setTimeout(()=>done(),10000);
 try{worker.postMessage({kind:'START',epoch:2,options:{humanSide:'SOVIET',scenario:'ai-attack',seed:17,map}});await complete;
  assert(messages.some(m=>m.kind==='AI_PREVIEW_PERF'&&m.policy.count===1));
  assert(messages.some(m=>m.message?.payload?.view?.pendingDecision?.kind==='DEFENDER_REACTION'));
  for(const m of messages)for(const forbidden of ['"authoritativeState"','"actionLog"','"random"'])assert(!JSON.stringify(m).includes(forbidden));
 }finally{clearTimeout(timer);await worker.terminate();}
});
test('published campaign strategy is byte-identical to AI005 build and reaches bounded route planner',()=>{
 for(const file of ['ai/fair/basicAgent.js','ai/fair/routing.js'])assert.equal(readFileSync(new URL('.ai003-preview/'+file,root),'utf8'),readFileSync(new URL('.ai003-dist/'+file,root),'utf8'));
 assert(readFileSync(new URL('.ai003-preview/ai/fair/basicAgent.js',root),'utf8').includes("from './routing.js'"));
 assert(readFileSync(new URL('.ai003-preview/ai/local/scenarios.js',root),'utf8').includes('policy: basicAgent'));
});
