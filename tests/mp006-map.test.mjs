import test from 'node:test';
import assert from 'node:assert/strict';
import {collectSamples} from '../scripts/mp005a/samples.mjs';
import {encodeSnapshot,decodeSnapshot,MAP_SNAPSHOT,COMPACT_SNAPSHOT} from '../dist/app/multiplayer/snapshotCodec.js';
import {encodeMapTable,decodeMapTable} from '../dist/app/multiplayer/mapEncoding.js';
test('MP006 production v3 roundtrips all 142 authorized both-side cross-phase privacy samples',()=>{
 for(const {message} of collectSamples().samples){const p=message.payload,canonical={...p,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}},wire=encodeSnapshot(canonical,MAP_SNAPSHOT),parsed=JSON.parse(JSON.stringify(wire)),decoded=decodeSnapshot(parsed,true,true);
 assert.deepEqual(decoded,p);assert.equal(wire.format,p.resync?'snapshot-v1':MAP_SNAPSHOT);
 assert.notEqual(decoded.model.playerView,decoded.view);assert.notEqual(decoded.model.hexes,decoded.view.hexes);assert.notEqual(decoded.model.edges,decoded.view.edges);assert.notEqual(decoded.model.playerView.hexes,decoded.model.hexes);
 if(!p.resync){assert.throws(()=>decodeSnapshot(parsed,true));const original=structuredClone(parsed);decoded.view.hexes[0].coord.q=999;assert.deepEqual(parsed,original);assert.notEqual(decoded.model.hexes[0].coord.q,999);}
 }
});
test('MP006 presence masks preserve missing/null, nested values, finite precision and array order',()=>{
 const rows=[{coord:{q:-0.123456789012345,r:0},cityId:null,terrain:'FOREST'},{terrain:'PLAIN',coord:{q:2,r:1}},{cityId:'',coord:{q:0,r:0},terrain:'CITY'}];
 const table=JSON.parse(JSON.stringify(encodeMapTable(rows)));assert.deepEqual(decodeMapTable(table,3),rows);
 for(const change of [t=>t.fields.push(t.fields[0]),t=>t.fields[0]='__proto__',t=>t.rows[0][0]=-1,t=>t.rows[0][0]=1.5,t=>t.rows[0][0]=2**t.fields.length,t=>t.rows[0].pop(),t=>t.rows[0].push(null),t=>t.extra=1,t=>t.rows={},t=>t.fields=new Array(17).fill('x')]){const bad=structuredClone(table);change(bad);assert.throws(()=>decodeMapTable(bad,3));}
 assert.throws(()=>decodeMapTable(table,2));
});
test('MP006 malformed map data, privacy fields and v3 recovery fail before application',()=>{
 const p=collectSamples().samples.find(s=>!s.message.payload.resync).message.payload;
 const wire=JSON.parse(JSON.stringify(encodeSnapshot({...p,model:{...p.model,playerView:p.view,hexes:p.view.hexes,edges:p.view.edges}},MAP_SNAPSHOT)));
 for(const change of [s=>s.resync=true,s=>s.view.hexes.rows[0][1]={q:'bad',r:0},s=>s.view.hexes.fields[0]='authoritativeState',s=>s.view.resources[s.view.viewer==='SOVIET'?'GERMAN':'SOVIET']={rp:1,cp:2},s=>s.view.edges.rows[0].push(null),s=>s.view.hexes=[],s=>s.model.hexes=[]]){const bad=structuredClone(wire);change(bad);if(JSON.stringify(bad)!==JSON.stringify(wire))assert.throws(()=>decodeSnapshot(bad,true,true));}
 assert.equal(encodeSnapshot({...p,model:{...p.model,hexes:[]}},MAP_SNAPSHOT).format,'snapshot-v1');
});
