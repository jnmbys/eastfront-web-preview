// Opt-in measurements only. Never pass a payload, token, unit or Action here.
export const transportTimingEnabled=typeof location!=='undefined'&&new URLSearchParams(location.search).get('transportDiagnostics')==='1';
export interface ReceiveTiming {
  type:string;requestId:string|null;revision?:number|undefined;sequence?:number|undefined;
  callbackAt:number;parsedAt:number;decodedAt:number;appliedAt:number;
  outcome:'processed'|'invalid-snapshot';
}
export function publishReceiveTiming(timing:ReceiveTiming):void {
  if(transportTimingEnabled&&typeof window!=='undefined')window.dispatchEvent(new CustomEvent('eastfront-transport-timing',{detail:timing}));
}
export interface ActionTiming {
  stage:'submit'|'send'|'ui'|'feedback-frame'|'ack'|'snapshot-applied';at:number;requestId:string|null;
  revision?:number;sequence?:number;type?:string;
  ready?:boolean;interactive?:boolean;syncing?:boolean;
}
/** Independent event keeps the MP-005C receive contract unchanged. */
export function publishActionTiming(timing:ActionTiming):void {
  if(!transportTimingEnabled||typeof window==='undefined')return;
  try{window.dispatchEvent(new CustomEvent('eastfront-action-timing',{detail:{...timing,clientTimestamp:performance.timeOrigin+timing.at}}));}catch{/* Observer failure never blocks input. */}
}
