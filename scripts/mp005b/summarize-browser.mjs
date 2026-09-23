import {readFileSync,writeFileSync} from 'node:fs';
const dir='evidence/mp-005b/';
const stats=a=>{const x=[...a].sort((a,b)=>a-b),n=x.length;return {n,median:n?(x[(n-1)>>1]+x[n>>1])/2:null,max:n?x[n-1]:null};};
const result={environment:{kind:'Cloud Chrome real browser, public Render WSS',viewport:'1363x936, DPR 1',models:'Auto',animation:'Normal',zoom:'100%',network:'same cloud browser/path, no simulated delay; external variation uncontrolled',order:'full then compact, separate matches, same first 10 Soviet unit/plain-card sequence',lods:'all three complete on both clients before each batch',cache:'HTTP cache not controlled; initialization excluded; fresh per-page surface caches fully built'},groups:{},boundaries:['UTF-8 JSON sizes, not WebSocket/TLS frame sizes','Native callbacks include browser message scheduling','Controls-ready is a microtask DOM observation, not pixels','Nested decode/apply/render timings are not added','No cross-clock subtraction between clients/server','Only one 10+10 comparison; not physical-device or regional-network proof']};
for(const mode of ['full','compact'])for(const role of ['actor','waiting']){
 const raw=JSON.parse(readFileSync(dir+`mp005b-${mode}-${role}.json`));
 const snapshots=raw.packets.filter(p=>p.type==='PLAYER_VIEW_SNAPSHOT'&&!p.resync&&p.revision>=1&&p.revision<=10);
 if(snapshots.length!==10||snapshots.some((p,i)=>p.revision!==i+1||p.appliedRevision!==p.revision||p.hiddenEnemyCount!==0))throw Error('Invalid revision/privacy sample');
 const row={browser:raw.browser,format:[...new Set(snapshots.map(p=>p.format))],bytes:stats(snapshots.map(p=>p.bytes)),parseMs:stats(snapshots.map(p=>p.parseMs)),validateRebuildMs:stats(snapshots.map(p=>p.decodeMs)),applyMs:stats(snapshots.map(p=>p.applyMs)),queryCount:raw.packets.filter(p=>p.type==='QUERY_MATCH').length,resyncCount:raw.packets.filter(p=>p.type==='RESYNC_MATCH').length,revisionAndHiddenDeploymentCheck:'PASS'};
 let begin=snapshots[0].arrival,end=snapshots.at(-1).arrival+(snapshots.at(-1).applyMs??0);
 if(role==='actor'){
  const s=raw.submissions;if(s.length!==10||s.some((s,i)=>s.lods!==3||s.expectedRevision!==i||s.acceptedRevision!==i+1||s.appliedRevision!==i+1||s.snapshotSequence!==s.ackSequence+1||!s.controlsReady))throw Error('Action correlation failed');
  for(const [name,a,b] of [['submitAckMs','ackAt','sentAt'],['ackSnapshotMs','snapshotAt','ackAt'],['submitSnapshotMs','snapshotAt','sentAt'],['submitControlsMs','controlsAt','sentAt']])row[name]=stats(s.map(s=>s[a]-s[b]));
  begin=s[0].sentAt;end=s.at(-1).controlsAt;
  row.earlyControlsMs=stats(s.slice(0,5).map(s=>s.controlsAt-s.sentAt));row.lateControlsMs=stats(s.slice(5).map(s=>s.controlsAt-s.sentAt));
 }else row.latency='No submit/ACK in waiting recipient; no cross-client-clock estimate';
 row.longTasks=stats(raw.tasks.filter(t=>t.start<end&&t.start+t.ms>begin).map(t=>t.ms));
 row.observationWindowMs=end-begin;result.groups[mode+'-'+role]=row;
}
writeFileSync(dir+'browser-summary.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
