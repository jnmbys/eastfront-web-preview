import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('./source/',import.meta.url));
const {scripts}=JSON.parse(readFileSync(cwd+'package.json','utf8'));
const failed=[];let count=0;
for(const [name,command]of Object.entries(scripts)){
 if(!name.startsWith('smoke'))continue;count++;console.log('RUN '+name);
 try{execFileSync(process.execPath,[command.split('node ')[1]],{cwd,stdio:'inherit',timeout:120000});}
 catch{failed.push(name);}
}
console.log(JSON.stringify({count,failed}));process.exitCode=failed.length?1:0;
