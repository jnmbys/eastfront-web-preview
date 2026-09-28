import { describe, expect, it } from 'vitest';
import { axialToPaper, getNeighbor, getNeighbors, hexDistance, paperToAxial } from '../src/index.js';

describe('hex geometry',()=>{
  it('returns exactly six axial neighbors',()=>{
    const ns=getNeighbors({q:0,r:0});
    expect(ns).toHaveLength(6);
    expect(ns).toContainEqual({q:1,r:0});
    expect(ns).toContainEqual({q:1,r:-1});
    expect(ns).toContainEqual({q:-1,r:1});
    expect(getNeighbor({q:0,r:0},0)).toEqual({q:1,r:0});
  });

  it('calculates axial distance',()=>{
    expect(hexDistance({q:0,r:0},{q:3,r:-2})).toBe(3);
    expect(hexDistance({q:2,r:2},{q:2,r:2})).toBe(0);
  });

  it('round-trips paper coordinates including AC/AF',()=>{
    for(const label of ['A1','B2','J6','R10','AC10','AC11','AF20']){
      const m=/^([A-Z]+)(\d+)$/.exec(label)!;
      const axial=paperToAxial(m[1]!,Number(m[2]));
      expect(axialToPaper(axial).label).toBe(label);
    }
  });
});
