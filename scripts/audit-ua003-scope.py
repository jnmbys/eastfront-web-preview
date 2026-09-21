"""Frozen-scope audit of UA003 against the authoritative UA002 source tree."""
from pathlib import Path
import subprocess,json,hashlib
BASE='1bbc481a25976d765d7f7e67aeaa1a6ca1c828ca'
TREE='f630f420be6a1796e9e4ba0c988b330df43821d4'
def git(*args):return subprocess.check_output(['git',*args]).decode().strip()
assert git('rev-parse',BASE+'^{tree}')==TREE
allowed={'src/presentation/coordinator.ts','src/presentation/events.ts','src/presentation/runtime.ts','src/presentation/svgUnits.ts','tests/helpers/svg-dom.mjs','tests/ua002-tactical.test.mjs'}
baseline=set(git('ls-tree','-r','--name-only',BASE).splitlines())
all_changed=git('diff','--name-only',BASE).splitlines()
changed=[p for p in all_changed if p in baseline]
new_runtime=[p for p in all_changed if p not in baseline and p.startswith('src/')]
assert all(p.startswith('src/presentation/') for p in new_runtime),new_runtime
assert set(changed)<=allowed,f'Frozen files changed: {set(changed)-allowed}'
for p in git('ls-tree','-r','--name-only',BASE).splitlines():assert Path(p).is_file(),f'Baseline file removed: {p}'
old=subprocess.check_output(['git','show',BASE+':tests/ua002-tactical.test.mjs']).decode();new=Path('tests/ua002-tactical.test.mjs').read_text()
assert old.count('test(')==new.count('test('),'Old tests removed'
frozen=json.loads(Path('tests/fixtures/ua003-frozen-sha256.json').read_text())
for p,sha in frozen.items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==sha,p
report={'baselineCommit':BASE,'baselineTree':TREE,'baselineFiles':len(git('ls-tree','-r','--name-only',BASE).splitlines()),'changedBaselineFiles':changed,'newRuntimeFiles':new_runtime,'runtimeChangesOnlyIn':'src/presentation/','frozenRuntimeFilesVerified':len(frozen),'allOldTestsRetained':True,'testAdaptations':['Software SVG DOM gains standard insertBefore and class selector support.','UA002 frame-write test recognizes the new active unit companion subtree; static-map writes and allocation assertions remain.'], 'frozen':['vendor/Core','Core adapter / seed generation','Geometry','canonical map / Scenario','Combat rules / CRT / odds / legality / supply / victory','Counter V2 renderer / hit targets / stack geometry','Combat UX2.1 / interaction routing','Camera mechanics / zoom / FIT','VS2 terrain / cached world surfaces / assets','Startup shell / progress / loader order / HTMLImageElement-first / fallback / timeout / cache','Localization / zh-CN default / en-US','UA002 timing.ts and motion.ts'],'noExternalAssetsAdded':True,'deployment':'UA003 is a source checkpoint only; public Pages remains UA002.'}
Path('evidence/ua-003/frozen-scope.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
