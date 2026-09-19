import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  defaultScenario,
  deploymentHexKeysForSide,
  validateMoveAction,
} from '../dist/vendor/eastfront-digital-core/dist/index.js';
import {
  controllerIdForSide,
  createLocalGameSession,
  dispatchGameAction,
  setActiveViewer,
} from '../dist/app/core-adapter/session.js';
import { deriveBrowserRenderModel } from '../dist/app/render/coreModel.js';
import { coreSvgMarkup, viewBoxForHexes } from '../dist/app/render/coreSvg.js';
import { createPresentationState } from '../dist/app/state/presentation.js';
import { hexPolygon, hexToPixel, sharedHexEdge } from '../dist/app/geometry/hex.js';

const raw=JSON.parse(await readFile(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url),'utf8'));
const fresh=()=>createLocalGameSession(raw,17);
const stateJson=(state)=>JSON.stringify(state);
const coordKey=(h)=>`${h.q},${h.r}`;

function planFor(session,side){
  const ids=session.scenario.deployment.units.filter((unit)=>unit.side===side).map((unit)=>unit.id).sort();
  const zone=deploymentHexKeysForSide(session.state,session.scenario,side);
  assert(zone.length*session.rules.stackingLimit>=ids.length);
  const plan={};
  ids.forEach((id,index)=>{
    const key=zone[Math.floor(index/session.rules.stackingLimit)];
    assert(key&&session.state.hexes[key]);
    plan[id]={...session.state.hexes[key].coord};
  });
  return {ids,zone,plan};
}

function deployAll(session,side){
  const controllerId=controllerIdForSide(session,side);
  const {ids,plan}=planFor(session,side);
  for(const id of ids){
    const result=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:id,hex:plan[id]}).result;
    assert.equal(result.accepted,true,`${side} placement ${id}: ${JSON.stringify(result.issues)}`);
  }
}

function ready(session,side){
  const result=dispatchGameAction(session,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(session,side)}).result;
  assert.equal(result.accepted,true,`Ready ${side}: ${JSON.stringify(result.issues)}`);
  return result;
}

function firstLegalGermanMove(session){
  const controllerId=controllerIdForSide(session,'GERMAN');
  const units=Object.values(session.state.units).filter((u)=>u.alive&&u.side==='GERMAN'&&u.controllerId===controllerId).sort((a,b)=>a.id.localeCompare(b.id));
  const dirs=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:0},{q:-1,r:1},{q:0,r:1}];
  for(const unit of units){
    for(const d of dirs){
      const dest={q:unit.hex.q+d.q,r:unit.hex.r+d.r};
      if(!session.state.hexes[coordKey(dest)])continue;
      const action={type:'MOVE',controllerId,unitId:unit.id,path:[dest]};
      const validation=validateMoveAction(session.state,session.rules,action);
      if(validation.issues.length===0)return {unit,action,validation};
    }
  }
  throw new Error('No legal one-step German move found after deterministic deployment.');
}

test('frozen UI geometry source SHA remains byte-for-byte unchanged',async()=>{
  const bytes=await readFile(new URL('../src/geometry/hex.ts',import.meta.url));
  const sha=createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha,'283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a');
});

test('real Strategic Reset F imports 640 unique Core hexes into deterministic UI pixels',()=>{
  const session=fresh();
  const hexes=Object.values(session.state.hexes);
  assert.equal(hexes.length,640);
  const pixels=hexes.map((hex)=>hexToPixel(hex.coord));
  assert.equal(new Set(pixels.map((p)=>`${p.x.toFixed(9)},${p.y.toFixed(9)}`)).size,640);
  for(const hex of hexes)assert.deepEqual(hexToPixel(hex.coord),hexToPixel(hex.coord));
  const vb=viewBoxForHexes(hexes);
  assert(vb.width>0&&vb.height>0);
});

test('Core axial coordinates are semantically compatible with locked pointy-top UI geometry',()=>{
  const session=fresh();
  const values=Object.values(session.state.hexes);
  const qs=values.map((h)=>h.coord.q), rs=values.map((h)=>h.coord.r);
  const samples=[
    values.find((h)=>h.coord.q===Math.min(...qs)),
    values.find((h)=>h.coord.q===Math.max(...qs)),
    values.find((h)=>h.coord.r===Math.min(...rs)),
    values.find((h)=>h.coord.r===Math.max(...rs)),
    ...defaultScenario.capitalCoreHexes.map((coord)=>session.state.hexes[coordKey(coord)]),
  ].filter(Boolean);
  assert(samples.length>=6);
  for(const hex of samples){assert.equal(hexPolygon(hex.coord).length,6);assert(Number.isFinite(hexToPixel(hex.coord).x));}
  const west=deploymentHexKeysForSide(session.state,session.scenario,'GERMAN');
  const soviet=deploymentHexKeysForSide(session.state,session.scenario,'SOVIET');
  assert(west.length>0&&soviet.length>0);
  assert.equal(west.some((key)=>soviet.includes(key)),false);
});

test('every real Core infrastructure edge resolves through canonical UI center/shared-edge geometry',()=>{
  const session=fresh();
  const edges=Object.values(session.state.edges);
  assert(edges.some((edge)=>edge.road));
  assert(edges.some((edge)=>edge.railway?.present));
  assert(edges.some((edge)=>edge.river));
  assert(edges.some((edge)=>edge.bridge));
  for(const edge of edges){
    const a=hexToPixel(edge.a),b=hexToPixel(edge.b);
    assert(Number.isFinite(a.x)&&Number.isFinite(b.x));
    if(edge.river||edge.bridge)assert(sharedHexEdge(edge.a,edge.b),`missing shared edge ${edge.key}`);
  }
});

test('setup-zone overlays and Core counter anchors use exact locked polygons/centers',()=>{
  const session=fresh();
  const presentation=createPresentationState(false,false);
  const model=deriveBrowserRenderModel(session,presentation);
  assert(model.deployment);
  for(const key of model.deployment.zoneKeys.slice(0,20)){
    const hex=session.state.hexes[key]; assert(hex);
    assert.equal(hexPolygon(hex.coord).length,6);
  }
  const first=model.deployment.roster[0]; assert(first);
  const target=session.state.hexes[model.deployment.zoneKeys[0]].coord;
  const placed=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId:session.activeViewerControllerId,deploymentUnitId:first.id,hex:target}).result;
  assert(placed.accepted);
  const after=deriveBrowserRenderModel(session,presentation);
  const counter=after.counters.find((c)=>c.id===first.id); assert(counter);
  assert.deepEqual(hexToPixel(counter.hex),hexToPixel(session.state.units[first.id].hex));
});

test('actual browser render model enforces hidden deployment in both viewer directions',()=>{
  const session=fresh();
  const presentation=createPresentationState(false,false);
  deployAll(session,'SOVIET'); ready(session,'SOVIET');
  assert.equal(session.state.phase,'GERMAN_DEPLOYMENT');
  setActiveViewer(session,controllerIdForSide(session,'GERMAN'));
  const germanBefore=deriveBrowserRenderModel(session,presentation);
  assert.equal(germanBefore.counters.filter((c)=>c.side==='SOVIET').length,0);
  const germanPlan=planFor(session,'GERMAN');
  for(const id of germanPlan.ids.slice(0,6)){
    const result=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId:session.activeViewerControllerId,deploymentUnitId:id,hex:germanPlan.plan[id]}).result;
    assert(result.accepted);
  }
  const germanView=deriveBrowserRenderModel(session,presentation);
  assert.equal(germanView.counters.filter((c)=>c.side==='SOVIET').length,0);
  assert.equal(germanView.counters.filter((c)=>c.side==='GERMAN').length,6);
  setActiveViewer(session,controllerIdForSide(session,'SOVIET'));
  const sovietView=deriveBrowserRenderModel(session,presentation);
  assert.equal(sovietView.counters.filter((c)=>c.side==='GERMAN').length,0);
  assert.equal(sovietView.counters.filter((c)=>c.side==='SOVIET').length,32);
  const svg=coreSvgMarkup(sovietView,{debug:true});
  for(const id of germanPlan.ids.slice(0,6))assert.equal(svg.includes(`data-unit-id=\"${id}\"`),false);
});

test('presentation changes and rejected Actions do not mutate authoritative browser GameState',()=>{
  const session=fresh();
  const presentation=createPresentationState(false,false);
  const before=stateJson(session.state);
  presentation.panelCollapsed=true; presentation.debug=true; presentation.selectedUnitId='not-a-real-unit';
  setActiveViewer(session,controllerIdForSide(session,'GERMAN'));
  assert.equal(stateJson(session.state),before);
  const rejected=dispatchGameAction(session,{type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(session,'GERMAN')});
  assert.equal(rejected.result.accepted,false);
  assert.equal(rejected.stateReplaced,false);
  assert.equal(stateJson(session.state),before);
  setActiveViewer(session,controllerIdForSide(session,'SOVIET'));
  const {ids,plan}=planFor(session,'SOVIET');
  const accepted=dispatchGameAction(session,{type:'DEPLOY_INITIAL_UNIT',controllerId:session.activeViewerControllerId,deploymentUnitId:ids[0],hex:plan[ids[0]]});
  assert.equal(accepted.result.accepted,true);
  assert.equal(session.state,accepted.result.state);
});

test('deterministic real flow reaches Turn 1 movement and executes one accepted MOVE',()=>{
  const session=fresh();
  const presentation=createPresentationState(false,false);
  assert.equal(session.state.phase,'SOVIET_DEPLOYMENT');
  deployAll(session,'SOVIET');
  ready(session,'SOVIET');
  assert.equal(session.state.phase,'GERMAN_DEPLOYMENT');
  setActiveViewer(session,controllerIdForSide(session,'GERMAN'));
  assert.equal(deriveBrowserRenderModel(session,presentation).counters.some((c)=>c.side==='SOVIET'),false);
  deployAll(session,'GERMAN');
  ready(session,'GERMAN');
  assert.equal(session.state.phase,'GERMAN_SUPPLY_RAIL');
  assert.equal(session.state.turn,1);
  assert.equal(Object.keys(session.state.units).length,58);
  const revealed=deriveBrowserRenderModel(session,presentation);
  assert.equal(revealed.counters.length,58);
  ready(session,'GERMAN');
  assert.equal(session.state.phase,'GERMAN_MOVEMENT');
  const candidate=firstLegalGermanMove(session);
  const from={...candidate.unit.hex};
  const moved=dispatchGameAction(session,candidate.action);
  assert.equal(moved.result.accepted,true,JSON.stringify(moved.result.issues));
  assert.notDeepEqual(session.state.units[candidate.unit.id].hex,from);
  assert.deepEqual(session.state.units[candidate.unit.id].hex,candidate.action.path[0]);
  assert.equal(session.integrityIssues.length,0);
});
