"""Read-only frozen-scope audit against the authoritative source checkpoint."""
import hashlib, json, pathlib, subprocess
BASE='e9d7dc90bfe85fb6ce762c10fb675f43ef52bb9f'
allowed={'src/core-adapter/browserProjection.ts','src/core-adapter/session.ts','src/fog/runtime.ts','src/fog/surface.ts','src/main.ts','src/presentation/svgUnits.ts','src/presentation/unitPresence.ts','src/render/coreSvg.ts','src/render/dynamicMap.ts'}
files=subprocess.check_output(['git','ls-tree','-r','--name-only',BASE],text=True).splitlines()
checks=0
for p in files:
 if p.startswith(('src/','vendor/')) or p in {'styles.css','index.html'}:
  if p in allowed:continue
  assert pathlib.Path(p).read_bytes()==subprocess.check_output(['git','show',BASE+':'+p]),p
  checks+=1
for p in files:
 if p.startswith('tests/') and p.endswith('.test.mjs'):assert pathlib.Path(p).is_file(),p
print(json.dumps({'baseline':BASE,'frozenFiles':checks,'oldTestFilesRetained':True,'authorizedRuntimeFiles':sorted(allowed)},indent=2))
