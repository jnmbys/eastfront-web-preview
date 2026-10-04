import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {LocalMatch} from '../../.ai-dist/ai/local/LocalMatch.js';
import {prepareLocalScenario} from '../../.ai-dist/ai/local/scenarios.js';
import {minimalAgent} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {Worker} from 'node:worker_threads';
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json')),evidence=[];
test('takeover retains actual pending battle and completes every follow-up without another policy call, both original seats',()=>{
 for(const humanSide of ['GERMAN','SOVIET']){
  const p=prepareLocalScenario({map,humanSide,scenario:'stop',seed:70022});let calls=0;
  const m=new LocalMatch(p.session,humanSide,input=>{calls++;return p.policy(input);});assert(m.audit().pendingDecision);assert(m.shouldThink);m.think();assert(m.meta.paused);assert.equal(calls,1);
  const before=m.audit(),changed=m.takeOver();assert(changed);assert.deepEqual(m.audit(),before);assert(m.meta.manual);assert.equal(m.shouldThink,false);
  const actions=[];
  for(let i=0;i<30&&m.audit().pendingDecision;i++){
   const pending=m.audit().pendingDecision,owner=m.meta.ownerSide;
   if(owner!==m.meta.humanSide)assert(m.takeOver(),'manual seat switch remains explicit');
   const snap=m.snapshot().payload,decision=minimalAgent(m.host.observe(snap.model.viewerControllerId));assert.equal(decision.kind,'INTENT');
   const replies=m.request('SUBMIT_ACTION',{matchId:snap.matchId,expectedRevision:snap.matchRevision,action:decision.intent},'manual-'+i);assert(replies.some(r=>r.messageType==='ACTION_ACCEPTED'));
   actions.push({pending:pending.kind,intent:decision.intent,afterPending:m.audit().pendingDecision});assert.equal(m.think(),null);assert.equal(calls,1);
  }
  assert.equal(m.audit().pendingDecision,null);assert.equal(m.meta.paused,false);assert.equal(calls,1);evidence.push({humanSide,before,after:m.audit(),calls,actions,meta:m.meta});
 }
 mkdirSync('evidence/ai-playtest-002',{recursive:true});writeFileSync('evidence/ai-playtest-002/takeover-core.json',JSON.stringify(evidence,null,2));
});
test('actual Worker cancels AI scheduling at takeover; pending state waits for a human request',async()=>{
 const worker=new Worker(new URL('../local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL('../../.ai-dist/ai/local/worker.js',import.meta.url).href}}),messages=[];
 worker.on('message',m=>messages.push(m));
 const wait=predicate=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{worker.off('message',listen);reject(Error('worker wait limit'));},10000);const listen=m=>{if(predicate(m)){clearTimeout(timeout);worker.off('message',listen);resolve(m);}};worker.on('message',listen);});
 try{
  let ready=wait(m=>m.meta?.paused);worker.postMessage({kind:'START',epoch:27,options:{map,humanSide:'GERMAN',scenario:'stop',seed:70022}});const stopped=await ready;assert.equal(stopped.message.payload.view.pendingDecision,null,'other side pending is not leaked before takeover');
  ready=wait(m=>m.takeover);worker.postMessage({kind:'TAKEOVER',epoch:27,requestId:'takeover'});const manual=await ready;
  assert(manual.meta.manual);assert.equal(manual.meta.accepted,0);assert.equal(manual.message.payload.view.pendingDecision.kind,'DEFENDER_REACTION');
  const count=messages.length;await new Promise(r=>setTimeout(r,240));assert.equal(messages.length,count,'no AI timer action after takeover');
  const snap=manual.message.payload;ready=wait(m=>m.message?.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.meta.accepted===1);
  worker.postMessage({kind:'REQUEST',epoch:27,requestId:'human-reaction',type:'SUBMIT_ACTION',payload:{matchId:snap.matchId,expectedRevision:snap.matchRevision,action:{type:'PASS_REACTION',battleId:snap.view.pendingDecision.battleId}}});const after=await ready;assert(after.meta.manual);assert.equal(after.message.payload.view.pendingDecision.kind,'RETREAT');
  const afterCount=messages.length;await new Promise(r=>setTimeout(r,240));assert.equal(messages.length,afterCount);
  writeFileSync('evidence/ai-playtest-002/takeover-worker.json',JSON.stringify({manual,after,noAutomaticWorkerActionWaitMs:240,counts:[count,afterCount]},null,2));
 }finally{await worker.terminate();}
});
