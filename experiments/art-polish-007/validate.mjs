import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createSlice,inside,corridors,label} from './dist/app/experiments/mapData.js';
import {inPolish,detailLayout} from './dist/app/experiments/polishDetails.js';
import {hexPolygon,hexToPixel} from './dist/app/geometry/hex.js';
import {vs2RectangleSegmentDistance} from './dist/app/render/vs2Projection.js';
const data=createSlice(JSON.parse(await readFile(new URL('./dist/map.json',import.meta.url)))),before=JSON.stringify(data),details=detailLayout(data),lanes=corridors(data),tests=[];
function test(name,fn){fn();tests.push({name,status:'PASS'});}
test('49-cell region only; original 640 cells, 257 edges, 58 fixtures unchanged',()=>{assert.equal(data.hexes.filter(inPolish).length,49);assert.equal(data.hexes.length,640);assert.equal(data.edges.length,257);assert.equal(data.counters.length,58);assert.equal(JSON.stringify(data),before);});
test('Every detail footprint lies within one original region cell',()=>{for(const p of details){const h=data.hexes.find(h=>label(h.coord)===p.cell);assert(h&&inPolish(h));for(const x of [-1,1])for(const y of [-1,1])assert(inside({x:p.x+x*p.width/2,y:p.y+y*p.height/2},hexPolygon(h.coord)));}});
test('All details clear full river/transport envelopes and bridge intersections',()=>{for(const p of details)for(const l of lanes)assert(vs2RectangleSegmentDistance(p,p.width/2,p.height/2,l.a,l.b)>=l.width+1.5);});
test('All details clear original counter envelopes; no units/actions added',()=>{for(const p of details)for(const u of data.counters){const q=hexToPixel(u.hex);assert(Math.abs(p.x-q.x)>=34+p.width/2||Math.abs(p.y-q.y)>=34+p.height/2);}});
test('Period props constrained to existing city or adjacent plain, stone to relief, deterministic variation',()=>{for(const p of details){const h=data.hexes.find(h=>label(h.coord)===p.cell);if(p.kind==='yard')assert.equal(h.terrain,'CITY');if(p.kind==='garden')assert(['CITY','PLAIN'].includes(h.terrain));if(p.kind==='stone')assert(['HILL','ROUGH'].includes(h.terrain));}assert.deepEqual(details,detailLayout(data));assert.equal(new Set(details.map(p=>p.kind)).size,6);});
await writeFile(new URL('../../evidence/ART-POLISH-007/detail-layout.json',import.meta.url),JSON.stringify(details,null,2)+'\n');await writeFile(new URL('../../evidence/ART-POLISH-007/semantic-tests.json',import.meta.url),JSON.stringify(tests,null,2)+'\n');console.log(JSON.stringify({tests:tests.length,count:details.length,kinds:details.reduce((o,p)=>(o[p.kind]=(o[p.kind]??0)+1,o),{})}));
