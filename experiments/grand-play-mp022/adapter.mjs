import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {Campaign} from '../grand-play-001/authority.mjs';
import {rules} from '../grand-play-001/rules.mjs';
import {canonical} from './sync.mjs';
import {encodeView} from './view.mjs';
export const BASELINE='0a7e670e911ffd08cc99419aa5159d422d9189a7';
const copy=structuredClone,fail=s=>{throw Error(s);},hash=v=>createHash('sha256').update(canonical(v)).digest('hex');
export class CampaignAdapter {
 constructor({saveFile=null,restore=true,CampaignClass=Campaign}={}) {
  this.c=new CampaignClass();this.c.transport={next:{a:1,b:1},economyGeneration:0,worldGeneration:0};this.era=randomUUID();this.saveFile=saveFile;
  this.tail=Promise.resolve();this.depth=0;this.peakDepth=0;this.trace=[];this.operation=0;this.accumulated=0;
  for(const g of this.c.clock.corps){g.permanentId=`${this.c.id}:${g.id}`;g.commandGeneration=0;}
  for(const u of Object.values(this.c.clock.units))u.commandGeneration=0;
  if(restore&&saveFile&&fs.existsSync(saveFile))this.loadFile();
 }
 get id(){return this.c.id;}get revision(){return this.c.version;}
 record(type,detail={}){const row={type,at:performance.now(),...detail};this.trace.push(row);if(this.evidenceFile)fs.appendFileSync(this.evidenceFile,JSON.stringify(row)+'\n');if(this.trace.length>2048)this.trace.shift();}
 async exclusive(fn){if(this.depth>=32)fail('AUTHORITY_QUEUE_FULL');this.depth++;this.peakDepth=Math.max(this.peakDepth,this.depth);const p=this.tail.then(fn);this.tail=p.catch(()=>{});try{return await p;}finally{this.depth--;}}
 seat(seat){if(!['a','b'].includes(seat))fail('SEAT_NOT_AUTHORIZED');return 'GERMAN';}
 control(seat,id){const side=this.seat(seat),a=this.c.match.controllerAssignments.find(x=>x.controllerId===side&&x.viewer===side&&x.seat===side),u=this.c.state.units[id];if(!a||!u?.alive||u.side!==side||u.controllerId!==a.coreControllerId)fail('UNIT_NOT_AUTHORIZED');return u;}
 group(seat,id){const g=this.c.clock.corps.find(g=>g.permanentId===id&&g.side===this.seat(seat));if(!g)fail('GROUP_NOT_AUTHORIZED');for(const id of g.members.filter(id=>this.c.state.units[id]?.alive))this.control(seat,id);return g;}
 accountStamp(){return hash(this.c.econ.accounts.GERMAN);}
 pending(seat){return [...this.c.receipts.values()].filter(r=>r.transport?.seat===seat&&!r.transport.acked).map(r=>copy(r.transport.result));}
 ack(seat,id){const r=this.c.receipts.get(id);if(r?.transport?.seat===seat)r.transport.acked=true;}
 async view(seat){return this.exclusive(()=>{this.seat(seat);const d=this.c.snapshot();d.transport={era:this.era,seat,nextCommandSeq:this.c.transport.next[seat],economyGeneration:this.c.transport.economyGeneration,worldGeneration:this.c.transport.worldGeneration,accountStamp:this.accountStamp(),mode:'GRAND_PLAY_SHARED_CLOCK',role:'同一德军统帅的协同操作端'};return {instanceId:this.id,revision:this.revision,era:this.era,document:encodeView(d)};});}
 async query(seat,draft){return this.exclusive(()=>{this.seat(seat);return this.c.projection(draft);});}
 saveFileNow(){if(!this.saveFile)fail('SAVE_UNAVAILABLE');const payload=JSON.stringify({schema:'GRAND-PLAY-MP022-1',campaign:this.c.save(),transport:this.c.transport});const envelope=JSON.stringify({checksum:hash(payload),payload});fs.mkdirSync(path.dirname(this.saveFile),{recursive:true});fs.writeFileSync(this.saveFile+'.tmp',envelope);fs.renameSync(this.saveFile+'.tmp',this.saveFile);}
 loadFile(){if(!this.saveFile)fail('SAVE_UNAVAILABLE');const e=JSON.parse(fs.readFileSync(this.saveFile,'utf8'));if(hash(e.payload)!==e.checksum)fail('SAVE_CHECKSUM_FAILED');const s=JSON.parse(e.payload);if(s.schema!=='GRAND-PLAY-MP022-1'||!s.transport?.next)fail('UNSUPPORTED_SAVE_VERSION');
  const old=this.c.clock,revision=this.c.version;this.c.restore(s.campaign);this.c.transport=copy(s.transport);this.c.version=Math.max(revision,this.c.version)+1;this.c.match.matchRevision=this.c.version;
  for(const g of this.c.clock.corps)g.commandGeneration=Math.max(g.commandGeneration??0,old.corps.find(x=>x.permanentId===g.permanentId)?.commandGeneration??0)+1;
  for(const [id,u]of Object.entries(this.c.clock.units))u.commandGeneration=Math.max(u.commandGeneration??0,old.units[id]?.commandGeneration??0)+1;
  this.c.transport.worldGeneration++;this.c.transport.economyGeneration++;this.era=randomUUID();this.accumulated=0;this.c.clock.paused=true;
 }
 async submit(seat,e){const receivedAt=performance.now();return this.exclusive(()=>{
  this.seat(seat);const c=this.c,startedAt=performance.now();if(e.instanceId!==c.id)fail('INSTANCE_MISMATCH');if(e.era!==this.era)fail('RESTORED_SESSION_REPLAN_REQUIRED');
  if(typeof e.requestId!=='string'||!/^[-\w:]{8,96}$/.test(e.requestId)||!Number.isSafeInteger(e.commandSeq)||e.commandSeq<1)fail('INVALID_ENVELOPE');
  const signature=canonical(e),prior=c.receipts.get(e.requestId);if(prior){if(prior.transport?.seat!==seat||prior.transport.signature!==signature)fail('ID_REUSE_CONFLICT');return copy(prior.transport.result);}
  if(c.receipts.size>=4096)fail('RECEIPT_CAPACITY_REACHED');if(e.commandSeq!==c.transport.next[seat])fail('COMMAND_SEQUENCE_GAP');
  const beforeVersion=c.version,p=copy(e.payload??{}),dep=e.dependencies??{};let reason=null,status='REJECTED',load=false;
  const before=e.kind==='LOAD'?{campaign:c.save(),transport:copy(c.transport),era:this.era}:null;
  try{
   if(e.kind==='SAVE'){c.version++;c.match.matchRevision=c.version;}
   else if(e.kind==='LOAD'){this.loadFile();load=true;}
   else if(e.kind==='OPERATION'){
    if(['ORDER','PAUSE_GROUP','ASSIGN'].includes(p.type)){const g=this.group(seat,p.groupId);if(dep.commandGeneration!==g.commandGeneration)fail('COMMAND_GENERATION_CHANGED');p.group=g.id;
     if(p.type==='PAUSE_GROUP'){p.type='ORDER';p.order={...copy(g.order),paused:true};}
    }
    if(['DIRECT','ASSIGN'].includes(p.type)){this.control(seat,p.unit);const u=c.clock.units[p.unit];if(dep.unitGeneration!==u.commandGeneration)fail('UNIT_COMMAND_CHANGED');}
    if(['PRODUCTION_LINE','ARMY_PRIORITY','BUILD_FACTORY','ECON_LINE','ECON_BUILD','ECON_QUEUE','ECON_HUB','ECON_PRIORITY'].includes(p.type)&&dep.economyGeneration!==c.transport.economyGeneration)fail('ECONOMY_CONFIGURATION_CHANGED');
    if(p.type==='BUILD_FACTORY'&&dep.account!==this.accountStamp())fail('RESOURCE_DEPENDENCY_CHANGED');
    if(['CLOCK','AUTOPAUSE'].includes(p.type)&&dep.worldGeneration!==c.transport.worldGeneration)fail('WORLD_COMMAND_CHANGED');
    const affected=c.clock.corps.filter(g=>g.id===p.group||p.type==='ASSIGN'&&g.members.includes(p.unit));
    c.transaction({id:e.requestId,version:c.version,operation:p});
    if(['ORDER','ASSIGN'].includes(p.type))for(const g of affected)g.commandGeneration++;
    if(['DIRECT','ASSIGN'].includes(p.type))c.clock.units[p.unit].commandGeneration++;
    if(['PRODUCTION_LINE','ARMY_PRIORITY','BUILD_FACTORY','ECON_LINE','ECON_BUILD','ECON_QUEUE','ECON_HUB','ECON_PRIORITY'].includes(p.type))c.transport.economyGeneration++;
    if(['CLOCK','AUTOPAUSE'].includes(p.type))c.transport.worldGeneration++;
   }else fail('UNKNOWN_COMMAND');
   status='APPLIED';
  }catch(error){reason=error.message;if(before){c.restore(before.campaign,false);c.transport=before.transport;this.era=before.era;}}
  const appliedAt=performance.now(),result={requestId:e.requestId,commandSeq:e.commandSeq,instanceId:c.id,status,reason,acceptedRevision:status==='APPLIED'?c.version:null,beforeVersion,operation:++this.operation,simulationPoint:{mode:'SHARED_CLOCK',tick:c.clock.tick},timing:{receivedAt,startedAt,appliedAt,queueMs:startedAt-receivedAt,applyMs:appliedAt-startedAt}};
  const entry=c.receipts.get(e.requestId)??{signature,result:{ok:status==='APPLIED',error:reason}};entry.transport={seat,signature,result,acked:false};c.receipts.set(e.requestId,entry);c.transport.next[seat]=Math.max(c.transport.next[seat],e.commandSeq+1);
  if(e.kind==='SAVE'&&status==='APPLIED'){try{this.saveFileNow();}catch(error){result.status='REJECTED';result.reason=error.message;result.acceptedRevision=null;}}
  this.record('command-complete',{kind:e.kind,type:p.type,requestId:e.requestId,tick:c.clock.tick,status:result.status,reason:result.reason,payload:p,epoch:c.econ.epoch,account:copy(c.econ.accounts.GERMAN),load});return copy(result);
 });}
 async step(){return this.exclusive(()=>{if(this.c.receipts.size>=4096){this.c.clock.paused=true;return;}this.record('step-start',{tick:this.c.clock.tick,groups:this.c.clock.corps.filter(g=>g.side==='GERMAN').map(g=>({id:g.permanentId,paused:g.order.paused,generation:g.commandGeneration}))});const changed=this.c.tick();this.record('step-end',{tick:this.c.clock.tick,changed});return changed;});}
 async tick(elapsed){if(this.c.clock.paused||this.c.clock.ended){this.accumulated=0;return;}this.accumulated+=Math.min(1000,elapsed)*this.c.clock.speed;if(this.accumulated>=(this.c.simRules?.wallMs??rules.wallMs)){this.accumulated-=(this.c.simRules?.wallMs??rules.wallMs);return this.step();}}
}
