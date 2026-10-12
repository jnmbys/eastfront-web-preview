import fs from 'node:fs';import {Campaign} from './authority.mjs';import {validate} from '../grand-division-002/inventory.mjs';
// Fixed before execution. Normal new game, default seed219031, no stock/work injection.
const output=process.env.EVIDENCE_DIR??'evidence/hoi4-equipment-priority-001';fs.mkdirSync(output,{recursive:true});
const c=new Campaign(),operation={type:'RECRUIT_ADD',template:'GERMAN:blackice:0',templateVersion:1,city:'CITY:GERMAN-industry-1',quantity:1};
const r=c.transaction({id:'recruit-normal-fixed-001',version:c.version,operation});
c.clock.autopause=false;const points=[],budget=288,start=Date.now();
for(let i=0;i<budget&&!c.clock.ended;i++){c.advance();if(i%48===47||!c.clock.divisionLedger.recruitment.units[r.ids[0]]){const p=c.clock.divisionLedger,q=p.recruitment.units[r.ids[0]];points.push(structuredClone({allocation:c.clock.equipmentPriority.sides.GERMAN.last,tick:c.clock.tick,personnel:q?.personnel,status:q?.status,held:q?.held,xp:q?.trainingExperience,reason:q?.reason,manpower:p.nations.GERMAN.manpower,stock:p.nations.GERMAN.stock,produced:p.nations.GERMAN.produced,transit:p.recruitment.transit.length}));console.log('day',Math.round(c.clock.tick/288),q?.status,q?.personnel,q?.trainingExperience);if(!q)break;}}
validate(c.clock.divisionLedger);fs.writeFileSync(output+'/normal.json',JSON.stringify({seed:219031,budget,operation,points,history:c.clock.divisionLedger.recruitment.history,ended:c.clock.ended,elapsedMs:Date.now()-start,scope:'normal new campaign; default economy/AI/weather; no injected resources'},null,2));
fs.writeFileSync(output+'/normal-end.json',JSON.stringify(c.save()));
