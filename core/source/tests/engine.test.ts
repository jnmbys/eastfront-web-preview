import { describe,expect,it } from 'vitest';
import { defaultRules, defaultScenario, RulesEngine } from '../src/index.js';
import { G,makeState,unit } from './helpers.js';

describe('RulesEngine transition shell',()=>{
  it('applies a legal MOVE immutably and logs it',()=>{
    const before=makeState([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0})]);
    const engine=new RulesEngine(defaultRules,defaultScenario);
    const result=engine.apply(before,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0}]});
    expect(result.accepted).toBe(true);
    expect(before.units.g!.hex).toEqual({q:0,r:0});
    expect(result.state.units.g!.hex).toEqual({q:1,r:0});
    expect(result.state.actionLog).toHaveLength(1);
  });
});
