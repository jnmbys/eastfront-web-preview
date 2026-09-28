import { describe,expect,it } from 'vitest';
import { buildCombatContext, defaultRules, selectCRTColumn } from '../src/index.js';
import { G,gridHexes,makeState,setTerrain,unit } from './helpers.js';

function combatState(units:ReturnType<typeof unit>[]){
  const st=makeState(units,gridHexes(-3,3,-3,3));
  st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';
  return st;
}

describe('CRT',()=>{
  it('selects the largest ratio column not exceeding actual odds',()=>{
    expect(defaultRules.crt.columns[selectCRTColumn(5,5,defaultRules)]).toBe('1:1');
    expect(defaultRules.crt.columns[selectCRTColumn(14,5,defaultRules)]).toBe('2:1');
    expect(defaultRules.crt.columns[selectCRTColumn(20,5,defaultRules)]).toBe('4:1+');
  });

  it('caps total column shifts at ±2',()=>{
    const target={q:0,r:0};
    const g=unit('pz','G-PANZER','GERMAN','PANZER',{q:-1,r:0});
    const d=unit('at','S-AT','SOVIET','ANTI_TANK',target);d.entrenched=true;
    const da=unit('dart','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2});
    const st=combatState([g,d,da]);setTerrain(st,target,'FOREST');
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['pz'],target},{defenderArtilleryUnitId:'dart',defenderHQCommand:'LAST_STAND'});
    expect(ctx.modifiers.rawShift).toBeLessThanOrEqual(-3);
    expect(ctx.finalShift).toBe(-2);
  });
});

describe('combat modifier breakdown',()=>{
  it('applies German combined arms +1',()=>{
    const target={q:0,r:0};
    const st=combatState([
      unit('pz','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),
      unit('inf','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),
      unit('def','S-INF','SOVIET','INFANTRY',target)
    ]);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['pz','inf'],target});
    expect(ctx.modifiers.combinedArmsShift).toBe(1);
  });

  it('applies forest -1 and Jäger cancels forest penalty',()=>{
    const target={q:0,r:0};
    let st=combatState([unit('inf','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('def','S-INF','SOVIET','INFANTRY',target)]);
    setTerrain(st,target,'FOREST');
    expect(buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['inf'],target}).modifiers.terrainShift).toBe(-1);
    st=combatState([unit('j','G-JAGER','GERMAN','JAGER',{q:-1,r:0}),unit('def','S-INF','SOVIET','INFANTRY',target)]);
    setTerrain(st,target,'FOREST');
    expect(buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['j'],target}).modifiers.terrainShift).toBe(0);
  });

  it('applies flank +1 from at least three distinct attack origins',()=>{
    const target={q:0,r:0};
    const st=combatState([
      unit('a','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),
      unit('b','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),
      unit('c','G-INF','GERMAN','INFANTRY',{q:1,r:-1}),
      unit('d','S-INF','SOVIET','INFANTRY',target)
    ]);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['a','b','c'],target});
    expect(ctx.modifiers.flankShift).toBe(1);
  });

  it('AT gives -1 against armor while one-step-or-better',()=>{
    const target={q:0,r:0};
    const st=combatState([unit('pz','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('at','S-AT','SOVIET','ANTI_TANK',target)]);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['pz'],target});
    expect(ctx.modifiers.antiTankShift).toBe(-1);
  });

  it('eligible attacker artillery gives +1',()=>{
    const target={q:0,r:0};
    const st=combatState([
      unit('inf','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),
      unit('art','G-ARTY','GERMAN','ARTILLERY',{q:-2,r:0}),
      unit('def','S-INF','SOVIET','INFANTRY',target)
    ]);
    const ctx=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['inf'],target,support:{attackerArtilleryUnitId:'art'}});
    expect(ctx.modifiers.attackerArtilleryShift).toBe(1);
    expect(ctx.attackerArtilleryUnitId).toBe('art');
  });
});
