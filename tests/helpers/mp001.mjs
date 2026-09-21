import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {WebSocket} from 'ws';
import {RoomAuthority} from '../../.server-dist/server/authority.js';
import {createMultiplayerServer} from '../../.server-dist/server/runtime.js';
import {DEFAULTS} from '../../.server-dist/server/config.js';
import {clientMessage} from '../../dist/app/multiplayer/protocol.js';
export function harness(options={}){
  let now=10000;const authority=new RoomAuthority({...DEFAULTS,...options.config},()=>now,options.factory,options.codeFactory);
  const peer=(name='Player')=>{
    const messages=[],connectionId=authority.connect(m=>messages.push(JSON.parse(JSON.stringify(m))));
    const send=(type,payload={})=>{const id=randomUUID();authority.receive(connectionId,JSON.stringify(clientMessage(type,payload,id)));return messages.filter(m=>m.requestId===id).at(-1);};
    if(name!==null)send('HELLO',{displayName:name});
    return {messages,connectionId,send,last:type=>messages.findLast(m=>m.messageType===type),get welcome(){return this.last('WELCOME')?.payload;},get room(){return this.last('ROOM_STATE')?.payload.room;}};
  };
  return {authority,peer,advance(ms){now+=ms;authority.sweep();}};
}
export function pair(h){const a=h.peer('A'),b=h.peer('B');a.send('CREATE_ROOM');b.send('JOIN_ROOM',{roomCode:a.room.roomCode});return {a,b};}
export function seats(a,b){a.send('SELECT_SEAT',{seat:'GERMANY'});b.send('SELECT_SEAT',{seat:'SOVIET'});}
export function start(a,b){seats(a,b);a.send('SET_READY',{ready:true});b.send('SET_READY',{ready:true});}
export async function network(t,options={}){
  const config={...DEFAULTS,port:0,allowedOrigins:['http://127.0.0.1:4173'],...options.config};
  const authority=new RoomAuthority(config,Date.now,options.factory);
  const server=createMultiplayerServer(config,authority),port=await server.listen();
  const all=[];t.after(async()=>{for(const p of all)p.ws.terminate();await server.close();});
  async function peer(name='Player',token=null){
    const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:config.allowedOrigins[0]});
    const messages=[],listeners=new Set();
    ws.on('message',data=>{const m=JSON.parse(data.toString());messages.push(m);for(const listener of listeners)listener(m);});
    ws.on('error',()=>{});
    await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
    const wait=(predicate,timeout=5000)=>{
      const existing=messages.findLast(predicate);if(existing)return Promise.resolve(existing);
      return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{listeners.delete(listener);reject(new Error('Network response timed out'));},timeout);const listener=m=>{if(predicate(m)){clearTimeout(timer);listeners.delete(listener);resolve(m);}};listeners.add(listener);});
    };
    const request=(type,payload={})=>{const id=randomUUID();const reply=wait(m=>m.requestId===id);ws.send(JSON.stringify(clientMessage(type,payload,id)));return reply;};
    const p={ws,messages,wait,request,get room(){return messages.findLast(m=>m.messageType==='ROOM_STATE')?.payload.room;},get welcome(){return messages.findLast(m=>m.messageType==='WELCOME')?.payload;}};
    all.push(p);
    if(token)await request('RECONNECT',{reconnectToken:token});else if(name!==null)await request('HELLO',{displayName:name});
    return p;
  }
  return {server,authority,port,peer};
}
export function assertPrivate(view,side,opposingIds=[]){
  assert.equal(view.viewer,side);assert(view.units.every(u=>u.side===side));assert.deepEqual(view.contacts,[]);
  for(const key of ['authoritativeState','random','combatTransactions','actionLog','deployment','controllers','engine','reconnectToken'])assert(!(key in view),key);
  assert.deepEqual(Object.keys(view.resources),[side]);
  for(const id of opposingIds)assert(!JSON.stringify(view).includes(`"${id}"`),`hidden ID ${id}`);
}
