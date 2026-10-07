import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Campaign} from './authority.mjs';
import {currentCityArtView} from '../../dist/app/playable/cities.js';
const c=new Campaign();const a=c.snapshot();const v=currentCityArtView(a);
assert.equal(v.viewer,'GERMAN');assert.equal(v.cities.length,a.cities.items.length);assert.deepEqual(v.knownHexKeys,a.game.message.payload.view.contactHexKeys);assert.equal(v.edges,a.game.message.payload.view.edges);
for(const city of v.cities)for(const d of city.districts){const original=a.cities.items.flatMap(x=>x.districts).find(x=>x.id===d.id);assert.deepEqual(d.facilities.map(f=>f.id),original.facilities.map(f=>f.id));if(original.control==='SOVIET')assert.equal(d.facilities.length,0);}
assert.throws(()=>currentCityArtView({version:a.version,cities:a.cities}),/FULL_AUTHORIZED/);
c.viewer='SOVIET';const b=c.snapshot();const w=currentCityArtView(b);assert.equal(w.viewer,'SOVIET');for(const d of w.cities.flatMap(c=>c.districts))if(d.control==='GERMAN')assert.equal(d.facilities.length,0);
const withdrawn=structuredClone(a);const d=withdrawn.cities.items[0].districts[0];d.hidden=true;d.facilities=[];d.sealedConstruction=[];assert.equal(currentCityArtView(withdrawn).cities[0].districts[0].hidden,true);
const main=fs.readFileSync('src/main.ts','utf8');assert(main.includes('dynamicMap.update(dynamic,model'));assert(main.includes('!presentation.privacyGate'));assert(main.includes(' as any).picking'));
const out={source:'003292992f24d4c82a8107ec3b6063b681d697dc',checks:['complete authorized DTO','partial message rejected','same authorized facility IDs','both seat projections omit enemy facilities','explicit withdrawal retained','existing dynamic SVG update and live action guard retained'],cities:v.cities.length,districts:v.cities.flatMap(x=>x.districts).length};
fs.writeFileSync('evidence/grand-play-001/city-integration.json',JSON.stringify(out,null,2)+'\n');console.log(out);
