// Prove the restored experimental map matches the real canonical map via the original importer.
import fs from 'node:fs';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import * as c from './.runtime/experiments/supply-exp-005/core/dist/index.js';
const root=new URL('../../',import.meta.url);
const bytes=fs.readFileSync(new URL('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',root));
const sourceBytes=fs.readFileSync(new URL('core/source/reference/strategic-reset-f-map.json',root));
assert.deepEqual(bytes,sourceBytes);
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
assert.equal(hash,'150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3');
const canonical=c.importLegacyMap(JSON.parse(bytes));
const seed=JSON.parse(zlib.gunzipSync(fs.readFileSync(new URL('./INITIAL.json.gz',import.meta.url))));
const derived=JSON.parse(fs.readFileSync(new URL('./.runtime/experiments/supply-exp-005/data/core-map.json',import.meta.url)));
assert.deepEqual(Object.fromEntries(canonical.hexes.map(h=>[c.hexKey(h.coord),h])),seed.core.hexes);
assert.deepEqual(Object.fromEntries(canonical.edges.map(e=>[e.key,e])),seed.core.edges);
assert.deepEqual(Object.fromEntries(derived.nodes.map(n=>[c.hexKey(n.coord),{coord:n.coord,terrain:n.terrain,control:n.control}])),seed.core.hexes);
assert.deepEqual(Object.fromEntries(derived.edges.filter(e=>e.core).map(e=>[e.core.key,e.core])),seed.core.edges);
const result={status:'PASS',canonical_map_sha256:hash,canonical_paths:['vendor/eastfront-digital-core/reference/strategic-reset-f-map.json','core/source/reference/strategic-reset-f-map.json'],
  hexes:Object.keys(seed.core.hexes).length,registered_feature_edges:Object.keys(seed.core.edges).length,derived_geometric_edges:derived.edges.length,
  hex_fields_equal:true,edge_fields_equal:true,scope:'Original Core importLegacyMap, full terrain/control/road/rail/river/bridge equality before legal deployment; no synthesized map.'};
fs.writeFileSync(new URL('./MAP_VALIDATION.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
