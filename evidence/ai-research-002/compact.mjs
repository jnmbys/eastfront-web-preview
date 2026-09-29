// Presentation-only pass over extracted metrics; no replay or policy execution.
import {readFileSync,writeFileSync} from 'node:fs';
const path='evidence/ai-research-002/statistics.json',d=JSON.parse(readFileSync(path));
if(!d.keyNodes){
 d.keyNodes=d.results.map(r=>({seed:r.seed,...r.opportunities[0]}));
 d.keyNodes.push({seed:17,turn:16,...d.results[0].rows.at(-1).lastMove});
 for(const r of d.results){delete r.opportunities;for(const t of r.rows){delete t.lastMove;delete t.peak.germanUnits;delete t.peak.enemyUnits;}}
 writeFileSync(path,JSON.stringify(d,null,2)+'\n');
}
let table='| T | 最近/中位距离（变化） | 移动 17/18 | 攻击 17/18 | 候选累计[去重] 17/18 | 选择 17/18 | 接敌己/附近己/可见敌 |\n|---|---|---|---|---|---|---|\n';
for(let i=0;i<8;i++){const a=d.results[0].rows[i],b=d.results[1].rows[i];table+=`| ${a.turn} | ${a.end.nearest}/${a.end.median}（${a.delta.nearest}/${a.delta.median}） | ${a.moves}/${b.moves} | ${a.attacks}/${b.attacks} | ${a.candidates}[${a.unique}]/${b.candidates}[${b.unique}] | ${a.attackSelected}/${b.attackSelected} | ${a.peak.adjacentGerman}/${a.peak.nearbyGerman}/${a.peak.visibleEnemy} |\n`;}
writeFileSync('evidence/ai-research-002/table.md',table);
