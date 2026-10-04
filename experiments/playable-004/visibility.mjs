// Input is already-authorized PlayerView; no authoritative state or legality query.
import fs from 'node:fs';
import {defaultRules,zocHexKeys} from '../industry-integrate-018/.runtime/live/core/dist/index.js';
const v=JSON.parse(fs.readFileSync(0,'utf8'));
const units=Object.fromEntries(v.units.filter(u=>u.visibility==='IDENTIFIED').map(u=>{
 const templateId=u.friendly?.templateId??Object.keys(defaultRules.unitTemplates).find(k=>defaultRules.unitTemplates[k].type===u.type);
 if(!templateId)throw Error('UNKNOWN_PUBLIC_TEMPLATE');
 return [u.id,{...u,alive:true,templateId}];
}));
const state={units,hexes:Object.fromEntries(v.hexes.map(h=>[`${h.coord.q},${h.coord.r}`,h]))};
console.log(JSON.stringify({G:[...zocHexKeys(state,defaultRules,'GERMAN')],S:[...zocHexKeys(state,defaultRules,'SOVIET')]}));
