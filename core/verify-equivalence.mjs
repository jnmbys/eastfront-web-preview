import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const archive=root+'core/archives/eastfront-digital-core-v0.2.25-task002G-3R1.zip';
assert.equal(createHash('sha256').update(readFileSync(archive)).digest('hex'),'b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609');
const temp=mkdtempSync(join(tmpdir(),'corefix001-'));
try{
 execFileSync('python3',['-c','import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',archive,temp]);
 const old=await import(pathToFileURL(join(temp,'eastfront-digital-core-v0.2.25-task002G-3R1/dist/index.js')));
 const fixed=await import('./source/dist/index.js');
 const scenario=structuredClone(old.defaultScenario);delete scenario.deployment;
 Object.assign(scenario,{id:'corefix001-equivalence',initialUnits:[],capitalCoreHexes:[{q:4,r:4},{q:4,r:5}],capitalOuterHexes:[],germanWestRailEntries:[{q:-5,r:0}],sovietEastRailExits:[{q:5,r:0}],sovietSupplySources:[{q:5,r:0}]});
 const G='G-HUMAN-1',S='S-AI-1';
 const unit=(id,templateId,side,type,hex)=>({id,templateId,side,type,step:0,alive:true,hex,supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
 const hexes=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
 const initial=old.createGameState({scenario,rules:old.defaultRules,hexes,edges:[],units:[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})],seed:8246});
 initial.phase='GERMAN_COMBAT';initial.activeSide='GERMAN';for(const u of Object.values(initial.units))u.supplyState='SUPPLIED';
 let a=initial,b=structuredClone(initial);const actions=[];const evidence=[];
 const ae=new old.RulesEngine(old.defaultRules,scenario),be=new fixed.RulesEngine(fixed.defaultRules,scenario);
 function apply(action){const x=ae.apply(a,action),y=be.apply(b,action);assert(x.accepted,JSON.stringify(x.issues));assert.deepEqual(y,x);a=x.state;b=y.state;actions.push(x.action);evidence.push({action:action.type,pending:a.pendingDecision?.kind??null,originalIntegrity:old.validateGameStateIntegrity(a,old.defaultRules,scenario).map(i=>i.code),fixedIntegrity:fixed.validateGameStateIntegrity(b,fixed.defaultRules,scenario).map(i=>i.code)});assert.equal(evidence.at(-1).fixedIntegrity.length,0);}
 apply({type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}});
 const battleId=a.pendingDecision.battleId;apply({type:'PASS_REACTION',controllerId:S,battleId});
 let from=a.units.d.hex;const path=[];for(let i=0;i<a.pendingDecision.retreatSteps;i++){from=old.getLegalRetreatStepOptions(a,old.defaultRules,a.units.d,from).find(h=>h.q!==1||h.r!==0);path.push(from);}
 apply({type:'RETREAT',controllerId:S,battleId,retreats:[{unitId:'d',path}]});
 apply({type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId,unitId:'g'});
 apply({type:'BREAKTHROUGH',controllerId:G,battleId,unitId:'g',path:[{q:1,r:0}]});
 apply({type:'PASS_SCHWERPUNKT',controllerId:G,battleId});
 const run=module=>module.runHeadlessGame(initial,module.defaultRules,scenario,({actionIndex})=>actions[actionIndex]??null);
 const before=run(old),after=run(fixed);assert.equal(before.terminationReason,'INTEGRITY_FAILURE');assert.equal(after.terminationReason,'NO_ACTION');assert.deepEqual(after.finalState,a);
 const replay=fixed.replayHeadlessActions(initial,fixed.defaultRules,scenario,actions);assert.deepEqual(replay.finalState,a);assert.deepEqual(replay.integrityIssues,[]);
 console.log(JSON.stringify({authorityResultsAndEventsIdentical:true,rngAndStateIdentical:true,originalHeadless:{termination:before.terminationReason,processed:before.actionsProcessed},fixedHeadless:{termination:after.terminationReason,processed:after.actionsProcessed},replayIdentical:true,actions:evidence},null,2));
}finally{rmSync(temp,{recursive:true,force:true});}
