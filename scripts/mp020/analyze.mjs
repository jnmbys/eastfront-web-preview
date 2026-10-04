// Durations only are combined across processes; absolute origins are never aligned.
export function queryMetrics(requestId,client,server){
 const send=client.find(r=>r.stage==='send'&&r.type==='QUERY_MATCH'&&r.requestId===requestId);
 const receive=client.find(r=>r.event==='transport'&&r.type==='MATCH_QUERY'&&r.requestId===requestId);
 const applied=client.find(r=>r.type==='query-applied'&&r.requestId===requestId);
 const stage=name=>server.find(r=>r.requestId===requestId&&r.stage===name);
 const dispatch=stage('query-dispatch'),handoff=stage('query-send'),write=stage('query-write');
 const duration=r=>r?r.endAt-r.startAt:null;
 const wait=send&&receive?receive.callbackAt-send.at:null;
 const service=dispatch&&handoff?handoff.startAt-dispatch.startAt:null;
 return {requestId,revision:receive?.revision??null,client:{sendAt:send?.at??null,receiveAt:receive?.callbackAt??null,parsedAt:receive?.parsedAt??null,legalOptionsAppliedAt:applied?.at??null,canSubmitAt:applied?.canSubmit?applied.at:null,
  sendToReceiveMs:wait,parseMs:receive?receive.parsedAt-receive.callbackAt:null,receiveToLegalOptionsMs:receive&&applied?applied.at-receive.callbackAt:null,receiveToCanSubmitMs:receive&&applied?.canSubmit?applied.at-receive.callbackAt:null},
 server:{receivedAt:dispatch?.startAt??null,startedAt:dispatch?.endAt??null,queuedAt:null,applicationQueue:'none (synchronous dispatch); pre-callback queue unknown',dispatchMs:duration(dispatch),queryModelMs:duration(stage('query-model')),forcedMs:duration(stage('query-forced')),summaryMs:duration(stage('query-summary')),queryBuildMs:duration(stage('query-build')),serializationMs:duration(stage('query-serialize')),handoffAt:handoff?.startAt??null,receiveToHandoffMs:service,writeCallbackMs:duration(write),serializedBytes:handoff?.bytes??null,bufferedBefore:handoff?.bufferedBytes??null,writeError:write?.writeError??null},
 unknownResidualMs:wait!==null&&service!==null?wait-service:null,
 residualMeaning:'client interval minus server-local receive-to-handoff duration; includes both transports, pre-callback queues, compression/write wait, client scheduling and fixture delay if present; NOT network RTT'};
}
