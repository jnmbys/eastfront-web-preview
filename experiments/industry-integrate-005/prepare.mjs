// Materialize pinned inputs locally; no dependency installation or campaign replay.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(here, '.runtime');
const refs = {
  runtime: '813b4072568352e95d0726fe5fe04060c889c554',
  rule: '7a970e020dc6ac104d44ac72a4a18508b10b1d2f',
  fixtures: '268ea7bd3d139936c4c6e52579cd4a84470e2611',
};
const sha = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: root, maxBuffer: 40 * 1024 * 1024});
const sources = [], outputs = [];
function read(commit, name) {
  const b = git('show', `${commit}:${name}`);
  sources.push({commit, path: name, sha256: sha(b)});
  return b;
}
function write(name, b) {
  fs.mkdirSync(path.dirname(path.join(out, name)), {recursive: true});
  fs.writeFileSync(path.join(out, name), b);
  outputs.push({path: name, sha256: sha(b)});
}
const prefix = 'experiments/supply-exp-005/core/src/';
const coreFiles = git('ls-tree', '-r', '--name-only', refs.runtime, '--', prefix).toString().trim().split('\n');
for (const name of coreFiles.filter(n => n.endsWith('.ts'))) {
  write('core/' + name.slice(prefix.length).replace(/\.ts$/, '.js'),
    stripTypeScriptTypes(read(refs.runtime, name).toString(), {mode: 'transform'}));
}
write('package.json', '{"type":"module"}\n');

// Verbatim guard function + verbatim apply() prefix, ending BEFORE reject/log/apply.
// Pinning and unique anchors deliberately fail closed if the engine structure changes.
const engine = read(refs.runtime, prefix + 'engine/RulesEngine.ts').toString();
function between(start, end) {
  assert.equal(engine.split(start).length, 2);
  const begin = engine.indexOf(start) + start.length;
  assert.equal(engine.slice(begin).split(end).length, 2);
  return engine.slice(begin, engine.indexOf(end, begin));
}
const ready = 'function controllerReadyGuard' + between('function controllerReadyGuard', '\nexport class RulesEngine');
const preamble = between('  apply(state:GameState,inputAction:Action):ActionResult {', '\n    const reject=');
assert.ok(preamble.includes('validatePendingDecisionAction(next,action)'));
assert.ok(!preamble.includes('applyRecoveryAction('));
const guardSource = `import type {Action,GameState,ValidationIssue,GameEvent} from '../core/types.js';
import {cloneGameState} from './state.js';
import {resolveActionIdentity} from './identity.js';
import {validatePendingDecisionAction} from './transactionGuard.js';
import {isDeploymentPhase} from '../rules/deployment.js';
${ready}
export function queryEnginePreconditions(state:GameState,inputAction:Action) {${preamble}
  return {issues, action, actionId};
}\n`;
write('core/engine/readOnlyPreconditions.js', stripTypeScriptTypes(guardSource, {mode: 'transform'}));
write('guard-extraction.json', JSON.stringify({source: prefix + 'engine/RulesEngine.ts',
  sourceSha256: sha(engine), controllerReadyGuardSha256: sha(ready), applyPrefixSha256: sha(preamble),
  stopBefore: 'const reject=', appliedRecovery: false, loggedAction: false}, null, 2) + '\n');
for (const name of ['candidate.json', 'inputs/MAP_NODES.json', 'VALIDATION.json']) {
  write('rule/' + path.basename(name), read(refs.rule, 'docs/rule-campaign-003/' + name));
}
for (const name of ['CHECKPOINTS.json.gz', 'ACTIONS.json.gz']) {
  write('fixtures/' + name, read(refs.fixtures, 'docs/campaign-004/' + name));
}
const manifest = {refs, node: process.version, sources, outputs};
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({status: 'PREPARED', refs, coreFiles: coreFiles.length, campaignReplayed: false}));
