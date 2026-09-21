/** Production renderer in the software DOM: allocation/state accounting, not device FPS. */
import {readFileSync,writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {battleRun,tacticalRun} from '../tests/helpers/tactical-fixture.mjs';
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex'),runs=[];
for(const [name,h]of [['three-attackers',battleRun({multi:true})],['all-tactical-motions',tacticalRun()],['destroyed',battleRun({destroy:true})]]){
 const root=h.dom(),before=digest(h.s.state),docs=new Map([root,...root.querySelectorAll('*')].map(n=>[n.ownerDocument,n.ownerDocument.created]));
 for(let i=0;i<80;i++)h.time.tick(16);
 const row={name,frames:80,allocatedDuringPlayback:[...docs].reduce((sum,[doc,start])=>sum+doc.created-start,0),remainingGhosts:root.querySelectorAll('[data-presence-ghost]').length,remainingPhases:root.querySelectorAll('[data-presence-phase]').length,visibleFireCues:root.querySelectorAll('[data-presence-fire]').filter(e=>Number(e.getAttribute('opacity'))>0).length,pendingFrames:h.time.pending(),stateUnchanged:before===digest(h.s.state)};
 if(row.remainingGhosts||row.remainingPhases||row.visibleFireCues||row.pendingFrames||!row.stateUnchanged)throw Error(JSON.stringify(row));runs.push(row);h.runtime.dispose();
}
const modules=['unitPresence','unitPresenceTypes','unitPresenceSvg'].map(name=>({name,bytes:statSync(`dist/app/presentation/${name}.js`).size}));
const report={measurement:'software SVG DOM; no browser/Huawei FPS claim',modules,totalBytes:modules.reduce((s,m)=>s+m.bytes,0),newRuntimeImages:0,newRuntimeDependencies:0,idleRAF:0,runs,realTerrainBuild:JSON.parse(readFileSync('evidence/ua-003r1/evidence-manifest.json')).terrainBuild};
writeFileSync('evidence/ua-003r1/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
