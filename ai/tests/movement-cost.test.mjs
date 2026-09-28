import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,unit,host,G,defaultRules,microScenario,RulesEngine} from './helpers.mjs';
import {scoreIntent,basicAgent} from '../../.ai-dist/ai/fair/index.js';
import {makeEdge} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/edge.js';
const move={type:'MOVE',unitId:'g',path:[{q:1,r:0}]};
function setup({terrain='PLAIN',road=false,river=null,bridge=null,oos=false,template='G-INF',type='INFANTRY'}={}){
 const s=fixture(17,[unit('g',template,'GERMAN',type,{q:0,r:0})]);
 s.hexes['1,0'].terrain=terrain;s.units.g.supplyState=oos?'OUT_OF_SUPPLY':'SUPPLIED';
 const e=makeEdge({q:0,r:0},{q:1,r:0},{road,river,bridge});s.edges[e.key]=e;
 const input=structuredClone(host(s).observe(G));input.rules.objectives=[{q:3,r:0}];
 return {s,input};
}
test('R1 public single-step cost agrees with Core across terrain, river, road, bridge, OOS and Jager cases',()=>{
 let count=0;
 for(const terrain of ['PLAIN','FOREST','HILL','MARSH'])for(const river of [null,'MINOR','MAJOR'])for(const road of [false,true])for(const oos of [false,true])for(const jager of [false,true])for(const bridge of [null,{kind:'ROAD',destroyed:false},{kind:'ROAD',destroyed:true}]){
  const {s,input}=setup({terrain,river,road,oos,bridge,...(jager?{template:'G-JAGER',type:'JAGER'}:{})});
  const result=new RulesEngine(defaultRules,microScenario).apply(s,{...move,controllerId:G});
  assert.equal(Number.isFinite(scoreIntent(input,move)),result.accepted,JSON.stringify({terrain,river,road,oos,jager,bridge,issues:result.issues}));count++;
 }
 assert.equal(count,288);
});
test('R1 cost filter chooses another affordable progress move instead of ending or repeating an impossible crossing',()=>{
 const {input}=setup({terrain:'FOREST',river:'MAJOR'});input.rules.objectives=[{q:3,r:-1}];
 assert.equal(scoreIntent(input,move),-Infinity);
 const result=basicAgent(input);assert.equal(result.intent.type,'MOVE');assert.notDeepEqual(result.intent,move);
 input.view.units[0].supplyState='OUT_OF_SUPPLY';assert.equal(scoreIntent(input,move),-Infinity);
});
test('R1 uncertain road bonus stays a proposal; unseen units and RNG cannot change preexecution output',()=>{
 const {s}=setup({road:true,river:'MAJOR',oos:true});
 const other=structuredClone(s);other.units.secret=unit('secret','S-INF','SOVIET','INFANTRY',{q:5,r:5});other.random={...other.random,seed:5,state:999};
 const a=host(s).observe(G),b=host(other).observe(G);assert.deepEqual(a,b);assert.deepEqual(basicAgent(a),basicAgent(b));
 const x=structuredClone(a);x.rules.objectives=[{q:3,r:0}];
 // Hide all authority-dependent bonus information: keep the optimistic public upper bound.
 x.rules.road.wholeMoveBonusEnabled=true;x.rules.road.wholeMoveBonusMP=10;
 assert(Number.isFinite(scoreIntent(x,move)));
});
