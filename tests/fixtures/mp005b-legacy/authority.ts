import {actionOwner,queryModel,forcedAction,validateIntent,applyIntent} from './gameplay.js';
import type {PresentationEvent} from '../src/presentation/events.js';
import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {SEATS,parseClientMessage,serverMessage,type ClientMessage,type ErrorCode,type RoomState,type ServerMessage,type ServerPayloads,type SeatId} from '../src/multiplayer/protocol.js';
import {DEFAULTS,type ServerConfig} from './config.js';
import {createMatchSession,playerSnapshot,type MatchSession} from './match.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Uses Node entropy only, with no access to a game/session RNG. */
export function generateRoomCode():string {return Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}
function canonical(v:unknown):string {
  if(Array.isArray(v))return `[${v.map(canonical).join(',')}]`;
  if(v!==null&&typeof v==='object')return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as Record<string,unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
const tokenKey=(token:string)=>createHash('sha256').update(token).digest('hex');
const emptySeat=()=>({controllerType:'EMPTY' as const,controllerId:null,ready:false});
interface Identity {controllerId:string;displayName:string;tokenHash:string;connectionId:string|null;roomId:string|null;disconnectedAt:number|null;}
interface Connection {send:(message:ServerMessage)=>void;controllerId:string|null;createdAt:number;windowAt:number;messages:number;requests:Set<string>;}
interface Room {state:RoomState;lastActivity:number;emptySince:number|null;}
class Rejection extends Error {constructor(readonly code:ErrorCode){super(code);}}
function reject(code:ErrorCode):never {throw new Rejection(code);}
/** One synchronous mutation boundary: no await between membership/phase checks and commit. */
export class RoomAuthority {
  #connections=new Map<string,Connection>();#identities=new Map<string,Identity>();#tokens=new Map<string,string>();
  #rooms=new Map<string,Room>();#codes=new Map<string,string>();#matches=new Map<string,MatchSession>();
  constructor(readonly config:ServerConfig={...DEFAULTS},private now:()=>number=Date.now,
    private matchFactory:(room:RoomState,now:number)=>MatchSession=createMatchSession,private codeFactory:()=>string=generateRoomCode){}
  connect(send:Connection['send']):string {
    if(this.#connections.size>=this.config.maxConnections)reject('CAPACITY');
    const id=randomUUID(),now=this.now();this.#connections.set(id,{send,controllerId:null,createdAt:now,windowAt:now,messages:0,requests:new Set()});
    this.emit(id,'CONNECTION_STATE',{state:'CONNECTED'});return id;
  }
  private emit<K extends keyof ServerPayloads>(connectionId:string,type:K,payload:ServerPayloads[K],requestId:string|null=null):void {
    // Transport failures cannot interrupt a committed room mutation or another recipient.
    try{this.#connections.get(connectionId)?.send(serverMessage(type,payload,requestId));}catch{/* close/heartbeat drives disconnect */}
  }
  receive(connectionId:string,raw:string):void {
    const c=this.#connections.get(connectionId);if(!c)return;
    const now=this.now();if(now-c.windowAt>=this.config.rateWindowMs){c.windowAt=now;c.messages=0;}
    if(++c.messages>this.config.messagesPerWindow){this.emit(connectionId,'ROOM_ERROR',{code:'RATE_LIMIT'});return;}
    if(Buffer.byteLength(raw)>this.config.maxMessageBytes){this.emit(connectionId,'ROOM_ERROR',{code:'BAD_MESSAGE'});return;}
    const result=parseClientMessage(raw);
    if(!result.ok){this.emit(connectionId,'ROOM_ERROR',{code:result.code},result.requestId);return;}
    const m=result.message;
    if(m.messageType!=='SUBMIT_ACTION'&&c.requests.has(m.requestId)){this.emit(connectionId,'ROOM_ERROR',{code:'BAD_MESSAGE'},m.requestId);return;}
    c.requests.add(m.requestId);if(c.requests.size>128)c.requests.delete(c.requests.values().next().value!);
    try{this.handle(connectionId,c,m);}catch(error){this.emit(connectionId,'ROOM_ERROR',{code:error instanceof Rejection?error.code:'MATCH_FAILED'},m.requestId);}
  }
  private handle(connectionId:string,c:Connection,m:ClientMessage):void {
    if(m.messageType==='HELLO'||m.messageType==='RECONNECT'){
      if(c.controllerId)reject('ALREADY_IDENTIFIED');
      let identity:Identity,token:string;
      if(m.messageType==='HELLO'){
        token=randomBytes(32).toString('base64url');identity={controllerId:randomUUID(),displayName:m.payload.displayName.trim(),tokenHash:tokenKey(token),connectionId,roomId:null,disconnectedAt:null};
        this.#identities.set(identity.controllerId,identity);this.#tokens.set(identity.tokenHash,identity.controllerId);
      }else{
        token=m.payload.reconnectToken;const id=this.#tokens.get(tokenKey(token));const existing=id?this.#identities.get(id):undefined;
        if(!existing||(existing.disconnectedAt!==null&&this.now()-existing.disconnectedAt>=this.config.reconnectGraceMs))reject('INVALID_TOKEN');
        if(existing.connectionId)reject('SESSION_CONNECTED');
        identity=existing;identity.connectionId=connectionId;identity.disconnectedAt=null;
      }
      c.controllerId=identity.controllerId;
      this.emit(connectionId,'WELCOME',{connectionId,controllerId:identity.controllerId,reconnectToken:token,reconnected:m.messageType==='RECONNECT'},m.requestId);
      const room=identity.roomId?this.#rooms.get(identity.roomId):undefined;
      if(room){this.refreshClients(room);this.changed(room,m.requestId);if(room.state.matchId){const match=this.#matches.get(room.state.matchId)!;this.sendMatchInfo(connectionId,identity.controllerId,match);this.connectionStatus(room,match);this.snapshot(connectionId,identity.controllerId,match,true);}}
      else this.emit(connectionId,'ROOM_STATE',{room:null},m.requestId);
      return;
    }
    const identity=c.controllerId?this.#identities.get(c.controllerId):undefined;
    if(!identity||identity.connectionId!==connectionId)reject('NOT_IDENTIFIED');
    if(m.messageType==='CREATE_ROOM'){
      if(identity.roomId)reject('ALREADY_IN_ROOM');if(this.#rooms.size>=this.config.maxRooms)reject('CAPACITY');
      let code='';for(let i=0;i<128;i++){const candidate=this.codeFactory();if(!this.#codes.has(candidate)){code=candidate;break;}}
      if(!code)reject('CAPACITY');
      const room:Room={state:{roomId:randomUUID(),roomCode:code,status:'LOBBY',createdAt:this.now(),revision:0,
        seats:{GERMANY:emptySeat(),SOVIET:emptySeat()},clients:[],matchId:null},lastActivity:this.now(),emptySince:null};
      this.#rooms.set(room.state.roomId,room);this.#codes.set(code,room.state.roomId);identity.roomId=room.state.roomId;
      this.refreshClients(room);this.changed(room,m.requestId);this.emit(connectionId,'ROOM_CREATED',{room:structuredClone(room.state)},m.requestId);return;
    }
    if(m.messageType==='JOIN_ROOM'){
      if(identity.roomId)reject('ALREADY_IN_ROOM');
      const roomId=this.#codes.get(m.payload.roomCode.trim().toUpperCase()),room=roomId?this.#rooms.get(roomId):undefined;
      if(!room)reject('ROOM_NOT_FOUND');if(room.state.status!=='LOBBY')reject('ROOM_PHASE');
      if(room.state.clients.length>=2)reject('ROOM_FULL');
      identity.roomId=room.state.roomId;room.emptySince=null;this.refreshClients(room);this.changed(room,m.requestId);return;
    }
    const room=identity.roomId?this.#rooms.get(identity.roomId):undefined;
    if(!room||!room.state.clients.some(p=>p.controllerId===identity.controllerId))reject('NOT_IN_ROOM');
    if(m.messageType==='SUBMIT_ACTION'||m.messageType==='RESYNC_MATCH'||m.messageType==='QUERY_MATCH'){
      const match=room.state.matchId?this.#matches.get(room.state.matchId):undefined;
      if(!match||match.matchId!==m.payload.matchId||!match.controllerAssignments.some(a=>a.controllerId===identity.controllerId))reject('NOT_IN_ROOM');
      room.lastActivity=this.now();
      if(m.messageType==='RESYNC_MATCH'){this.snapshot(connectionId,identity.controllerId,match,true,[],m.requestId);return;}
      if(m.messageType==='QUERY_MATCH'){
        if(m.payload.expectedRevision!==match.matchRevision){this.snapshot(connectionId,identity.controllerId,match,true,[],m.requestId);return;}
        const model=queryModel(match,identity.controllerId,m.payload.draft),forced=forcedAction(match,identity.controllerId,m.payload.draft);
        this.emit(connectionId,'MATCH_QUERY',{...this.order(match,identity.controllerId),model,forcedAction:forced},m.requestId);return;
      }
      const cache=match.receipts[identity.controllerId]!,fingerprint=canonical(m.payload),existing=cache.get(m.requestId);
      if(existing){
        if(existing.fingerprint!==fingerprint){this.emit(connectionId,'ACTION_REJECTED',{...this.order(match,identity.controllerId),acceptedRevision:null,actionSequence:match.actionSequence,code:'REQUEST_REUSED'},m.requestId);return;}
        const {fingerprint:_,...reply}=existing;this.emit(connectionId,reply.acceptedRevision===null?'ACTION_REJECTED':'ACTION_ACCEPTED',{...this.order(match,identity.controllerId),...reply},m.requestId);return;
      }
      let code:import('../src/multiplayer/gameplayProtocol.js').ActionError|undefined;
      if(cache.size>=4096)code='REQUEST_LIMIT';
      else if(match.status!=='ACTIVE')code='MATCH_UNAVAILABLE';
      else if(m.payload.expectedRevision!==match.matchRevision)code='STALE_REVISION';
      else code=validateIntent(match,identity.controllerId,m.payload.action)??undefined;
      let events:Map<string,readonly PresentationEvent[]>|null=null;
      if(!code){events=applyIntent(match,identity.controllerId,m.payload.action);if(!events)code='INVALID_ACTION';}
      const receipt={fingerprint,acceptedRevision:code?null:match.matchRevision,actionSequence:match.actionSequence,...(code?{code}:{})};
      if(cache.size<4096)cache.set(m.requestId,receipt);
      const {fingerprint:_,...reply}=receipt;
      this.emit(connectionId,code?'ACTION_REJECTED':'ACTION_ACCEPTED',{...this.order(match,identity.controllerId),...reply},m.requestId);
      if(events)this.broadcastSnapshots(room,match,false,events);
      return;
    }
    if(m.messageType==='LEAVE_ROOM'){
      if(room.state.status==='IN_GAME'){const match=this.#matches.get(room.state.matchId!)!;if(match.status!=='FINISHED'){match.status='ABORTED';this.broadcastSnapshots(room,match);}this.close(room,m.requestId);return;}
      identity.roomId=null;this.releaseSeat(room,identity.controllerId);this.refreshClients(room);this.changed(room,m.requestId);
      this.emit(connectionId,'ROOM_STATE',{room:null},m.requestId);return;
    }
    if(room.state.status!=='LOBBY')reject('ROOM_PHASE');
    if(m.messageType==='SELECT_SEAT'){
      const target=room.state.seats[m.payload.seat];
      if(target.controllerId===identity.controllerId){this.emit(connectionId,'ROOM_STATE',{room:structuredClone(room.state)},m.requestId);return;}
      if(target.controllerType!=='EMPTY')reject('SEAT_TAKEN');
      this.releaseSeat(room,identity.controllerId);
      room.state.seats[m.payload.seat]={controllerType:'HUMAN_REMOTE',controllerId:identity.controllerId,ready:false};
      // Both players reconfirm after a side assignment changes.
      for(const seat of SEATS)room.state.seats[seat].ready=false;
      this.changed(room,m.requestId);return;
    }
    if(m.messageType==='SET_READY'){
      const seat=SEATS.find(s=>room.state.seats[s].controllerId===identity.controllerId);
      if(!seat)reject('NO_SEAT');room.state.seats[seat].ready=m.payload.ready;this.changed(room,m.requestId);
      if(SEATS.every(s=>room.state.seats[s].controllerType==='HUMAN_REMOTE'&&room.state.seats[s].ready&&room.state.clients.some(p=>p.controllerId===room.state.seats[s].controllerId&&p.connected)))this.start(room);
    }
  }
  private releaseSeat(room:Room,controllerId:string):void {
    for(const seat of SEATS)if(room.state.seats[seat].controllerId===controllerId)room.state.seats[seat]=emptySeat();
    for(const seat of SEATS)room.state.seats[seat].ready=false;
  }
  private refreshClients(room:Room):void {
    room.state.clients=[...this.#identities.values()].filter(i=>i.roomId===room.state.roomId).map(i=>({controllerId:i.controllerId,displayName:i.displayName,connected:i.connectionId!==null,disconnectedAt:i.disconnectedAt}));
    if(!room.state.clients.length)room.emptySince??=this.now();
  }
  private changed(room:Room,requestId:string|null=null):void {
    room.state.revision++;room.lastActivity=this.now();
    for(const client of room.state.clients){const connection=this.#identities.get(client.controllerId)?.connectionId;
      if(connection)this.emit(connection,'ROOM_STATE',{room:structuredClone(room.state)},requestId);}
  }
  private start(room:Room):void {
    room.state.status='STARTING';this.changed(room);
    for(const client of room.state.clients){const connection=this.#identities.get(client.controllerId)?.connectionId;if(connection)this.emit(connection,'MATCH_STARTING',{roomId:room.state.roomId});}
    try{
      const match=this.matchFactory(structuredClone(room.state),this.now());
      // Derive every authorized DTO before publishing success, so a failure rolls back cleanly.
      const snapshots=match.controllerAssignments.map(a=>({id:a.controllerId,view:playerSnapshot(match,a.controllerId)}));
      this.#matches.set(match.matchId,match);room.state.matchId=match.matchId;room.state.status='IN_GAME';this.changed(room);
      for(const snapshot of snapshots){const connection=this.#identities.get(snapshot.id)?.connectionId;if(!connection)continue;
        this.sendMatchInfo(connection,snapshot.id,match);
        this.snapshot(connection,snapshot.id,match,true);}
    }catch{
      room.state.status='LOBBY';for(const seat of SEATS)room.state.seats[seat].ready=false;this.changed(room);
      for(const client of room.state.clients){const connection=this.#identities.get(client.controllerId)?.connectionId;if(connection)this.emit(connection,'ROOM_ERROR',{code:'MATCH_FAILED'});}
    }
  }
  private order(match:MatchSession,controllerId:string){return {matchId:match.matchId,matchRevision:match.matchRevision,serverSequence:++match.serverSequences[controllerId]!};}
  private snapshot(connectionId:string,controllerId:string,match:MatchSession,resync=false,events:readonly PresentationEvent[]=[],requestId:string|null=null):void {
    const model=queryModel(match,controllerId);
    this.emit(connectionId,'PLAYER_VIEW_SNAPSHOT',{...this.order(match,controllerId),revision:match.matchRevision,format:'snapshot-v1',resync,status:match.status,
      canAct:match.status==='ACTIVE'&&actionOwner(match)===model.viewerControllerId,view:playerSnapshot(match,controllerId),model,events:resync?[]:events,forcedAction:forcedAction(match,controllerId)},requestId);
  }
  private broadcastSnapshots(room:Room,match:MatchSession,resync=false,events=new Map<string,readonly PresentationEvent[]>()):void {
    for(const client of room.state.clients){const connection=this.#identities.get(client.controllerId)?.connectionId;
      if(connection)this.snapshot(connection,client.controllerId,match,resync,events.get(client.controllerId)??[]);}
  }
  private connectionStatus(room:Room,match:MatchSession):void {
    if(match.status==='FINISHED'||match.status==='ABORTED')return;
    match.status=room.state.clients.every(c=>c.connected)?'ACTIVE':'WAITING_FOR_RECONNECT';
    this.broadcastSnapshots(room,match);
  }
  private sendMatchInfo(connectionId:string,controllerId:string,match:MatchSession):void {
    const a=match.controllerAssignments.find(a=>a.controllerId===controllerId);if(!a)return;
    this.emit(connectionId,'MATCH_CREATED',{matchId:match.matchId,scenarioId:match.scenarioId,createdAt:match.createdAt,seat:a.seat,viewer:a.viewer});
  }
  disconnect(connectionId:string):void {
    const c=this.#connections.get(connectionId);this.#connections.delete(connectionId);
    const identity=c?.controllerId?this.#identities.get(c.controllerId):undefined;
    if(!identity||identity.connectionId!==connectionId)return;
    identity.connectionId=null;identity.disconnectedAt=this.now();
    const room=identity.roomId?this.#rooms.get(identity.roomId):undefined;
    if(room){if(room.state.status==='LOBBY')for(const seat of SEATS)room.state.seats[seat].ready=false;this.refreshClients(room);this.changed(room);if(room.state.matchId)this.connectionStatus(room,this.#matches.get(room.state.matchId)!);}
  }
  private close(room:Room,requestId:string|null=null):void {
    if(room.state.matchId){const m=this.#matches.get(room.state.matchId);if(m&&m.status!=='ABORTED'&&m.status!=='FINISHED'){m.status='ABORTED';this.broadcastSnapshots(room,m);}}
    room.state.status='CLOSED';this.changed(room,requestId);
    for(const client of room.state.clients){const identity=this.#identities.get(client.controllerId);if(identity){identity.roomId=null;if(identity.connectionId)this.emit(identity.connectionId,'ROOM_STATE',{room:null},requestId);}}
    this.#codes.delete(room.state.roomCode);this.#rooms.delete(room.state.roomId);if(room.state.matchId)this.#matches.delete(room.state.matchId);
  }
  /** Runtime clock, grace and cleanup all enter the same authority object. */
  sweep():void {
    const now=this.now();
    for(const identity of this.#identities.values())if(identity.disconnectedAt!==null&&now-identity.disconnectedAt>=this.config.reconnectGraceMs){
      const room=identity.roomId?this.#rooms.get(identity.roomId):undefined;
      if(room){if(room.state.status==='IN_GAME'){const match=this.#matches.get(room.state.matchId!)!;if(match.status!=='FINISHED'){match.status='ABORTED';this.broadcastSnapshots(room,match);}this.close(room);}else{identity.roomId=null;this.releaseSeat(room,identity.controllerId);this.refreshClients(room);this.changed(room);}}
      this.#tokens.delete(identity.tokenHash);this.#identities.delete(identity.controllerId);
    }
    for(const room of this.#rooms.values())if((room.emptySince!==null&&now-room.emptySince>=this.config.emptyRoomTimeoutMs)||now-room.lastActivity>=this.config.roomTimeoutMs)this.close(room);
  }
  isIdentified(connectionId:string):boolean{return !!this.#connections.get(connectionId)?.controllerId;}
  /** Aggregate health only; never state, names, tokens or assignments. */
  counts(){return {connections:this.#connections.size,rooms:this.#rooms.size,matches:this.#matches.size,controllers:this.#identities.size};}
}
