import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';
import {makeRecord,purposes} from '../scripts/mp021/web/records.mjs';
test('MP021 page keeps one iframe, fixed four purposes, and requires saved confirmation between exports',async()=>{
 const ids=['game','device','version','start','export','saved','status','fallback','result'],els=Object.fromEntries(ids.map(id=>[id,{value:'local controller fixture',disabled:true}])),listeners={},jobs=[],messages=[],downloads=[];
 els.game.contentWindow={postMessage:m=>messages.push(m)};
 const config={sourceSha:'source',instanceId:'instance',packageTreeSha256:'package',diagnosticSha256:'diagnostic'};
 const context=vm.createContext({makeRecord,purposes,document:{querySelector:s=>els[s.slice(1)],createElement:()=>({set href(v){},set download(v){downloads.push(v);},click(){}})},fetch:async()=>({json:async()=>config}),addEventListener:(k,f)=>listeners[k]=f,location:{origin:'https://local.invalid'},setTimeout:f=>jobs.push(f),URL:{createObjectURL:()=>'',revokeObjectURL(){}},Blob:class{},Date,JSON,Math});
 const source=readFileSync('scripts/mp021/web/controller.mjs','utf8').replace(/^import .*\n/,'');await vm.runInContext('(async()=>{'+source+'})()',context);
 els.start.onclick();const iframe=els.game.src;assert(iframe.includes('/v/candidate/move/real/'));
 const dispatch=data=>listeners.message({source:els.game.contentWindow,origin:'https://local.invalid',data});
 for(let index=1;index<=4;index++){
  const action={requestId:'a'+index,completionCount:1,acceptedRevision:index,times:{sendAt:10,ackAt:11,canSubmitAt:23},milestones:{authorityAppliedMs:2,canSelectMs:2,legalOptionsReadyMs:13,canSubmitMs:13}};
  dispatch({source:'MP021-DIAG',sourceSha:'source',diagnosticSha256:'diagnostic',report:{actions:[action],events:[]}});
  els.export.onclick();dispatch({source:'MP021-SAMPLE',type:'result',index,restored:true,flags:[],foreground:{satisfiedAtInput:true},events:[{stage:'send',type:'SUBMIT_ACTION',at:10,requestId:'a'+index},{stage:'send',type:'QUERY_MATCH',at:13,requestId:'q'+index},{event:'transport',type:'MATCH_QUERY',requestId:'q'+index,revision:index,callbackAt:20,parsedAt:21},{type:'query-applied',requestId:'q'+index,at:23,canSubmit:true,legalOptionsReady:true}]});
  while(jobs.length)jobs.shift()();const record=JSON.parse(els.fallback.value);assert.equal(record.index,index);assert.equal(record.classification,purposes[index-1]);assert.equal(els.game.src,iframe);
  assert.equal(messages.filter(m=>m.type==='arm').length,index-1);
  if(index<4){assert.equal(els.saved.disabled,false);els.saved.onclick();assert.equal(messages.at(-1).index,index+1);}else assert.equal(els.saved.disabled,true);
 }
 assert.equal(downloads.length,4);assert(downloads[0].endsWith('-1-warmup.json'));assert(downloads[3].endsWith('-4-normal.json'));
});
