import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {queryMetrics} from '../mp020/analyze.mjs';
export function joinRecord(client,rows){
 const same=rows.filter(r=>r.instanceId===client.instanceId),queries=(client.queries??[]).map(q=>{
  const matching=same.filter(r=>r.requestId===q.requestId&&r.revision===q.revision);
  const serverDuplicateStage=matching.length!==new Set(matching.map(r=>r.stage)).size;
  const timing=queryMetrics(q.requestId,client.events??[],serverDuplicateStage?[]:matching);
  const missingServerStages=['query-dispatch','query-build','query-serialize','query-send','query-write'].filter(stage=>!matching.some(r=>r.stage===stage));
  const complete=!serverDuplicateStage&&!missingServerStages.length&&timing.server.writeError===false&&Number.isFinite(timing.client.receiveToCanSubmitMs)&&timing.unknownResidualMs>=0;
  return {...q,timing,missingServerStages,serverDuplicateStage,correlationStatus:serverDuplicateStage?'ambiguous':complete?'complete':'incomplete'};
 });
 return {schema:'MP021-joined-v1',instanceId:client.instanceId,index:client.index,purpose:client.purpose,classification:client.classification,sourceSha:client.sourceSha,packageTreeSha256:client.packageTreeSha256,device:client.device,queries,deviceSamplingConfirmed:false,
  limits:['Client and server clocks are independent; only durations compared.','write callback is local compression/write completion, not client receipt.','Residual includes transports, queues and client scheduling; NOT pure RTT.','Input is evidence, not a claim of real-device execution; review device provenance separately.']};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const [client,server,out]=process.argv.slice(2);if(!out)throw Error('Usage: node scripts/mp021/join.mjs CLIENT.json SERVER.jsonl NEW-OUTPUT.json');
 const rows=readFileSync(server,'utf8').trim().split(/\r?\n/).filter(Boolean).map(s=>JSON.parse(s));
 writeFileSync(out,JSON.stringify(joinRecord(JSON.parse(readFileSync(client,'utf8')),rows),null,2)+'\n',{flag:'wx'});
}
