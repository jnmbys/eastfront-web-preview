// Reconstruct the client modules at both recorded checkpoints without moving any Git ref.
import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import ts from 'typescript';
const refs={development:'73d2dee2f2dab3bfb09d6466d54fa391d19d39fb',mp009:'33e7e8e292a509760f69ebdea29e541df69aea6c'};
for(const [label,ref] of Object.entries(refs)){
 const root=resolve('node_modules/.cache/mp009-r1',label);mkdirSync(root,{recursive:true});
 cpSync('dist/app',root+'/app',{recursive:true});cpSync('dist/vendor',root+'/vendor',{recursive:true});
 writeFileSync(root+'/package.json',JSON.stringify({type:'module'}));
 const files=execFileSync('git',['ls-tree','-r','--name-only',ref,'src/multiplayer'],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.ts'));
 const options=ts.convertCompilerOptionsFromJson(JSON.parse(readFileSync('tsconfig.json','utf8')).compilerOptions,'.').options;
 for(const path of files){const source=execFileSync('git',['show',ref+':'+path],{encoding:'utf8'});writeFileSync(root+'/app/'+path.slice(4,-3)+'.js',ts.transpileModule(source,{compilerOptions:options,fileName:path}).outputText);}
 const sharedDependencies=['src',':!src/main.ts',':!src/multiplayer','vendor','server','tsconfig.json'];
 const dependencyDiff=execFileSync('git',['diff','--name-only',ref,'--',...sharedDependencies],{encoding:'utf8'}).trim();
 if(dependencyDiff)throw Error('Unreviewed shared dependency difference: '+dependencyDiff);
 writeFileSync(root+'/provenance.json',JSON.stringify({ref,clientModulesFromGit:files,sharedDependencies,unchangedSharedDependencies:true},null,2)+'\n');
 console.log(label,ref,root+'/app');
}
