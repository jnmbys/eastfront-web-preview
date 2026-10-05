import fs from 'node:fs';
import crypto from 'node:crypto';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import {createScenario,config} from './scenario.mjs';
const {state,nodes,placements}=createScenario();
const initial={config,turn:state.turn,phase:state.phase,nodes,units:placements.map(p=>({...p,label:core.axialToPaper(p.hex).label,templateId:state.units[p.id].templateId})),hexes:Object.values(state.hexes),edges:Object.values(state.edges)};
const bytes=JSON.stringify(initial,null,2)+'\n';
fs.writeFileSync('docs/grand-campaign-001/evidence/initial-scenario.json',bytes);
console.log(JSON.stringify({hexes:initial.hexes.length,units:initial.units.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
