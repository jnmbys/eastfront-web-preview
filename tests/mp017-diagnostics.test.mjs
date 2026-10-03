import test from 'node:test';
import assert from 'node:assert/strict';
import {ComparisonTimeline} from '../scripts/mp017/web/timeline.mjs';
import {ForegroundGate} from '../scripts/mp017/web/foreground.mjs';
import {exportRecord,sampleOf,diagnosticMatches} from '../scripts/mp017/web/export.mjs';
import {installObserver} from '../scripts/mp017/web/observer.mjs';
test('MP017 common four milestones retain real application across late ACK and separate clocks',()=>{
 const t=new ComparisonTimeline();t.submit('own','private-scope',0,10,12);t.applied('private-scope',1,4,30);
 t.gates('private-scope',1,31,{canSelect:true,legalOptionsReady:false,canSubmit:true},true);
 assert.equal(t.report().actions[0].times.appliedAt,null);
 t.gates('private-scope',1,40,{canSelect:true,legalOptionsReady:false,canSubmit:false});t.gates('private-scope',1,75,{canSelect:true,legalOptionsReady:true,canSubmit:true});
 t.render('private-scope',1,4,'view',31,45);t.ack('wrong',1,90);assert.equal(t.report().actions[0].completionCount,0);t.ack('own',1,100);t.applied('private-scope',1,9,110);t.ack('own',1,120);
 const a=t.report().actions[0];assert.deepEqual(a.milestones,{authorityAppliedMs:20,canSelectMs:21,legalOptionsReadyMs:65,canSubmitMs:65});assert.equal(a.completionCount,1);assert.equal(a.renders[0].durationMs,14);assert(!JSON.stringify(t.report()).includes('private-scope'));
});
test('MP017 foreground reset is identical in both packages; early/unready/hidden time is not credited',()=>{
 const g=new ForegroundGate();assert(!g.update(0,true,false).satisfiedAtInput);g.update(100,true,true);assert(!g.update(5099,true,true).satisfiedAtInput);assert(g.update(5100,true,true).satisfiedAtInput);g.update(5200,false,true);assert(!g.update(12000,true,true).satisfiedAtInput);assert(g.update(17000,true,true).satisfiedAtInput);
});
test('MP017 recovery, missing ACK/association/readiness stay exceptional; warmup is separate and no zeros invented',()=>{
 const config={versions:{control:'A',candidate:'B'},diagnosticSha256:'d',serverSha:'s',snapshotFormat:'v3',cachePolicy:'no-store'};
 const valid={source:'MP017-DIAG',version:'control',sourceSha:'A',diagnosticSha256:'d',report:{actions:[{requestId:'r',completionCount:1,acceptedRevision:1,appliedSequence:3,milestones:{authorityAppliedMs:30,canSelectMs:31,legalOptionsReadyMs:89,canSubmitMs:90}}],events:[]}};
 const sample={metrics:{requestId:'r',ackMs:20,acceptedRevision:1,appliedSequence:3,resyncCount:0,rejected:false,submitCount:1,flags:[]},finalState:{interactive:true},preparation:{satisfiedAtInput:true}};
 const make=(run=valid,s=sample,purpose='measured')=>exportRecord({config,device:'local component fixture',version:'control',pairId:'pair',purpose,order:1,run,sample:s,attempt:{at:90000,clock:'parent'},exportedAt:'fixture'});
 assert.equal(make().classification,'normal');assert.equal(make(valid,sample,'warmup').classification,'warmup');
 for(const field of ['resyncCount','ackMs','acceptedRevision']){const s=structuredClone(sample);s.metrics[field]=field==='resyncCount'?1:null;assert.equal(make(valid,s).classification,'exception-or-incomplete');}
 const incomplete=structuredClone(sample);incomplete.finalState.interactive=false;assert(make(valid,incomplete).reasons.includes('not-restored'));
 const missingMilestone=structuredClone(valid);missingMilestone.report.actions[0].milestones.legalOptionsReadyMs=null;assert(make(missingMilestone).reasons.includes('missing-milestone'));assert.equal(make(missingMilestone).classification,'exception-or-incomplete');
 assert.equal(make(null,null).sample,null);assert(!diagnosticMatches({...valid,sourceSha:'old-73d2'},config,'control'));
 assert(!JSON.stringify(sampleOf({build:{sourceSha:'A'},result:{ackMs:null,token:'SECRET',payload:'HIDDEN'},finalState:{cookie:'SECRET'}},config,'control')).includes('SECRET'));
});
test('MP017 observer calls original methods exactly once, preserves return/throw and never sends work itself',()=>{
 const calls=[],target=new EventTarget();class Client{send(type){calls.push(type);return 'id';}}
 class Session{constructor(){this.client={state:{snapshot:{matchId:'private'}}};this.model={viewerControllerId:'viewer'};this.matchRevision=0;this.serverSequence=1;this.presentation={};this.modelKey='same';this.interactive=true;this.canSelect=true;this.onChange=()=>calls.push('change');}needsProjection(){return true;}key(){return 'same';}requestProjection(){calls.push('projection');return 'original';}submit(){calls.push('submit');return 7;}receive(){this.onChange('view');return 8;}}
 const t=new ComparisonTimeline(),restore=installObserver({NetworkPlayerSession:Session,LobbyClient:Client,timeline:t,queryDraft:()=>({}),target,inputAt:()=>1,now:()=>2});const s=new Session();assert.deepEqual(calls,[]);assert.equal(s.requestProjection(),'original');assert.equal(s.submit(),7);assert.equal(s.receive(null),8);assert.equal(new Client().send('QUERY_MATCH',{}),'id');assert.deepEqual(calls,['projection','submit','change','QUERY_MATCH']);
 t.gates=()=>{throw Error('observer failed');};assert.equal(s.submit(),7);assert.equal(s.receive(null),8);restore();assert(t.dropped>=2);
});
