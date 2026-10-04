// Offline only. Re-run from any directory; no network, game traffic or file mutation by default.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {joinRecord} from '../../../scripts/mp021/join.mjs';
const dir=dirname(fileURLToPath(import.meta.url));
const read=name=>JSON.parse(readFileSync(join(dir,name),'utf8').replace(/^\uFEFF/,''));
const lines=name=>readFileSync(join(dir,name),'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const server=lines('server-query.jsonl'),config=read('fixture-ready.json'),status=read('log-status-before-stop.json');
assert.equal(status.instanceId,config.instanceId);assert.equal(status.pendingRows,0);assert.equal(status.dropped,0);assert.equal(status.writeFailed,false);assert.equal(server.length,status.persistedRows);
const privateKeys=/^(?:password|passwordHash|passwordSha256|cookie|cookies|token|accessToken|authorization|payload)$/i;
function inspect(value){if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)){assert.equal(privateKeys.test(key),false,`Unexpected private field: ${key}`);inspect(item);}}
const boundary=lines('boundary-after-stop.jsonl');inspect(server);inspect(boundary);
const samples=[];
for(let index=1;index<=4;index++){
 const purpose=index===1?'warmup':'normal',file=`mp021-${config.instanceId}-${index}-${purpose}.json`,client=read(file);inspect(client);
 for(const key of ['instanceId','sourceSha','gameplayClientSha','packageTreeSha256','diagnosticSha256'])assert.equal(client[key],config[key],key);
 assert.equal(client.index,index);assert.equal(client.purpose,purpose);assert.equal(client.classification,purpose);assert.equal(client.performanceSample,false);
 assert.equal(client.restored,true);assert.equal(client.action.completionCount,1);assert.equal(client.action.acceptedRevision,index);
 assert.equal(client.foreground.satisfiedAtInput,true);assert.ok(client.foreground.continuousVisibleMs>=5000);assert.deepEqual(client.flags,[]);assert.deepEqual(client.reasons,[]);
 const joined=joinRecord(client,server);assert.deepEqual(joined,read(`joined-${index}-${purpose}.json`));
 const recovery=joined.queries.filter(q=>q.phase==='authority-recovery');assert.equal(recovery.length,1);
 const q=recovery[0];assert.equal(q.correlationStatus,'complete');assert.equal(q.revision,client.action.acceptedRevision);
 const t=client.action.times,view=client.action.renders.find(r=>r.kind==='view'),render=client.action.renders.find(r=>r.kind==='query');
 const overlap=Math.max(0,Math.min(view.endAt,q.callbackAt)-Math.max(view.startAt,q.sendAt));
 samples.push({index,purpose,classification:client.classification,device:client.device,clientFile:file,
  actionRequestId:client.action.requestId,queryRequestId:q.requestId,revision:q.revision,foreground:client.foreground,
  queryCounts:joined.queries.reduce((a,q)=>(a[q.phase]=(a[q.phase]??0)+1,a),{}),
  actionMilestonesMs:client.action.milestones,inputToInteractiveMs:client.action.intervals.inputToInteractive,
  appliedToQuerySendMs:q.sendAt-t.appliedAt,appliedToInteractiveMs:t.interactiveAt-t.appliedAt,
  queryTiming:q.timing,viewRenderMs:view.durationMs,queryWaitOverlapsViewRenderMs:overlap,
  queryRenderMs:render.durationMs,callbackToInteractiveMs:t.interactiveAt-q.callbackAt,
  queryAppliedToUiGateMs:t.canSubmitAt-q.canSubmitAt,missing:client.action.missing});
}
const finished=boundary.filter(r=>r.event==='response-finish');
const summary={schema:'MP021-field-review-v1',provenance:'Four original files supplied by the user from the Huawei test; this is not browser automation or A/B performance evidence.',
 config,samples,log:{rows:server.length,requests:new Set(server.map(r=>r.requestId)).size,...status},
 access:{anonymousProbePassed:read('anonymous-probes.json').pass,loginSuccess:finished.filter(r=>r.reason==='login-success').length,
 authorizedHttp200:finished.filter(r=>r.kind==='http'&&r.status===200&&r.reason==='authorized-upstream').length,
 authorizedWs101:finished.filter(r=>r.kind==='ws'&&r.status===101&&r.reason==='authorized-upstream').length,
 upstream404:finished.filter(r=>r.status===404).map(r=>({path:r.path,requestId:r.requestId,at:r.at})),
 http5xx:finished.filter(r=>r.status>=500).length,connectionErrors:boundary.filter(r=>r.hadError===true||r.event==='connection-error').length},
 closure:read('closure.json'),
 limits:['Exact Huawei model/OS/browser versions were not provided; preserve entered device string.',
 'Actual visible feedback and feedback frame opportunity are missing, never zero.',
 'Warmup separate; three normal samples are localization observations, not stable improvement or P95.',
 'Service is on the authorized Windows host behind the temporary tunnel, not production Render.',
 'Serialized bytes are JSON bytes before WebSocket/link compression, not measured wire bytes.',
 'No cross-clock subtraction. Residual is not pure network RTT; path direction and callback queues remain unknown.',
 'Two upstream 404 paths were redacted as <other>; resource identity and impact cannot be inferred.',
 'Text backup was not verified. Public 502 verifies unavailability at probe time, not permanent DNS removal.']};
const evidenceHashes=Object.fromEntries(readdirSync(dir).filter(n=>/\.(json|jsonl|mjs)$/.test(n)&&n!=='analysis.json').sort().map(n=>[n,createHash('sha256').update(readFileSync(join(dir,n))).digest('hex')]));
const output={...summary,evidenceHashes};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(output,null,2)+'\n',{flag:'wx'});
else console.log(JSON.stringify(output,null,2));
