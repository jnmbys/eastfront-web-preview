import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Campaign} from './authority.mjs';import {Campaign as Base} from '../grand-map-001/authority.mjs';import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
import {eligible,decideAction} from './policy.mjs';
const setup=c=>{for(const g of c.clock.corps.filter(g=>g.side==='GERMAN'))g.order={kind:'ADVANCE',target:{q:25,r:4},risk:'NORMAL',paused:false};c.clock.paused=false;c.clock.autopause=false;};
const tx=(c,op,id=crypto.randomUUID())=>c.transaction({id,version:c.version,operation:op});
function contact(){const c=new Campaign();setup(c);for(let n=0;n<7;n++)c.tick();return c;}
const direct=(unit,kind,b)=>({type:'DIRECT',unit,battleId:b.id,order:{kind,target:b.hex,risk:'NORMAL',paused:false}});
test('new grouping and arrows alone preserve state, RNG and economy; same target stable, different targets distinct',()=>{
 const c=new Campaign(),base=new Base();setup(c);setup(base);let many=false,distinct=false;
 for(let n=0;n<40;n++){c.tick();base.tick();assert.deepEqual(c.state,base.state);assert.deepEqual(c.econ,base.econ);assert.equal(c.clock.rng,base.clock.rng);
  const m=c.snapshot().continuous.map;assert.equal(new Set(m.battles.map(b=>JSON.stringify(b.hex))).size,m.battles.length);
  for(const b of m.battles){assert.equal(new Set(b.participants.map(p=>p.id)).size,b.participants.length);if(b.pairCount>1)many=true;}
  if(m.battles.length>1)distinct=true;
 }assert(many);assert(distinct);
});
test('actual adjacent support pays combat supply and losses; target episode stable; no automatic advance after disengagement',()=>{
 const c=contact(),b=c.snapshot().continuous.map.battles[0],unit=b.supportEligible.find(id=>!b.participants.some(p=>p.id===id));assert(unit);
 tx(c,direct(b.attackEligible[0],'ATTACK',b));tx(c,direct(unit,'SUPPORT',b));const origin=structuredClone(c.state.units[unit].hex),stock=c.econ.supply[unit].stock,personnel=c.clock.units[unit].personnel;
 c.tick();let m=c.snapshot().continuous.map;assert(m.actions.some(a=>a.unit===unit&&a.kind==='SUPPORT'&&a.status==='EXECUTING'));assert(c.econ.supply[unit].stock<stock);assert(c.clock.units[unit].personnel<personnel);assert(m.battles.some(x=>x.id===b.id&&x.participants.some(p=>p.id===unit)));
 const trace=[];for(let n=0;n<35;n++){trace.push({tick:c.clock.tick,hex:c.state.units[unit].hex,order:structuredClone(c.clock.units[unit].direct),battles:c.snapshot().continuous.map.battles.map(x=>x.id)});c.tick();if(c.clock.units[unit].direct.paused)break;}
 assert(c.clock.units[unit].direct.paused);assert.equal(c.clock.units[unit].direct.kind,'HOLD');const end=structuredClone(c.state.units[unit].hex);for(let n=0;n<3;n++)c.tick();assert.deepEqual(c.state.units[unit].hex,end);assert(!c.snapshot().continuous.map.actions.some(a=>a.unit===unit));
 fs.mkdirSync('evidence/grand-map-r1',{recursive:true});fs.writeFileSync('evidence/grand-map-r1/support-natural.json',JSON.stringify({unit,origin,end,trace,stockAfter:c.econ.supply[unit].stock,personnelAfter:c.clock.units[unit].personnel,disclaimer:'Offline normal campaign; withdrawal may change position, support never grants advance.'},null,2));
});
test('eligibility rejects range, public obstruction, low org/supply and foreign units; no hidden-state dependence',()=>{
 const c=contact(),b=c.snapshot().continuous.map.battles[0],id=b.supportEligible[0],view=c.fair('GERMAN').view,u=view.units.find(u=>u.id===id),cap=c.capability(id);
 assert.equal(eligible(view,u,cap,b.hex),null);assert(eligible(view,u,cap,{q:0,r:0}));assert(eligible(view,u,{...cap,org:44},b.hex));assert(eligible(view,u,{...cap,stock:0},b.hex));
 const order={kind:'SUPPORT',target:b.hex,risk:'NORMAL',paused:false},before=decideAction(view,u,{[id]:cap},order,{});
 const authorizedBefore=c.snapshot().continuous.map;
 for(const [enemy,v]of Object.entries(c.clock.units))if(enemy.startsWith('S-')){v.org=1;v.personnel=1;c.econ.supply[enemy].stock=0;}
 assert.deepEqual(decideAction(view,u,{[id]:cap},order,{}),before);
 const dto=c.snapshot().continuous.map;assert.deepEqual(dto,authorizedBefore);for(const x of dto.battles)for(const p of x.participants)if(p.side==='SOVIET'){assert.equal(p.org,null);assert.equal(p.equipment,null);assert.equal(p.supply,null);}
 assert.throws(()=>tx(c,direct('S-020','SUPPORT',b)));assert.throws(()=>tx(c,direct(id,'SUPPORT',{...b,id:'expired'})),/ACTIVE_TARGET/);
});
test('cancel/takeover immediately removes arrows without resetting losses; duplicate command and restore preserve ledger and relationships',()=>{
 const c=contact(),b=c.snapshot().continuous.map.battles[0],id=b.supportEligible[1],op=direct(id,'SUPPORT',b),req={id:crypto.randomUUID(),version:c.version,operation:op};
 c.transaction(req);c.tick();const state=structuredClone(c.state),econ=structuredClone(c.econ);c.transaction(req);assert.deepEqual(c.econ,econ);assert.deepEqual(c.state,state);
 const saved=c.save(),loaded=new Campaign();loaded.restore(saved);assert(loaded.clock.paused);assert.deepEqual(loaded.snapshot().continuous.map,c.snapshot().continuous.map);
 loaded.clock.paused=false;c.tick();loaded.tick();assert.deepEqual(loaded.state,c.state);assert.deepEqual(loaded.econ,c.econ);assert.equal(loaded.clock.rng,c.clock.rng);
 const loss=c.clock.units[id].losses;tx(c,{type:'DIRECT',unit:id,order:{kind:'HOLD',target:c.state.units[id].hex,paused:true,risk:'LOW'}});assert(!c.snapshot().continuous.map.actions.some(a=>a.unit===id));assert.equal(c.clock.units[id].losses,loss);
 assert.throws(()=>loaded.restore({...saved,mapRules:'OLD'}),/UNSUPPORTED/);
});
test('pausing corps does not cancel direct support; ineligible continuing order is not falsely marked executing or newly accepted',()=>{
 const c=contact(),b=c.snapshot().continuous.map.battles[0],id=b.supportEligible[1];tx(c,direct(id,'SUPPORT',b));c.tick();
 const g=c.clock.corps.find(g=>g.members.includes(id));tx(c,{type:'ORDER',group:g.id,order:{...g.order,paused:true}});
 assert(c.snapshot().continuous.map.actions.some(a=>a.unit===id&&a.kind==='SUPPORT'&&a.status==='EXECUTING'));
 c.clock.units[id].org=44;c.tick();assert(!c.snapshot().continuous.map.actions.some(a=>a.unit===id));assert.match(c.clock.units[id].reason,/组织度不足/);
});
test('generation checked adapter saves new commands and isolates old connection on disk reload',async()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'map-r1-')),'save.json'),a=new CampaignAdapter({CampaignClass:Campaign,saveFile:file});setup(a.c);for(let i=0;i<7;i++)await a.step();
 const battle=a.c.snapshot().continuous.map.battles[0],id=battle.supportEligible[1];
 const send=(kind,payload,deps={})=>a.submit('a',{instanceId:a.id,era:a.era,requestId:crypto.randomUUID(),commandSeq:a.c.transport.next.a,kind,payload,dependencies:deps});
 const op=direct(id,'SUPPORT',battle);
 assert.equal((await send('OPERATION',op,{unitGeneration:a.c.clock.units[id].commandGeneration})).status,'APPLIED');
 const rejected=await send('OPERATION',op,{unitGeneration:0});assert.equal(rejected.status,'REJECTED');assert.equal(rejected.reason,'UNIT_COMMAND_CHANGED');
 await a.step();assert.equal((await send('SAVE',{})).status,'APPLIED');
 const b=new CampaignAdapter({CampaignClass:Campaign,saveFile:file});assert(b.c.clock.paused);assert.notEqual(b.era,a.era);assert.deepEqual(b.c.clock.engagements,a.c.clock.engagements);assert.deepEqual(b.c.econ,a.c.econ);
});
