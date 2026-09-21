/** Browser preference only. Never part of a GameState or PlayerView. */
export type ModelDisplay='auto'|'off';
const key='eastfront.unitModels';
export function readModelDisplay():ModelDisplay {try{return globalThis.localStorage?.getItem(key)==='off'?'off':'auto';}catch{return 'auto';}}
export function saveModelDisplay(mode:ModelDisplay):void {try{globalThis.localStorage?.setItem(key,mode);}catch{/* Private browsing keeps the in-memory preference. */}}
