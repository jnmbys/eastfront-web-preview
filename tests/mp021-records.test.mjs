import test from 'node:test';import assert from 'node:assert/strict';
import {makeRecord,safeTiming,purposes} from '../scripts/mp021/web/records.mjs';
import {joinRecord} from '../scripts/mp021/join.mjs';
import {ForegroundGate} from '../scripts/mp017/web/foreground.mjs';
function valid(index=1){const action={requestId:'a',acceptedRevision:1,completionCount:1,times:{sendAt:10,ackAt:11,appliedAt:12,canSubmitAt:23},milestones:{authorityAppliedMs:2,canSelectMs:2,legalOptionsReadyMs:13,canSubmitMs:13}};
 return {config:{instanceId:'i',sourceSha:'source',packageTreeSha256:'hash'},device:'local synthetic',index,report:{actions:[action]},sample:{events:[{stage:'send',type:'SUBMIT_ACTION',requestId:'a',at:10},{stage:'send',type:'QUERY_MATCH',requestId:'q',at:13},{event:'transport',type:'MATCH_QUERY',requestId:'q',revision:1,callbackAt:20,parsedAt:21},{type:'query-applied',requestId:'q',at:23,canSubmit:true,legalOptionsReady:true}],restored:true,flags:[],foreground:{satisfiedAtInput:true}},exportedAt:'fixture'};}
test('MP021 preassigned warmup + three diagnostic samples; incomplete never normal',()=>{
 assert.deepEqual(purposes,['warmup','normal','normal','normal']);for(let index=1;index<=4;index++){const r=makeRecord(valid(index));assert.equal(r.classification,purposes[index-1]);assert.equal(r.performanceSample,false);}
 for(const mutate of [s=>s.sample.restored=false,s=>s.sample.flags.push('offline'),s=>s.sample.events.push({type:'RESYNC_MATCH'}),s=>s.sample.events.push({type:'transport-status',syncing:true}),s=>s.report.actions[0].completionCount=0,s=>s.sample.events.pop()]){const s=valid(2);mutate(s);assert.equal(makeRecord(s).classification,'exception-or-incomplete');}
});
test('MP021 safe metadata drops credentials, drafts and game objects',()=>{const r=safeTiming('action',{stage:'send',at:1,requestId:'q',payload:{hidden:true},token:'secret',cookie:'secret',pathDraft:[{q:0,r:0}],private:'secret'});assert.deepEqual(r,{event:'action',stage:'send',at:1,requestId:'q'});});
test('MP021 join requires same instance/request/revision; unknown stays null across clock origins',()=>{
 const c=makeRecord(valid()),row=(stage,startAt,endAt)=>({instanceId:'i',requestId:'q',revision:1,stage,startAt,endAt});const rows=[row('query-dispatch',100000,100001),row('query-send',100003,100003)];
 assert.equal(joinRecord(c,rows).queries[0].timing.unknownResidualMs,4);
 assert.equal(joinRecord(c,rows.map(r=>({...r,instanceId:'other'}))).queries[0].timing.server.receivedAt,null);
 assert.equal(joinRecord(c,rows.map(r=>({...r,revision:0}))).queries[0].timing.unknownResidualMs,null);
 assert(joinRecord(c,[]).queries[0].missingServerStages.includes('query-send'));
 assert.equal(joinRecord(c,[...rows,rows[0]]).queries[0].serverDuplicateStage,true);
 assert.equal(joinRecord(c,[...rows,rows[0]]).queries[0].timing.unknownResidualMs,null);
});
test('MP021 continuous foreground gate resets on hidden or unready, no zero missing data',()=>{const g=new ForegroundGate();assert(!g.update(0,true,true).satisfiedAtInput);assert(g.update(5000,true,true).satisfiedAtInput);assert(!g.update(5100,false,true).satisfiedAtInput);assert(!g.update(5200,true,true).satisfiedAtInput);assert(!g.update(10100,true,false).satisfiedAtInput);});
