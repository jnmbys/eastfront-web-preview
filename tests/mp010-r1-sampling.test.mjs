import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize} from '../scripts/mp010/summarize.mjs';
import {classify,statistics} from '../scripts/mp010/web/classify.mjs';
import {sampleProgress,nextVersion} from '../scripts/mp010/web/sampling.mjs';
import {ForegroundGate} from '../scripts/mp010/web/foreground.mjs';
import {Trial} from '../scripts/mp010/web/measure.mjs';
import {VERSIONS,SERVER_SHA,FORMAT} from '../scripts/mp010/config.mjs';
const expected={versions:VERSIONS,serverSha:SERVER_SHA,format:FORMAT};
function row(){
  const trial=new Trial({inputAt:0,requestId:'request-1',baseRevision:4,scope:'own',format:FORMAT});
  trial.sent(1);trial.ack('request-1',5,30);trial.apply('own',5,8,100);trial.interactive(5,110);
  return {version:'candidate',sourceSha:VERSIONS.candidate,serverSha:SERVER_SHA,snapshotFormat:FORMAT,
    check:'sample',mode:'real',metrics:trial.result(),finalState:{interactive:true},
    preparation:{requiredVisibleMs:5000,continuousVisibleMs:5000,satisfiedAtInput:true}};
}
test('MP010R1 a completed RESYNC is abnormal and cannot raise normal count or normal median',()=>{
  const normal=row(),recovered=row();recovered.metrics.resyncCount=1;recovered.metrics.authorizedAppliedMs=7000;recovered.metrics.interactiveMs=7200;
  const input={rows:[normal,recovered]},before=JSON.stringify(input),g=summarize(input).groups[0];
  assert.equal(g.normalCount,1);assert.equal(g.buckets.normal.metrics.authorizedAppliedMs.median,100);
  assert.equal(g.buckets.abnormal.count,1);assert.equal(g.buckets.abnormal.metrics.authorizedAppliedMs.median,7000);
  assert.equal(g.buckets.abnormal.reasonCounts.resync,1);assert.deepEqual(g.buckets.abnormal.records[0].row,recovered);
  assert.equal(JSON.stringify(input),before);assert.equal(g.targetNormalMet,false);
});
test('MP010R1 missing ACK, exact application, and recovered interactivity remain incomplete',()=>{
  for(const [label,edit,reason] of [
    ['ACK',r=>r.metrics.ackMs=null,'missing-ack'],
    ['accepted revision',r=>r.metrics.acceptedRevision=null,'missing-ack'],
    ['wrong revision',r=>r.metrics.appliedRevision=6,'missing-exact-result'],
    ['missing apply',r=>r.metrics.authorizedAppliedMs=null,'missing-exact-result'],
    ['sequence',r=>r.metrics.appliedSequence=null,'missing-exact-result'],
    ['missing ready time',r=>r.metrics.interactiveMs=null,'not-interactive'],
    ['wrong ready revision',r=>r.metrics.interactiveRevision=6,'not-interactive'],
    ['still blocked',r=>r.finalState.interactive=false,'not-interactive'],
    ['unknown RESYNC count',r=>delete r.metrics.resyncCount,'unknown-resync-count']
  ]){
    const sample=row();edit(sample);const g=summarize({rows:[sample]}).groups[0];
    assert.equal(g.normalCount,0,label);assert.equal(g.buckets.incomplete.count,1,label);
    assert.equal(g.buckets.incomplete.reasonCounts[reason],1,label);
    assert.deepEqual(g.buckets.incomplete.records[0].row,sample);
    assert.deepEqual(g.buckets.normal.metrics.ackMs,{n:0,min:null,median:null,max:null});
  }
});
test('MP010R1 a failed recovery keeps both abnormal and incomplete reasons without double counting',()=>{
  const r=row();r.metrics.resyncCount=2;r.metrics.ackMs=null;r.metrics.interactiveMs=null;r.finalState.interactive=false;
  const g=summarize({rows:[r]}).groups[0];assert.equal(g.buckets.abnormal.count,1);assert.equal(g.buckets.incomplete.count,0);
  assert.equal(g.buckets.abnormal.reasonCounts['missing-ack'],1);assert.equal(g.buckets.abnormal.reasonCounts['not-interactive'],1);
  assert.equal(g.buckets.abnormal.metrics.ackMs.n,0);assert.equal(g.normalCount,0);
});
test('MP010R1 null, undefined, nonfinite and numeric strings never become zero or valid samples',()=>{
  assert.deepEqual(statistics([null,undefined,NaN,Infinity,-1,'0']),{n:0,min:null,median:null,max:null});
  assert.deepEqual(statistics([null,0,10]),{n:2,min:0,median:5,max:10});
  const g=summarize({rows:[row()]}).groups[0];assert.equal(g.buckets.normal.metrics.visibleFeedbackMs.n,0);
  assert.equal(g.normalVideoReviewed,0);assert.equal(g.targetVideoMet,false);
});
test('MP010R1 warmup and checks keep metrics but never consume normal quota or sample alternation',()=>{
  const warm=row();warm.check='warmup';const check=row();check.check='offline';check.metrics.resyncCount=1;
  const g=summarize({rows:[warm,check]}).groups[0];assert.equal(g.normalCount,0);
  assert.equal(g.buckets.warmup.metrics.authorizedAppliedMs.n,1);assert.equal(g.buckets.abnormal.reasonCounts.resync,1);
  const recoveredWarmup=row();recoveredWarmup.check='warmup';recoveredWarmup.metrics.resyncCount=1;
  assert.equal(classify(recoveredWarmup,expected).category,'abnormal');
  assert.deepEqual(sampleProgress([warm,check],expected),{candidate:0,control:0});
  assert.equal(nextVersion([warm,check],'sample',expected),'candidate');
  const ten=Array.from({length:10},row);assert.equal(nextVersion([...ten,warm],'sample',expected),'control');
});
test('MP010R1 old evidence without enforced foreground wait and exact revision fields stays incomplete',()=>{
  const old=row();delete old.preparation;delete old.metrics.appliedRevision;delete old.metrics.interactiveRevision;
  const c=classify(old,expected);assert.equal(c.category,'incomplete');assert(c.reasons.includes('missing-foreground-wait'));
  assert(c.reasons.includes('missing-exact-result'));
});
test('MP010R1 both versions enforce a full five seconds, resetting on hidden or unready intervals',()=>{
  for(const version of Object.keys(VERSIONS)){
    const gate=new ForegroundGate();assert.equal(gate.update(100,true,true).satisfiedAtInput,false,version);
    assert.equal(gate.update(5099,true,true).satisfiedAtInput,false);assert.equal(gate.update(5100,true,true).satisfiedAtInput,true);
    gate.update(5200,false,true);assert.equal(gate.update(30000,true,true).continuousVisibleMs,0);
    assert.equal(gate.update(34999,true,true).satisfiedAtInput,false);assert.equal(gate.update(35000,true,true).satisfiedAtInput,true);
    gate.update(35001,true,false);assert.equal(gate.update(40000,true,true).satisfiedAtInput,false);
  }
});
