import {describe,it,expect} from 'vitest';
import {RulesEngine,createGameState,defaultRules,defaultScenario,getLegalRetreatStepOptions,validateGameStateIntegrity,runHeadlessGame,replayHeadlessActions,type Action,type GameState,type ScenarioConfig} from '../src/index.js';
import {G,S,gridHexes,unit} from './helpers.js';
const scenario:ScenarioConfig=structuredClone(defaultScenario);delete scenario.deployment;
Object.assign(scenario,{id:'corefix001-real-chain',initialUnits:[],capitalCoreHexes:[{q:4,r:4},{q:4,r:5}],capitalOuterHexes:[],germanWestRailEntries:[{q:-5,r:0}],sovietEastRailExits:[{q:5,r:0}],sovietSupplySources:[{q:5,r:0}]});
const engine=new RulesEngine(defaultRules,scenario);
const audit=(s:GameState)=>validateGameStateIntegrity(s,defaultRules,scenario);
function chain(seed=8246){
 const initial=createGameState({scenario,rules:defaultRules,hexes:gridHexes(-5,5,-5,5),edges:[],units:[unit('g','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})],seed});
 initial.phase='GERMAN_COMBAT';initial.activeSide='GERMAN';for(const u of Object.values(initial.units))u.supplyState='SUPPLIED';
 let state=initial;const states=[initial],actions:Action[]=[];
 const apply=(action:Action)=>{const r=engine.apply(state,action);expect(r.accepted,JSON.stringify(r.issues)).toBe(true);state=r.state;actions.push(r.action);states.push(state);return r;};
 apply({type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}});
 const battleId=state.pendingDecision!.battleId;
 apply({type:'PASS_REACTION',controllerId:S,battleId});
 expect(state.pendingDecision?.kind).toBe('RETREAT');
 if(state.pendingDecision?.kind!=='RETREAT')throw Error('retreat');
 let from=state.units.d!.hex;const path=[];
 for(let i=0;i<state.pendingDecision.retreatSteps;i++){from=getLegalRetreatStepOptions(state,defaultRules,state.units.d!,from).find(h=>h.q!==1||h.r!==0)!;expect(from).toBeDefined();path.push(from);}
 apply({type:'RETREAT',controllerId:S,battleId,retreats:[{unitId:'d',path}]});
 apply({type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId,unitId:'g'});
 apply({type:'BREAKTHROUGH',controllerId:G,battleId,unitId:'g',path:[{q:1,r:0}]});
 expect(state.pendingDecision?.kind).toBe('SCHWERPUNKT_OPTION');
 return {initial,get state(){return state;},states,actions,apply,battleId};
}
function broken(change:(s:GameState,b:string)=>void){const c=chain();const s=structuredClone(c.state);change(s,c.battleId);return audit(s).map(x=>x.code);}
describe('CORE-FIX-001 accepted movement evidence',()=>{
 it('validates each real action transition, pass, deterministic headless run and replay',()=>{
  const c=chain();for(const s of c.states)expect(audit(s)).toEqual([]);
  const before=structuredClone(c.state.random);c.apply({type:'PASS_SCHWERPUNKT',controllerId:G,battleId:c.battleId});
  expect(c.state.pendingDecision).toBeNull();expect(audit(c.state)).toEqual([]);expect(c.state.random).toEqual(before);
  const replay=replayHeadlessActions(c.initial,defaultRules,scenario,c.actions);expect(replay.integrityIssues).toEqual([]);expect(replay.finalState).toEqual(c.state);
  const run=runHeadlessGame(c.initial,defaultRules,scenario,({actionIndex})=>c.actions[actionIndex]??null);
  expect(run.terminationReason).toBe('NO_ACTION');expect(run.finalState).toEqual(c.state);
 });
 it('retains normal target-position validation and does not treat decline as movement',()=>{
  const c=chain();const advanced=structuredClone(c.states[4]!);advanced.units.g!.hex={q:1,r:0};
  expect(audit(advanced).map(i=>i.code)).toContain('COMBAT_ADVANCE_POSITION_INVALID');
  for(const type of ['PASS_ADVANCE','PASS_BREAKTHROUGH'] as const){const s=c.states[type==='PASS_ADVANCE'?3:4]!;const r=engine.apply(s,{type,controllerId:G,battleId:c.battleId});expect(r.accepted).toBe(true);expect(audit(r.state)).toEqual([]);}
  const decline=engine.apply(c.states[4]!,{type:'BREAKTHROUGH',controllerId:G,battleId:c.battleId,unitId:'g',path:[]});expect(decline.accepted).toBe(true);expect(audit(decline.state)).toEqual([]);
  decline.state.units.g!.hex={q:1,r:0};expect(audit(decline.state).map(i=>i.code)).toContain('COMBAT_BREAKTHROUGH_POSITION_INVALID');
 });
 it('checks the exact endpoint even when another adjacent hex looks geometrically plausible',()=>{
  for(const hex of [{q:1,r:1},{q:0,r:0},{q:4,r:0}])expect(broken(s=>{s.units.g!.hex=hex;})).toContain('COMBAT_BREAKTHROUGH_POSITION_INVALID');
 });
 it.each(['missing','rejected','duplicate','actor','unit','battle','envelope','actionId','turn','phase','path','length','completion','missingCompletion','stage','stale','unresolved'] as const)('rejects corrupt or stale evidence: %s',kind=>{
  const issues=broken((s,b)=>{
   const tx=s.combatTransactions[b]!;const r=s.actionLog.find(e=>e.action.type==='BREAKTHROUGH')!;if(r.action.type!=='BREAKTHROUGH')throw Error('type');
   switch(kind){
    case 'missing':s.actionLog=s.actionLog.filter(e=>e!==r);break;
    case 'rejected':r.accepted=false;break;
    case 'duplicate':s.actionLog.push(structuredClone(r));break;
    case 'actor':r.action.controllerId=S;break;
    case 'unit':r.action.unitId='d';break;
    case 'battle':r.action.battleId='old-battle';break;
    case 'envelope':r.battleId='old-battle';break;
    case 'actionId':r.action.actionId='wrong';break;
    case 'turn':r.turn--;break;
    case 'phase':r.phase='GERMAN_MOVEMENT';break;
    case 'path':r.action.path=[{q:4,r:0}];break;
    case 'length':r.action.path=[{q:1,r:0},{q:1,r:1},{q:0,r:1}];break;
    case 'completion':tx.breakthrough!.completedUnitIds=['d'];break;
    case 'missingCompletion':tx.breakthrough!.completedUnitIds=[];break;
    case 'stage':tx.stage='ADVANCE_AFTER_COMBAT';break;
    case 'stale':s.turn++;break;
    case 'unresolved':tx.breakthrough!.resolved=false;break;
   }
  });expect(issues).toContain('COMBAT_BREAKTHROUGH_RECORD_INVALID');
 });
 it('rejects duplicate actions and stale battle references without moving or consuming RNG',()=>{
  const c=chain();const duplicate=engine.apply(c.state,c.actions[4]!);expect(duplicate.accepted).toBe(false);expect(duplicate.issues.map(i=>i.code)).toContain('ACTION_ID_DUPLICATE');expect(duplicate.state).toEqual(c.state);
  c.apply({type:'PASS_SCHWERPUNKT',controllerId:G,battleId:c.battleId});
  const r=engine.apply(c.state,{type:'BREAKTHROUGH',controllerId:G,battleId:c.battleId,unitId:'g',path:[{q:2,r:0}]});expect(r.accepted).toBe(false);expect(r.state.units).toEqual(c.state.units);expect(r.state.random).toEqual(c.state.random);expect(audit(r.state)).toEqual([]);
 });
 it('allows the actual Schwerpunkt child, all of its required steps and normal child advance',()=>{
  const c=chain(8253);c.apply({type:'SCHWERPUNKT_ATTACK',controllerId:G,sourceBattleId:c.battleId,unitId:'g',target:{q:2,r:0}});
  const child=c.state.pendingDecision!.battleId;c.apply({type:'PASS_REACTION',controllerId:S,battleId:child});
  for(let n=0;c.state.pendingDecision&&n<8;n++){
   const d=c.state.pendingDecision;
   if(d.kind==='LOSS_ALLOCATION')c.apply({type:'ALLOCATE_LOSSES',controllerId:d.decisionOwnerControllerId,battleId:child,unitIdsByStep:Array(d.lossSteps).fill(d.eligibleUnitIds[0])});
   else if(d.kind==='RETREAT'){
    const sim=structuredClone(c.state);const retreats=d.unitIds.map(unitId=>{let from=sim.units[unitId]!.hex;const path=[];for(let i=0;i<d.retreatSteps;i++){const next=getLegalRetreatStepOptions(sim,defaultRules,sim.units[unitId]!,from)[0];if(!next)break;path.push(next);from=next;sim.units[unitId]!.hex=next;}return{unitId,path};});
    c.apply({type:'RETREAT',controllerId:d.decisionOwnerControllerId,battleId:child,retreats});
   }else if(d.kind==='ADVANCE_AFTER_COMBAT')c.apply({type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:child,unitId:'g'});
   else throw Error('unexpected '+d.kind);
  }
  expect(c.state.pendingDecision).toBeNull();for(const s of c.states)expect(audit(s)).toEqual([]);
  expect(c.state.combatTransactions[child]!.stage).toBe('CLOSED');
  expect(c.state.combatTransactions[child]!.advance?.advancedUnitIds).toEqual(['g']);
  expect(replayHeadlessActions(c.initial,defaultRules,scenario,c.actions).finalState).toEqual(c.state);
 });
 it('closed breakthrough requires the matching closure action, not an unrelated old transaction',()=>{
  const c=chain();c.apply({type:'PASS_SCHWERPUNKT',controllerId:G,battleId:c.battleId});
  const corrupt=structuredClone(c.state);const close=corrupt.actionLog.at(-1)!;
  if(close.action.type!=='PASS_SCHWERPUNKT')throw Error('pass');close.action.battleId='unrelated-old-battle';
  expect(audit(corrupt).map(i=>i.code)).toContain('COMBAT_BREAKTHROUGH_RECORD_INVALID');
 });
 it('closed history accepts only a later recorded move and still rejects unrecorded displacement',()=>{
  const c=chain();c.apply({type:'PASS_SCHWERPUNKT',controllerId:G,battleId:c.battleId});
  for(let n=0;c.state.phase!=='GERMAN_MOVEMENT'&&n<20;n++)c.apply({type:'READY_FOR_PHASE_END',controllerId:c.state.activeSide==='GERMAN'?G:S});
  expect(c.state.phase).toBe('GERMAN_MOVEMENT');c.apply({type:'MOVE',controllerId:G,unitId:'g',path:[{q:0,r:0}]});
  expect(audit(c.state)).toEqual([]);const bad=structuredClone(c.state);bad.units.g!.hex={q:-1,r:0};expect(audit(bad).map(i=>i.code)).toContain('COMBAT_BREAKTHROUGH_POSITION_INVALID');
  expect(replayHeadlessActions(c.initial,defaultRules,scenario,c.actions).finalState).toEqual(c.state);
 });
});
