import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
const workspace=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baseline='4db081bcfcd89c584fe7f53015b2a6ade63d87bf';
const mode=process.argv[2];
if(!['baseline','candidate'].includes(mode))throw Error('Use baseline or candidate');
const run=(cmd,args,cwd=workspace)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
const git=(...args)=>execFileSync('git',args,{cwd:workspace,encoding:'utf8'}).trim();
const npmCli=process.env.npm_execpath??join(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
if(!existsSync(npmCli))throw Error('Use the Node executable installed with npm, or set npm_execpath to npm-cli.js');
if(mode==='baseline'){
 const source=join(workspace,'.startup003/repro-baseline-source');
 if(existsSync(source))throw Error('Baseline checkout already exists: '+source);
 run('git',['worktree','add','--detach',source,baseline]);
 run(process.execPath,[npmCli,'ci','--ignore-scripts','--no-audit','--no-fund'],source);
 run(process.execPath,[npmCli,'run','build'],source);
 console.log('STARTUP003_BASELINE='+join(source,'dist'));
}else{
 const sourceCommit=git('rev-parse','HEAD');
 if(!/^[a-f0-9]{40}$/.test(sourceCommit)||git('status','--porcelain','--untracked-files=no'))throw Error('Commit tracked changes before packaging');
 run(process.execPath,[npmCli,'run','build']);
 const dist=join(workspace,'dist');
 if(JSON.parse(readFileSync(join(dist,'diagnostics/transport/build.json'))).sourceCommit!==sourceCommit)throw Error('Build SHA mismatch');
 const zip=join(workspace,`.startup003/startup-003-candidate-${sourceCommit}.zip`);
 if(existsSync(zip))throw Error('Candidate already exists: '+zip);
 mkdirSync(dirname(zip),{recursive:true});
 // Windows bsdtar writes ZIP directly. No deployment command or remote is used.
 run('tar.exe',['-a','-c','-f',zip,'-C',dist,'.']);
 const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
 const files=[];function walk(dir){for(const name of readdirSync(dir).sort()){const path=join(dir,name);if(statSync(path).isDirectory())walk(path);else files.push({path:relative(dist,path).replaceAll('\\','/'),bytes:statSync(path).size,sha256:hash(path)});}}walk(dist);
 const manifest={sourceCommit,baseline,zip,zipSha256:hash(zip),rollbackQuery:'?terrainLoad=serial',files};
 writeFileSync(zip+'.manifest.json',JSON.stringify(manifest,null,2)+'\n');console.log(zip);
}
