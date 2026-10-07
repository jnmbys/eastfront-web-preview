import {patch,canonical} from '/sync.mjs';
export class Client extends EventTarget{
 constructor(seat){super();this.seat=seat;this.side=null;this.view=null;this.version=0;this.epoch=null;this.socket=null;this.connected=false;this.selectionId=0;this.selected=null;this.nextSeq=1;this.history=[];this.pings=new Map();this.pending=new Map();this.metrics=null;this.events=[];this.viewTimes=[];this.profile='clean';this.retryTimer=null;
  try{const saved=JSON.parse(sessionStorage.getItem(`mp022:${seat}`)||'null');if(saved){this.savedInstance=saved.instanceId;this.nextSeq=saved.nextSeq;this.pending=new Map(saved.pending.map(r=>[r.command.requestId,r]));}}catch{}
 }
 event(type,detail={}){this.events.push({type,at:performance.now(),...detail});if(this.events.length>3000)this.events.shift();this.dispatchEvent(new CustomEvent(type,{detail}));this.dispatchEvent(new Event('change'));}
 persist(){sessionStorage.setItem(`mp022:${this.seat}`,JSON.stringify({instanceId:this.instanceId,nextSeq:this.nextSeq,pending:[...this.pending.values()]}));}
 async start(){const r=await fetch(`/${this.seat}/session`,{method:'POST'});const d=await r.json();if(!r.ok)throw Error(d.error);this.side=d.side;this.instanceId=d.instanceId;
  if(this.savedInstance&&this.savedInstance!==d.instanceId){for(const row of this.pending.values())this.history.push({...row,status:'unknown',reason:'INSTANCE_CHANGED_NO_AUTOMATIC_REPLAY'});this.pending.clear();this.nextSeq=1;this.event('instance-reset');}this.connect();}
 connect(){clearTimeout(this.retryTimer);const socket=new WebSocket(`${location.origin.replace('http','ws')}/${this.seat}/ws`);this.socket=socket;this.connected=false;
  socket.onopen=()=>socket.send(JSON.stringify({type:'HELLO'}));
  socket.onmessage=e=>{if(socket!==this.socket)return;try{this.receive(JSON.parse(e.data));}catch(error){this.event('error',{reason:error.message});this.send({type:'RESYNC'});}};
  socket.onclose=()=>{if(socket!==this.socket)return;this.connected=false;this.event('disconnected');for(const row of this.pending.values())if(row.status==='pending')row.status='unknown';this.persist();this.retryTimer=setTimeout(()=>this.connect(),1200);};
 }
 send(data){if(this.socket?.readyState!==1)return false;this.socket.send(JSON.stringify({...data,instanceId:this.instanceId,connectionEpoch:this.epoch}));return true;}
 receive(m){if(m.instanceId!==this.instanceId)return;
  if(m.type==='WELCOME'){if(this.epoch!==null&&m.connectionEpoch<=this.epoch)return;this.epoch=m.connectionEpoch;this.version=0;this.connected=true;this.nextSeq=Math.max(this.nextSeq,m.nextCommandSeq);this.event('connected');
   if(this.profile!=='clean')this.send({type:'PROFILE',name:this.profile});if(this.selected)this.select(this.selected);
   for(const row of [...this.pending.values()].filter(r=>r.command.commandSeq!==null).sort((a,b)=>a.command.commandSeq-b.command.commandSeq)){this.send({type:'COMMAND',command:row.command});this.event('retry',{requestId:row.command.requestId});}return;
  }
  if(m.connectionEpoch!==this.epoch)return;
  if(m.type==='STATE'){
   if(m.viewVersion<=this.version)return;
   if(!m.full&&m.baseViewVersion!==this.version){this.event('resync',{reason:'BASE_MISMATCH'});this.send({type:'RESYNC'});return;}
   const next=m.full??patch(this.view,m.change);if(this.view&&next.revision<this.view.revision){this.event('resync',{reason:'REVISION_REGRESSION'});this.send({type:'RESYNC'});return;}
   this.view=next;this.version=m.viewVersion;const at=performance.now();this.viewTimes.push({revision:next.revision,at});if(this.viewTimes.length>256)this.viewTimes.shift();
   this.event('view',{revision:next.revision,full:!!m.full,bytes:JSON.stringify(m).length});
   for(const result of m.results??[])this.result(result);
   for(const row of [...this.pending.values()])this.complete(row);this.send({type:'VIEW_ACK',viewVersion:this.version});this.pump();this.persist();this.event('ready');return;
  }
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
 select(unitId){this.selected=unitId;this.event('selection',{unitId});this.send({type:'SELECT',unitId,id:++this.selectionId});}
 submit(kind,payload,keys){for(const row of this.pending.values())if(row.command.kind===kind&&canonical(row.command.payload)===canonical(payload)){this.event('duplicate-click',{requestId:row.command.requestId});return row.command.requestId;}if(!this.view||this.pending.size>=16)throw Error('本地待确认队列已满或尚未同步');const at=performance.now(),command={instanceId:this.instanceId,requestId:crypto.randomUUID(),commandSeq:null,kind,payload,dependencies:{unit:this.view.stamps[payload.unitId],account:this.view.accountStamp,phase:`${this.view.turn}:${this.view.phase}`}};
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
 export(){return {schema:'MP022-browser-v1',mode:'CITY_REAL_INTERFACE',instanceId:this.instanceId,side:this.side,profile:this.profile,history:this.history,pending:[...this.pending.values()],events:this.events,metrics:this.metrics,limits:['Client monotonic timestamps are not server timestamps.','feedbackAt measures local handler feedback; rAF is only a frame opportunity.','Injected local test, not Huawei or public performance evidence.']};}
}
