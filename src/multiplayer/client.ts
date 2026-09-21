import {PROTOCOL_VERSION,clientMessage,type ClientPayloads,type ServerMessage,type RoomState,type MatchInfo,type AuthorizedPlayerView} from './protocol.js';
import {CLIENT_NETWORK} from './config.js';
import type {MPText} from './catalog.js';
export interface LobbyState {
  connection:'DISCONNECTED'|'CONNECTING'|'RECONNECTING'|'CONNECTED';controllerId:string|null;
  room:RoomState|null;match:MatchInfo|null;view:AuthorizedPlayerView|null;pending:boolean;synced:boolean;error:MPText|null;
}
/** Owns only authorized network DTOs. It never constructs a LocalGameSession. */
export class LobbyClient {
  readonly state:LobbyState={connection:'DISCONNECTED',controllerId:null,room:null,match:null,view:null,pending:false,synced:false,error:null};
  private socket:WebSocket|null=null;private token:string|null=null;private stopped=true;
  private retry:ReturnType<typeof setTimeout>|null=null;private deadline:ReturnType<typeof setTimeout>|null=null;
  private attempts=0;private pendingId:string|null=null;private name='';
  private offline=()=>{this.state.connection='DISCONNECTED';this.state.synced=false;this.state.pending=false;this.changed();this.socket?.close();};
  private online=()=>{if(!this.stopped&&!this.socket)this.open();};
  constructor(private url:string,private changed:()=>void){try{this.token=sessionStorage.getItem(this.storageKey);}catch{/* memory-only identity */}window.addEventListener('offline',this.offline);window.addEventListener('online',this.online);}
  private get storageKey(){return `eastfront.mp.identity:${this.url}`;}
  get canMutate(){return this.state.connection==='CONNECTED'&&this.state.synced&&!this.state.pending;}
  connect(displayName:string):void {
    if(this.socket&&(this.socket.readyState===WebSocket.OPEN||this.socket.readyState===WebSocket.CONNECTING))return;
    this.name=displayName.trim();this.stopped=false;this.open();
  }
  private clearDeadline(){if(this.deadline!==null)clearTimeout(this.deadline);this.deadline=null;}
  private open():void {
    if(this.stopped)return;if(this.retry!==null)clearTimeout(this.retry);this.retry=null;
    this.state.connection=this.token?'RECONNECTING':'CONNECTING';this.state.synced=false;this.state.pending=false;this.pendingId=null;
    this.changed();let socket:WebSocket;
    try{socket=new WebSocket(this.url);}catch{this.state.connection='DISCONNECTED';this.state.error='unavailable';this.changed();return;}
    this.socket=socket;this.clearDeadline();this.deadline=setTimeout(()=>socket.close(),CLIENT_NETWORK.requestTimeoutMs);
    socket.onopen=()=>{if(this.socket!==socket)return;this.sendHandshake();};
    socket.onmessage=event=>{
      if(this.socket!==socket)return;
      let message:ServerMessage;try{message=JSON.parse(String(event.data)) as ServerMessage;
        if(!message||message.protocolVersion!==PROTOCOL_VERSION||typeof message.messageType!=='string'||!message.payload||typeof message.payload!=='object')throw new Error();
      }catch{this.state.error='invalidServer';this.stopped=true;socket.close();return;}
      this.receive(message);
    };
    socket.onerror=()=>{this.state.error='unavailable';socket.close();};
    socket.onclose=()=>{
      if(this.socket!==socket)return;this.socket=null;this.clearDeadline();
      this.state.connection='DISCONNECTED';this.state.synced=false;this.state.pending=false;this.pendingId=null;this.changed();
      if(!this.stopped){this.retry=setTimeout(()=>this.open(),Math.min(CLIENT_NETWORK.maxRetryMs,CLIENT_NETWORK.initialRetryMs*2**this.attempts++));}
    };
  }
  private sendHandshake(){if(this.token)this.sendRaw('RECONNECT',{reconnectToken:this.token});else this.sendRaw('HELLO',{displayName:this.name});}
  private sendRaw<K extends keyof ClientPayloads>(type:K,payload:ClientPayloads[K]):void {
    const requestId=crypto.randomUUID();this.pendingId=requestId;this.state.pending=true;
    this.socket?.send(JSON.stringify(clientMessage(type,payload,requestId)));
    this.clearDeadline();this.deadline=setTimeout(()=>{this.state.error='unavailable';this.socket?.close();},CLIENT_NETWORK.requestTimeoutMs);
  }
  send<K extends Exclude<keyof ClientPayloads,'HELLO'|'RECONNECT'>>(type:K,payload:ClientPayloads[K]):void {
    if(!this.canMutate)return;this.state.error=null;this.sendRaw(type,payload);this.changed();
  }
  private receive(message:ServerMessage):void {
    if(message.requestId===this.pendingId){this.state.pending=false;this.pendingId=null;this.clearDeadline();}
    let repaint=true;
    switch(message.messageType){
      case 'CONNECTION_STATE':return; // Transport chatter never repaints HOME or map.
      case 'WELCOME':
        this.state.controllerId=message.payload.controllerId;this.token=message.payload.reconnectToken;
        try{sessionStorage.setItem(this.storageKey,this.token);}catch{/* retain in memory */}
        this.state.connection='CONNECTED';this.state.error=null;this.attempts=0;break;
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
        this.state.view=message.payload.view;break;
      default:this.state.error='invalidServer';this.stopped=true;this.socket?.close();
    }
    if(repaint)this.changed();
  }
  dispose():void {window.removeEventListener('offline',this.offline);window.removeEventListener('online',this.online);this.stopped=true;if(this.retry!==null)clearTimeout(this.retry);this.clearDeadline();const socket=this.socket;this.socket=null;socket?.close();}
}
