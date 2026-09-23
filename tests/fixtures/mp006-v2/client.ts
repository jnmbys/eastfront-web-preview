import {COMPACT_SNAPSHOT,FULL_SNAPSHOT,MAX_SERVER_MESSAGE_BYTES,decodeSnapshot,isSnapshotFormat,type SnapshotFormat} from './snapshotCodec.js';
import type {MatchSnapshot} from './gameplayProtocol.js';
import {PROTOCOL_VERSION,clientMessage,type ClientPayloads,type ServerMessage,type RoomState,type MatchInfo,type AuthorizedPlayerView} from './protocol.js';
import {CLIENT_NETWORK} from './config.js';
import type {MPText} from './catalog.js';
import {transportTimingEnabled,publishReceiveTiming} from './diagnosticTiming.js';
export interface LobbyState {
  connection:'DISCONNECTED'|'CONNECTING'|'RECONNECTING'|'CONNECTED';controllerId:string|null;
  snapshot:MatchSnapshot|null;room:RoomState|null;match:MatchInfo|null;view:AuthorizedPlayerView|null;pending:boolean;synced:boolean;error:MPText|null;
}
/** Owns only authorized network DTOs. It never constructs a LocalGameSession. */
export class LobbyClient {
  readonly state:LobbyState={connection:'DISCONNECTED',controllerId:null,snapshot:null,room:null,match:null,view:null,pending:false,synced:false,error:null};
  private listeners=new Set<(message:ServerMessage|null)=>void>();
  subscribe(listener:(message:ServerMessage|null)=>void):()=>void {this.listeners.add(listener);return ()=>this.listeners.delete(listener);}
  private notify(message:ServerMessage|null=null):void {
    // A lobby callback can construct a session from this very snapshot. That new
    // subscriber has already consumed it and must not receive it a second time.
    const listeners=[...this.listeners];this.changed();for(const listener of listeners)listener(message);
  }
  private socket:WebSocket|null=null;private token:string|null=null;private stopped=true;
  private retry:ReturnType<typeof setTimeout>|null=null;private deadline:ReturnType<typeof setTimeout>|null=null;
  snapshotFormat:SnapshotFormat=FULL_SNAPSHOT;
  private negotiationId:string|null=null;private recoveryId:string|null=null;private recoveryUsed=false;private compactDisabled=false;
  private attempts=0;private pendingId:string|null=null;private name='';
  private offline=()=>{this.state.connection='DISCONNECTED';this.state.synced=false;this.state.pending=false;this.notify();this.socket?.close();};
  private online=()=>{if(!this.stopped&&!this.socket)this.open();};
  constructor(private url:string,private changed:()=>void,private preferredFormat:SnapshotFormat=(typeof location!=='undefined'&&new URLSearchParams(location.search).get('snapshotFormat')===FULL_SNAPSHOT)?FULL_SNAPSHOT:COMPACT_SNAPSHOT){try{this.token=sessionStorage.getItem(this.storageKey);}catch{/* memory-only identity */}window.addEventListener('offline',this.offline);window.addEventListener('online',this.online);}
  private get storageKey(){return `eastfront.mp.identity:${this.url}`;}
  get canMutate(){return this.state.connection==='CONNECTED'&&this.state.synced&&!this.state.pending&&!this.negotiationId&&!this.recoveryId;}
  connect(displayName:string):void {
    if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;
    this.name=displayName.trim();this.stopped=false;this.open();
  }
  private clearDeadline(){if(this.deadline!==null)clearTimeout(this.deadline);this.deadline=null;}
  private open():void {
    if(this.stopped)return;if(this.retry!==null)clearTimeout(this.retry);this.retry=null;
    this.snapshotFormat=FULL_SNAPSHOT;this.negotiationId=null;this.recoveryId=null;
    this.state.connection=this.token?'RECONNECTING':'CONNECTING';this.state.synced=false;this.state.pending=false;this.pendingId=null;
    this.notify();let socket:WebSocket;
    try{socket=new WebSocket(this.url);}catch{this.state.connection='DISCONNECTED';this.state.error='unavailable';this.notify();return;}
    this.socket=socket;this.clearDeadline();this.deadline=setTimeout(()=>socket.close(),CLIENT_NETWORK.requestTimeoutMs);
    socket.onopen=()=>{if(this.socket!==socket)return;this.sendHandshake();};
    socket.onmessage=event=>{
      if(this.socket!==socket)return;
      const callbackAt=transportTimingEnabled?performance.now():0;let parsedAt=callbackAt,decodedAt=callbackAt;
      let message:ServerMessage;try{
        const raw=String(event.data);if(raw.length>MAX_SERVER_MESSAGE_BYTES||new TextEncoder().encode(raw).byteLength>MAX_SERVER_MESSAGE_BYTES)throw new Error();
        message=JSON.parse(raw) as ServerMessage;
        if(!message||message.protocolVersion!==PROTOCOL_VERSION||typeof message.messageType!=='string'||!message.payload||typeof message.payload!=='object')throw new Error();
        if(transportTimingEnabled)parsedAt=performance.now();
      }catch{this.invalidServer();return;}
      if(message.messageType==='PLAYER_VIEW_SNAPSHOT'){
        try{message={...message,payload:decodeSnapshot(message.payload,this.snapshotFormat===COMPACT_SNAPSHOT)};}
        catch{if(transportTimingEnabled)publishReceiveTiming({type:'PLAYER_VIEW_SNAPSHOT',requestId:'',callbackAt,parsedAt,decodedAt:performance.now(),appliedAt:performance.now(),outcome:'invalid-snapshot'});this.recoverSnapshot();return;}
      }
      if(transportTimingEnabled)decodedAt=performance.now();
      this.receive(message);
      if(transportTimingEnabled&&['PLAYER_VIEW_SNAPSHOT','ACTION_ACCEPTED','ACTION_REJECTED'].includes(message.messageType)){
        const p=message.payload as {matchRevision?:number;serverSequence?:number};
        publishReceiveTiming({type:message.messageType,requestId:message.requestId,revision:p.matchRevision,sequence:p.serverSequence,callbackAt,parsedAt,decodedAt,appliedAt:performance.now(),outcome:'processed'});
      }
    };
    socket.onerror=()=>{this.state.error='unavailable';socket.close();};
    socket.onclose=()=>{
      if(this.socket!==socket)return;this.socket=null;this.clearDeadline();this.negotiationId=null;this.recoveryId=null;
      this.state.connection='DISCONNECTED';this.state.synced=false;this.state.pending=false;this.pendingId=null;this.notify();
      if(!this.stopped){this.retry=setTimeout(()=>this.open(),Math.min(CLIENT_NETWORK.maxRetryMs,CLIENT_NETWORK.initialRetryMs*2**this.attempts++));}
    };
  }
  private sendHandshake(){if(this.token)this.sendRaw('RECONNECT',{reconnectToken:this.token});else this.sendRaw('HELLO',{displayName:this.name});}
  private sendRaw<K extends keyof ClientPayloads>(type:K,payload:ClientPayloads[K]):string {
    const requestId=crypto.randomUUID();this.pendingId=requestId;this.state.pending=true;
    this.socket?.send(JSON.stringify(clientMessage(type,payload,requestId)));
    this.clearDeadline();this.deadline=setTimeout(()=>{this.state.error='unavailable';if(this.negotiationId||this.recoveryId)this.stopped=true;this.socket?.close();},CLIENT_NETWORK.requestTimeoutMs);
    return requestId;
  }
  send<K extends Exclude<keyof ClientPayloads,'HELLO'|'RECONNECT'|'SET_SNAPSHOT_FORMAT'>>(type:K,payload:ClientPayloads[K]):string|null {
    if(!this.canMutate)return null;this.state.error=null;const id=this.sendRaw(type,payload);this.notify();return id;
  }
  resyncMatch(matchId:string):void {
    if(this.state.connection!=='CONNECTED'||this.socket?.readyState!==WebSocket.OPEN||this.recoveryId)return;
    this.recoveryId=this.sendRaw('RESYNC_MATCH',{matchId});this.notify();
  }
  private invalidServer():void {this.state.error='invalidServer';this.stopped=true;this.state.synced=false;this.notify();this.socket?.close();}
  private recoverSnapshot():void {
    if(this.recoveryUsed||this.recoveryId||!this.state.match){this.invalidServer();return;}
    this.recoveryUsed=true;this.compactDisabled=true;this.state.synced=false;
    this.resyncMatch(this.state.match.matchId);
  }
  private receive(message:ServerMessage):void {
    if(message.requestId===this.negotiationId&&this.negotiationId){
      if(message.messageType==='SNAPSHOT_FORMAT_SELECTED'&&isSnapshotFormat(message.payload.format)&&Object.keys(message.payload).length===1){this.snapshotFormat=message.payload.format;}
      else if(message.messageType==='ROOM_ERROR'&&message.payload.code==='UNSUPPORTED_MESSAGE'){this.snapshotFormat=FULL_SNAPSHOT;}
      else {this.invalidServer();return;}
      this.negotiationId=null;if(message.requestId===this.pendingId){this.pendingId=null;this.state.pending=false;this.clearDeadline();}this.notify();return;
    }
    if(message.requestId===this.pendingId){this.state.pending=false;this.pendingId=null;this.clearDeadline();}
    let repaint=true;
    switch(message.messageType){
      case 'CONNECTION_STATE':return; // Transport chatter never repaints HOME or map.
      case 'WELCOME':
        this.state.controllerId=message.payload.controllerId;this.token=message.payload.reconnectToken;
        try{sessionStorage.setItem(this.storageKey,this.token);}catch{/* retain in memory */}
        this.state.connection='CONNECTED';this.state.error=null;this.attempts=0;
        if(this.preferredFormat===COMPACT_SNAPSHOT&&!this.compactDisabled)this.negotiationId=this.sendRaw('SET_SNAPSHOT_FORMAT',{format:COMPACT_SNAPSHOT});
        break;
      case 'ROOM_CREATED':case 'ROOM_STATE':{
        const room=message.payload.room;
        repaint=!this.state.synced||room?.revision!==this.state.room?.revision||room?.roomId!==this.state.room?.roomId||!this.state.pending;
        this.state.synced=true;this.state.room=room;
        if(!room){this.state.match=null;this.state.view=null;}
        break;
      }
      case 'ROOM_ERROR':
        if(this.state.connection!=='CONNECTED'){this.stopped=true;this.socket?.close();}
        this.state.error=`error.${message.payload.code}`;
        if(message.payload.code==='INVALID_TOKEN'||message.payload.code==='SESSION_CONNECTED'){
          this.stopped=true;
          if(message.payload.code==='INVALID_TOKEN'){try{sessionStorage.removeItem(this.storageKey);}catch{}this.token=null;this.state.controllerId=null;this.state.room=null;this.state.match=null;this.state.view=null;}
          this.socket?.close();
        }break;
      case 'MATCH_STARTING':break;
      case 'MATCH_CREATED':this.state.match=message.payload;break;
      case 'PLAYER_VIEW_SNAPSHOT':
        if(this.state.match?.matchId!==message.payload.matchId||message.payload.view.viewer!==this.state.match.viewer||'authoritativeState' in message.payload.view){this.state.error='invalidServer';this.stopped=true;this.socket?.close();break;}
        if(this.recoveryId){
          if(!message.payload.resync||message.requestId!==this.recoveryId)return;
          if(this.state.snapshot&&(message.payload.matchRevision<this.state.snapshot.matchRevision||message.payload.serverSequence<this.state.snapshot.serverSequence)){this.invalidServer();return;}
          this.recoveryId=null;this.snapshotFormat=FULL_SNAPSHOT;this.state.synced=true;
        }
        this.state.view=message.payload.view;this.state.snapshot=message.payload;break;
      case 'ACTION_ACCEPTED':case 'ACTION_REJECTED':case 'MATCH_QUERY':break;
      default:this.state.error='invalidServer';this.stopped=true;this.socket?.close();
    }
    if(repaint)this.notify(message);
  }
  dispose():void {window.removeEventListener('offline',this.offline);window.removeEventListener('online',this.online);this.stopped=true;if(this.retry!==null)clearTimeout(this.retry);this.clearDeadline();const socket=this.socket;this.socket=null;socket?.close();}
}
