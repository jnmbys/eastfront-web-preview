// Additional offline board-fact audit for city occupation and exact stored events.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {initial} from '../../ai/lab/match.mjs';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {records} from '../../ai/lab/runner.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
const out='evidence/ai-advance-014',summary=JSON.parse(readFileSync(out+'/summary.json')),facts=[];
for(const game of summary.games){
 const rows=records(game.source+'/trace.ndjson'),events=records(game.source+'/events.ndjson'),record=JSON.parse(readFileSync(game.source+'/record.json'));
 if(game.version!=='experiment')for(const f of ['trace.ndjson','events.ndjson','record.json']){
  const path=game.source+'/'+f,sha=execFileSync('git',['rev-parse','92805a8550ddfb314fa77828d6c83b5a2f7f5e27:'+path],{encoding:'utf8'}).trim();assert.equal(execFileSync('git',['hash-object',path],{encoding:'utf8'}).trim(),sha);
 }
 let state=initial(game.seed),count=0;const engine=new RulesEngine(defaultRules,defaultScenario),turns=[];
 const cities=()=>Object.values(state.hexes).filter(h=>['CITY','MAIN_CITY','OUTER_CITY'].includes(h.terrain)||h.cityId).map(h=>({hex:h.coord,terrain:h.terrain,cityId:h.cityId??null,control:h.control,occupants:Object.values(state.units).filter(u=>u.alive&&hexKey(u.hex)===hexKey(h.coord)).map(u=>({id:u.id,side:u.side}))}));
 const counts=()=>{const all=cities();return {germanOccupiedHexes:all.filter(c=>c.occupants.some(u=>u.side==='GERMAN')).length,sovietOccupiedHexes:all.filter(c=>c.occupants.some(u=>u.side==='SOVIET')).length,germanControlledHexes:all.filter(c=>c.control==='GERMAN').length,totalCityHexes:all.length};};
 for(const row of rows){const before=state,r=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));assert.equal(r.accepted,row.result.status!=='REJECTED');if(!r.accepted)continue;state=r.state;assert.deepEqual(events[count++],{n:row.n,turn:before.turn,phase:before.phase,activeSide:before.activeSide,events:r.events,random:state.random});if(before.turn!==state.turn||state.phase==='GAME_OVER')turns.push({turn:before.turn,...counts()});}
 assert.equal(events.length,count);assert.equal(hash(state),record.finalHash);
 const audit=JSON.parse(readFileSync(`${out}/${game.seed}-${game.version}-audit.json`));
 if(game.version==='experiment')for(const o of audit.offers){const retained=o.options.filter(c=>c.retained);if(o.choice.intent.type==='ADVANCE_AFTER_COMBAT')assert(retained.some(c=>c.unitId===o.choice.intent.unitId));else assert.equal(retained.length,0,'Missed eligible advance at '+o.n);}
 const finalCounts=counts();facts.push({seed:game.seed,version:game.version,eventRows:count,finalHash:hash(state),finalCounts,finalCities:cities(),turnCounts:turns});
 console.log(JSON.stringify({seed:game.seed,version:game.version,eventIntegrity:'PASS',cities:finalCounts}));
}
atomic(out+'/city-integrity.json',{definition:'City hex = CITY/MAIN_CITY/OUTER_CITY terrain or cityId; occupied requires an alive unit. Core control is recorded separately and is not inferred from occupation. Counts are hexes, not distinct named cities.',games:facts});
let md='\n占城补充（城格口径，实际驻军与 Core control 分列；详情 city-integrity.json）：\n\n| 种子/版 | 德军驻军城格 | 德控城格 |\n|---|---|---|\n';for(const g of facts)md+=`| ${g.seed}/${g.version} | ${g.finalCounts.germanOccupiedHexes}/${g.finalCounts.totalCityHexes} | ${g.finalCounts.germanControlledHexes} |\n`;
const base=readFileSync(out+'/comparison.md','utf8').split('\n占城补充（')[0];writeFileSync(out+'/comparison.md',base+md);
