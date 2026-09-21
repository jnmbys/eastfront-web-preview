import {createHash,randomBytes,randomInt,randomUUID} from 'node:crypto';
import {SEATS,parseClientMessage,serverMessage,type ClientMessage,type ErrorCode,type RoomState,type ServerMessage,type ServerPayloads,type SeatId} from '../src/multiplayer/protocol.js';
import {DEFAULTS,type ServerConfig} from './config.js';
import {createMatchSession,playerSnapshot,type MatchSession} from './match.js';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Uses Node entropy only, with no access to a game/session RNG. */
export function generateRoomCode():string {return Array.from({length:6},()=>alphabet[randomInt(alphabet.length)]).join('');}
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
    if(c.requests.has(m.requestId)){this.emit(connectionId,'ROOM_ERROR',{code:'BAD_MESSAGE'},m.requestId);return;}
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
      if(room){this.refreshClients(room);this.changed(room,m.requestId);if(room.state.matchId)this.sendMatchInfo(connectionId,identity.controllerId,this.#matches.get(room.state.matchId)!);}
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
    if(m.messageType==='LEAVE_ROOM'){
      if(room.state.status==='IN_GAME'){this.close(room,m.requestId);return;}
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
        this.emit(connection,'PLAYER_VIEW_SNAPSHOT',{matchId:match.matchId,revision:0,view:snapshot.view});}
    }catch{
      room.state.status='LOBBY';for(const seat of SEATS)room.state.seats[seat].ready=false;this.changed(room);
      for(const client of room.state.clients){const connection=this.#identities.get(client.controllerId)?.connectionId;if(connection)this.emit(connection,'ROOM_ERROR',{code:'MATCH_FAILED'});}
    }
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
    if(room){if(room.state.status==='LOBBY')for(const seat of SEATS)room.state.seats[seat].ready=false;this.refreshClients(room);this.changed(room);}
  }
  private close(room:Room,requestId:string|null=null):void {
    room.state.status='CLOSED';this.changed(room,requestId);
    for(const client of room.state.clients){const identity=this.#identities.get(client.controllerId);if(identity){identity.roomId=null;if(identity.connectionId)this.emit(identity.connectionId,'ROOM_STATE',{room:null},requestId);}}
    this.#codes.delete(room.state.roomCode);this.#rooms.delete(room.state.roomId);if(room.state.matchId)this.#matches.delete(room.state.matchId);
  }
  /** Runtime clock, grace and cleanup all enter the same authority object. */
  sweep():void {
    const now=this.now();
    for(const identity of this.#identities.values())if(identity.disconnectedAt!==null&&now-identity.disconnectedAt>=this.config.reconnectGraceMs){
      const room=identity.roomId?this.#rooms.get(identity.roomId):undefined;
      if(room){if(room.state.status==='IN_GAME')this.close(room);else{identity.roomId=null;this.releaseSeat(room,identity.controllerId);this.refreshClients(room);this.changed(room);}}
      this.#tokens.delete(identity.tokenHash);this.#identities.delete(identity.controllerId);
    }
    for(const room of this.#rooms.values())if((room.emptySince!==null&&now-room.emptySince>=this.config.emptyRoomTimeoutMs)||now-room.lastActivity>=this.config.roomTimeoutMs)this.close(room);
  }
  isIdentified(connectionId:string):boolean{return !!this.#connections.get(connectionId)?.controllerId;}
  /** Aggregate health only; never state, names, tokens or assignments. */
  counts(){return {connections:this.#connections.size,rooms:this.#rooms.size,matches:this.#matches.size,controllers:this.#identities.size};}
}
