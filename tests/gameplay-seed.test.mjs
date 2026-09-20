import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFreshProductionSession,TERRAIN_VISUAL_SEED} from '../dist/app/web/preview.js';
import {SeededRNG} from '../dist/vendor/eastfront-digital-core/dist/random/SeededRNG.js';
const raw=JSON.parse(readFileSync(new URL('../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url)));
test('new sessions consume fresh entropy, reject zero, and retain explicit-seed replay',t=>{
 const values=[0,123456789,987654321];let calls=0;
 t.mock.method(globalThis.crypto,'getRandomValues',array=>{array[0]=values[calls++];return array;});
 const a=createFreshProductionSession(raw),b=createFreshProductionSession(raw);
 assert.equal(calls,3);assert.equal(a.state.random.seed,123456789);assert.equal(b.state.random.seed,987654321);
 const replay=createFreshProductionSession(raw,123456789);assert.equal(calls,3);assert.deepEqual(a.state,replay.state);
 const dice=s=>{const r=new SeededRNG(s.state.random);return Array.from({length:10},()=>[r.rollDie(6),r.rollDie(6)]);};
 assert.deepEqual(dice(a),dice(replay));assert.notDeepEqual(dice(a),dice(b));
 assert.deepEqual(a.state.hexes,b.state.hexes);assert.deepEqual(a.state.units,b.state.units);
});
test('production startup and SVG rendering use fixed visual seed independently of gameplay',()=>{
 assert.equal(TERRAIN_VISUAL_SEED,17);
 const main=readFileSync(new URL('../dist/app/main.js',import.meta.url),'utf8');
 assert(main.includes('createFreshProductionSession(productionMap)'));
 assert(main.includes('scenarioSeed: TERRAIN_VISUAL_SEED'));
 assert(main.includes('createFreshProductionSession(map, TERRAIN_VISUAL_SEED)'));
 assert(main.includes('buildCachedTerrainSurface(terrainModel, TERRAIN_VISUAL_SEED,'));
 assert(!main.includes('session.state.random.seed'));
});
