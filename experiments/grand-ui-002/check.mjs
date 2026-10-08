import assert from 'node:assert/strict';import fs from 'node:fs';import {gunzipSync} from 'node:zlib';
import {groupForces,retainGroupKeys,scaleMode} from '../../.ai003-preview/src/playable/forceScale.js';import {hexToPixel} from '../../.ai003-preview/src/geometry/hex.js';
import {ownStatus,aggregateStatus} from '../../.ai003-preview/src/playable/unitStatus.js';
import {stackPanel} from '../../.ai003-preview/src/playable/compactForces.js';
import {Campaign} from '../grand-vision-001/authority.mjs';
const unit=(id,q,r,side='GERMAN')=>({id,hex:{q,r},side,type:'INFANTRY'}),us=[unit('a',0,0),unit('b',1,0),unit('c',0,0),unit('d',20,0),unit('s',0,0,'SOVIET')],corps=[{id:'one',name:'第一军团',members:['a','b','d']},{id:'two',name:'第二军团',members:['c']}],own={a:{},b:{},c:{},d:{}};
const group=(arr=us,mode='far',scale=.15,cs=corps,ou=own)=>groupForces(arr,'GERMAN',cs,ou,mode,scale,hexToPixel);
assert.equal(scaleMode(35,'far'),'far');assert.equal(scaleMode(35,'middle'),'middle');assert.equal(scaleMode(30,'middle'),'far');assert.equal(scaleMode(68,'middle'),'middle');assert.equal(scaleMode(70,'middle'),'near');assert.equal(scaleMode(59,'near'),'near');assert.equal(scaleMode(56,'near'),'middle');
const a=group();assert.equal(a.length,4);assert.deepEqual(a.find(g=>g.units.some(u=>u.id==='a')).units.map(u=>u.id),['a','b']);assert.equal(a.find(g=>g.units.some(u=>u.id==='d')).units.length,1);assert.equal(group(us,'near',1).length,5);assert.equal(group(us,'middle',.5).find(g=>g.units.some(u=>u.id==='a')).crossHex,true);
assert.deepEqual(group(us.slice().reverse()),a);assert.deepEqual(group([...us,us[0]]),a);
assert.equal(group(us,'far',.15,corps,{...own,b:{direct:{kind:'HOLD'}}}).length,5);
const noEnemy=us.filter(u=>u.id!=='s'),next=retainGroupKeys(group(noEnemy),a);assert.equal(next.flatMap(g=>g.units).length,4);assert(!next.some(g=>g.units.some(u=>u.id==='s')));assert.equal(new Set(next.map(g=>g.key)).size,next.length);
const survivor=retainGroupKeys(group(us.filter(u=>u.id!=='a')),a);assert.equal(survivor.find(g=>g.units.some(u=>u.id==='b')).key,a.find(g=>g.units.some(u=>u.id==='a')).key);
const start=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-ui-002/comparison-start.save.json.gz'))).payload).campaign;
const c=new Campaign(),d=new Campaign();c.restore(start);d.restore(start);// Display-only directed danger data; never applied to the campaign or browser.
const dto0=d.snapshot(),port={data:structuredClone(dto0),selections:{}};const ownIds=port.data.game.message.payload.view.units.filter(u=>u.side===port.data.viewer).slice(0,2).map(u=>u.id);
port.data.continuous.units[ownIds[0]].org=17;port.data.continuous.units[ownIds[1]].org=90;
const danger=aggregateStatus(ownIds.map(id=>ownStatus(port,id)));assert.equal(danger.low,1);assert(danger.orgRatio>.5);
const enemyId=port.data.game.message.payload.view.units.find(u=>u.side!==port.data.viewer).id;assert.equal(ownStatus(port,enemyId),null);
port.selections['scale-members']=JSON.stringify(ownIds);port.selections['scale-affiliation']=port.data.continuous.corps[0].id;
port.data.continuous.units[ownIds[0]].direct={kind:'HOLD'};assert(!stackPanel(port).includes('data-stack-unit="'+ownIds[0]+'"'));
const metrics=[];let elapsed=0;for(let step=0;step<8;step++){
 const dto=d.snapshot(),v=dto.game.message.payload.view,stamp=JSON.stringify(d.save()),t=performance.now();
 for(const [mode,scale]of [['far',.2],['middle',.6],['near',1.2]]){const gs=groupForces(v.units,v.viewer,dto.continuous.corps,dto.continuous.units,mode,scale,hexToPixel);assert.equal(new Set(gs.flatMap(g=>g.units.map(u=>u.id))).size,v.units.length);assert(gs.every(g=>new Set(g.units.map(u=>u.side)).size===1));metrics.push({step,mode,units:v.units.length,markers:gs.length});}
 elapsed+=performance.now()-t;assert.equal(JSON.stringify(d.save()),stamp);c.advance();d.advance();assert.deepEqual(d.state,c.state);assert.deepEqual(d.econ,c.econ);assert.deepEqual(d.clock,c.clock);assert.deepEqual(d.vision,c.vision);
}
fs.writeFileSync('evidence/grand-ui-002/check.json',JSON.stringify({hysteresis:true,directedLowOrgNotHiddenByMean:true,enemyExactStatusUnknown:true,expandedRosterUpdatesOnTakeover:true,currentRosterAndDirectIsolation:true,enemyAuthorization:true,localityBound:4,deduplicated:true,permutationStable:true,retainedSurvivingIdentity:true,withdrawalNoGhost:true,displayDoesNotMutate:true,replaySteps:8,equalAuthorityEconomyRngAndVision:true,groupingTotalMs:elapsed,metrics},null,2));console.log('PASS bounded display grouping, authorization, hysteresis, identity and 8-step replay equivalence; '+elapsed.toFixed(2)+'ms grouping total');
