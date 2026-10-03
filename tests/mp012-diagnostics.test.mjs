import test from 'node:test';
import assert from 'node:assert/strict';
import {Timeline,safePath,safeError,assetPath} from '../scripts/mp012/trace.mjs';
test('MP012 snapshot before ACK retains first apply, excludes wrong revision/scope, completes once',()=>{
  const t=new Timeline();t.submit('a','own',0,10,11);t.applied('other',1,2,14);t.applied('own',2,3,15);t.ack('unrelated',1,16);
  assert.equal(t.report().actions[0].times.appliedAt,null);
  t.applied('own',1,4,20);t.interactive('own',1,25);t.applied('own',1,5,30);
  t.receive('own',{type:'PLAYER_VIEW_SNAPSHOT',sequence:4,callbackAt:17,parsedAt:18,decodedAt:19,appliedAt:24});
  t.ack('a',1,90);t.ack('a',2,95);t.ack('a',1,100);
  const a=t.report().actions[0];assert.equal(a.times.appliedAt,20);assert.equal(a.times.ackAt,90);assert.equal(a.completionCount,1);assert.equal(a.intervals.ackToSnapshotCallback,-73);assert.equal(a.times.interactiveAt,25);
});
test('MP012 decomposes artificial delays and queries without crossing clocks',()=>{
  const t=new Timeline();t.submit('a','s',5,10,12);t.ack('a',6,1012);t.applied('s',6,20,2020);t.receive('s',{type:'PLAYER_VIEW_SNAPSHOT',sequence:20,callbackAt:2012,parsedAt:2014,decodedAt:2019,appliedAt:2030});
  t.query('q','s',6,2031);t.queryReceived('q',3031,3040);t.query('wrong','s',7,3050);t.interactive('s',6,3040);
  const a=t.report().actions[0];assert.deepEqual(a.intervals,{inputToSend:2,sendToAck:1000,ackToSnapshotCallback:1000,parse:2,decode:5,decodedToApplied:1,appliedToHandlerEnd:10,appliedToInteractive:1020,inputToInteractive:3030});assert.equal(a.queries.length,1);assert.equal(a.serverComputeMs,null);
});
test('MP012 missing receive/ACK/readiness stay missing, never zero',()=>{
  const t=new Timeline();t.submit('a','s',0,1,2);t.applied('s',1,3,4);assert.equal(t.report().actions[0].times.appliedAt,null);t.ack('a',1,5);
  const a=t.report().actions[0];assert.equal(a.times.appliedAt,4);assert.equal(a.intervals.decode,null);assert.equal(a.intervals.inputToInteractive,null);assert.equal(a.actualVisibleFeedbackMs,null);
});
test('MP012 metadata is bounded and excludes internal scope and raw error content',()=>{
  const t=new Timeline();t.submit('a','SECRET_SCOPE',0,1,2);for(let i=0;i<2100;i++)t.event('tick',i);assert.equal(t.report().events.length,2048);assert.equal(t.report().dropped,52);assert.ok(!JSON.stringify(t.report()).includes('SECRET_SCOPE'));
  const base='http://127.0.0.1:4190/v/control/move/real/',allowed=new Set(['app/main.js']);
  const error={name:'TypeError',message:'fetch failed token=SECRET payload=HIDDEN',stack:`TypeError: SECRET\n at x (${base}app/main.js?token=SECRET:34:5)\n at x (https://foreign.example/secret.js:1:2)`};
  const safe=safeError(error,base,allowed);assert.deepEqual(safe.frames,[{path:'app/main.js',line:34,column:5}]);assert.ok(!JSON.stringify(safe).includes('SECRET'));assert.equal(safePath('http://foreign.example/app/main.js',base,allowed),null);assert.equal(safePath('./unknown-token-path',base,allowed),null);
});
test('MP012 terrain-relative asset names resolve only against a unique known inventory entry',()=>{
  const base='http://127.0.0.1:4190/v/control/move/real/',allowed=new Set(['assets/terrain/road.png']);
  assert.equal(assetPath('road.png?token=SECRET',base,allowed),'assets/terrain/road.png');
  allowed.add('assets/other/road.png');assert.equal(assetPath('road.png',base,allowed),null);
  assert.equal(assetPath('unknown.png',base,allowed),null);assert.equal(assetPath('../private.png',base,allowed),null);
});
