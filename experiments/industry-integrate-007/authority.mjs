import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export function executePE(bundleJSON,command,python=process.env.INDUSTRY_PYTHON??'python') {
  return new Promise((resolve,reject)=>{
    const child=execFile(python,[fileURLToPath(new URL('./pe_bridge.py',import.meta.url))],{
      timeout:20000,maxBuffer:40*1024*1024,env:{...process.env,PYTHONUTF8:'1',PYTHONIOENCODING:'utf-8'}
    },(error,out,err)=>{
      if(error)return reject(Error('PE_ENTRY_FAILED:'+(err||error.message)));
      try{resolve(JSON.parse(out));}catch(e){reject(e);}
    });
    child.stdin.on('error',()=>{});child.stdin.end(JSON.stringify({bundleJSON,command}));
  });
}
