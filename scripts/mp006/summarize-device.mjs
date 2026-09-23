// Four fresh-page exports, ABBA order, five identical initial deployments each.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const files=process.argv.slice(2);assert.equal(files.length,4,'Supply A1 B1 B2 A2 JSON exports');
const groups={},order=['snapshot-v2-inline-view','snapshot-v3-map-table','snapshot-v3-map-table','snapshot-v2-inline-view'];let environment;
for(const [i,file] of files.entries()){
 const d=JSON.parse(readFileSync(file,'utf8')),env=JSON.stringify({build:d.build,browser:d.browser,viewport:d.viewport});
 if(environment)assert.equal(env,environment,'Build/browser/viewport must match');else environment=env;
 assert.equal(d.entry,'official-game-opt-in');assert.equal(d.submissions.length,5,'Exactly five submissions per batch');
 assert(d.connections.every(c=>!c.QUERY_MATCH&&!c.RESYNC_MATCH&&!c.fallbackReason),'No recovery/fallback in comparison');
 for(const [index,s] of d.submissions.entries()){
  assert.equal(s.lodCompleted,3);assert.equal(s.lodFailed,false);assert.equal(s.snapshotFormat,order[i]);
  assert.equal(s.acceptedRevision,index+1);assert.equal(s.appliedRevision,s.acceptedRevision);assert.equal(s.snapshotSequence,s.ackSequence+1);assert.equal(s.controlsReady,true);
  const p=s.production;assert(p);const r={bytes:s.snapshotBytes,sendAck:s.ackAt-s.sentAt,ackSnapshot:s.snapshotArrival-s.ackAt,parse:p.parseAndEnvelopeMs,validation:p.validationMs,rebuild:p.rebuildMs,applyNotify:p.receiveNotifyMs,sendControls:s.controlsObservedAt-s.sentAt};
  assert(Object.values(r).every(v=>Number.isFinite(v)&&v>=0));(groups[s.snapshotFormat]??=[]).push(r);
 }
}
for(const [format,rows] of Object.entries(groups)){assert.equal(rows.length,10);groups[format]={n:rows.length,...Object.fromEntries(Object.keys(rows[0]).map(k=>{const ns=rows.map(r=>r[k]).sort((a,b)=>a-b);return [k,{median:(ns[4]+ns[5])/2,max:ns.at(-1)}];}))};}
console.log(JSON.stringify({environment:JSON.parse(environment),order,groups,boundaries:['User must confirm same device/network/scenario/operation sequence; exports cannot prove network sameness','JSON bytes are not on-wire bytes','Apply/notify includes synchronous listeners; controls ready is not pixel presentation','Diagnostic extra parse and clocks add overhead; identical opt-in in both groups','No historical samples used; one 10+10 comparison does not establish durable latency improvement']},null,2));
