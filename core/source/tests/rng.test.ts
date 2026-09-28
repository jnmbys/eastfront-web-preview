import { describe,expect,it } from 'vitest';
import { SeededRNG } from '../src/index.js';

describe('SeededRNG',()=>{
  it('reproduces identical rolls from identical seed/state',()=>{
    const a=new SeededRNG(20260917);
    const b=new SeededRNG(20260917);
    expect(Array.from({length:20},()=>a.roll2D6())).toEqual(Array.from({length:20},()=>b.roll2D6()));
    const snap=a.snapshot();
    const c=new SeededRNG(snap);
    expect(c.roll2D6()).toBe(a.roll2D6());
  });
});
