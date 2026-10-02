import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';

const root = new URL('./.runtime/', import.meta.url);
export const bytesHash = bytes => createHash('sha256').update(bytes).digest('hex');
// Full JSON value, including journal/seen (unlike the old hash_bundle helper).
const canonical = x => Array.isArray(x) ? x.map(canonical) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canonical(x[k])])) : x;
export const snapshotHash = value => bytesHash(JSON.stringify(canonical(value)));
const read = name => fs.readFileSync(new URL(name, root));
const json = name => JSON.parse(read(name));
export const provenance = json('manifest.json');
assert.deepEqual(provenance.refs, {
  runtime: '813b4072568352e95d0726fe5fe04060c889c554',
  rule: '7a970e020dc6ac104d44ac72a4a18508b10b1d2f',
  fixtures: '268ea7bd3d139936c4c6e52579cd4a84470e2611',
});
for (const file of provenance.outputs) assert.equal(bytesHash(read(file.path)), file.sha256, file.path);
export function freeze(x) {
  if (x && typeof x === 'object' && !Object.isFrozen(x)) {
    Object.values(x).forEach(freeze); Object.freeze(x);
  }
  return x;
}
export const candidate = freeze(json('rule/candidate.json'));
export const mapData = freeze(json('rule/MAP_NODES.json'));
export const gate = freeze(json('rule/VALIDATION.json'));
assert.equal(bytesHash(read('rule/candidate.json')), '249511bc8f382e86305184c3e81ddb347222c873acd1593aef3b96f0cbef6ad0');
assert.equal(bytesHash(read('rule/MAP_NODES.json')), '3598aa9eaa2a725ac6c05edd684b0edad71e2164a98f63b5c60fc1bfd698f5ca');
assert.equal(gate.blockers.length, 35);
assert.deepEqual(gate.errors, []);
export const loadCheckpoints = () => JSON.parse(gunzipSync(read('fixtures/CHECKPOINTS.json.gz')));
export const loadActions = () => JSON.parse(gunzipSync(read('fixtures/ACTIONS.json.gz')));
