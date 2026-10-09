import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';
const before=execFileSync('git',['show','bdb3384:src/interaction/viewportWork.ts'],{encoding:'utf8'});
const after=fs.readFileSync('src/interaction/viewportWork.ts','utf8');
function setup(source){
 const context=vm.createContext({});
 vm.runInContext(`
   const pending=new Map();let sequence=0,painted=0;
   function setTimeout(fn,delay){if(this!==globalThis)throw new TypeError('Illegal invocation');const id=++sequence;pending.set(id,fn);return id;}
   function clearTimeout(id){if(this!==globalThis)throw new TypeError('Illegal invocation');pending.delete(id);}
 `+ts.transpileModule(source.replace('export class','class'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+`
   const work=new ViewportWork(()=>painted++);
 `,context);return context;
}
const old=setup(before);
assert.throws(()=>vm.runInContext('work.request(true)',old),/Illegal invocation/);
// Check clearTimeout independently, not just the first scheduling call.
assert.throws(()=>vm.runInContext('work.timer=1;work.dispose()',old),/Illegal invocation/);
const fixed=setup(after);
vm.runInContext(`
  work.request(true);work.request();work.hold();work.request();work.release();
  for(const [id,fn] of pending){pending.delete(id);fn();}
  work.request();work.dispose();
`,fixed);
assert.equal(vm.runInContext('painted',fixed),1);
assert.equal(vm.runInContext('pending.size',fixed),0);
assert.equal(vm.runInContext('work.busy',fixed),false);
console.log('PASS: previous code reproduces Illegal invocation for both timers; fixed schedule/cancel use the Window-style global receiver; coalescing/hold/release/disposal pass. Host-receiver regression, not a physical browser test.');
