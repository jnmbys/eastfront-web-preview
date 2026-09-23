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
