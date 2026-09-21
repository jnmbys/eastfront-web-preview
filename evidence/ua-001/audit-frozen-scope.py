"""Compare baseline bytes and protected function spans; never edit baseline files."""
import hashlib,json,subprocess
from pathlib import Path
BASE='d8e651cb84ad19f2901eacd282526fcb9deba65e'
EXPECTED_TREE='dc6db20fa4599eb946735344539a5430c15d5495'
def git(*args):return subprocess.check_output(['git',*args])
def digest(b):return hashlib.sha256(b).hexdigest()
assert git('rev-parse',BASE+'^{tree}').decode().strip()==EXPECTED_TREE
allowed={'src/core-adapter/session.ts','src/main.ts','src/localization/en-US.ts','src/localization/zh-CN.ts','styles.css','tests/localization.test.mjs'}
files=git('ls-tree','-r','--name-only',BASE).decode().splitlines()
checked=[]
for f in files:
 if f in allowed:continue
 old=git('show',BASE+':'+f);new=Path(f).read_bytes();assert old==new, f
 checked.append({'path':f,'sha256':digest(new)})
old=git('show',BASE+':src/main.ts').decode();new=Path('src/main.ts').read_text()
spans={}
for label,start,end in [('newGame_and_camera','function startNewGame(','function mapRenderOptions('),('combat_UX21_bindings','function showCombatView(','async function boot('),('boot_VS2_cache','async function boot(',"window.addEventListener('resize'")]:
 a=old[old.index(start):old.index(end)];b=new[new.index(start):new.index(end)];assert a==b,label;spans[label]=digest(b.encode())
session=Path('src/core-adapter/session.ts').read_text().replace("import { publishPresentationTransition } from '../presentation/transitionBus.js';\n",'').replace('  const previousState = session.state;\n','').replace('  publishPresentationTransition(session, previousState, result);\n','')
assert session==git('show',BASE+':src/core-adapter/session.ts').decode()
assert Path('styles.css').read_bytes().startswith(git('show',BASE+':styles.css'))
oldtest=git('show',BASE+':tests/localization.test.mjs').decode()
newtest=Path('tests/localization.test.mjs').read_text().replace("import {UnitAnimationRuntime} from '../dist/app/presentation/runtime.js';\n",'').replace("import {animationControls,bindAnimationControls} from '../dist/app/ui/animationControls.js';\n",'').replace("addEventListener(){},querySelectorAll:()=>[]",'addEventListener(){}').replace("unitAnimations:new UnitAnimationRuntime({now:()=>0,request:()=>0,cancel(){}}),animationControls,bindAnimationControls,",'')
assert oldtest==newtest,'All existing localization assertions must remain unchanged'
report={'baselineCommit':BASE,'baselineTree':EXPECTED_TREE,'baselineWorkingTree':'CLEAN (verified before changes)','unchangedBaselineFiles':len(checked),'protectedRuntimeFiles':sum(f['path'].startswith(('src/','vendor/','public/')) for f in checked),'approvedExistingFileEdits':sorted(allowed),'unchangedFunctionSpans':spans,'sessionChange':'Only post-adoption detached presentation notification; engine, acceptance, state replacement and integrity flow unchanged','existingTests':'No deletions or assertion changes; localization mock wired to new presentation controls','files':checked}
Path('evidence/ua-001/frozen-scope.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
