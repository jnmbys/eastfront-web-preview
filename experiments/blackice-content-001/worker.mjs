import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {start} from '../blackice-001/server.mjs';
import {eligibleModel} from '../grand-division-002/authority.mjs';
import {validate,totals} from '../grand-division-002/inventory.mjs';
import {canonical} from '../grand-play-mp022/sync.mjs';
const [temp,portText,out,stage]=process.argv.slice(2),port=Number(portText),origin='http://127.0.0.1:'+port,mode='blackice-r1',cohort=['G-025','G-026','G-030'];
const service=await start({port,origin,saveDir:temp,autoTick:false,idleMs:3600000});
const write=(name,v)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(v,null,2));
const log=v=>fs.appendFileSync(path.join(out,'timeline.ndjson'),JSON.stringify(v)+'\n');
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
let cookie=stage==='2'?fs.readFileSync(path.join(temp,'identity.private'),'utf8'):null;
const http=(url,method='GET',extra={})=>fetch(origin+url,{method,headers:{origin,cookie:cookie??'',connection:'close',...extra},redirect:'manual'});
try{
 if(!cookie){const r=await http('/visitor/start','POST');assert.equal(r.status,303);cookie=r.headers.get('set-cookie').split(';')[0];fs.writeFileSync(path.join(temp,'identity.private'),cookie);}
 const info=await http('/release/info?campaign='+mode);assert.equal(info.status,200);await info.arrayBuffer();
 const session=await http('/a/session?campaign='+mode,'POST',{'X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1'});assert.equal(session.status,200);await session.arrayBuffer();
 const adapter=service.active.get(cookie.split('=')[1].split('.')[0]+':'+mode).service.adapter,c=adapter.c;
 const business=()=>{const economy=structuredClone(c.econ.modern);delete economy.lastPersonnel;return {tick:c.clock.tick,rng:c.clock.rng,inventory:c.clock.divisionLedger,economy,units:c.state.units};};
 let meta=stage==='2'?JSON.parse(fs.readFileSync(path.join(temp,'restart.json'),'utf8')):{adopted:[],template:null,restarted:false,arrived:{},dispatches:0};
 const cmd=async(payload,kind='OPERATION')=>{
  const group=c.clock.corps.find(g=>g.permanentId===payload.groupId);
  const e={instanceId:adapter.id,era:adapter.era,requestId:'content-'+randomUUID(),commandSeq:c.transport.next.a,kind,payload,dependencies:{unitGeneration:c.clock.units[payload.unit]?.commandGeneration,commandGeneration:group?.commandGeneration,worldGeneration:c.transport.worldGeneration,economyGeneration:c.transport.economyGeneration}};
  const r=await adapter.submit('a',e);log({kind:'command',tick:c.clock.tick,type:kind==='SAVE'?kind:payload.type,unit:payload.unit,status:r.status,reason:r.reason});assert.equal(r.status,'APPLIED',r.reason);adapter.ack('a',r.requestId);return r;
 };
 if(stage==='2'){
  assert(c.clock.paused);assert.equal(digest(business()),meta.digest);assert.equal(adapter.id,meta.instanceId);
  write('restart',{sameVisitor:true,sameCampaign:true,previousPid:meta.pid,currentPid:process.pid,differentProcess:meta.pid!==process.pid,tick:c.clock.tick,paused:true,businessHash:meta.digest,transitCount:c.clock.divisionLedger.balance.transit.length});meta.restarted=true;
 }else{
  assert.equal(c.clock.rng,219031);assert.equal(c.clock.tick,0);assert.equal(Object.keys(c.state.units).length,36);
  await cmd({type:'AUTOPAUSE',enabled:false});
  for(const g of c.clock.corps.filter(g=>g.side==='GERMAN'))await cmd({type:'ORDER',groupId:g.permanentId,order:{kind:'HOLD',front:g.members.map(id=>c.state.units[id].hex),target:c.state.units[g.members[0]].hex,risk:'NORMAL',paused:false}});
  for(const id of cohort)await cmd({type:'DIRECT',unit:id,order:{kind:'HOLD',target:c.state.units[id].hex,risk:'NORMAL',paused:false}});
  const e=c.econ.modern,line=e.lines['GERMAN:support_equipment_1'],donor=e.lines['GERMAN:artillery_equipment_1'];
  await cmd({type:'ECON_LINE',line:line.id,product:line.product,factories:[donor.factories[0]],priority:1});
  write('start',{seed:c.clock.rng,tick:0,cohort:cohort.map(id=>c.clock.divisionLedger.units[id]),line:c.econ.modern.lines[line.id],inventory:c.clock.divisionLedger.nations.GERMAN});
 }
 await cmd({type:'CLOCK',paused:false,speed:1});
 let prev=null,stop='observation-budget';
 while(c.clock.tick<2880&&!c.clock.ended){
  if(c.clock.tick%12===0&&c.clock.divisionLedger.formal.xp.GERMAN>=10&&!meta.template){
   const base=c.clock.divisionLedger.formal.templates['GERMAN:blackice:0'],draft=structuredClone(base);draft.name='CONTENT001 工兵守备';draft.support[0]='ENGINEER';
   const receipt=await cmd({type:'DIVISION_FORMAL_SAVE',baseId:base.id,expectedBaseVersion:base.version,draft});meta.template=receipt.division;
  }
  if(meta.template&&c.clock.tick%12===0)for(const id of cohort.filter(id=>!meta.adopted.includes(id))){
   try{eligibleModel(c,id);}catch(e){log({kind:'eligibility',tick:c.clock.tick,unit:id,reason:e.message});continue;}
   await cmd({type:'DIVISION_FORMAL_ADOPT',unit:id,expectedUnitRevision:c.clock.divisionLedger.units[id].revision,templateId:meta.template.templateId,expectedTemplateVersion:meta.template.templateVersion});meta.adopted.push(id);
  }
  assert(await adapter.step(),'unexpected pause');const p=c.clock.divisionLedger;validate(p);
  const transit=(p.balance.transit??[]).filter(x=>cohort.includes(x.unit));
  const row={tick:c.clock.tick,xp:p.formal.xp.GERMAN,units:cohort.map(id=>({id,alive:c.state.units[id].alive,hex:c.state.units[id].hex,personnel:p.units[id].personnel,held:p.units[id].held,target:p.units[id].target,org:p.units[id].org,engaged:c.clock.units[id].engaged,refill:c.clock.units[id].refillStatus,supply:c.clock.units[id].dailySupply,reason:c.clock.units[id].reason})),stock:p.nations.GERMAN.stock,produced:p.nations.GERMAN.produced,loss:p.nations.GERMAN.lost,transit,reservations:Object.values(p.freightReservations??{}).filter(x=>cohort.includes(x.unit)),line:c.econ.modern.lines['GERMAN:support_equipment_1'],cargo:{hour:c.econ.modern.cargoHour.hour,sides:{GERMAN:c.econ.modern.cargoHour.sides.GERMAN}}};
  const signature=digest({units:row.units.map(u=>({id:u.id,alive:u.alive,personnel:u.personnel,held:u.held,target:u.target})),stock:row.stock,produced:row.produced,transit:row.transit,reservations:row.reservations});
  if(signature!==prev||c.clock.tick%12===0){log({kind:'state',...row});prev=signature;}
  if(!meta.restarted&&transit.some(x=>x.model==='support_equipment_1'&&x.arrival>c.clock.tick)){
   await cmd({},'SAVE');meta.digest=digest(business());meta.instanceId=adapter.id;meta.pid=process.pid;
   fs.writeFileSync(path.join(temp,'restart.json'),JSON.stringify(meta));write('transit-before-restart',{tick:c.clock.tick,transit,businessHash:meta.digest});console.log('saved in transit',c.clock.tick);
   await service.close();process.exit(0);
  }
  if(meta.adopted.length===3&&cohort.every(id=>{const u=p.units[id];return c.state.units[id].alive&&u.personnel===u.target.manpower&&Object.entries(u.target.equipment).every(([k,q])=>u.held[k]>=q);})) {stop='cohort-full';break;}
  if(c.clock.tick%144===0)console.log('tick',c.clock.tick,'adopted',meta.adopted.length,'support',row.units.map(x=>x.held.support_equipment_1),'produced',row.produced.support_equipment_1);
  await new Promise(r=>setImmediate(r));
 }
 await cmd({},'SAVE');const p=c.clock.divisionLedger;
 write('final',{kind:'normal campaign / automated legal player / no injection',stop:c.clock.ended?'natural-end':stop,tick:c.clock.tick,ended:c.clock.ended,restarted:meta.restarted,adopted:meta.adopted,units:cohort.map(id=>({unit:p.units[id],attributes:c.divisionAttributes(id),status:c.clock.units[id]})),nation:p.nations.GERMAN,totals:totals(p),initial:p.initial,conservation:'validated every step',line:c.econ.modern.lines['GERMAN:support_equipment_1'],network:cohort.map(id=>({id,network:c.econ.modern.net?.GERMAN?.rows?.[id]}))});
 console.log('finished',stop,c.clock.tick);
}finally{await service.close();}
