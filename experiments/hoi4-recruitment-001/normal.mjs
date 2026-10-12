import fs from 'node:fs';import {Campaign} from './authority.mjs';import {validate} from '../grand-division-002/inventory.mjs';
// Fixed before execution. Normal new game, default seed219031, no stock/work injection.
const c=new Campaign(),operation={type:'RECRUIT_ADD',template:'GERMAN:blackice:0',templateVersion:1,city:'CITY:GERMAN-industry-1',quantity:1};
const r=c.transaction({id:'recruit-normal-fixed-001',version:c.version,operation});
const points=[],budget=16*288,start=Date.now();
for(let i=0;i<budget&&!c.clock.ended;i++){c.advance();if(i%288===287||!c.clock.divisionLedger.recruitment.units[r.ids[0]]){const p=c.clock.divisionLedger,q=p.recruitment.units[r.ids[0]];points.push({tick:c.clock.tick,personnel:q?.personnel,status:q?.status,held:q?.held,xp:q?.trainingExperience,reason:q?.reason,manpower:p.nations.GERMAN.manpower,stock:p.nations.GERMAN.stock,produced:p.nations.GERMAN.produced,transit:p.recruitment.transit.length});console.log('day',Math.round(c.clock.tick/288),q?.status,q?.personnel,q?.trainingExperience);if(!q)break;}}
validate(c.clock.divisionLedger);fs.writeFileSync('evidence/hoi4-recruitment-001/normal.json',JSON.stringify({seed:219031,budget,operation,points,history:c.clock.divisionLedger.recruitment.history,ended:c.clock.ended,elapsedMs:Date.now()-start,scope:'normal new campaign; default economy/AI/weather; no injected resources'},null,2));
fs.writeFileSync('evidence/hoi4-recruitment-001/normal-end.json',JSON.stringify(c.save()));
