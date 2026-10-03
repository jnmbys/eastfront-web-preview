// Offline review only: never starts services, edits exports or reads credentials.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const [file,boundaryFile,desktopBoundaryFile]=process.argv.slice(2);
if(!file||!boundaryFile||!desktopBoundaryFile)throw Error('Usage: node scripts/mp015/review-export.mjs export.json boundary.json desktop-boundary.json');
const raw=readFileSync(file),d=JSON.parse(raw),r=d.diagnostic?.report;
const events=r?.events??[],m=d.sample?.metrics??{},a=r?.actions?.find(x=>x.requestId===m.requestId),t=a?.times??{};
const cutoff=JSON.parse(readFileSync(desktopBoundaryFile)).capturedAt;
const boundary=JSON.parse(readFileSync(boundaryFile)).events.filter(e=>Date.parse(e.at)>Date.parse(cutoff));
const decisions=boundary.filter(e=>e.event==='decision');
const round=x=>Number.isFinite(x)?Math.round(x*10)/10:null;
const delta=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?round(x-y):null;
const first=kind=>events.find(e=>e.kind===kind)?.at??null;
const bad=boundary.filter(e=>e.status>=500||e.event==='upstream-error'||(e.event==='decision'&&e.path==='/__mp010_login'&&e.method==='POST'&&e.reason!=='login-success'));
const errors=events.filter(e=>/error|fail/i.test(e.kind)||e.status>=400||e.outcome==='error'||e.errorPresent===true);
const checks={schema:d.schema==='MP013-owner-diagnostic-v1',
  fixedControl:d.sourceSha==='73d2dee2f2dab3bfb09d6466d54fa391d19d39fb',
  fixedServer:d.serverSha==='6ea4983047757a4a32a707a23d61f4962bca36d3',
  fixedDiagnostic:d.diagnosticSha256==='717fee6da0df5d272a656aa869c5182a43f7d0d789227b6db24b1cfa8dedaa98',
  format:d.snapshotFormat==='snapshot-v3-map-table',
  realMove:d.diagnostic?.mode==='real'&&d.diagnostic?.scenario==='move'&&d.diagnostic?.fixtureFault==='none',
  oneSubmit:m.submitCount===1&&events.filter(e=>e.kind==='send'&&e.type==='SUBMIT_ACTION').length===1,
  exactCompletion:!!a&&a.completionCount===1&&m.acceptedRevision===m.appliedRevision&&a.acceptedRevision===m.acceptedRevision&&a.appliedSequence===m.appliedSequence,
  completeTimes:['inputAt','sendAt','ackAt','snapshotReceiveAt','parsedAt','decodedAt','appliedAt','handlerEndAt','interactiveAt'].every(k=>Number.isFinite(t[k])),
  foregroundWait:d.sample?.preparation?.satisfiedAtInput===true&&d.sample.preparation.continuousVisibleMs>=5000,
  interactive:d.sample?.finalState?.interactive===true&&d.sample.finalState.pendingMarker===false,
  noRecoveryOrRejection:m.resyncCount===0&&m.rejected===false&&m.flags?.length===0,
  mapObserved:events.some(e=>e.kind==='map-dom-ready'),noDiagnosticErrors:errors.length===0&&d.diagnostic?.startup?.imageJobs?.failed===0,
  loginAccepted:decisions.some(e=>e.reason==='login-success'),
  authorizedHttp:decisions.some(e=>e.kind==='http'&&e.status===200&&e.reason==='authorized-upstream'),
  authorizedWs:decisions.some(e=>e.kind==='ws'&&e.path==='/ws/move/real'&&e.status===101&&e.reason==='authorized-upstream'),
  noBoundary500AuthOrUpstreamError:bad.length===0};
const resources=events.filter(e=>e.kind==='resource-timing');
const inputs=events.filter(e=>e.kind==='input');
const report={status:Object.values(checks).every(Boolean)?'HUAWEI_SINGLE_RUN_COMPLETE_WITH_NOTES':'INCOMPLETE_OR_EXCEPTION',checks,
  exportedAt:d.exportedAt,device:d.device,originalSha256:createHash('sha256').update(raw).digest('hex'),sourceSha:d.sourceSha,
  requestId:m.requestId,originalSampling:m,preparation:d.sample?.preparation,diagnosticIntervals:a?.intervals,
  query:(a?.queries??[]).map(q=>({requestId:q.requestId,revision:q.revision,sendToReceiveMs:delta(q.receiveAt,q.sendAt),receiveToHandledMs:delta(q.handledAt,q.receiveAt)})),
  startup:{clock:r?.clock,importStartAt:round(first('app-import')),importCompleteAt:round(first('app-import-complete')),
    firstConnectedAt:round(events.find(e=>e.kind==='connection-state'&&e.connection==='CONNECTED')?.at),
    firstMapDomAt:round(first('map-dom-ready')),firstInteractiveAt:round(events.find(e=>e.kind==='operation-block-state'&&e.interactive)?.at),
    stage:d.diagnostic?.stage,imageJobs:d.diagnostic?.startup?.imageJobs,resourceCount:resources.length,
    slowestResources:[...resources].sort((a,b)=>b.duration-a.duration).slice(0,5).map(e=>({...e,responseBodyWindowMs:delta(e.responseEnd,e.responseStart)}))},
  boundaryPhase:{cutoff,deviceAttribution:'After desktop capture; metadata has no device identity. Corroboration by phase only, not wall-clock subtraction.',loginSuccesses:decisions.filter(e=>e.reason==='login-success').length,
    authorizedHttp200:decisions.filter(e=>e.kind==='http'&&e.reason==='authorized-upstream'&&e.status===200).length,
    authorizedWs101:decisions.filter(e=>e.kind==='ws'&&e.reason==='authorized-upstream'&&e.status===101).length,
    exceptions:decisions.filter(e=>e.status>=400),bad},
  notes:{rawInputEvents:inputs.length,unsubmittedEarlyInputs:inputs.filter(e=>Number.isFinite(t.inputAt)&&e.at<t.inputAt-1),
    earlyInput:'Earlier capture without send; consistent with five-second foreground guard. Only submitted input is timed.',
    unknown404:'Two phase HTTP 404 paths are redacted as <other>; exact purpose unknown. Not asserted to be favicon or successful resources.',
    dropped:r?.dropped,textBackup:'Not independently verified; actual JSON received.'},
  limits:['One control run; no stable performance, P95 or improvement conclusion. Huawei model and OS/browser versions missing.',
    'rAF is frame opportunity, not visible paint. Server compute/build missing; no mixed-clock subtraction.',
    'Map DOM observation is not full visible paint. Resource response spans do not isolate network, tunnel, browser scheduling or decode.',
    'Successful startup does not explain the prior failure. Boundary metadata does not contain action frames.']};
console.log(JSON.stringify(report,null,2));
if(!Object.values(checks).every(Boolean))process.exitCode=1;
