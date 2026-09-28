import {record,shape,id,revision,hex} from './gameplayProtocol.js';
import type {CombatTransaction,HexCoord} from '../core-adapter/core.js';
/** Result facts only; no participants, strengths, support sources or action capability. */
export interface BattleSummary {
 battleId:string;revision:number;stage:CombatTransaction['stage'];targetHex:HexCoord;
 resolution:NonNullable<CombatTransaction['resolution']>;
 context:{baseOdds:string;finalShift:number;finalCRTColumnLabel:string}|null;
 pending:string|null;
 consequences:({kind:'loss';unitId:string;steps:number}|{kind:'retreat'|'advance'|'breakthrough';unitId:string;from:HexCoord;to:HexCoord})[];
 truncated:boolean;
}
export interface BattleSummaries {matchId:string;viewerControllerId:string;entries:BattleSummary[];olderOmitted:boolean;}
export const SUMMARY_LIMIT=32,CONSEQUENCE_LIMIT=64;
const str=(v:unknown)=>typeof v==='string'&&v.length<=64;
const bool=(v:unknown)=>typeof v==='boolean';
const one=(...values:unknown[])=>(v:unknown)=>values.includes(v);
const dice=(v:unknown)=>Number.isInteger(v)&&Number(v)>=1&&Number(v)<=6;
const count=(v:unknown)=>Number.isInteger(v)&&Number(v)>=0&&Number(v)<=128;
export function validBattleSummaries(v:unknown):v is BattleSummaries {
 return shape(v,{matchId:id,viewerControllerId:id,olderOmitted:bool,entries:x=>Array.isArray(x)&&x.length<=SUMMARY_LIMIT&&new Set(x.map(e=>e?.battleId)).size===x.length&&x.every(e=>shape(e,{
  battleId:id,revision,stage:one('DEFENDER_REACTION','LOSS_ALLOCATION','RETREAT','ADVANCE_AFTER_COMBAT','BREAKTHROUGH_OPTION','SCHWERPUNKT_OPTION','CLOSED'),targetHex:hex,pending:x=>x===null||one('DEFENDER_REACTION','LOSS_ALLOCATION','RETREAT','ADVANCE_AFTER_COMBAT','BREAKTHROUGH_OPTION','SCHWERPUNKT_OPTION')(x),truncated:bool,
  resolution:x=>shape(x,{dice:d=>shape(d,{die1:dice,die2:dice,total:n=>Number.isInteger(n)})&&record(d)&&Number(d.total)===Number(d.die1)+Number(d.die2),crtResult:one('A3R','A2','A1','AR','EX','NE','DR','D1R','D2R','D3R'),attackerLossSteps:count,defenderLossSteps:count,attackerRetreatSteps:count,defenderRetreatSteps:count,retreatConvertedToLoss:bool}),
  context:x=>x===null||shape(x,{baseOdds:str,finalShift:n=>Number.isInteger(n)&&Math.abs(Number(n))<=32,finalCRTColumnLabel:str}),
  consequences:x=>Array.isArray(x)&&x.length<=CONSEQUENCE_LIMIT&&x.every(c=>shape(c,{kind:one('loss'),unitId:id,steps:n=>count(n)&&Number(n)>0})||shape(c,{kind:one('retreat','advance','breakthrough'),unitId:id,from:hex,to:hex})),
 }))});
}
