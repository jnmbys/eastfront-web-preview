import assert from 'node:assert/strict';import fs from 'node:fs';
import {Campaign as Base} from '../blackice-content-002/authority.mjs';import {Campaign} from './authority.mjs';
const a=new Base(),b=new Campaign();
assert.equal(b.clock.mapPlaces.length,31);assert.equal(new Set(b.clock.mapPlaces.map(x=>x.hex)).size,31);
for(const x of b.clock.mapPlaces)assert(b.state.hexes[x.hex]&&b.state.hexes[x.hex].terrain!=='LAKE');
b.clock.divisionLedger.id=a.clock.divisionLedger.id;for(let i=0;i<12;i++){a.advance();b.advance();}
for(const k of ['units','rng','divisionLedger','battles','corps'])assert.deepEqual(b.clock[k],a.clock[k],k);
const normalized=x=>JSON.parse(JSON.stringify(x,(k,v)=>['ms','maxMs','totalMs','networkTiming','performance'].includes(k)?undefined:v));assert.deepEqual(normalized(b.econ),normalized(a.econ));assert.deepEqual(b.state,a.state);
const va=b.snapshot();b.viewer='SOVIET';assert.deepEqual(b.snapshot().mapPlaces,va.mapPlaces);
const restored=new Campaign();restored.restore(b.save());assert.deepEqual(restored.clock.mapPlaces,b.clock.mapPlaces);
const result={passed:true,steps:12,places:31,addedTowns:8,checks:['same authoritative state, corps, inventory, battles, RNG and economy as baseline','no duplicate places or asset addition','public place identity same in both views','save/restore places stable'],scope:'author checks; browser separately documented'};
fs.writeFileSync('evidence/hoi4-map-province-001/stage1/check.json',JSON.stringify(result,null,2));console.log(result);


