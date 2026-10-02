"""Restore pinned 005 and original live.execute under 006 only. No campaign replay."""
import gzip, hashlib, io, json, os, shutil, subprocess, sys, tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNTIME = HERE / '.runtime'
ROOT = HERE.parents[1]
BASE = '8cd45705559f2ecdffb5cf5696a6c4ff198a095d'
CORE = '813b4072568352e95d0726fe5fe04060c889c554'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT)

def sha(raw):
    return hashlib.sha256(raw).hexdigest()

def main():
    import numpy, scipy
    assert (numpy.__version__, scipy.__version__) == ('2.3.5', '1.17.0')
    inputs = []
    for commit, prefix, target in [
        (BASE, 'experiments/industry-integrate-005', RUNTIME / 'planner'),
        (CORE, 'experiments/supply-exp-005', RUNTIME / 'live'),
    ]:
        target.mkdir(parents=True, exist_ok=True)
        archive = git('archive', commit, prefix)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tf:
            tf.extractall(target, filter='data')
        for name in git('ls-tree', '-r', '--name-only', commit, '--', prefix).decode().splitlines():
            raw = (target / name).read_bytes()
            assert raw == git('show', commit + ':' + name)
            inputs.append(dict(commit=commit, path=name, sha256=sha(raw)))
    planner = RUNTIME / 'planner/experiments/industry-integrate-005'
    live = RUNTIME / 'live/experiments/supply-exp-005'
    # 005 resolves its repository root relative to its own file. Bind only its read-only
    # Git invocations to the existing object database and this isolated copy's root.
    env = dict(os.environ, GIT_DIR=git('rev-parse', '--absolute-git-dir').decode().strip(),
               GIT_WORK_TREE=str(RUNTIME / 'planner'))
    subprocess.run(['node', str(planner / 'prepare.mjs')], check=True, cwd=ROOT, env=env)
    assert len(list((planner / '.runtime/core').rglob('*.js'))) == 39
    subprocess.run([sys.executable, str(live / 'restore-fixtures.py')], check=True, cwd=live)
    # Identical pinned TS source, transformed by the unchanged 005 preparer.
    # Original live bridge expects core/dist; no tracked Core file is edited.
    shutil.copytree(planner / '.runtime/core', live / 'core/dist', dirs_exist_ok=True)
    (live / 'package.json').write_bytes(b'{"type":"module"}\n')
    checkpoints = json.loads(gzip.decompress((planner / '.runtime/fixtures/CHECKPOINTS.json.gz').read_bytes()))
    (RUNTIME / 'checkpoints').mkdir(exist_ok=True)
    for name in ['german_recovery_T2', 'german_recovery_T5', 'repaired']:
        # Preserve Python integer/float JSON representation for original live.hash_bundle.
        (RUNTIME / 'checkpoints' / (name + '.json')).write_bytes(json.dumps(checkpoints[name], ensure_ascii=False).encode('utf8'))
    files = {str(p.relative_to(RUNTIME)).replace('\\', '/'): sha(p.read_bytes())
             for p in sorted(RUNTIME.rglob('*')) if p.is_file()
             and '__pycache__' not in p.parts and p != RUNTIME / 'manifest.json'}
    manifest = dict(base=BASE, core=CORE, inputs=inputs, files=files,
                    versions=dict(python=sys.version, numpy=numpy.__version__, scipy=scipy.__version__,
                                  node=subprocess.check_output(['node', '--version'], text=True).strip()))
    (RUNTIME / 'manifest.json').write_bytes((json.dumps(manifest, indent=2) + '\n').encode())
    print(json.dumps(dict(status='PREPARED_006', files=len(files), campaignReplayed=False)))

if __name__ == '__main__':
    main()
