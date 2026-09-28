import assert from 'node:assert/strict';
import {
  RulesEngine, canonicalEdgeKey, createDeploymentGameState, createGameState, defaultRules,
  deploymentHexKeysForSide, projectDeploymentView, runHeadlessGame, replayHeadlessActions,
  validateGameStateIntegrity
} from '../dist/index.js';

const H=(q,r=0,terrain='PLAIN')=>({coord:{q,r},terrain,control:null});
const E=(a,b,repairedBy='GERMAN')=>({key:canonicalEdgeKey(a,b),a,b,road:false,railway:{present:true,repairedBy,destroyed:false},river:null,bridge:null});
const unit=(id,templateId,side,type,hex,controllerId)=>({id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'OUT_OF_SUPPLY',entrenched:false,hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});

function makeScenario(twoByTwo=true){
  const controllers=twoByTwo?[
    {id:'G1',side:'GERMAN',controllerType:'HUMAN'},{id:'G2',side:'GERMAN',controllerType:'HUMAN'},
    {id:'S1',side:'SOVIET',controllerType:'HUMAN'},{id:'S2',side:'SOVIET',controllerType:'HUMAN'}
  ]:[{id:'G1',side:'GERMAN',controllerType:'HUMAN'},{id:'S1',side:'SOVIET',controllerType:'HUMAN'}];
  const units=twoByTwo?[
    {id:'S-A',templateId:'S-INF',side:'SOVIET'},{id:'S-B',templateId:'S-AT',side:'SOVIET'},
    {id:'G-A',templateId:'G-INF',side:'GERMAN'},{id:'G-B',templateId:'G-PANZER',side:'GERMAN'}
  ]:[{id:'S-A',templateId:'S-INF',side:'SOVIET'},{id:'G-A',templateId:'G-INF',side:'GERMAN'}];
  return {
    id:'deploy-mini',displayName:'Deploy Mini',rulesId:defaultRules.id,board:{paperColumns:6,paperRows:2},turnLimit:3,
    experimental:{turnLimitCandidates:[3],wholeRoadMoveBonusCandidate:false},
    germanWestRailEntries:[{q:-2,r:0}],sovietEastRailExits:[{q:3,r:0}],sovietSupplySources:[{q:3,r:0}],
    capitalCoreHexes:[{q:2,r:0},{q:3,r:0}],capitalOuterHexes:[],reinforcements:[],controllers,initialUnits:[],
    deployment:{sequence:['SOVIET','GERMAN'],hiddenUntilBothComplete:true,zones:{
      GERMAN:{kind:'WESTERNMOST_COLUMNS',columnCount:3},
      SOVIET:{kind:'COMPLEMENT_OF_SIDE_ZONE',excludedSide:'GERMAN'}
    },units}
  };
}
function map(){
  const hexes=[]; for(let q=-2;q<=3;q++) hexes.push(H(q,0)); hexes.push(H(2,1,'LAKE'));
  const edges=[]; for(let q=-2;q<3;q++) edges.push(E({q,r:0},{q:q+1,r:0}));
  return {hexes,edges};
}
function fresh(twoByTwo=true){const scenario=makeScenario(twoByTwo);const m=map();return {scenario,state:createDeploymentGameState({scenario,rules:defaultRules,...m,seed:7}),...m};}
const reason=(r)=>r.issues[0]?.details?.reason;

// Dynamic westernmost actual q columns, Soviet complement, LAKE exclusion.
{
  const {state,scenario}=fresh();
  const g=deploymentHexKeysForSide(state,scenario,'GERMAN'); const s=deploymentHexKeysForSide(state,scenario,'SOVIET');
  assert.deepEqual([...new Set(g.map(k=>state.hexes[k].coord.q))].sort((a,b)=>a-b),[-2,-1,0]);
  assert.deepEqual([...new Set(s.map(k=>state.hexes[k].coord.q))].sort((a,b)=>a-b),[1,2,3]);
  assert(!g.includes('2,1')&&!s.includes('2,1'));
  assert.equal(state.phase,'SOVIET_DEPLOYMENT'); assert.equal(state.activeSide,'SOVIET'); assert.equal(state.turn,1);
}

// Soviet-first, controller assignment, reposition, teammate cannot steal, stacking and incomplete Ready.
{
  const {state,scenario}=fresh(); const engine=new RulesEngine(defaultRules,scenario);
  let r=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:'G1',deploymentUnitId:'G-A',hex:{q:-2,r:0}});
  assert.equal(r.accepted,false); assert.equal(r.issues[0].code,'WRONG_SIDE');
  r=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:2,r:1}});
  assert.equal(r.accepted,false); assert.equal(r.issues[0].code,'INVALID_DEPLOYMENT_HEX');
  let a=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:1,r:0}}); assert(a.accepted); let st=a.state;
  assert.equal(st.units['S-A'].controllerId,'S1'); assert.equal(st.units['S-A'].hasMoved,false);
  a=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:2,r:0}}); assert(a.accepted); st=a.state; assert.deepEqual(st.units['S-A'].hex,{q:2,r:0});
  r=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S2',deploymentUnitId:'S-A',hex:{q:1,r:0}}); assert.equal(r.accepted,false); assert.equal(r.issues[0].code,'NOT_UNIT_CONTROLLER');
  r=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:'S1'}); assert.equal(r.accepted,false); assert.equal(r.issues[0].code,'INITIAL_DEPLOYMENT_INCOMPLETE');
  a=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S2',deploymentUnitId:'S-B',hex:{q:2,r:0}}); assert(a.accepted); st=a.state; assert.equal(st.units['S-B'].controllerId,'S2');
  // third living unit into stack 2 via custom extra roster fixture
  const sc=structuredClone(scenario); sc.deployment.units.push({id:'S-C',templateId:'S-INF',side:'SOVIET'});
  const eng2=new RulesEngine(defaultRules,sc); r=eng2.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-C',hex:{q:2,r:0}}); assert.equal(r.accepted,false); assert.equal(r.issues[0].code,'STACKING_LIMIT');
}

// 2v2 side-wide barrier, hidden views, no actionLog leakage, gameplay blocked.
let finalized;
{
  const {state,scenario,hexes,edges}=fresh(); const engine=new RulesEngine(defaultRules,scenario); let st=state;
  for (const action of [
    {type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:1,r:0}},
    {type:'DEPLOY_INITIAL_UNIT',controllerId:'S2',deploymentUnitId:'S-B',hex:{q:2,r:0}}
  ]) { const r=engine.apply(st,action); assert(r.accepted); st=r.state; }
  let rv=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:'S1'}); assert(rv.accepted); st=rv.state; assert.equal(st.phase,'SOVIET_DEPLOYMENT');
  rv=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:3,r:0}}); assert.equal(rv.accepted,false); assert.equal(rv.issues[0].code,'CONTROLLER_ALREADY_READY');
  rv=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:'S2'}); assert(rv.accepted); st=rv.state; assert.equal(st.phase,'GERMAN_DEPLOYMENT'); assert.equal(st.activeSide,'GERMAN');
  const sv=projectDeploymentView(st,scenario,'S1'); const gv0=projectDeploymentView(st,scenario,'G1');
  assert.deepEqual(Object.keys(sv.units).sort(),['S-A','S-B']); assert.deepEqual(Object.keys(gv0.units),[]); assert.equal('actionLog' in sv,false);
  let g=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'G1',deploymentUnitId:'G-A',hex:{q:-2,r:0}}); assert(g.accepted); st=g.state;
  g=engine.apply(st,{type:'DEPLOY_INITIAL_UNIT',controllerId:'G2',deploymentUnitId:'G-B',hex:{q:-1,r:0}}); assert(g.accepted); st=g.state;
  const sv2=projectDeploymentView(st,scenario,'S1'); const gv=projectDeploymentView(st,scenario,'G2');
  assert.deepEqual(Object.keys(sv2.units).sort(),['S-A','S-B']); assert.deepEqual(Object.keys(gv.units).sort(),['G-A','G-B']);
  assert(!JSON.stringify(sv2.units).includes('G-A')); assert(!JSON.stringify(gv.units).includes('S-A'));
  const blocked=engine.apply(st,{type:'MOVE',controllerId:'G1',unitId:'G-A',path:[{q:-1,r:0}]}); assert.equal(blocked.accepted,false); assert.equal(blocked.issues[0].code,'WRONG_PHASE');
  const rein=engine.apply(st,{type:'DEPLOY_REINFORCEMENT',controllerId:'G1',reinforcementId:'x',entryHex:{q:-2,r:0}}); assert.equal(rein.accepted,false); assert.equal(rein.issues[0].code,'WRONG_PHASE');
  let r1=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:'G1'}); assert(r1.accepted); st=r1.state; assert.equal(st.phase,'GERMAN_DEPLOYMENT');
  let r2=engine.apply(st,{type:'READY_FOR_PHASE_END',controllerId:'G2'}); assert(r2.accepted); st=r2.state;
  assert.equal(st.phase,'GERMAN_SUPPLY_RAIL'); assert.equal(st.activeSide,'GERMAN'); assert.equal(st.turn,1); assert.deepEqual(st.phaseReadyControllerIds,[]);
  assert.deepEqual(r2.events.map(e=>e.type),['ControllerReadyForPhaseEnd','PhaseEnded','GameTurnStarted','PlayerTurnStarted']);
  assert.equal(st.cp.GERMAN,Math.min(defaultRules.cp.maximum,defaultRules.cp.initial+defaultRules.cp.gainPerOwnTurn));
  finalized={state:st,scenario,hexes,edges};
}

// Turn-1 CP/supply parity with legacy createGameState using the same final placements.
{
  const {state,scenario,hexes,edges}=finalized;
  const sameUnits=Object.values(state.units).map(u=>unit(u.id,u.templateId,u.side,u.type,u.hex,u.controllerId));
  const legacy=createGameState({scenario,rules:defaultRules,hexes,edges,units:sameUnits,seed:7});
  assert.deepEqual(state.cp,legacy.cp);
  for (const id of Object.keys(state.units).sort()) assert.equal(state.units[id].supplyState,legacy.units[id].supplyState);
}

// View rejects outside deployment.
assert.throws(()=>projectDeploymentView(finalized.state,finalized.scenario,'S1'));

// Integrity: valid deployment state; bad config audits.
{
  const {state,scenario}=fresh(); assert.deepEqual(validateGameStateIntegrity(state,defaultRules,scenario),[]);
  const bad=structuredClone(scenario); bad.deployment.units.push(structuredClone(bad.deployment.units[0]));
  assert(validateGameStateIntegrity(state,defaultRules,bad).some(i=>i.code==='DEPLOYMENT_UNIT_ID_DUPLICATE'));
  const badCol=structuredClone(scenario); badCol.deployment.zones.GERMAN={kind:'WESTERNMOST_COLUMNS',columnCount:0};
  assert(validateGameStateIntegrity(state,defaultRules,badCol).some(i=>i.code==='DEPLOYMENT_ZONE_INVALID'));
  const badHex=structuredClone(scenario); badHex.deployment.zones.GERMAN={kind:'EXPLICIT_HEXES',hexes:[{q:99,r:99}]};
  assert(validateGameStateIntegrity(state,defaultRules,badHex).some(i=>i.code==='DEPLOYMENT_ZONE_HEX_INVALID'));
}

// Post-setup deployment-roster integrity hardening: roster records persist, destruction/movement remain legal.
{
  const {state,scenario}=finalized;

  const missingGerman=structuredClone(state);
  delete missingGerman.units['G-A'];
  assert(validateGameStateIntegrity(missingGerman,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING'&&i.details?.unitId==='G-A'));

  const missingSoviet=structuredClone(state);
  delete missingSoviet.units['S-A'];
  assert(validateGameStateIntegrity(missingSoviet,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING'&&i.details?.unitId==='S-A'));

  const destroyed=structuredClone(state);
  destroyed.units['G-A'].alive=false;
  assert(!validateGameStateIntegrity(destroyed,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING'&&i.details?.unitId==='G-A'));

  const moved=structuredClone(state);
  moved.units['G-A'].hex={q:3,r:0};
  assert(!validateGameStateIntegrity(moved,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_STATE_HEX_INVALID'&&i.details?.unitId==='G-A'));

  const identityCorrupt=structuredClone(state);
  identityCorrupt.units['G-A'].templateId='G-PANZER';
  assert(validateGameStateIntegrity(identityCorrupt,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_STATE_UNIT_MISMATCH'&&i.details?.unitId==='G-A'));
}

// During German deployment the completed Soviet roster is still mandatory.
{
  const {state,scenario}=fresh(); const engine=new RulesEngine(defaultRules,scenario); let st=state;
  for (const action of [
    {type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:1,r:0}},
    {type:'DEPLOY_INITIAL_UNIT',controllerId:'S2',deploymentUnitId:'S-B',hex:{q:2,r:0}},
    {type:'READY_FOR_PHASE_END',controllerId:'S1'},
    {type:'READY_FOR_PHASE_END',controllerId:'S2'}
  ]) { const r=engine.apply(st,action); assert(r.accepted); st=r.state; }
  assert.equal(st.phase,'GERMAN_DEPLOYMENT');
  delete st.units['S-A'];
  assert(validateGameStateIntegrity(st,defaultRules,scenario).some(i=>i.code==='DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING'&&i.details?.unitId==='S-A'));
}

// Backward compatibility: scenario without deployment retains createGameState opening semantics.
{
  const scenario=structuredClone(makeScenario(false)); delete scenario.deployment; const {hexes,edges}=map();
  const st=createGameState({scenario,rules:defaultRules,hexes,edges,units:[],seed:1}); assert.equal(st.phase,'GERMAN_SUPPLY_RAIL'); assert.equal(st.activeSide,'GERMAN');
}

// Headless naturally performs deployment actions then normal phase; exact replay matches.
{
  const scenario=makeScenario(false); const {hexes,edges}=map(); const initial=createDeploymentGameState({scenario,rules:defaultRules,hexes,edges,seed:3});
  const provider=({state})=>{
    if(state.phase==='SOVIET_DEPLOYMENT') return state.units['S-A']?{type:'READY_FOR_PHASE_END',controllerId:'S1'}:{type:'DEPLOY_INITIAL_UNIT',controllerId:'S1',deploymentUnitId:'S-A',hex:{q:1,r:0}};
    if(state.phase==='GERMAN_DEPLOYMENT') return state.units['G-A']?{type:'READY_FOR_PHASE_END',controllerId:'G1'}:{type:'DEPLOY_INITIAL_UNIT',controllerId:'G1',deploymentUnitId:'G-A',hex:{q:-2,r:0}};
    if(state.phase==='GERMAN_SUPPLY_RAIL') return {type:'READY_FOR_PHASE_END',controllerId:'G1'};
    return null;
  };
  const run=runHeadlessGame(initial,defaultRules,scenario,provider,{maxActions:10});
  assert.equal(run.finalState.phase,'GERMAN_MOVEMENT'); assert(run.canonicalActions.some(a=>a.type==='DEPLOY_INITIAL_UNIT'));
  const replay=replayHeadlessActions(initial,defaultRules,scenario,run.canonicalActions);
  assert.deepEqual(replay.finalState,run.finalState); assert.deepEqual(replay.finalState.actionLog,run.finalState.actionLog); assert.deepEqual(replay.finalState.idCounters,run.finalState.idCounters);
}

console.log('initial-deployment smoke: PASS');
