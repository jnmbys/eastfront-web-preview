import fs from 'node:fs';
import {Campaign} from '../blackice-content-002/authority.mjs';
const c=new Campaign();const d=c.snapshot();console.log(JSON.stringify({hexCount:Object.keys(c.state.hexes).length,terrain:[...new Set(Object.values(c.state.hexes).map(h=>h.terrain))],cities:d.cities.items.map(x=>({id:x.id,label:x.label,hex:x.districts.find(d=>d.type==='MAIN')?.hex})),template:d.divisions.integrated.templates[0],unit:d.divisions.integrated.units[0],geo:d.continuous.geography.cells.slice(0,2)},null,2));
