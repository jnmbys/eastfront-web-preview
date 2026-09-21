import {createServer} from 'node:http';
import {WebSocketServer,WebSocket} from 'ws';
import {RoomAuthority} from './authority.js';
import {configFromEnv,type ServerConfig} from './config.js';

export function createMultiplayerServer(config:ServerConfig=configFromEnv(),authority=new RoomAuthority(config)) {
  const http=createServer((request,response)=>{
    response.setHeader('Content-Type','application/json');response.setHeader('Cache-Control','no-store');
    response.statusCode=request.url==='/health'?200:404;
    response.end(JSON.stringify(request.url==='/health'?{status:'ok',protocolVersion:1}:{error:'not_found'}));
  });
  const sockets=new WebSocketServer({noServer:true,maxPayload:config.maxMessageBytes,perMessageDeflate:false});
  const peers=new Map<WebSocket,{id:string;alive:boolean;openedAt:number}>();
  http.on('upgrade',(request,socket,head)=>{
    // Missing Origin also fails closed; non-browser automation sends an allowed Origin.
    if(request.url!=='/ws'||!request.headers.origin||!config.allowedOrigins.includes(request.headers.origin)||peers.size>=config.maxConnections){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
    sockets.handleUpgrade(request,socket,head,ws=>sockets.emit('connection',ws,request));
  });
  sockets.on('connection',ws=>{
    const id=authority.connect(message=>{
      if(ws.readyState!==WebSocket.OPEN)return;
      if(ws.bufferedAmount>config.maxBufferedBytes){ws.terminate();return;}
      ws.send(JSON.stringify(message),error=>{if(error)ws.terminate();});
    });
    peers.set(ws,{id,alive:true,openedAt:Date.now()});
    ws.on('pong',()=>{const peer=peers.get(ws);if(peer)peer.alive=true;});
    ws.on('message',(data,binary)=>{if(binary){ws.close(1003,'Text JSON required');return;}authority.receive(id,data.toString());});
    ws.on('error',()=>ws.terminate());
    ws.on('close',()=>{peers.delete(ws);authority.disconnect(id);});
  });
  const heartbeat=setInterval(()=>{
    for(const [ws,peer] of peers){if(!peer.alive){ws.terminate();continue;}peer.alive=false;ws.ping();}
  },config.heartbeatMs);heartbeat.unref();
  const sweep=setInterval(()=>{
    for(const [ws,peer] of peers)if(!authority.isIdentified(peer.id)&&Date.now()-peer.openedAt>config.handshakeTimeoutMs)ws.terminate();
    authority.sweep();
  },config.sweepMs);sweep.unref();
  return {authority,http,sockets,
    listen:()=>new Promise<number>((resolve,reject)=>{http.once('error',reject);http.listen(config.port,config.host,()=>{http.off('error',reject);const address=http.address();resolve(typeof address==='object'&&address?address.port:config.port);});}),
    close:()=>new Promise<void>(resolve=>{clearInterval(heartbeat);clearInterval(sweep);for(const ws of peers.keys())ws.terminate();sockets.close(()=>http.close(()=>resolve()));}),
  };
}
