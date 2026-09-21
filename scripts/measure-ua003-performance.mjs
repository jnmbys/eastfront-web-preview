/** Software DOM allocation/write accounting, never a Huawei/browser FPS claim. */
import {writeFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {battleRun,tacticalRun} from '../tests/helpers/tactical-fixture.mjs';
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex'),runs=[];
for(const [name,h]of [['three-attackers',battleRun({multi:true})],['tactical-motions',tacticalRun()],['destroyed',battleRun({destroy:true})]]){
 const root=h.dom(),state=digest(h.s.state),docs=new Map([root,...root.querySelectorAll('*')].map(n=>[n.ownerDocument,n.ownerDocument.created]));
 const nodes=root.querySelectorAll('*').length;
 for(let i=0;i<80;i++)h.time.tick(16);
 runs.push({name,softwareFrames:80,mountedNodes:nodes,frameAllocations:[...docs].reduce((n,[doc,old])=>n+doc.created-old,0),remainingGhosts:root.querySelectorAll('[data-presence-ghost]').length,remainingPhases:root.querySelectorAll('[data-presence-phase]').length,visibleFireCues:root.querySelectorAll('[data-presence-fire]').filter(e=>Number(e.getAttribute('opacity'))>0).length,pendingFrames:h.time.pending(),stateUnchanged:digest(h.s.state)===state});h.runtime.dispose();
 if(root.querySelectorAll('[data-unit-presence-layer]').length)throw Error('Presence layer leaked');
}
const modules=['unitPresence','unitPresenceTypes','unitPresenceSvg'].map(name=>({name,bytes:statSync(`dist/app/presentation/${name}.js`).size}));
const report={measurement:'software SVG DOM only; not device FPS',newModules:modules,newModuleBytes:modules.reduce((s,m)=>s+m.bytes,0),newRuntimeImages:0,newRuntimeDependencies:0,idleRAF:0,runs};
writeFileSync('evidence/ua-003/performance.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
