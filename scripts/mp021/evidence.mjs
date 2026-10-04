import {realpathSync,mkdirSync,writeFileSync,lstatSync,existsSync} from 'node:fs';
import {resolve,basename,join} from 'node:path';
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const plainDirectory=path=>{if(lstatSync(path).isSymbolicLink()||!same(realpathSync(path),resolve(path)))throw Error('Evidence/run directory redirects are forbidden');};
export function reserveEvidence(runDir,workspace=process.cwd()){
  const dir=resolve(runDir),name=basename(dir),parent=resolve(workspace,'.mp010-build/mp021');
  if(!/^run-\d{8}T\d{6}-[a-f0-9]{8}$/.test(name)||!same(dir,join(parent,name)))throw Error('Explicit MP021 lifecycle directory required');
  plainDirectory(dir);
  const evidence=resolve(workspace,'evidence');plainDirectory(evidence);
  const root=join(evidence,'mp-021');if(!existsSync(root))mkdirSync(root);plainDirectory(root);
  const out=join(root,name);
  // Exclusive directory creation happens before any network request. A repeated run cannot overwrite evidence.
  mkdirSync(out);
  return out;
}
export function writeNew(out,name,data){
  if(!/^[a-z][a-z0-9-]*\.(json|txt)$/.test(name))throw Error('Fixed evidence file name required');
  writeFileSync(join(out,name),data,{flag:'wx'});
}
