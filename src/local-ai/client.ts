import type {LobbyState} from '../multiplayer/client.js';
import type {PlayerClientTransport} from '../multiplayer/networkSession.js';
import type {ClientPayloads,ServerMessage} from '../multiplayer/protocol.js';
import type {LocalStart,LocalReply,LocalMeta,LocalRequest} from './types.js';
export interface WorkerPort {onmessage:((e:MessageEvent<LocalReply>)=>void)|null;onerror:((e:Event)=>void)|null;postMessage:(message:LocalRequest)=>void;terminate:()=>void;}
/** In-process transport facade only. Receives authorized DTOs, never GameState or agent inputs. */
export class LocalAiClient implements PlayerClientTransport {
 readonly state:LobbyState={connection:'DISCONNECTED',controllerId:null,snapshot:null,room:null,match:null,view:null,pending:false,synced:false,error:null};
 get canMutate(){return !this.dead&&!this.faulted&&this.state.connection==='CONNECTED'&&this.state.synced&&!this.state.pending;}
 private callbacks=new Set<(message:ServerMessage|null)=>void>();private dead=false;private faulted=false;private started=false;private epoch=1;
 meta:LocalMeta;private bootResolve:(()=>void)|null=null;private bootReject:((e:Error)=>void)|null=null;
 private takeoverResolve:(()=>void)|null=null;private takeoverReject:((e:Error)=>void)|null=null;private watchdog:ReturnType<typeof setTimeout>|null=null;
 constructor(private port:WorkerPort,options:LocalStart,private update:()=>void){
  this.meta={humanSide:options.humanSide,ownerSide:'SOVIET',paused:false,manual:false,reason:null,accepted:0,rejected:0};
  this.port.onmessage=e=>this.receiveLocal(e.data);this.port.onerror=()=>this.fail('WORKER_ERROR');
 }
 start(options:LocalStart):Promise<void>{if(this.started||this.dead)return Promise.reject(new Error('Already started'));this.started=true;return new Promise((resolve,reject)=>{this.bootResolve=resolve;this.bootReject=reject;this.arm();this.port.postMessage({kind:'START',epoch:this.epoch,options});});}
 subscribe(cb:(message:ServerMessage|null)=>void){this.callbacks.add(cb);return ()=>{this.callbacks.delete(cb);};}
 private receiveLocal(reply:LocalReply){
  if(this.dead||this.faulted||reply.epoch!==this.epoch)return;
  if(this.watchdog!==null)clearTimeout(this.watchdog);this.watchdog=null;
  this.meta=reply.meta;const m=reply.message;
  if(m?.messageType==='PLAYER_VIEW_SNAPSHOT'){
   this.state.snapshot=m.payload;this.state.view=m.payload.view;this.state.controllerId=m.payload.model.viewerControllerId;this.state.connection='CONNECTED';this.state.synced=true;this.state.pending=false;
  }else if(m&&['MATCH_QUERY','ACTION_ACCEPTED','ACTION_REJECTED'].includes(m.messageType))this.state.pending=false;
  if(this.bootResolve&&this.state.snapshot){this.bootResolve();this.bootResolve=null;this.bootReject=null;}
  for(const cb of [...this.callbacks])cb(m);
  if(reply.takeover){this.takeoverResolve?.();this.takeoverResolve=null;this.takeoverReject=null;}
  this.update();
  if(!this.meta.paused&&this.meta.ownerSide!==this.meta.humanSide&&!this.meta.manual&&this.state.snapshot?.status==='ACTIVE')this.arm();
 }
 send<K extends Exclude<keyof ClientPayloads,'HELLO'|'RECONNECT'|'SET_SNAPSHOT_FORMAT'>>(type:K,payload:ClientPayloads[K]):string|null {
  if(this.dead||!this.canMutate||!['SUBMIT_ACTION','QUERY_MATCH'].includes(type))return null;
  const requestId=crypto.randomUUID();this.state.pending=true;this.arm();this.port.postMessage({kind:'REQUEST',epoch:this.epoch,requestId,type,payload});return requestId;
 }
 resyncMatch(matchId:string){if(this.dead)return;this.arm();this.port.postMessage({kind:'REQUEST',epoch:this.epoch,requestId:crypto.randomUUID(),type:'RESYNC_MATCH',payload:{matchId}});}
 takeover():Promise<void>{
  if(this.dead||(!this.meta.manual&&!/^(AGENT_STOP|AGENT_ERROR|REJECTION_LIMIT)/.test(this.meta.reason??'')))return Promise.reject(new Error('Takeover unavailable'));
  return new Promise((resolve,reject)=>{this.takeoverResolve=resolve;this.takeoverReject=reject;this.state.pending=true;this.arm();this.port.postMessage({kind:'TAKEOVER',epoch:this.epoch,requestId:crypto.randomUUID()});});
 }
 private arm(){if(this.watchdog!==null)clearTimeout(this.watchdog);this.watchdog=setTimeout(()=>this.fail('WORKER_TIMEOUT'),30000);}
 private fail(reason:string){if(this.dead||this.faulted)return;this.faulted=true;this.port.terminate();if(this.watchdog!==null)clearTimeout(this.watchdog);this.watchdog=null;this.meta={...this.meta,paused:true,reason};this.state.pending=false;this.state.synced=false;this.bootReject?.(new Error(reason));this.bootReject=null;this.bootResolve=null;this.takeoverReject?.(new Error(reason));this.takeoverReject=null;this.takeoverResolve=null;for(const cb of this.callbacks)cb(null);this.update();}
 dispose(){if(this.dead)return;this.dead=true;this.epoch++;if(this.watchdog!==null)clearTimeout(this.watchdog);this.port.onmessage=null;this.port.onerror=null;this.port.terminate();this.callbacks.clear();this.bootReject?.(new Error('CANCELLED'));this.takeoverReject?.(new Error('CANCELLED'));this.takeoverReject=null;this.takeoverResolve=null;this.bootResolve=null;this.bootReject=null;}
}

export function createLocalAiWorker():WorkerPort { return new Worker(new URL('../../ai/local/worker.js',import.meta.url),{type:'module'}) as unknown as WorkerPort; }
