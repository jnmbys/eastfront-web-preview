import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
const root=resolve(process.argv[2]??'evidence/mp-020/run-20261004-local');
const groups=['baseline-local','diagnostic-local','diagnostic-delayed','diagnostic-render'];
const rows=[];
for(const group of groups){
 const result=JSON.parse(readFileSync(join(root,group,'results.json'))),events=JSON.parse(readFileSync(join(root,group,'client.json')));
 for(const sample of result.samples){
  const timing=sample.timing,queryId=sample.queryRequestId;
  const completed=events.filter(r=>r.stage==='snapshot-applied'&&r.at<=timing.client.sendAt).at(-1);
  const sent=events.find(r=>r.stage==='send'&&r.type==='SUBMIT_ACTION'&&r.requestId===completed?.requestId);
  const gate=events.find(r=>r.stage==='interaction-gates'&&r.canSelect&&r.at>=completed?.at&&r.at<=timing.client.legalOptionsAppliedAt);
  const elapsed=at=>typeof at==='number'&&sent?at-sent.at:null;
  rows.push({group,sample:sample.sample,queryId,from:'client send (not physical click/paint)',authorityAppliedMs:elapsed(completed?.at),canSelectMs:elapsed(gate?.at),legalOptionsReadyMs:elapsed(timing.client.legalOptionsAppliedAt),canSubmitMs:elapsed(timing.client.canSubmitAt),query:timing,wire:sample.wire});
 }
}
writeFileSync(join(root,'four-milestones.json'),JSON.stringify({rows,limits:'Derived only from this run metadata. Same client clock; actual snapshot time preserved. No Huawei values inferred. No browser paint or DOM measurement.'},null,2)+'\n',{flag:'wx'});
console.log('Four milestones derived without editing raw records.');
