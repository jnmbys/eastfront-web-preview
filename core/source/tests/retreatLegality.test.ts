import {describe,expect,it} from 'vitest';
import {
  buildCombatContext,defaultRules,getLegalRetreatStepOptions,hasLegalRetreatExit,
  validateRetreatStep,type GameState,type HexCoord,type UnitState
} from '../src/index.js';
import {declaredSupplySnapshot,G,S,gridHexes,makeState,setTerrain,unit} from './helpers.js';

const center={q:0,r:0};
const attackerHex={q:-1,r:0};
function base(defender:UnitState,extras:UnitState[]=[]):GameState{
  const g=unit('g','G-INF','GERMAN','INFANTRY',attackerHex,G);
  const st=makeState([g,defender,...extras],gridHexes(-3,3,-3,3));
  declaredSupplySnapshot(st,[g,defender,...extras]);
  st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';
  return st;
}
function surrounded(st:GameState):void{
  const lake:HexCoord[]=[{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:1},{q:0,r:1}];
  for(const h of lake)setTerrain(st,h,'LAKE');
}

describe('Task 002A-2B-1 shared retreat legality',()=>{
  it('accepts a normal empty adjacent hex',()=>{
    const d=unit('d','S-INF','SOVIET','INFANTRY',center,S);const st=base(d);
    const to={q:1,r:0};
    expect(validateRetreatStep(st,defaultRules,d,center,to).legal).toBe(true);
    expect(getLegalRetreatStepOptions(st,defaultRules,d,center)).toContainEqual(to);
    expect(hasLegalRetreatExit(st,defaultRules,d,center)).toBe(true);
  });
  it('rejects lake, enemy occupation, enemy ZOC, and full stacking',()=>{
    const d=unit('d','S-INF','SOVIET','INFANTRY',center,S);let st=base(d);setTerrain(st,{q:1,r:0},'LAKE');
    expect(validateRetreatStep(st,defaultRules,d,center,{q:1,r:0}).issues.map(x=>x.code)).toContain('IMPASSABLE_TERRAIN');
    expect(validateRetreatStep(st,defaultRules,d,center,attackerHex).issues.map(x=>x.code)).toContain('ENEMY_OCCUPIED_HEX');
    expect(validateRetreatStep(st,defaultRules,d,center,{q:0,r:-1}).issues.map(x=>x.code)).toContain('ENEMY_ZOC_STOP');
    const f1=unit('f1','S-INF','SOVIET','INFANTRY',{q:1,r:0},S),f2=unit('f2','S-INF','SOVIET','INFANTRY',{q:1,r:0},S);st=base(d,[f1,f2]);
    expect(validateRetreatStep(st,defaultRules,d,center,{q:1,r:0}).issues.map(x=>x.code)).toContain('STACKING_LIMIT');
  });
});

describe('Task 002A-2B-1 OOS encirclement defense',()=>{
  it('does not halve OOS defense when any legal retreat exit exists',()=>{
    const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='OUT_OF_SUPPLY';const st=base(d);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
    expect(ctx.rawDefenseStrength).toBe(7);expect(ctx.finalDefenseStrength).toBe(7);expect(ctx.defenseStrength).toBe(7);expect(ctx.oosSurroundedDefenseHalved).toBe(false);
  });
  it('halves all-OOS surrounded defense with ceiling and explains it',()=>{
    const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='OUT_OF_SUPPLY';const st=base(d);surrounded(st);
    expect(hasLegalRetreatExit(st,defaultRules,d,center)).toBe(false);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
    expect(ctx.rawDefenseStrength).toBe(7);expect(ctx.finalDefenseStrength).toBe(4);expect(ctx.defenseStrength).toBe(4);expect(ctx.oosSurroundedDefenseHalved).toBe(true);
  });
  it('does not halve if one defender is supplied',()=>{
    const d1=unit('d1','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d1.supplyState='OUT_OF_SUPPLY';const d2=unit('d2','S-INF','SOVIET','INFANTRY',center,S);d2.supplyState='SUPPLIED';const st=base(d1,[d2]);surrounded(st);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
    expect(ctx.rawDefenseStrength).toBe(10);expect(ctx.finalDefenseStrength).toBe(10);expect(ctx.oosSurroundedDefenseHalved).toBe(false);
  });
  it('TEMPORARY_SUPPLY is not OOS for encirclement halving',()=>{
    const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='TEMPORARY_SUPPLY';d.temporarySupply=true;const st=base(d);surrounded(st);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
    expect(ctx.rawDefenseStrength).toBe(7);expect(ctx.finalDefenseStrength).toBe(7);expect(ctx.oosSurroundedDefenseHalved).toBe(false);
  });
});
