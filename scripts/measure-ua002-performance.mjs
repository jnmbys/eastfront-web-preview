/** Allocation/cleanup accounting in the software SVG DOM, not device FPS. */
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {battleRun,tacticalRun} from '../tests/helpers/tactical-fixture.mjs';
const digest=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
const runs=[];
for(const [name,h] of [['tactical',tacticalRun()],['three-attackers',battleRun({multi:true})],['destroyed',battleRun({destroy:true})]]){
 const root=h.dom(),state=digest(h.s.state);
 // Software remounts use separate ownerDocuments; count retained ghost documents too.
 const documents=new Map([root,...root.querySelectorAll('*')].map(node=>[node.ownerDocument,node.ownerDocument.created]));
 for(let i=0;i<80;i++)h.time.tick(16);
 runs.push({name,softwareFrames:80,effectPathsCreated:[...documents].reduce((sum,[document,start])=>sum+document.created-start,0),
  pendingFrames:h.time.pending(),remainingPresentationStates:h.runtime.coordinator.snapshot().size,
  remainingGhosts:root.querySelectorAll('[data-presentation-ghost]').length,remainingEffects:root.querySelectorAll('[data-presentation-effect]').length,stateUnchanged:state===digest(h.s.state)});
}
writeFileSync('evidence/ua-002/performance.json',JSON.stringify({measurement:'Software SVG DOM only; not browser or Huawei performance',runs},null,2));
console.log(JSON.stringify(runs));
