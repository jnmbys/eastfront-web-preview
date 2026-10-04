// Local diagnostic instance only. Never starts the owner gateway or a tunnel.
import {readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(process.argv[2]),enabled=process.argv[3]==='on';
const load=p=>import(pathToFileURL(join(root,p)).href);
const [{createMultiplayerServer},{RoomAuthority},{createMatchSession},{DEFAULTS},sessionApi,core]=await Promise.all([
 load('server/runtime.js'),load('server/authority.js'),load('server/match.js'),load('server/config.js'),load('src/core-adapter/session.js'),load('src/core-adapter/core.js')]);
const {createLocalGameSession,dispatchGameAction,controllerIdForSide}=sessionApi;
const raw=JSON.parse(readFileSync(join(root,'vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'))),SEED=17;
// Exact MP017 move scenario preparation, retained separately from fixed artifacts.
function scenario(name){
 const s=createLocalGameSession(raw,SEED);if(name==='deployment')return s;
 const apply=action=>{const r=dispatchGameAction(s,action).result;assert(r.accepted,'Pinned scenario preparation must remain legal');};
 for(const [side,special] of [['SOVIET',{'S-I-01':'3,-1'}],['GERMAN',{'G-PZ-01':'2,-1','G-I-01':'1,0','G-J-01':'2,0'}]]){
  const controllerId=controllerIdForSide(s,side),zone=core.deploymentHexKeysForSide(s.state,s.scenario,side),counts={};
  for(const [deploymentUnitId,key] of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  for(const u of s.scenario.deployment.units.filter(u=>u.side===side).sort((a,b)=>a.id.localeCompare(b.id))){if(u.id in special)continue;const key=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:u.id,hex:s.state.hexes[key].coord});counts[key]=(counts[key]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId});
 }
 apply({type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;
}
const pinned=readFileSync('scripts/mp017/serve.mjs','utf8').replaceAll('\r\n','\n');
assert.equal(scenario.toString(),pinned.slice(pinned.indexOf('function scenario(name){'),pinned.indexOf('\nconst servers=new Map();')));
const config={...DEFAULTS,host:'127.0.0.1',port:0,allowedOrigins:['http://127.0.0.1'],messagesPerWindow:10000};
const authority=new RoomAuthority(config,Date.now,(...args)=>{const m=createMatchSession(...args);m.authoritative=scenario('move');return m;});
const rows=[];
const sink={active:()=>enabled,latency(_id,row){if(row.stage.startsWith('query-')){rows.push(row);if(rows.length>4096)rows.shift();}}};
const server=createMultiplayerServer(config,authority,sink);
process.send({type:'ready',port:await server.listen(),clock:'server process performance.now',applicationQueue:'none: synchronous authority dispatch',beforeWsCallback:null});
process.on('message',async m=>{if(m.type==='finish'){await server.close();process.send({type:'done',rows},()=>process.disconnect());}});
process.on('disconnect',()=>server.close().finally(()=>process.exit()));
