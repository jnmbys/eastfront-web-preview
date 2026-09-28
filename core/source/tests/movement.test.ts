import { describe,expect,it } from 'vitest';
import { defaultRules, movementStepCost, validateMoveAction } from '../src/index.js';
import { edge,G,gridHexes,makeState,setTerrain,unit } from './helpers.js';

describe('movement and stacking',()=>{
  it('enforces two-unit stacking limit',()=>{
    const dest={q:1,r:0};
    const mover=unit('g1','G-INF','GERMAN','INFANTRY',{q:0,r:0});
    const st=makeState([mover,unit('g2','G-INF','GERMAN','INFANTRY',dest),unit('g3','G-INF','GERMAN','INFANTRY',dest)]);
    const v=validateMoveAction(st,defaultRules,{type:'MOVE',controllerId:G,unitId:'g1',path:[dest]});
    expect(v.issues.map(x=>x.code)).toContain('STACKING_LIMIT');
  });

  it('uses normal terrain movement cost',()=>{
    const a={q:0,r:0},b={q:1,r:0};
    const u=unit('g1','G-INF','GERMAN','INFANTRY',a);
    const st=makeState([u]);setTerrain(st,b,'FOREST');
    expect(movementStepCost(st,defaultRules,u,a,b).total).toBe(2);
  });

  it('road movement costs 1 regardless of forest terrain',()=>{
    const a={q:0,r:0},b={q:1,r:0};
    const u=unit('g1','G-INF','GERMAN','INFANTRY',a);
    const st=makeState([u],gridHexes(),[edge(a,b,{road:true})]);setTerrain(st,b,'FOREST');
    expect(movementStepCost(st,defaultRules,u,a,b)).toMatchObject({total:1,terrain:1,usedRoad:true});
  });

  it('minor river adds +1 MP and major river +2 MP',()=>{
    const a={q:0,r:0},b={q:1,r:0};
    const u=unit('g1','G-INF','GERMAN','INFANTRY',a);
    let st=makeState([u],gridHexes(),[edge(a,b,{river:'MINOR'})]);
    expect(movementStepCost(st,defaultRules,u,a,b).total).toBe(2);
    st=makeState([u],gridHexes(),[edge(a,b,{river:'MAJOR'})]);
    expect(movementStepCost(st,defaultRules,u,a,b).total).toBe(3);
  });

  it('road bridge cancels river movement surcharge',()=>{
    const a={q:0,r:0},b={q:1,r:0};
    const u=unit('g1','G-INF','GERMAN','INFANTRY',a);
    const st=makeState([u],gridHexes(),[edge(a,b,{road:true,river:'MAJOR',bridge:{kind:'ROAD',destroyed:false}})]);
    expect(movementStepCost(st,defaultRules,u,a,b).total).toBe(1);
  });
});

describe('ZOC movement',()=>{
  it('entering enemy ZOC stops ordinary movement',()=>{
    const g=unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0});
    const s=unit('s','S-INF','SOVIET','INFANTRY',{q:2,r:0});
    const st=makeState([g,s]);
    const v=validateMoveAction(st,defaultRules,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0},{q:1,r:-1}]});
    expect(v.issues.map(x=>x.code)).toContain('ENEMY_ZOC_STOP');
  });

  it('ordinary unit cannot move enemy ZOC to enemy ZOC',()=>{
    const g=unit('g','G-INF','GERMAN','INFANTRY',{q:1,r:0});
    const s=unit('s','S-INF','SOVIET','INFANTRY',{q:2,r:0});
    const st=makeState([g,s]);
    const v=validateMoveAction(st,defaultRules,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:1}]});
    expect(v.issues.map(x=>x.code)).toContain('ENEMY_ZOC_TO_ZOC');
  });

  it('recon can spend its once-per-turn ignore to pass the first ZOC stop',()=>{
    const g=unit('g','G-RECON','GERMAN','RECON',{q:0,r:0});
    const s=unit('s','S-INF','SOVIET','INFANTRY',{q:2,r:0});
    const st=makeState([g,s]);
    const v=validateMoveAction(st,defaultRules,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0},{q:1,r:-1}]});
    expect(v.issues.filter(x=>x.code.startsWith('ENEMY_ZOC'))).toHaveLength(0);
    expect(v.reconIgnoreConsumed).toBe(true);
  });
});
