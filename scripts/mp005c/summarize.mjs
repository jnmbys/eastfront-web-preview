import {readFileSync,writeFileSync} from 'node:fs';
const input=process.argv[2],output=process.argv[3];if(!input||!output)throw Error('Usage: node scripts/mp005c/summarize.mjs report.json summary.json');
const raw=JSON.parse(readFileSync(input)),rows=[];
const stats=a=>{const x=a.filter(Number.isFinite).sort((a,b)=>a-b),n=x.length;return {n,median:n?(x[(n-1)>>1]+x[n>>1])/2:null,max:n?x.at(-1):null};};
for(const s of raw.submissions){
 const connection=raw.connections.find(c=>c.messages.some(m=>m.requestId===s.requestId&&m.type==='ACTION_ACCEPTED'));
 const snap=connection?.messages.find(m=>m.type==='PLAYER_VIEW_SNAPSHOT'&&m.requestId===s.requestId&&m.revision===s.acceptedRevision&&m.sequence===s.ackSequence+1);
 if(!snap||!s.production||s.appliedRevision!==s.acceptedRevision||!s.controlsReady)throw Error('Incomplete/mismatched deployment sample');
 const ack=connection.server?.sends?.find(m=>m.type==='ACTION_ACCEPTED'&&m.requestId===s.requestId);
 const sent=connection.server?.sends?.find(m=>m.type==='PLAYER_VIEW_SNAPSHOT'&&m.matchRevision===s.acceptedRevision&&m.serverSequence===s.snapshotSequence);
 rows.push({requestId:s.requestId,acceptedRevision:s.acceptedRevision,appliedRevision:s.appliedRevision,sequence:s.snapshotSequence,format:snap.format,bytes:snap.bytes,
  clickSendMs:s.confirmAt===null?null:s.sentAt-s.confirmAt,sendAckMs:s.ackAt-s.sentAt,ackSnapshotMs:s.snapshotArrival-s.ackAt,sendSnapshotMs:s.snapshotArrival-s.sentAt,
  observerBeforeProductionMs:s.production.callbackAt-s.snapshotArrival,parseAndEnvelopeMs:s.production.parseAndEnvelopeMs,validateRebuildMs:s.production.validateRebuildMs,receiveNotifyMs:s.production.receiveNotifyMs,
  postReceiveControlsMs:s.controlsObservedAt-s.production.processedAt,sendControlsMs:s.controlsObservedAt-s.sentAt,
  serverAckSnapshotSendCallMs:ack&&sent?sent.sendAt-ack.sendAt:null,serverSerializeMs:sent?.serializeMs??null,serverBufferedBefore:sent?.bufferedBefore??null});
}
const metrics=Object.fromEntries(['bytes','clickSendMs','sendAckMs','ackSnapshotMs','sendSnapshotMs','observerBeforeProductionMs','parseAndEnvelopeMs','validateRebuildMs','receiveNotifyMs','postReceiveControlsMs','sendControlsMs','serverAckSnapshotSendCallMs','serverSerializeMs','serverBufferedBefore'].map(k=>[k,stats(rows.map(r=>r[k]))]));
const result={build:raw.build,browser:raw.browser,viewport:raw.viewport,entry:raw.entry,n:rows.length,connections:raw.connections.map(c=>({url:c.url,requestedFormat:c.requestedFormat,negotiatedFormat:c.negotiatedFormat,fallbackReason:c.fallbackReason??null,backend:c.server?.sourceCommit??null,queries:c.QUERY_MATCH??0,resyncs:c.RESYNC_MATCH??0})),metrics,samples:rows,boundaries:raw.boundaries};
writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
