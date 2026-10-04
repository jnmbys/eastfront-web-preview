/** Metadata only, per live connection, opt-in. No gameplay values or payloads. */
export interface LatencyRow {
  stage:'receive'|'request'|'validate'|'apply-intent'|'core-apply'|'snapshot-build'|'snapshot-encode'|'query-build'|'query-dispatch'|'query-model'|'query-forced'|'query-summary'|'query-serialize'|'query-send'|'query-write';
  startAt:number;endAt:number;serverTimestamp:number;
  requestId?:string|null;revision?:number;sequence?:number;type?:string;
  bytes?:number;bufferedBytes?:number;writeError?:boolean;
}
export interface LatencySink {
  active(id:string):boolean;
  latency(id:string,row:LatencyRow):void;
}
export function beginSpan(sink:LatencySink|undefined,id:string):number|undefined {
  try{return sink?.active(id)?performance.now():undefined;}catch{return undefined;}
}
export function recordSpan(sink:LatencySink|undefined,id:string,row:LatencyRow):void {
  try{sink?.latency(id,row);}catch{/* Diagnostics cannot affect authority. */}
}
export function endSpan(sink:LatencySink|undefined,id:string,start:number|undefined,
  stage:LatencyRow['stage'],meta:Pick<LatencyRow,'requestId'|'revision'|'sequence'|'type'>={}):void {
  if(start===undefined)return;
  recordSpan(sink,id,{stage,startAt:start,endAt:performance.now(),serverTimestamp:performance.timeOrigin+start,...meta});
}
