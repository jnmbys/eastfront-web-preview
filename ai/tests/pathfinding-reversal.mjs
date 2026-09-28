// Focused authority-side replay of the single seed19 reversal. Inputs saved are FAIR packets.
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync,gzipSync} from 'node:zlib';
import {host,production} from './helpers.mjs';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/index.js';
const s=production();s.random={...s.random,seed:19,state:19};const h=host(s,'ai005-comparison');
let input,decision;const snapshots=process.argv.includes('--saved')?JSON.parse(gunzipSync(readFileSync('evidence/ai005/reversal-19-inputs.json.gz'))):[];
const agent=x=>{input=x;decision=basicAgent(x);return decision;};
if(!process.argv.includes('--saved'))for(let n=0;n<=837;n++){
 const result=h.step({GERMAN:agent,SOVIET:agent});
 if(n===760||n===837)snapshots.push({n,input,decision,result});
}
writeFileSync('evidence/ai005/reversal-19-inputs.json.gz',gzipSync(JSON.stringify(snapshots),{level:9}));
const [a,b]=snapshots,unitId='S-EL-02';
const samePosition=structuredClone(a.input);samePosition.view.units.find(u=>u.id===unitId).hex={q:21,r:2};
const reverse=b.decision.intent;
const oldOccupancy=structuredClone(b.input);for(const u of oldOccupancy.view.units)if(u.id!==unitId){const old=a.input.view.units.find(v=>v.id===u.id);if(old)u.hex={...old.hex};}
console.log(JSON.stringify({priorDecision:a.decision,currentDecision:b.decision,reverseScoreUnderPriorView:scoreIntent(samePosition,reverse),reverseScoreWithPriorOccupancy:scoreIntent(oldOccupancy,reverse),reverseScoreUnderCurrentView:scoreIntent(b.input,reverse),ownBefore:a.input.view.units.find(u=>u.id===unitId),ownAfter:b.input.view.units.find(u=>u.id===unitId),changedPositions:b.input.view.units.filter(u=>JSON.stringify(u.hex)!==JSON.stringify(a.input.view.units.find(v=>u.id===v.id)?.hex)).map(u=>({id:u.id,before:a.input.view.units.find(v=>u.id===v.id)?.hex,after:u.hex})),contactsBefore:a.input.view.contacts,contactsAfter:b.input.view.contacts},null,2));
