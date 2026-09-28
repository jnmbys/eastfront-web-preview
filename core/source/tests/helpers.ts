import { canonicalEdgeKey, defaultRules, makeEdge, createGameState, type GameState, type HexCoord, type HexEdge, type HexState, type UnitState } from '../src/index.js';
import { defaultScenario } from '../src/scenario/defaultScenario.js';

export const G='G-HUMAN-1';
export const S='S-AI-1';

export function gridHexes(qMin=-2,qMax=4,rMin=-3,rMax=4,terrain:'PLAIN'|'FOREST'='PLAIN'):HexState[]{
  const hs:HexState[]=[];
  for(let q=qMin;q<=qMax;q++) for(let r=rMin;r<=rMax;r++) hs.push({coord:{q,r},terrain,control:null});
  return hs;
}

export function unit(id:string,templateId:string,side:'GERMAN'|'SOVIET',type:UnitState['type'],hex:HexCoord,controllerId=side==='GERMAN'?G:S):UnitState{
  return {id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,
    controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};
}

export function makeState(units:UnitState[],hexes=gridHexes(),edges:HexEdge[]=[]):GameState{
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges,units,seed:123});
  st.phase='GERMAN_MOVEMENT';st.activeSide='GERMAN';
  return st;
}

export function edge(a:HexCoord,b:HexCoord,opts:Partial<HexEdge>):HexEdge{
  return makeEdge(a,b,opts);
}

export function setTerrain(state:GameState,h:HexCoord,terrain:HexState['terrain']){
  state.hexes[`${h.q},${h.r}`]={coord:{...h},terrain,control:null};
}

/** Combat unit tests declare a turn supply snapshot, not a railway topology.
 * Setup refresh (002B-3 / 002B-5D) deliberately overwrites supplied inputs.
 * Opt in after setup; never change makeState or production supply lifecycle.
 * Mirrors the archived combat-declare-smoke fixture precondition. */
export function declaredSupplySnapshot(state:GameState,units:readonly UnitState[]):void {
  for(const expected of units) {
    const actual=state.units[expected.id];
    if(!actual)throw new Error(`Missing fixture unit ${expected.id}`);
    actual.supplyState=expected.supplyState;
    actual.temporarySupply=expected.temporarySupply;
  }
}
