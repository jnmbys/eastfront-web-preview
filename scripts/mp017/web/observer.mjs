// Identical wrapper for both packages. No queries, actions, timers or gate writes.
export function installObserver({NetworkPlayerSession,LobbyClient,timeline,queryDraft,target=window,now=()=>performance.now(),inputAt=()=>null}){
 let lastSession=null,context=null;const sendTimes=new Map(),scopes=new Map(),restore=[];
 const scope=s=>JSON.stringify([s.client.state.snapshot?.matchId,s.model.viewerControllerId]);
 const safe=fn=>{try{return fn();}catch{timeline.dropped++;}};
 const emit=(kind,fields={})=>safe(()=>timeline.event(kind,now(),fields));
 const observe=(s,selectionOnly=false)=>safe(()=>timeline.gates(scope(s),s.matchRevision,now(),{canSelect:s.canSelect,legalOptionsReady:!s.needsProjection()||s.modelKey===s.key(safeDraft(s)),canSubmit:s.interactive,interactive:s.interactive,syncing:!!s.syncing,queryQueued:!!s.queued,queryInFlight:!!s.flight},selectionOnly));
 // Existing key() accepts the same serialized QueryDraft; use the installed
 // queryDraft helper passed by entry, never infer legality or hidden state.
 function safeDraft(s){return queryDraft(s.presentation);}
 const wrap=(proto,key,fn)=>{const original=proto[key];proto[key]=fn(original);restore.push(()=>{proto[key]=original;});};
 const action=e=>safe(()=>{const d=e.detail;
  if(d.stage==='send'){sendTimes.set(d.requestId,d.at);if(sendTimes.size>128)sendTimes.delete(sendTimes.keys().next().value);emit('send',{requestId:d.requestId,type:d.type,sendAt:d.at});
   if(d.type==='SUBMIT_ACTION'&&context)timeline.submit(d.requestId,context.scope,context.revision,context.inputAt,d.at);
  }
  if(d.stage==='snapshot-applied'){const a=timeline.actions.get(d.requestId);if(a){timeline.applied(a.scope,d.revision,d.sequence,d.at);emit('authoritative-completion',{requestId:d.requestId,revision:d.revision,sequence:d.sequence,actualAppliedAt:d.at});}}
 });
 target.addEventListener('eastfront-action-timing',action);
 wrap(NetworkPlayerSession.prototype,'submit',original=>function(action){lastSession=this;const previous=context,at=inputAt();context=at===null?null:{scope:scope(this),revision:this.matchRevision,inputAt:at};try{return original.call(this,action);}finally{context=previous;observe(this);}});
 wrap(NetworkPlayerSession.prototype,'requestProjection',original=>function(...args){lastSession=this;try{return original.apply(this,args);}finally{observe(this);}});
 wrap(LobbyClient.prototype,'send',original=>function(type,payload){const id=original.call(this,type,payload);safe(()=>{if(id&&type==='QUERY_MATCH'&&lastSession?.client===this)timeline.query(id,scope(lastSession),payload.expectedRevision,sendTimes.get(id)??null);});return id;});
 wrap(NetworkPlayerSession.prototype,'receive',original=>function(m){lastSession=this;const before=this.serverSequence,wasSyncing=this.syncing,change=this.onChange;
  this.onChange=kind=>{const render=['view','query','resync'].includes(kind),at=now();if(render)observe(this,kind!=='query');
   try{return change.call(this,kind);}finally{if(render)safe(()=>timeline.render(scope(this),this.matchRevision,this.serverSequence,kind,at,now()));}};
  try{return original.call(this,m);}finally{this.onChange=change;
   if(m&&Number.isInteger(m.payload?.serverSequence)){scopes.set(`${m.messageType}/${m.payload.serverSequence}`,scope(this));if(scopes.size>128)scopes.delete(scopes.keys().next().value);}
   safe(()=>{if(m?.messageType==='ACTION_ACCEPTED'&&!wasSyncing&&before!==this.serverSequence&&this.serverSequence===m.payload.serverSequence)timeline.ack(m.requestId,m.payload.acceptedRevision,now());
   if(this.interactive)timeline.interactive(scope(this),this.matchRevision,now());});observe(this);
  }
 });
 const receive=e=>safe(()=>{const d=e.detail,s=scopes.get(`${d.type}/${d.sequence}`);if(s)timeline.receive(s,d);if(d.type==='MATCH_QUERY')timeline.queryReceived(d.requestId,d.callbackAt,d.appliedAt);emit('receive',{type:d.type,requestId:d.requestId,revision:d.revision??null,sequence:d.sequence??null,callbackAt:d.callbackAt,parsedAt:d.parsedAt,decodedAt:d.decodedAt,handlerEndAt:d.appliedAt,outcome:d.outcome});});
 target.addEventListener('eastfront-transport-timing',receive);
 return ()=>{restore.reverse().forEach(f=>f());target.removeEventListener('eastfront-action-timing',action);target.removeEventListener('eastfront-transport-timing',receive);};
}
