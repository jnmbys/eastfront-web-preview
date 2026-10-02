import test from 'node:test';
import assert from 'node:assert/strict';
import {Trial} from '../scripts/mp010/web/measure.mjs';
const trial=()=>new Trial({inputAt:10,requestId:'own',baseRevision:0,scope:'private-scope',format:'snapshot-v3-map-table'});
test('MP010 identical observer retains actual application and ready times across late ACK',()=>{
 const t=trial();t.sent(12);t.apply('private-scope',1,2,30);t.interactive(1,45);assert.equal(t.result().authorizedAppliedMs,null);
 t.ack('wrong',1,70);assert.equal(t.result().authorizedAppliedMs,null);t.ack('own',1,100);
 assert.equal(t.result().authorizedAppliedMs,20);assert.equal(t.result().interactiveMs,35);assert.equal(t.result().ackMs,90);
 t.apply('private-scope',1,4,120);t.ack('own',1,125);assert.equal(t.result().authorizedAppliedMs,20);
});
test('MP010 other revision or viewer cannot be credited and visible feedback stays manual',()=>{
 const t=trial();t.ack('own',2,15);t.apply('private-scope',1,2,20);t.apply('other',2,3,25);t.frame('status-change',26);
 assert.equal(t.result().authorizedAppliedMs,null);assert.equal(t.result().visibleFeedbackMs,null);assert.equal(t.result().feedbackFrameOpportunityMs,16);
});
test('MP010 export only contains safe metadata, not internal scope or caller payload',()=>{
 const t=trial();t.payload={token:'SECRET',unitId:'HIDDEN',hex:{q:9,r:8}};t.apply('private-scope',1,2,20);t.ack('own',1,30);
 const result=t.result(),text=JSON.stringify(result);for(const value of ['SECRET','HIDDEN','private-scope','payload','hex','token'])assert(!text.includes(value));
 assert.equal(result.requestId,'own');assert.equal(result.visibleFeedbackMethod,'unreviewed-video');
});
