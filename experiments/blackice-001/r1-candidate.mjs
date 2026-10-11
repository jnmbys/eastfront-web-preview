import fs from 'node:fs';import assert from 'node:assert/strict';
import {Campaign,VERSION} from './r1-campaign.mjs';import {natural} from './r1-authority.mjs';import {seeds,scenarios} from './r1-forced.mjs';
const rows=[];
for(const name of ['infantry','artillery','armor'])for(const seed of seeds){const r=natural(scenarios.find(s=>s[0]===name),seed,'officer',Campaign);console.log(JSON.stringify({scenario:name,seed,hours:r.hours,end:r.end,losses:r.losses,withdrawals:r.withdrawalEvents.length,recovery:r.inCombatOrgRecovery}));if(seed!==219031){delete r.timeline;delete r.initial;}rows.push(r);}
rows.push(natural(scenarios[1],219031,'manual',Campaign));assert(rows.every(r=>r.inCombatOrgRecovery===0));
fs.writeFileSync('evidence/blackice-001-r1/candidate.json',JSON.stringify({rules:VERSION,change:'Retain recovery on automatic order/risk replan; no damage/stat/rate changes',rows},null,2));
