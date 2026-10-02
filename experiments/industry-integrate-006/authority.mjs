import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// The caller selects an existing Python environment, never an alternative execution function.
export async function executeOriginal(bundleJSON, command, python = process.env.INDUSTRY_PYTHON ?? 'python') {
  assert.equal(typeof bundleJSON, 'string', 'LOSSLESS_SERIALIZED_BUNDLE_REQUIRED');
  const bridge = fileURLToPath(new URL('./live_bridge.py', import.meta.url));
  return await new Promise((resolve, reject) => {
    const child = execFile(python, [bridge], {maxBuffer: 40 * 1024 * 1024, timeout: 20000,
      env: {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'}}, (error, stdout, stderr) => {
      if (error) return reject(new Error('ORIGINAL_ENTRY_FAILED: ' + (stderr || error.message)));
      try { resolve(JSON.parse(stdout)); } catch (e) { reject(e); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({bundleJSON, command}));
  });
}

export function savedCheckpointJSON(name) {
  assert.ok(['german_recovery_T2', 'german_recovery_T5', 'repaired'].includes(name));
  return fs.readFileSync(new URL('./.runtime/checkpoints/' + name + '.json', import.meta.url), 'utf8');
}

export function verifyRuntime() {
  const root = new URL('./.runtime/', import.meta.url);
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root)));
  assert.equal(manifest.base, '8cd45705559f2ecdffb5cf5696a6c4ff198a095d');
  assert.equal(manifest.core, '813b4072568352e95d0726fe5fe04060c889c554');
  for (const [name, expected] of Object.entries(manifest.files)) {
    assert.equal(createHash('sha256').update(fs.readFileSync(new URL(name, root))).digest('hex'), expected, name);
  }
  return manifest;
}
