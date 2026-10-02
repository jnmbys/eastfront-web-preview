// Offline projection only. Executes fixed original coordinate/import functions, no game turn.
// Node >=22.13 (stripTypeScriptTypes); Git objects for the two pinned commits must exist.
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('./', import.meta.url);
const runtime = '813b4072568352e95d0726fe5fe04060c889c554';
const campaign = '268ea7bd3d139936c4c6e52579cd4a84470e2611';
const sources = [];
const sha = b => createHash('sha256').update(b).digest('hex');
function git(commit, path) {
  const bytes = execFileSync('git', ['show', `${commit}:${path}`], {cwd:root, maxBuffer:20*1024*1024});
  sources.push({commit,path,sha256:sha(bytes)});
  return bytes;
}
const prefix = 'experiments/supply-exp-005/core/src/';
function moduleUrl(path, replacements={}) {
  let js = stripTypeScriptTypes(git(runtime,prefix+path).toString('utf8'));
  for (const [from,to] of Object.entries(replacements)) js = js.replaceAll(`'${from}'`, `'${to}'`);
  return 'data:text/javascript;base64,' + Buffer.from(js).toString('base64');
}
const hexUrl = moduleUrl('core/hex.ts');
const edgeUrl = moduleUrl('core/edge.ts', {'./hex.js':hexUrl});
const importerUrl = moduleUrl('scenario/importLegacyFMap.ts', {'../core/hex.js':hexUrl,'../core/edge.js':edgeUrl});
const h = await import(hexUrl);
const {importLegacyMap} = await import(importerUrl);
const mapBytes = git(runtime,'core/source/reference/strategic-reset-f-map.json');
assert.equal(sha(mapBytes),'150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3');
const canonical = importLegacyMap(JSON.parse(mapBytes));
const initialBytes = git(campaign,'docs/campaign-004/INITIAL.json.gz');
const initial = JSON.parse(gunzipSync(initialBytes));
const hexes = Object.fromEntries(canonical.hexes.map(n=>[h.hexKey(n.coord),n]));
const edges = Object.fromEntries(canonical.edges.map(e=>[e.key,e]));
assert.deepEqual(hexes,initial.core.hexes);
assert.deepEqual(edges,initial.core.edges);
assert.equal(Object.keys(hexes).length,640);
const nodes = [];
for(let col=1; col<=32; col++) for(let row=1; row<=20; row++) {
  const nodeId = h.columnToLetters(col)+row;
  const coord = h.parsePaperHex(nodeId), key=h.hexKey(coord);
  assert.equal(h.axialToPaper(coord).label,nodeId);
  const n=hexes[key]; assert.ok(n);
  const display=initial.logistics.nodes.find(x=>x.id===nodeId);
  assert.equal(display.terrain,n.terrain); assert.equal(display.core_control,n.control);
  nodes.push({nodeId,key,terrain:n.terrain,control:n.control});
}
assert.equal(new Set(nodes.map(n=>n.key)).size,640);
const authority = {runtimeCommit:runtime,campaignCommit:campaign,sources,
  verification:'Original pinned importLegacyMap equals saved INITIAL.core hexes AND edges; original paperToAxial/axialToPaper executed for all 640 cells.',
  hexes,edges};
const projection = {sourceCommit:campaign,sourcePath:'docs/campaign-004/INITIAL.json.gz',sourceSha256:sha(initialBytes),
  runtimeCommit:runtime,projection:'Original pinned Core parsePaperHex/axialToPaper + importLegacyMap; full snapshot equality; logistics x/y NOT used as Core keys.',nodes};
const outputs={'inputs/MAP_NODES.json':projection,'r1/CORE_AUTHORITY.json':authority};
const write = process.argv.includes('--write');
for (const [path,value] of Object.entries(outputs)) {
  const bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');
  if(write) {fs.mkdirSync(new URL('./r1/',root),{recursive:true});fs.writeFileSync(new URL(path,root),bytes);}
  else assert.deepEqual(fs.readFileSync(new URL(path,root)),bytes,`Generated file differs: ${path}`);
  console.log(JSON.stringify({path,sha256:sha(bytes),mode:write?'WRITE':'CHECK',cells:640}));
}
