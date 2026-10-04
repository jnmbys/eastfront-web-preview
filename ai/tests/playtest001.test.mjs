import test from 'node:test';
import assert from 'node:assert/strict';
import {localStatus} from '../../.ai-dist/src/local-ai/status.js';
test('playtest status distinguishes active owner, finished game, recoverable policy and terminated Worker',()=>{
 const meta={humanSide:'GERMAN',ownerSide:'SOVIET',manual:false,paused:false,reason:null,accepted:0,rejected:0};
 assert.equal(localStatus(meta),'AI 正在处理');assert.equal(localStatus({...meta,ownerSide:'GERMAN'}),'等待你的操作');
 assert.equal(localStatus(meta,true),'对局已结束');
 for(const reason of ['AGENT_STOP:NO_CANDIDATE','AGENT_ERROR','REJECTION_LIMIT','WORKER_ERROR','WORKER_TIMEOUT','INTEGRITY_FAILURE']){
  const text=localStatus({...meta,paused:true,reason});assert(text.startsWith('已停止：'));assert(text.includes(reason));assert(!text.includes('未知原因'));
 }
 assert.equal(localStatus({...meta,manual:true}),'人工接管模式');
});
