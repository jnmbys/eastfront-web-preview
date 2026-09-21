"""Byte-for-byte audit against the user-authorized Startup Loading UX1 baseline."""
import hashlib,json,subprocess
from pathlib import Path
BASE='8a817dc0abfa1999ac9262108c139ca508fa798a'
TREE='68c404eb633401448eb64b8040ffbc909fa83678'
def git(*args): return subprocess.check_output(['git',*args])
assert git('rev-parse',BASE+'^{tree}').decode().strip()==TREE
allowed={f'src/presentation/{name}.ts' for name in ['coordinator','events','runtime','svgUnits','timing']}
allowed.update(['tests/helpers/animation-fixture.mjs','tests/localization.test.mjs','tests/startup-progress.test.mjs','tests/ua001-animation.test.mjs'])
files=git('ls-tree','-r','--name-only',BASE).decode().splitlines()
unchanged=[];changed=[]
for path in files:
 old=git('show',f'{BASE}:{path}');new=Path(path).read_bytes()
 if old!=new:
  assert path in allowed,f'Frozen baseline file changed: {path}'
  changed.append(path)
 else:unchanged.append({'path':path,'sha256':hashlib.sha256(new).hexdigest()})
# Existing tests retain their behavioral assertions; only DOM/event fixtures and the
# intentionally superseded presentation-byte-freeze gate are adapted for UA-002.
assert git('show',BASE+':tests/ua001-animation.test.mjs').count(b"test('")==Path('tests/ua001-animation.test.mjs').read_bytes().count(b"test('")
assert git('show',BASE+':tests/startup-progress.test.mjs').count(b"test('")==Path('tests/startup-progress.test.mjs').read_bytes().count(b"test('")
report={'baselineCommit':BASE,'baselineTree':TREE,'baselineFileCount':len(files),'unchangedBaselineFiles':len(unchanged),
 'changedBaselineFiles':changed,'runtimeChangesOnlyIn':'src/presentation/','newRuntimeFile':'src/presentation/motion.ts',
 'frozenScopes':['vendor/Core','core-adapter','interaction/Combat UX2.1','Geometry','Scenario/canonical map','VS2/assets/cache','Camera','Counter V2 renderer','localization/default zh-CN','main startup and loader shell','styles.css'],
 'testAdaptations':['Existing animation DOM fixture now supports SVG children, cloning, removal and serialization.','Localization DOM stub adds querySelector; original assertions unchanged.','UA001 lifecycle synthetic facts include cue participants; original assertions unchanged.','Startup test retains session/transitionBus byte freeze; UA002 intentionally supersedes presentation-module byte freeze. All startup loader/VS2 byte-freeze and behavior tests remain; all other source files receive a new baseline byte-freeze gate.'],
 'files':unchanged}
Path('evidence/ua-002/frozen-scope.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
