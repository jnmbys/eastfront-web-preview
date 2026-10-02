// No game payload, DOM text, identity token, coordinate or unit data is retained.
// Same source and schema in both packages; all times use the iframe monotonic clock.
export class Trial {
 constructor({inputAt,requestId,baseRevision,scope,format,compression='unknown'}){
  this.inputAt=inputAt;this.id=requestId;this.base=baseRevision;this.scope=scope;this.format=format;this.compression=compression;
  this.sentAt=null;this.ackAt=null;this.accepted=null;this.applied=new Map();this.ready=new Map();this.feedback=null;this.flags=new Set();this.rejected=false;this.resyncs=0;this.queries=0;this.clicks=1;this.submits=1;
 }
 sent(at){this.sentAt=at;}
 ack(id,revision,at){if(id!==this.id||!Number.isInteger(revision)||revision<=this.base)return;if(this.accepted!==null&&revision!==this.accepted)return;this.accepted=revision;this.ackAt??=at;}
 apply(scope,revision,sequence,at){if(scope!==this.scope)return;if(!this.applied.has(revision))this.applied.set(revision,{at,sequence});}
 interactive(revision,at){if(this.applied.has(revision)&&!this.ready.has(revision))this.ready.set(revision,at);}
 frame(kind,at){if(!this.feedback)this.feedback={kind,at};}
 result(){
  const applied=this.applied.get(this.accepted),ready=this.ready.get(this.accepted),delta=t=>t==null?null:Math.round((t-this.inputAt)*1000)/1000;
  return {schema:'MP010-v1',requestId:this.id,snapshotFormat:this.format,compression:this.compression,baseRevision:this.base,acceptedRevision:this.accepted,appliedSequence:applied?.sequence??null,
   sendMs:delta(this.sentAt),ackMs:delta(this.ackAt),authorizedAppliedMs:delta(applied?.at),interactiveMs:delta(ready),
   feedbackFrameOpportunityMs:delta(this.feedback?.at),feedbackProxyKind:this.feedback?.kind??null,
   visibleFeedbackMs:null,visibleFeedbackMethod:'unreviewed-video',rejected:this.rejected,resyncCount:this.resyncs,queryCount:this.queries,confirmClicks:this.clicks,submitCount:this.submits,flags:[...this.flags]};
 }
}
