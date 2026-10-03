// Read-only current authoritative Core query, not a player visibility oracle.
import fs from 'node:fs';
import * as c from './.runtime/base6/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005/core/dist/index.js';
const state=JSON.parse(fs.readFileSync(0,'utf8')), before=JSON.stringify(state), issues=[];
const hex=state.hexes?.['0,9'];
if(!hex || !Object.hasOwn(hex,'control') || hex.coord.q!==0 || hex.coord.r!==9)issues.push('UNKNOWN_RECEIVER');
else if(hex.control!==null && hex.control!=='GERMAN')issues.push('ENEMY_OR_UNKNOWN_CONTROL');
const integrity=c.validateGameStateIntegrity(state,c.defaultRules,c.defaultScenario);
if(integrity.length)issues.push('CORE_INTEGRITY_UNKNOWN');
const occupants=Object.values(state.units).filter(u=>u.alive&&u.hex.q===0&&u.hex.r===9).map(u=>({id:u.id,side:u.side}));
if(occupants.some(u=>u.side!=='GERMAN'))issues.push('ENEMY_OCCUPATION');
const enemyZoc=c.zocHexKeys(state,c.defaultRules,'SOVIET').has('0,9');
if(enemyZoc)issues.push('ENEMY_ZOC');
if(JSON.stringify(state)!==before)throw Error('QUALIFICATION_MUTATED_CORE');
console.log(JSON.stringify({eligible:!issues.length,issues,integrity,control:hex?.control,occupants,enemyZoc,node:'A10',coreKey:'0,9',side:'G',turn:state.turn,phase:state.phase,authoritative:true}));
