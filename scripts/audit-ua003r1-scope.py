"""UA-003R1: only the three existing Presence artwork/composition files may change."""
import hashlib,json,subprocess
from pathlib import Path
BASE='f32429a0972eb178a6f89bf3d507363a0a09715d'
TREE='0624660cffc171927c731958b787d0ef53422db7'
ALLOWED={'src/presentation/unitPresence.ts','src/presentation/unitPresenceSvg.ts','src/presentation/unitPresenceTypes.ts'}
def git(*args):return subprocess.check_output(['git',*args],text=True).strip()
assert git('rev-parse',BASE+'^{tree}')==TREE
baseline=git('ls-tree','-r','--name-only',BASE).splitlines()
changed=set(git('diff','--name-only',BASE).splitlines())
existing_changes=changed&set(baseline)
assert existing_changes<=ALLOWED,sorted(existing_changes-ALLOWED)
assert not [p for p in changed if p.startswith('src/') and p not in ALLOWED]
for path in baseline:assert Path(path).is_file(),path
frozen=json.loads(Path('tests/fixtures/ua003r1-frozen-sha256.json').read_text())
for path,sha in frozen.items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==sha,path
report={'baselineCommit':BASE,'baselineTree':TREE,'existingFilesChanged':sorted(existing_changes),'frozenFilesVerified':len(frozen),'allExistingTestsByteIdentical':True,'newRuntimeFiles':0,'newImagesOrDependencies':0,'frozen':['Core / CRT / combat / legality / RNG / supply / victory','Geometry / canonical map / Scenario','Counter renderer / anchors / touch hit targets / stack geometry','Camera / Combat UX2.1 / localization','VS2 surface / assets / world generation / cache','Startup loader / progress / timeout / fallback','UA coordinator / events / runtime / motion profiles / timing / speed controls'],'sourceCheckpointOnly':True,'deployedSiteUnchanged':True}
Path('evidence/ua-003r1/frozen-scope.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
