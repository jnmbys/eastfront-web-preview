import {cp,rm,mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..'),src=resolve(root,'task-source/ART-PREVIEW-002'),dist=resolve(src,'dist'),accepted=resolve(root,'candidate');
process.chdir(src);
await mkdir(resolve(root,'task-source/evidence'),{recursive:true});
await cp(resolve(accepted,'vendor'),resolve(src,'vendor'),{recursive:true});
const tsc=resolve(src,'node_modules/typescript/bin/tsc');
execFileSync(process.execPath,[tsc,'--noEmit'],{stdio:'inherit'});
if(process.argv.includes('--typecheck'))process.exit(0);
await rm(dist,{recursive:true,force:true});
execFileSync(process.execPath,[tsc],{stdio:'inherit'});
// Frozen Core and static assets are tracked inputs. Never copy accepted app JS.
for(const n of ['vendor','assets','diagnostics','multiplayer.css'])await cp(resolve(accepted,n),resolve(dist,n),{recursive:true});
await cp('src/assets/VS2_ASSET_MANIFEST.json',resolve(dist,'app/assets/VS2_ASSET_MANIFEST.json'));
await cp('styles.css',resolve(dist,'styles.css'));
const {startupLoadingMarkup}=await import(resolve(dist,'app/web/startupView.js'));
let html=(await readFile('index.html','utf8')).replace('<!--startup-feedback-->',startupLoadingMarkup());
html=html.replace('<head>','<head><meta name="robots" content="noindex,nofollow"><script src="./preview/guard.js"></script>').replace('</body>','<script type="module" src="./preview/measure.js"></script></body>');
await writeFile(resolve(dist,'index.html'),html);
await mkdir(resolve(dist,'preview'),{recursive:true});
for(const n of ['scene.mjs','guard.js','measure.js'])await cp(resolve(src,'preview-only',n),resolve(dist,'preview',n));
let main=await readFile(resolve(dist,'app/main.js'),'utf8');
if(!main.includes('addMultiplayerHomeButton(root,'))throw Error('Missing isolation anchor');
main="if(['eastfront-web-preview.pages.dev','jnmbys.github.io'].includes(location.hostname))throw Error('Preview must not run on production hostname');\n"+main.replace('addMultiplayerHomeButton(root,','(()=>{})(root,');
main+='\n'+await readFile('preview-only/bootstrap.txt','utf8');
await writeFile(resolve(dist,'app/main.js'),main);
await writeFile(resolve(dist,'multiplayer-config.json'),JSON.stringify({serverUrl:'',disabled:true}));
// Compatibility provenance is deliberately pinned to the accepted source origin.
// Current source/build commit is recorded in the external build evidence, not fabricated here.
const origin='1f124566ef669fc50af93be7aaa34c7135b346d9';
const diagnostic=resolve(dist,'app/web/startupDiagnostics.js');
await writeFile(diagnostic,(await readFile(diagnostic,'utf8')).replace('__EASTFRONT_SOURCE_COMMIT__',origin));
await writeFile(resolve(dist,'diagnostics/transport/build.json'),JSON.stringify({sourceCommit:origin,previewOnly:true}));
console.log('Built candidate from TypeScript:',dist);
