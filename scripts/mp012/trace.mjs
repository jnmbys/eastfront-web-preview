// Metadata only, one iframe performance.now() clock. Never accepts game payloads.
export class Timeline {
  constructor(){this.actions=new Map();this.snapshots=new Map();this.ready=new Map();this.receives=new Map();this.queries=new Map();this.events=[];this.dropped=0;}
  event(kind,at,fields={}){this.events.push({kind,at,...fields});if(this.events.length>2048){this.events.shift();this.dropped++;}}
  trim(map){if(map.size>128)map.delete(map.keys().next().value);}
  key(scope,revision){return JSON.stringify([scope,revision]);}
  submit(id,scope,baseRevision,inputAt,sendAt){if(this.actions.has(id))return;this.actions.set(id,{requestId:id,scope,baseRevision,inputAt,sendAt,acceptedRevision:null,ackAt:null,feedbackOpportunityAt:null,completionCount:0});this.trim(this.actions);}
  ack(id,revision,at){const a=this.actions.get(id);if(!a||!Number.isInteger(revision)||revision<=a.baseRevision||a.acceptedRevision!==null&&a.acceptedRevision!==revision)return;a.acceptedRevision=revision;a.ackAt??=at;this.complete(a);}
  applied(scope,revision,sequence,at){const key=this.key(scope,revision);if(!this.snapshots.has(key))this.snapshots.set(key,{revision,sequence,at});this.trim(this.snapshots);for(const a of this.actions.values())this.complete(a);}
  interactive(scope,revision,at){const key=this.key(scope,revision);if(this.snapshots.has(key)&&!this.ready.has(key))this.ready.set(key,at);this.trim(this.ready);}
  complete(a){if(a.acceptedRevision!==null&&this.snapshots.has(this.key(a.scope,a.acceptedRevision))&&!a.completionCount)a.completionCount=1;}
  receive(scope,d){this.receives.set(JSON.stringify([scope,d.sequence,d.type]),d);this.trim(this.receives);}
  query(id,scope,revision,sendAt){this.queries.set(id,{requestId:id,scope,revision,sendAt,receiveAt:null,handledAt:null});this.trim(this.queries);}
  queryReceived(id,at,handledAt){const q=this.queries.get(id);if(q){q.receiveAt??=at;q.handledAt??=handledAt;}}
  feedback(id,at){const a=this.actions.get(id);if(a)a.feedbackOpportunityAt??=at;}
  report(){
    const delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)*1000)/1000:null;
    const actions=[...this.actions.values()].map(a=>{
      const key=this.key(a.scope,a.acceptedRevision),s=a.acceptedRevision===null?null:this.snapshots.get(key),r=s?this.receives.get(JSON.stringify([a.scope,s.sequence,'PLAYER_VIEW_SNAPSHOT'])):null;
      const times={inputAt:a.inputAt,sendAt:a.sendAt,feedbackOpportunityAt:a.feedbackOpportunityAt,ackAt:a.ackAt,snapshotReceiveAt:r?.callbackAt??null,parsedAt:r?.parsedAt??null,decodedAt:r?.decodedAt??null,appliedAt:s?.at??null,handlerEndAt:r?.appliedAt??null,interactiveAt:s?this.ready.get(key)??null:null};
      return {requestId:a.requestId,baseRevision:a.baseRevision,acceptedRevision:a.acceptedRevision,appliedSequence:s?.sequence??null,completionCount:a.completionCount,times,
        intervals:{inputToSend:delta(times.sendAt,times.inputAt),sendToAck:delta(times.ackAt,times.sendAt),ackToSnapshotCallback:delta(times.snapshotReceiveAt,times.ackAt),parse:delta(times.parsedAt,times.snapshotReceiveAt),decode:delta(times.decodedAt,times.parsedAt),decodedToApplied:delta(times.appliedAt,times.decodedAt),appliedToHandlerEnd:delta(times.handlerEndAt,times.appliedAt),appliedToInteractive:delta(times.interactiveAt,times.appliedAt),inputToInteractive:delta(times.interactiveAt,times.inputAt)},
        queries:[...this.queries.values()].filter(q=>q.scope===a.scope&&q.revision===a.acceptedRevision&&q.sendAt>=a.sendAt).map(({scope,...q})=>q),
        missing:Object.entries(times).filter(([,v])=>v===null).map(([k])=>k),serverComputeMs:null,snapshotBuildMs:null,actualVisibleFeedbackMs:null};
    });
    return {clock:'iframe performance.now; ms since its own navigation; never subtract server/other-frame clocks',actions,events:this.events,dropped:this.dropped,
      limits:['rAF is a frame opportunity, not paint','ACK-to-callback combines unknown server/network/event-loop wait','handlerEnd includes synchronous subscribers/UI work, not paint','negative ACK-to-callback is legal for late ACK','server compute/build and actual visible feedback remain missing']};
  }
}
export function safePath(value,base,allowed){try{const u=new URL(value,base),root=new URL(base);if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname))return null;const p=u.pathname.slice(root.pathname.length);return allowed.has(p)?p:null;}catch{return null;}}
export function assetPath(value,base,allowed){const exact=safePath(value,base,allowed);if(exact)return exact;const suffix=String(value).split(/[?#]/)[0].replace(/^\.\//,'');if(!suffix||suffix.includes('..')||suffix.includes(':'))return null;const matches=[...allowed].filter(p=>p.endsWith('/'+suffix));return matches.length===1?matches[0]:null;}
export function safeError(error,base,allowed){
  const name=['Error','TypeError','SyntaxError','RangeError','ReferenceError','SecurityError','AbortError','InvalidStateError','QuotaExceededError','EncodingError','NetworkError'].includes(error?.name)?error.name:'UnknownError';
  const message=String(error?.message??''),category=/timeout|timed out/i.test(message)?'timeout':/decode|bitmap|image/i.test(message)?'image-or-decode':/fetch|network|load/i.test(message)?'resource-or-network':'unclassified';
  const frames=[];for(const line of String(error?.stack??'').split('\n').slice(1,15)){const m=line.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);if(m){const path=safePath(m[1],base,allowed);if(path)frames.push({path,line:Number(m[2]),column:Number(m[3])});}}
  return {name,category,frames,message:'omitted (may contain credentials or game data)'};
}
