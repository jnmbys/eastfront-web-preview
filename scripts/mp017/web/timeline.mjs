import {Timeline} from './trace-base.mjs';
export class ComparisonTimeline extends Timeline {
 constructor(){super();this.gateTimes=new Map();this.renders=[];}
 gates(scope,revision,at,flags,selectionOnly=false){
  const key=this.key(scope,revision),row=this.gateTimes.get(key)??{canSelectAt:null,legalOptionsReadyAt:null,canSubmitAt:null};
  if(flags.canSelect)row.canSelectAt??=at;
  if(!selectionOnly){if(flags.legalOptionsReady)row.legalOptionsReadyAt??=at;if(flags.canSubmit)row.canSubmitAt??=at;}
  this.gateTimes.set(key,row);this.trim(this.gateTimes);
  this.event('interaction-gates',at,{revision,...flags,selectionOnly});
 }
 render(scope,revision,sequence,kind,startAt,endAt){this.renders.push({scope,revision,sequence,kind,startAt,endAt});if(this.renders.length>256)this.renders.shift();}
 report(){const base=super.report(),delta=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)?Math.round((a-b)*1000)/1000:null;
  for(const a of base.actions){const internal=this.actions.get(a.requestId),key=this.key(internal.scope,a.acceptedRevision),g=a.completionCount?this.gateTimes.get(key):null;
   Object.assign(a.times,{canSelectAt:g?.canSelectAt??null,legalOptionsReadyAt:g?.legalOptionsReadyAt??null,canSubmitAt:g?.canSubmitAt??null});
   a.milestones={authorityAppliedMs:delta(a.times.appliedAt,a.times.inputAt),canSelectMs:delta(a.times.canSelectAt,a.times.inputAt),legalOptionsReadyMs:delta(a.times.legalOptionsReadyAt,a.times.inputAt),canSubmitMs:delta(a.times.canSubmitAt,a.times.inputAt)};
   a.renders=this.renders.filter(r=>r.scope===internal.scope&&r.revision===a.acceptedRevision&&r.startAt>=a.times.inputAt).map(({scope,...r})=>({...r,durationMs:delta(r.endAt,r.startAt)}));
   a.missing=Object.entries(a.times).filter(([,v])=>v===null).map(([k])=>k);
  }
  return {...base,definition:'MP017 common observer: exact R1 action completion; unchanged canSelect and interactive; legalOptionsReady from current revision+draft key. Submit sampled after projection scheduling, never at transient pre-render readiness.',limits:[...base.limits,'render interval is synchronous onChange view/query/resync subscriber work, not paint','diagnostics add observer overhead; scheduling equivalence does not prove zero overhead']};
 }
}
