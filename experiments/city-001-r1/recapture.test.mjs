import fs from 'node:fs';import assert from 'node:assert/strict';import {Campaign} from '../city-001/authority.mjs';import {tx,until,h,moveEast} from '../city-001/check.mjs';import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
const c=new Campaign(),trace=[],marks={},push=(action,operation)=>{const r=tx(c,action,operation);trace.push(r);return r;};
const warehouse='DISTRICT:CITY-DNIEPER:D2';let first,second,recaptureRequest,recaptureResult;
function advance(t,p){for(let n=0;n<100;n++){if(c.state.turn===t&&c.state.phase===p)return;
 if(c.state.phase==='SOVIET_REINFORCEMENT_SUPPLY'){
  if(c.state.turn===1){first=push(null,{type:'BUILD_FACTORY',district:'CITY-DNIEPER:D2'}).r.facility;push(null,{type:'PRODUCTION_LINE',warehouse,product:'RIFLE'});for(const a of c.econ.ux.armies.SOVIET)push(null,{type:'ARMY_PRIORITY',army:a.id,priority:a.priority,materials:false,reserve:0});}
  if(c.state.turn===3){second=push(null,{type:'BUILD_FACTORY',district:'CITY-DNIEPER:D2'}).r.facility;push(null,{type:'PRODUCTION_LINE',warehouse,product:'HEAVY'});}
 }
 push({type:'READY_FOR_PHASE_END'});
 }throw Error('BOUND');}
function to(id,target){const u=c.state.units[id],dest=h(target),queue=[[]],seen=new Set(),found=[];
 for(let i=0;i<queue.length&&i<3000;i++){const path=queue[i],at=path.at(-1)??u.hex;for(const step of core.getNeighbors(at)){if(!c.state.hexes[core.hexKey(step)]||path.some(x=>core.hexKey(x)===core.hexKey(step)))continue;const next=[...path,step],r=c.match.authoritative.engine.apply(c.state,{type:'MOVE',controllerId:u.side,unitId:id,path:next});if(!r.accepted)continue;if(core.hexKey(step)===core.hexKey(dest)){if(id==='S-028'&&target==='AB18'){
 const before=JSON.stringify([c.state,c.econ,c.version,[...c.receipts]]),capture=c.capture.bind(c);c.capture=a=>{capture(a);throw Error('RECAPTURE_PRECOMMIT');};
 assert.throws(()=>push({type:'MOVE',unitId:id,path:next}),/RECAPTURE_PRECOMMIT/);assert.equal(JSON.stringify([c.state,c.econ,c.version,[...c.receipts]]),before);c.capture=capture;
 const done=push({type:'MOVE',unitId:id,path:next});recaptureRequest=done.q;recaptureResult=done.r;
 }else push({type:'MOVE',unitId:id,path:next});return true;}const key=core.hexKey(step);if(!seen.has(key)&&next.length<7){seen.add(key);queue.push(next);found.push(next);}}}
 found.sort((a,b)=>core.hexDistance(a.at(-1),dest)-core.hexDistance(b.at(-1),dest));if(found[0]){push({type:'MOVE',unitId:id,path:found[0]});return false;}throw Error(`NO_ROUTE ${id} ${target}`);}
advance(1,'GERMAN_MOVEMENT');push({type:'MOVE',unitId:'G-026',path:[h('Z17')]});advance(1,'SOVIET_MOVEMENT');for(let i=25;i<=36;i++)moveEast(c,'S-'+String(i).padStart(3,'0'),trace);
advance(2,'GERMAN_MOVEMENT');to('G-026','AC17');advance(2,'SOVIET_MOVEMENT');for(let i=25;i<=36;i++)moveEast(c,'S-'+String(i).padStart(3,'0'),trace);
advance(3,'GERMAN_MOVEMENT');to('G-026','AC17');advance(4,'GERMAN_MOVEMENT');
marks.before={trace:trace.length,warehouse:structuredClone(c.econ.warehouses[warehouse]),line:structuredClone(c.econ.ux.lines[warehouse]),facilities:[first,second].map(id=>structuredClone(c.econ.ux.facilities[id]))};
assert(to('G-026','AB18'));marks.lost={trace:trace.length,warehouse:structuredClone(c.econ.warehouses[warehouse]),line:structuredClone(c.econ.ux.lines[warehouse]),facilities:[first,second].map(id=>structuredClone(c.econ.ux.facilities[id]))};
advance(5,'GERMAN_MOVEMENT');to('G-026','Y17');advance(5,'SOVIET_MOVEMENT');console.log('S028',c.state.units['S-028'].hex);let returned=to('S-028','AB18');if(!returned){advance(6,'SOVIET_MOVEMENT');returned=to('S-028','AB18');}assert(returned);marks.returned={trace:trace.length,warehouse:structuredClone(c.econ.warehouses[warehouse]),line:structuredClone(c.econ.ux.lines[warehouse]),facilities:[first,second].map(id=>structuredClone(c.econ.ux.facilities[id]))};
assert.equal(c.econ.ux.facilities[second].status,'BUILDING');assert.equal(c.econ.ux.facilities[second].progress,1);assert.equal(c.econ.ux.lines[warehouse].progress.HEAVY,4);assert.equal(c.econ.warehouses[warehouse].lots.find(l=>l.type==='RIFLE').qty,1);
advance(c.state.turn+1,'GERMAN_SUPPLY_RAIL');marks.after={trace:trace.length,warehouse:structuredClone(c.econ.warehouses[warehouse]),line:structuredClone(c.econ.ux.lines[warehouse]),facilities:[first,second].map(id=>structuredClone(c.econ.ux.facilities[id]))};assert.equal(c.econ.ux.facilities[second].status,'BUILT');
const late=JSON.stringify([c.state,c.econ,c.version]);assert.deepEqual(c.transaction(recaptureRequest),recaptureResult);assert.equal(JSON.stringify([c.state,c.econ,c.version]),late);assert.throws(()=>c.transaction({...recaptureRequest,id:crypto.randomUUID()}),/STALE/);assert.throws(()=>c.transaction({...recaptureRequest,action:{type:'READY_FOR_PHASE_END'}}),/ID_REUSE/);
assert.equal(c.econ.cities.constructionSpentI.SOVIET,12);
fs.writeFileSync('evidence/city-001-r1/real-recapture.json',JSON.stringify({kind:'real commands, unmodified normal scenario',trace,marks},null,2));console.log('PASS legal recapture, conserved assets, precommit rollback, late receipt and version competition');

