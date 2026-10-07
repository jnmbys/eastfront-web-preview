import {createHash,randomUUID} from 'node:crypto';
import {Campaign} from '../city-001/authority.mjs';
import {createPresentationState} from '../../.ai003-preview/src/state/presentation.js';
import {queryDraft} from '../../.ai003-preview/src/multiplayer/gameplayProtocol.js';
import {canonical} from './sync.mjs';
const clone=structuredClone,hash=x=>createHash('sha256').update(canonical(x)).digest('hex').slice(0,24),fail=m=>{throw Error(m);};
export const BASELINE='e008340a69304529ebab2f336938dba993366f34';
export class CityAdapter{
 constructor(){this.c=new Campaign();this.c.transport={next:{GERMAN:1,SOVIET:1},tick:0};this.tail=Promise.resolve();this.depth=0;this.peakDepth=0;this.stopped=false;}
 get id(){return this.c.id;}get revision(){return this.c.version;}
 async exclusive(fn){if(this.depth>=32)throw Error('AUTHORITY_QUEUE_FULL');this.depth++;this.peakDepth=Math.max(this.peakDepth,this.depth);const job=this.tail.then(fn);this.tail=job.catch(()=>{});try{return await job;}finally{this.depth--;}}
 as(side,fn){const previous=this.c.viewer;this.c.viewer=side;try{return fn();}finally{this.c.viewer=previous;}}
 stamp(side,unitId){return this.as(side,()=>{const c=this.c,u=c.state.units[unitId];if(!u||u.side!==side)return null;
  return hash({unit:u,supply:c.econ.supply[unitId],phase:c.state.phase,turn:c.state.turn,owner:c.owner(),delegated:c.delegation.seat().groups.filter(g=>g.members.includes(unitId)).map(g=>({id:g.id,order:g.order,paused:g.paused}))});});}
 accountStamp(side){return hash(this.c.econ.accounts[side]);}
 async view(side,selection={}){return this.exclusive(()=>this.as(side,()=>{
  const c=this.c,p=createPresentationState();p.selectedUnitId=selection.unitId??null;p.interactionMode='MOVE_PATH';p.pathDraft=selection.path??[];
  const s=c.snapshot(queryDraft(p)),v=s.game.message.payload.view,m=s.game.message.payload.model;
  // Never diff c.state. All world fields below come from the existing authorized view.
  return {instanceId:c.id,revision:c.version,mode:'CITY_REAL_INTERFACE',viewer:side,owner:s.owner,phase:s.phase,turn:s.turn,
   hexes:Object.fromEntries(v.hexes.map(h=>[`${h.coord.q},${h.coord.r}`,h])),edges:Object.fromEntries(v.edges.map(e=>[e.key,e])),
   units:Object.fromEntries(v.units.map(u=>[u.id,u])),contacts:v.contacts,lastKnown:v.lastKnown,pendingDecision:v.pendingDecision,
   account:s.account,accountStamp:this.accountStamp(side),cities:s.cities,officers:s.officers,
   stamps:Object.fromEntries(s.units.filter(u=>u.alive).map(u=>[u.id,this.stamp(side,u.id)])),
   legal:{selectionId:selection.id??0,unitId:p.selectedUnitId,path:p.pathDraft,revision:c.version,movement:m.movement,canAct:s.owner===side,forcedAction:s.game.message.payload.forcedAction},
   nextCommandSeq:c.transport.next[side],clock:{mode:'OLD_PHASES_NO_SHARED_CLOCK',officerServerDriven:true,halted:this.stopped}};
 }));}
 pending(side){return [...this.c.receipts.values()].filter(r=>r.transport?.side===side&&!r.transport.acked).map(r=>clone(r.transport.result));}
 ack(side,id){const r=this.c.receipts.get(id);if(r?.transport?.side===side)r.transport.acked=true;}
 async submit(side,e){const receivedAt=performance.now();return this.exclusive(()=>this.as(side,()=>{
  const c=this.c,startedAt=performance.now();if(e.instanceId!==c.id)fail('INSTANCE_MISMATCH');
  if(typeof e.requestId!=='string'||!/^[-\w:]{8,96}$/.test(e.requestId)||!Number.isSafeInteger(e.commandSeq)||e.commandSeq<1)fail('INVALID_ENVELOPE');
  const signature=canonical(e),prior=c.receipts.get(e.requestId);
  if(prior){if(prior.transport?.side!==side||prior.transport?.signature!==signature)fail('ID_REUSE_CONFLICT');return clone(prior.transport.result);}
  if(c.receipts.size>=4096||c.delegation.receipts.size>=4096)fail('RECEIPT_CAPACITY_REACHED');
  if(e.commandSeq!==c.transport.next[side])fail('COMMAND_SEQUENCE_GAP');
  let status='REJECTED',reason=null,receipt=null,acceptedAt=null;const p=e.payload??{},beforeVersion=c.version;
  try{
   if(['MOVE','OFFICER','PAUSE'].includes(e.kind)){
    if(!c.state.units[p.unitId]||c.state.units[p.unitId].side!==side)fail('UNIT_NOT_AUTHORIZED');
    if(e.dependencies?.unit!==this.stamp(side,p.unitId))fail('UNIT_DEPENDENCY_CHANGED');
   }
   if(e.kind==='BUILD'&&e.dependencies?.account!==this.accountStamp(side))fail('RESOURCE_DEPENDENCY_CHANGED');
   if(e.kind==='PHASE'&&e.dependencies?.phase!==`${c.state.turn}:${c.state.phase}`)fail('PHASE_DEPENDENCY_CHANGED');
   acceptedAt=performance.now();
   if(e.kind==='MOVE')receipt=c.transaction({id:e.requestId,version:c.version,action:{type:'MOVE',unitId:p.unitId,path:p.path}});
   else if(e.kind==='BUILD')receipt=c.transaction({id:e.requestId,version:c.version,operation:{type:'BUILD_FACTORY',district:p.district}});
   else if(e.kind==='PHASE')receipt=c.transaction({id:e.requestId,version:c.version,action:{type:'READY_FOR_PHASE_END'}});
   else if(e.kind==='OFFICER'||e.kind==='PAUSE'){
    if(c.match.status!=='ACTIVE')fail('GAME_OVER');
    // Existing config validation and existing transaction receipt map; no parallel business ledger.
    const before=clone(c.delegation.seats);try{const s=c.delegation.seat(),config=command=>c.delegation.config({revision:s.revision,command});
     if(e.kind==='OFFICER'){config({type:'ENABLE',enabled:true});config({type:'ASSIGN',group:String(p.group??0),unit:p.unitId,direct:false});config({type:'ORDER',group:String(p.group??0),order:p.order});}
     else {const g=s.groups.find(g=>g.members.includes(p.unitId));if(!g)fail('NO_OFFICER_ORDER');config({type:'PAUSE',group:g.id});}
     c.version++;c.match.matchRevision=c.version;receipt={ok:true,version:c.version,orderAccepted:true};c.receipts.set(e.requestId,{signature, result:receipt});
    }catch(error){c.delegation.seats=before;throw error;}
   }else fail('UNKNOWN_COMMAND');status='APPLIED';
  }catch(error){reason=error.message;acceptedAt=null;}
  const appliedAt=performance.now();const result={requestId:e.requestId,commandSeq:e.commandSeq,instanceId:c.id,status,reason,acceptedRevision:status==='APPLIED'?c.version:null,
   simulationPoint:{mode:'CITY_PHASE',turn:c.state.turn,phase:c.state.phase},timing:{receivedAt,startedAt,acceptedAt,appliedAt,queueMs:startedAt-receivedAt,applyMs:appliedAt-startedAt},beforeVersion};
  const entry=c.receipts.get(e.requestId)??{signature,result:{ok:false,error:reason}};
  entry.transport={side,signature,result,acked:false};c.receipts.set(e.requestId,entry);c.transport.next[side]++;return clone(result);
 }));}
 async tick(){return this.exclusive(async()=>{
  const c=this.c;if(c.receipts.size>=4096||c.delegation.receipts.size>=4096){this.stopped=true;return;}
  const side=c.owner(),previous=c.viewer;c.viewer=side;try{if(c.delegation.active().length)await c.delegation.tick({id:`mp022-officer-${++c.transport.tick}-${randomUUID()}`,version:c.version,revision:c.delegation.seat().revision});}finally{c.viewer=previous;}
 });}
}
