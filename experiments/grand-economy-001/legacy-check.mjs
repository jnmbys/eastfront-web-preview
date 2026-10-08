import assert from 'node:assert/strict';import fs from 'node:fs';
import {Campaign as Old} from '../../../grand-play-002-campaign-loop/experiments/grand-play-002/authority.mjs';
import {Campaign as Current} from '../grand-play-002/authority.mjs';
const a=new Old(),b=new Current();b.restore(a.save(),false);a.clock.autopause=b.clock.autopause=false;a.clock.paused=b.clock.paused=false;
for(let i=0;i<25;i++){a.tick();b.tick();}assert.deepEqual(a.state,b.state);assert.deepEqual(a.econ,b.econ);assert.equal(a.clock.rng,b.clock.rng);
fs.writeFileSync('evidence/grand-economy-001/legacy.json',JSON.stringify({same25Steps:true,sameTwoOldEconomySettlements:true,rng:a.clock.rng}));console.log('legacy unchanged');
