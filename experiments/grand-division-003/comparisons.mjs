// Fixed analytical/settlement cases, explicitly not natural campaign victories.
import fs from 'node:fs';
import {emptyDraft} from '../grand-division-001/templates.mjs';
import {attributes,resolveContacts} from '../grand-division-002/combat.mjs';
import {PROFILE,demand} from './catalog.mjs';
import {fuelAdjusted,terrainModifier} from './attributes.mjs';
const template=(...ids)=>{const t=emptyDraft();ids.forEach((id,i)=>t.regiments[i][0]=id);return t;};
const stats=(t,ratios={},fuel=100)=>{const n=demand(t);return fuelAdjusted(attributes(t,{personnel:n.manpower,held:Object.fromEntries(Object.entries(n.equipment).map(([k,q])=>[k,Math.floor(q*(ratios[k]??1))]))},PROFILE),fuel);};
const cases={infantry:stats(template('INFANTRY')),infantryArtillery:stats(template('INFANTRY','ARTILLERY')),motorFull:stats(template('MOTORIZED')),motorHalfTrucks:stats(template('MOTORIZED'),{motorized_equipment_1:.5}),motorNoFuel:stats(template('MOTORIZED'),{},0),tank:stats(template('LIGHT_ARMOR')),tankNoFuel:stats(template('LIGHT_ARMOR'),{},0)};
const piercing=[4,12,25].map(p=>{const a=structuredClone(cases.infantry);a.effective.piercing=p;return {piercing:p,...resolveContacts({contacts:[{hex:'1,1',units:['A','B'],initiators:['A']}],units:{A:{side:'GERMAN'},B:{side:'SOVIET'}},stats:{A:a,B:cases.tank},random:()=>.5,combined:true})};});
const terrain=Object.fromEntries(['infantry','motorFull','tank'].map(id=>[id,Object.fromEntries(['PLAIN','FOREST','MARSH'].map(t=>[t,{speed:cases[id].effective.speed,movementModifier:terrainModifier(cases[id],t,'movement'),durationFactor:1/Math.max(.1,1+terrainModifier(cases[id],t,'movement'))}]))]));
fs.writeFileSync('evidence/grand-division-003/comparisons.json',JSON.stringify({kind:'fixed directed attributes and real combat resolver; full equipment/fuel supplied only as fixture, no natural victory claim; common dice=.5; road bonuses remain inherited path rules',cases:Object.fromEntries(Object.entries(cases).map(([id,a])=>[id,{paper:a.paper,effective:a.effective}])),piercing,terrain},null,2));
console.log(Object.fromEntries(Object.entries(cases).map(([id,a])=>[id,a.effective])));
