import {canDecodeState,decodeStateEnvelope} from '/transport/stateCodec.mjs';
import {decodeView,decodeSharedView} from '/transport/view.mjs';
import {patch,canonical} from '/sync.mjs';
const campaignMode=new URLSearchParams(location.search).get('campaign');
const scoped=p=>campaignMode?p+'?campaign='+encodeURIComponent(campaignMode):p;
export class Client extends EventTarget{
 constructor(seat){super();this.seat=seat;this.side=null;this.view=null;this.version=0;this.epoch=null;this.socket=null;this.connected=false;this.selectionId=0;this.selected=null;this.nextSeq=1;this.history=[];this.pings=new Map();this.pending=new Map();this.metrics=null;this.events=[];this.viewTimes=[];this.profile='clean';this.retryTimer=null;this.stream=0;this.resyncPending=false;this.lastViewAt=null;this.updateIntervalMs=null;this.serverQueueMs=null;
  try{const saved=JSON.parse(sessionStorage.getItem(`grand-play-wire:${campaignMode??'legacy'}:${seat}`)||'null');if(saved){this.savedInstance=saved.instanceId;this.savedEra=saved.era;this.nextSeq=saved.nextSeq;this.pending=new Map(saved.pending.map(r=>[r.command.requestId,r]));}}catch{}
 }
 event(type,detail={}){const {payload,...logDetail}=detail;this.events.push({...logDetail,type,at:performance.now()});if(this.events.length>3000)this.events.shift();this.dispatchEvent(new CustomEvent(type,{detail}));this.dispatchEvent(new Event('change'));}
 persist(){sessionStorage.setItem(`grand-play-wire:${campaignMode??'legacy'}:${this.seat}`,JSON.stringify({instanceId:this.instanceId,era:this.era,nextSeq:this.nextSeq,pending:[...this.pending.values()]}));}
 async start(){const r=await fetch(scoped(`/${this.seat}/session`),{method:'POST',headers:document.querySelector('meta[name=grand-release]')?{'X-Grand-Protocol':document.querySelector('meta[name=grand-release]').content==='territory-1'?'GRAND-RELEASE-TERRITORY-1':'GRAND-RELEASE-1'}:{}});const d=await r.json();if(!r.ok)throw Error(d.error);this.side=d.side;this.instanceId=d.instanceId;const changed=this.era&&this.era!==d.era||this.savedEra&&this.savedEra!==d.era;this.era=d.era;
  if(changed||this.savedInstance&&this.savedInstance!==d.instanceId){for(const row of this.pending.values())this.history.push({...row,status:'unknown',reason:'INSTANCE_CHANGED_NO_AUTOMATIC_REPLAY'});this.pending.clear();this.nextSeq=1;this.epoch=null;this.version=0;this.view=null;this.savedInstance=d.instanceId;this.savedEra=d.era;this.event('instance-reset');}this.connect();}
 connect(){clearTimeout(this.retryTimer);const socket=new WebSocket(`${location.origin.replace('http','ws')}${scoped('/'+this.seat+'/ws')}`);this.socket=socket;this.connected=false;
  let stateTail=Promise.resolve(),stateQueued=0;socket.onopen=()=>socket.send(JSON.stringify({type:'HELLO',stateGzip:canDecodeState()}));
  socket.onmessage=e=>{if(socket!==this.socket)return;try{const m=JSON.parse(e.data);if(m.type==='STATE'||m.type==='STATE_GZIP'){if(m.instanceId!==this.instanceId||m.connectionEpoch!==this.epoch)return;if(++stateQueued>8){socket.close(1013,'STATE_DECODE_BACKPRESSURE');return;}stateTail=stateTail.then(async()=>{if(socket!==this.socket)return;const d=await decodeStateEnvelope(m);if(socket===this.socket)this.receive(d.message,d);}).catch(error=>{if(socket===this.socket){this.event('error',{reason:error.message});this.resync();}}).finally(()=>stateQueued--);}else this.receive(m);}catch(error){this.event('error',{reason:error.message});this.resync();}};
  socket.onclose=event=>{if(socket!==this.socket)return;this.connected=false;if(event.reason==='REPLACED'){this.disposed=true;this.event('replaced');}this.event('disconnected');for(const row of this.pending.values())if(row.status==='pending')row.status='unknown';this.persist();if(!this.disposed)this.retryTimer=setTimeout(()=>void this.start().catch(error=>{this.event('error',{reason:error.message});if(!this.disposed)this.retryTimer=setTimeout(()=>this.connect(),1200);}),1200);};
 }
 send(data){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify({...data,instanceId:this.instanceId,connectionEpoch:this.epoch}));return true;}
 receive(m,transport={}){if(m.instanceId!==this.instanceId)return;
  if(m.type==='WELCOME'){if(this.epoch!==null&&m.connectionEpoch<=this.epoch)return;this.epoch=m.connectionEpoch;this.version=0;this.stream=0;this.resyncPending=false;this.connected=true;this.stateEncoding=m.stateEncoding??'json';this.nextSeq=Math.max(this.nextSeq,m.nextCommandSeq);this.event('connected');
   if(this.profile!=='clean')this.send({type:'PROFILE',name:this.profile});if(this.selected)this.select(this.selected);
   for(const row of [...this.pending.values()].filter(r=>r.command.commandSeq!==null).sort((a,b)=>a.command.commandSeq-b.command.commandSeq)){this.send({type:'COMMAND',command:row.command});this.event('retry',{requestId:row.command.requestId});}return;
  }
  if(m.connectionEpoch!==this.epoch)return;
  if(m.type==='STATE'){
   const stream=m.stream??1;if(stream<this.stream||this.resyncPending&&!m.full)return;if(stream>this.stream&&!m.full){this.resync();return;}
   if(m.viewVersion<=this.version)return;
   if(!m.full&&m.baseViewVersion!==this.version){this.event('resync',{reason:'BASE_MISMATCH'});this.resync();return;}
   const applyStart=performance.now();const next=m.full??patch(this.view,m.change);if(this.view&&next.revision<this.view.revision){this.event('resync',{reason:'REVISION_REGRESSION'});this.resync();return;}
   this.view=next;this.version=m.viewVersion;this.stream=stream;this.resyncPending=false;const at=performance.now();this.updateIntervalMs=this.lastViewAt===null?null:at-this.lastViewAt;this.lastViewAt=at;this.serverQueueMs=m.serverQueueMs??null;this.viewTimes.push({revision:next.revision,at});if(this.viewTimes.length>256)this.viewTimes.shift();
   this.event('view',{revision:next.revision,stream,viewVersion:m.viewVersion,baseViewVersion:m.baseViewVersion,full:!!m.full,updateIntervalMs:this.updateIntervalMs,serverQueueMs:this.serverQueueMs,applyMs:performance.now()-applyStart,bytes:new TextEncoder().encode(JSON.stringify(m)).length,wireBytes:transport.wireBytes??null,decodeMs:transport.decodeMs??0});
   for(const result of m.results??[])this.result(result);
   for(const row of [...this.pending.values()])this.complete(row);this.send({type:'VIEW_ACK',stream:this.stream,viewVersion:this.version});this.pump();this.persist();this.event('ready');return;
  }
  if(m.type==='QUERY_RESULT'){this.event('query',m);return;}
  if(m.type==='RESULT'){this.result(m.result);return;}
  if(m.type==='PONG'){const at=this.pings.get(m.id);if(at!==undefined){this.pings.delete(m.id);this.event('ping',{elapsedMs:performance.now()-at});}return;}
  if(m.type==='PROFILE'){this.event('profile',{name:m.name,profile:m.profile});return;}
  if(m.type==='METRICS'){this.metrics=m.metrics;this.event('metrics',m.metrics);return;}
  if(m.type==='ERROR'){this.event('error',{requestId:m.requestId,reason:m.reason});const row=this.pending.get(m.requestId);if(row){row.status='unknown';row.reason=m.reason;this.persist();}return;}
 }
 result(result){const row=this.pending.get(result.requestId);if(row&&row.command.commandSeq===result.commandSeq){row.result=result;row.resultAt??=performance.now();row.status=result.status==='APPLIED'?'accepted':'rejected';this.event('result',{requestId:result.requestId,status:result.status,reason:result.reason});this.complete(row);this.persist();}
  this.send({type:'RESULT_ACK',ids:[result.requestId]});
 }
 complete(row){if(row.status==='rejected'||row.status==='accepted'&&this.view?.revision>=row.result.acceptedRevision){row.viewAvailableAt=this.viewTimes.find(t=>t.revision>=row.result.acceptedRevision)?.at??null;row.completedAt=performance.now();row.status=row.result.status==='APPLIED'?'applied':'rejected';this.history.push(structuredClone(row));if(this.history.length>128)this.history.shift();this.pending.delete(row.command.requestId);this.event('completed',{requestId:row.command.requestId,status:row.status});this.pump();}}
 resync(){if(this.resyncPending)return;this.resyncPending=true;this.send({type:'RESYNC',stream:this.stream});}
 select(unitId){this.selected=unitId;this.event('selection',{unitId});this.send({type:'SELECT',unitId,id:++this.selectionId});}
 submit(kind,payload,keys,dependencies={}){for(const row of this.pending.values())if(row.command.kind===kind&&canonical(row.command.payload)===canonical(payload)){this.event('duplicate-click',{requestId:row.command.requestId});return row.command.requestId;}if(!this.view||this.pending.size>=16)throw Error('本地待确认队列已满或尚未同步');const at=performance.now(),command={instanceId:this.instanceId,requestId:crypto.randomUUID(),commandSeq:null,kind,payload,era:this.era,dependencies};
  const row={command,keys,status:'queued',inputAt:at,feedbackAt:performance.now()};this.pending.set(command.requestId,row);this.event('feedback',{requestId:command.requestId});this.persist();this.pump();return command.requestId;
 }
 pump(){if(!this.connected||this.version===0)return;for(const row of this.pending.values()){
  if(row.status!=='queued')continue;const blocked=[...this.pending.values()].some(other=>other!==row&&other.command.commandSeq!==null&&other.keys.some(k=>row.keys.includes(k)||k==='all'||row.keys.includes('all')));
  if(blocked)continue;
  // Queued plans are never silently rebased to a changed unit/resource state.
  row.command.commandSeq=this.nextSeq++;row.status='pending';row.sendAt=performance.now();this.persist();this.send({type:'COMMAND',command:row.command});this.event('command-sent',{requestId:row.command.requestId});
 }}
 setProfile(name){this.profile=name;this.send({type:'PROFILE',name});}
 ping(){const id=crypto.randomUUID();this.pings.set(id,performance.now());this.send({type:'PING',id});}
 disconnect(){this.socket?.close(1000,'manual-test');}
 document(shared=false){return this.view?(shared?decodeSharedView(this.view.document):decodeView(this.view.document)):null;}
 dispose(){this.disposed=true;clearTimeout(this.retryTimer);const socket=this.socket;this.socket=null;socket?.close();}
 export(){return {schema:'MP022-browser-v1',mode:'GRAND_PLAY_SHARED_CLOCK',instanceId:this.instanceId,side:this.side,profile:this.profile,history:this.history,pending:[...this.pending.values()],events:this.events,metrics:this.metrics,limits:['Client monotonic timestamps are not server timestamps.','feedbackAt measures local handler feedback; rAF is only a frame opportunity.','Injected local test, not Huawei or public performance evidence.']};}
}
