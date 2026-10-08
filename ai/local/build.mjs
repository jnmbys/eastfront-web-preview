import {execFileSync} from 'node:child_process';
import {cpSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
const preview=process.env.AI_PREVIEW_DIR??'.ai003-preview';
if(!/^\.[a-z0-9-]+$/.test(preview))throw Error('INVALID_PREVIEW_DIRECTORY');
for(const output of ['.ai003-dist',preview])rmSync(output,{recursive:true,force:true});
// The package build is three Node programs; invoke them directly so Windows does
// not need to execute npm.cmd as a binary or enable a command shell.
for(const args of [['scripts/clean-dist.mjs'],['node_modules/typescript/bin/tsc'],['scripts/copy-static.mjs']])
 execFileSync(process.execPath,args,{stdio:'inherit',env:{...process.env,MULTIPLAYER_SERVER_URL:''}});
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','ai/local/tsconfig.json'],{stdio:'inherit'});
mkdirSync(preview,{recursive:true});cpSync('dist',preview,{recursive:true});
for(const dir of ['src','ai','server'])cpSync('.ai003-dist/'+dir,preview+'/'+dir,{recursive:true});
const file=preview+'/src/main.js',source=readFileSync(file,'utf8');if(source.split('const LOCAL_AI_ENABLED = false;').length!==2)throw new Error('Experimental gate marker missing');writeFileSync(file,source.replace('const LOCAL_AI_ENABLED = false;','const LOCAL_AI_ENABLED = true;'));
writeFileSync(preview+'/index.html',readFileSync('dist/index.html','utf8').replaceAll('./app/','./src/').replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="connect-src 'self'; object-src 'none'">`));
writeFileSync(preview+'/multiplayer-config.json','{"serverUrl":""}\n');
cpSync('src/assets/VS2_ASSET_MANIFEST.json',preview+'/src/assets/VS2_ASSET_MANIFEST.json');
writeFileSync(preview+'/styles.css',readFileSync('styles.css','utf8')+'\n.local-ai-status{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px;background:#222d22;color:#fff;font-size:14px}.local-ai-status button{min-height:44px}.home-screen{padding:32px}.home-screen select{margin:12px;min-height:44px}');
console.log('AI003 isolated preview: .ai003-preview (no deployment)');

writeFileSync(preview+'/ai003-build.json',JSON.stringify({task:'AI-003',sourceCommit:process.env.RELEASE_SOURCE_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),uncommittedChanges:process.env.RELEASE_SOURCE_SHA?false:!!execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim(),productionConnection:false,saveLoadSupported:false},null,2)+'\n');

cpSync('playable.css',preview+'/playable.css');
writeFileSync(preview+'/index.html',readFileSync(preview+'/index.html','utf8').replace('</head>','<link rel="stylesheet" href="./playable.css"></head>'));
cpSync('public/assets/playable',preview+'/assets/playable',{recursive:true});
