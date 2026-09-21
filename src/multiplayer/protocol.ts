import type { PlayerViewState } from '../player-view/playerView.js';

export const PROTOCOL_VERSION = 1 as const;
export const SEATS = ['GERMANY', 'SOVIET'] as const;
export type SeatId = typeof SEATS[number];
export type PlayerSide = 'GERMAN' | 'SOVIET';
export const sideForSeat = (seat: SeatId): PlayerSide => seat === 'GERMANY' ? 'GERMAN' : 'SOVIET';
export type RoomStatus = 'LOBBY' | 'STARTING' | 'IN_GAME' | 'CLOSED';
export type SeatController = {controllerType:'EMPTY';controllerId:null} |
  {controllerType:'HUMAN_REMOTE'|'AI';controllerId:string};
export type SeatState = SeatController & {ready:boolean};
export interface RoomClient {controllerId:string;displayName:string;connected:boolean;disconnectedAt:number|null;}
/** Public lobby DTO: never includes tokens, session objects or game state. */
export interface RoomState {
  roomId:string;roomCode:string;status:RoomStatus;createdAt:number;revision:number;
  seats:Record<SeatId,SeatState>;clients:RoomClient[];matchId:string|null;
}
export type ErrorCode = 'BAD_MESSAGE'|'VERSION_MISMATCH'|'UNSUPPORTED_MESSAGE'|'NOT_IDENTIFIED'|
  'ALREADY_IDENTIFIED'|'INVALID_TOKEN'|'SESSION_CONNECTED'|'ALREADY_IN_ROOM'|'ROOM_NOT_FOUND'|
  'ROOM_FULL'|'NOT_IN_ROOM'|'ROOM_PHASE'|'SEAT_TAKEN'|'NO_SEAT'|'CAPACITY'|'RATE_LIMIT'|'MATCH_FAILED';
export interface ClientPayloads {
  HELLO:{displayName:string};RECONNECT:{reconnectToken:string};CREATE_ROOM:Record<string,never>;
  JOIN_ROOM:{roomCode:string};SELECT_SEAT:{seat:SeatId};SET_READY:{ready:boolean};LEAVE_ROOM:Record<string,never>;
}
export interface MatchInfo {matchId:string;scenarioId:string;createdAt:number;seat:SeatId;viewer:PlayerSide;}
/** Observer/full-state fields cannot be expressed by this network contract. */
export type AuthorizedPlayerView = Omit<PlayerViewState,'viewer'|'authoritativeState'> & {viewer:PlayerSide};
export interface ServerPayloads {
  WELCOME:{connectionId:string;controllerId:string;reconnectToken:string;reconnected:boolean};
  ROOM_CREATED:{room:RoomState};ROOM_STATE:{room:RoomState|null};ROOM_ERROR:{code:ErrorCode};
  MATCH_STARTING:{roomId:string};MATCH_CREATED:MatchInfo;
  PLAYER_VIEW_SNAPSHOT:{matchId:string;revision:number;view:AuthorizedPlayerView};
  CONNECTION_STATE:{state:'CONNECTED'|'DISCONNECTED'};
}
type Envelope<M> = {[K in keyof M]:{protocolVersion:typeof PROTOCOL_VERSION;messageType:K;requestId:string|null;payload:M[K]}}[keyof M];
export type ClientMessage = Envelope<ClientPayloads> & {requestId:string};
export type ServerMessage = Envelope<ServerPayloads>;
export function serverMessage<K extends keyof ServerPayloads>(messageType:K,payload:ServerPayloads[K],requestId:string|null=null):ServerMessage {
  return {protocolVersion:PROTOCOL_VERSION,messageType,payload,requestId} as ServerMessage;
}
export function clientMessage<K extends keyof ClientPayloads>(messageType:K,payload:ClientPayloads[K],requestId:string):ClientMessage {
  return {protocolVersion:PROTOCOL_VERSION,messageType,payload,requestId} as ClientMessage;
}
const object = (v:unknown):v is Record<string,unknown> => !!v && typeof v==='object' && !Array.isArray(v);
const exact = (v:Record<string,unknown>,keys:string[]) => Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k));
export type ParseResult = {ok:true;message:ClientMessage}|{ok:false;code:ErrorCode;requestId:string|null};
/** Exact allowlist validation; arbitrary extra authority/view/state fields are rejected. */
export function parseClientMessage(text:string):ParseResult {
  let v:unknown;try{v=JSON.parse(text);}catch{return {ok:false,code:'BAD_MESSAGE',requestId:null};}
  const requestId=object(v)&&typeof v.requestId==='string'&&/^[\w-]{1,64}$/.test(v.requestId)?v.requestId:null;
  const fail=(code:ErrorCode):ParseResult=>({ok:false,code,requestId});
  if(!object(v)||!requestId||!exact(v,['protocolVersion','messageType','requestId','payload']))return fail('BAD_MESSAGE');
  if(v.protocolVersion!==PROTOCOL_VERSION)return fail('VERSION_MISMATCH');
  if(!object(v.payload))return fail('BAD_MESSAGE');
  const p=v.payload;let valid=false;
  switch(v.messageType){
    case 'HELLO':valid=exact(p,['displayName'])&&typeof p.displayName==='string'&&p.displayName.trim().length>0&&p.displayName.length<=32&&!/[\u0000-\u001f\u007f]/.test(p.displayName);break;
    case 'RECONNECT':valid=exact(p,['reconnectToken'])&&typeof p.reconnectToken==='string'&&/^[A-Za-z0-9_-]{43}$/.test(p.reconnectToken);break;
    case 'CREATE_ROOM':case 'LEAVE_ROOM':valid=exact(p,[]);break;
    case 'JOIN_ROOM':valid=exact(p,['roomCode'])&&typeof p.roomCode==='string'&&/^[a-zA-Z2-9]{6}$/.test(p.roomCode.trim());break;
    case 'SELECT_SEAT':valid=exact(p,['seat'])&&SEATS.includes(p.seat as SeatId);break;
    case 'SET_READY':valid=exact(p,['ready'])&&typeof p.ready==='boolean';break;
    default:return fail('UNSUPPORTED_MESSAGE');
  }
  return valid?{ok:true,message:v as ClientMessage}:fail('BAD_MESSAGE');
}
