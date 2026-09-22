import type {IncomingMessage,ServerResponse} from 'node:http';
import type {WebSocket} from 'ws';
import type {WireServerMessage} from '../src/multiplayer/protocol.js';

// Read-only transport evidence. No payloads, tokens, players, rooms or unit data.
// Entries exist only for live sockets; detailed send timing is opt-in and bounded.
export class TransportDiagnostics {
  private entries=new Map<string,{ws:WebSocket;offered:string;accepted:string;observing:boolean;sends:Record<string,unknown>[]}>();
  constructor(private origins:readonly string[],private sourceCommit:string|null){}
  add(id:string,ws:WebSocket,offer:unknown,accepted:string):void {
    const deflate=typeof offer==='string'?offer.split(',').find(v=>/^\s*permessage-deflate(?:\s*;|\s*$)/i.test(v)):undefined;
    // Only extension syntax is ever echoed, not arbitrary request headers.
    const offered=deflate&&/^[a-z0-9_;=\s-]{1,200}$/i.test(deflate)?deflate.trim():'';
    this.entries.set(id,{ws,offered,accepted,observing:false,sends:[]});
  }
  remove(id:string):void {this.entries.delete(id);}
  active(id:string):boolean {return this.entries.get(id)?.observing===true;}
  record(id:string,message:WireServerMessage,bytes:number,serializeMs:number,compressRequested:boolean,bufferedBefore:number,sentAt:number):((error?:Error)=>void)|undefined {
    const entry=this.entries.get(id);if(!entry?.observing)return;
    const p=message.payload as unknown as Record<string,unknown>;
    const row:Record<string,unknown>={type:message.messageType,bytes,serializeMs,compressRequested,negotiated:entry.ws.extensions,bufferedBefore,sendAt:sentAt};
    // Only public ordering metadata; never action type, contents, or identity.
    if(message.messageType==='ACTION_ACCEPTED'){row.requestId=message.requestId;row.acceptedRevision=p.acceptedRevision;}
    if(['ACTION_ACCEPTED','PLAYER_VIEW_SNAPSHOT','MATCH_QUERY','ACTION_REJECTED'].includes(message.messageType)){row.matchRevision=p.matchRevision;row.serverSequence=p.serverSequence;}
    entry.sends.push(row);if(entry.sends.length>64)entry.sends.shift();
    return error=>{row.writeCallbackMs=performance.now()-sentAt;row.bufferedAfter=entry.ws.bufferedAmount;row.writeError=!!error;};
  }
  handle(request:IncomingMessage,response:ServerResponse):boolean {
    if(!request.url?.startsWith('/transport-diagnostics/'))return false;
    const origin=request.headers.origin;
    if(request.method!=='GET'||!origin||!this.origins.includes(origin)){response.statusCode=403;response.end('{"error":"forbidden"}');return true;}
    response.setHeader('Access-Control-Allow-Origin',origin);response.setHeader('Vary','Origin');
    const id=request.url.slice('/transport-diagnostics/'.length);
    const entry=/^[0-9a-f-]{36}$/.test(id)?this.entries.get(id):undefined;
    if(!entry){response.statusCode=404;response.end('{"error":"not_found"}');return true;}
    entry.observing=true;
    response.end(JSON.stringify({sourceCommit:this.sourceCommit,connectionId:id,requestExtensions:entry.offered,responseExtensions:entry.accepted,negotiatedExtensions:entry.ws.extensions,
      config:{serverNoContextTakeover:true,clientNoContextTakeover:true,level:3,memLevel:7,concurrencyLimit:2,threshold:1024},
      sends:entry.sends,boundaries:['bytes are serialized UTF-8, not compressed wire size','writeCallbackMs is local write completion, not peer receipt','compression CPU and end-to-end wire bytes are not measured','server sendAt uses server performance.now; do not subtract client timestamps']}));return true;
  }
}
