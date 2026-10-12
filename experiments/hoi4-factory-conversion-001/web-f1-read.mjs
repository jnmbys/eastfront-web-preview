// Read-only cross-check of the isolated browser session's durable save, not an operation driver.
import fs from 'node:fs';import path from 'node:path';import {readSave} from '../grand-release-001/persistence.mjs';
const root='evidence/factory-conversion-f1',p=JSON.parse(fs.readFileSync(root+'/process.json','utf8').replace(/^\uFEFF/,'')),s=readSave(path.join(p.root,'saves','campaign.json')),c=s.campaign,e=c.econ.modern,f=e.facilities['FACTORY:GERMAN-industry-1:1'];
const data={stage:process.argv[2],savedAt:s.savedAt,tick:c.clock.tick,paused:c.clock.paused,factory:f,lines:Object.values(e.lines).filter(l=>l.side==='GERMAN').map(l=>({id:l.id,product:l.product,factories:l.factories,progress:l.progress,efficiency:l.efficiency,completed:l.completed})),queue:e.queue.filter(q=>q.side==='GERMAN'&&q.kind==='CONVERT')};
fs.writeFileSync(root+'/'+process.argv[2]+'.json',JSON.stringify(data,null,2));console.log(JSON.stringify({stage:data.stage,tick:data.tick,factory:f,queue:data.queue}));
