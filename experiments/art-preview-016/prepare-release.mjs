import {readFile,writeFile,readdir,mkdir,cp,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'../..'),dist=join(import.meta.dirname,'dist'),evidence=join(root,'evidence/ART-PREVIEW-016'),release=join(root,'release/ART-PREVIEW-016'),withdrawn=join(root,'release/ART-PREVIEW-016-WITHDRAWN');
const git=(args,input)=>execFileSync('git',args,{cwd:root,input,encoding:'utf8'}).trim();
const hash=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(await readFile(join(dist,'manifest.json')));
for(const e of manifest.entries){const b=await readFile(join(dist,e.path));if(hash(b)!==e.sha256||b.length!==e.bytes)throw Error('Build differs from manifest: '+e.path);}
// Keep exact runtime bytes reachable through the source/evidence branch. Reused
// image blobs are deduplicated by Git. No zip, bundle download or rebuild required.
await mkdir(release,{recursive:true});await cp(dist,release,{recursive:true});
await mkdir(withdrawn,{recursive:true});
await writeFile(join(withdrawn,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>预览已撤回</title><h1>此独立预览已撤回</h1><p>生产站点未受影响。</p></html>\n');
await writeFile(join(withdrawn,'_headers'),"/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-store\n  Content-Security-Policy: default-src 'none'; base-uri 'none'\n");
async function tree(dir){const rows=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())rows.push(`040000 tree ${await tree(p)}\t${e.name}`);else rows.push(`100644 blob ${git(['hash-object','-w','--no-filters',p])}\t${e.name}`);}return git(['mktree'],rows.sort().join('\n')+'\n');}
const runtimeTree=await tree(release),withdrawalTree=await tree(withdrawn),planPath=join(evidence,'release-plan.json');
let prior;try{prior=JSON.parse(await readFile(planPath));}catch(e){if(e.code!=='ENOENT')throw e;}
if(prior&&prior.runtimeTree!==runtimeTree)throw Error('Already fixed release differs; do not silently replace it');
const timestamp=prior?.commitTimestamp??Math.floor(Date.now()/1000);
const raw=`tree ${runtimeTree}\nauthor Codex <codex@openai.com> ${timestamp} +0000\ncommitter Codex <codex@openai.com> ${timestamp} +0000\n\nART-PREVIEW-016 prepared isolated full-map preview\n\nVisual baseline 35e36314b61e157be016040d91d9d05eeaf39f5a.\nRuntime-only root, 014/015 comparison and camera presets.\n`;
const commit=git(['hash-object','-t','commit','-w','--stdin'],raw),ref='refs/heads/art-map-preview-016';
let existing='';try{existing=git(['rev-parse','--verify',ref]);}catch{}
if(existing&&existing!==commit)throw Error('Local publication ref already has a different checkpoint');
if(!existing)git(['update-ref',ref,commit,'0000000000000000000000000000000000000000']);
await writeFile(join(evidence,'publication-commit.txt'),raw);
let bytes=0,count=0;async function size(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await size(p);else{count++;bytes+=(await stat(p)).size;}}}await size(release);
const plan={status:'PREPARED_NOT_PUBLISHED',visualBaseline:'35e36314b61e157be016040d91d9d05eeaf39f5a',sourceEvidenceBranch:'art-preview-016',publicationBranch:'art-map-preview-016',publicationCommit:commit,runtimeTree,commitTimestamp:timestamp,runtimeRoot:'release/ART-PREVIEW-016',runtimeFiles:count,runtimeBytes:bytes,manifestSHA256:hash(await readFile(join(release,'manifest.json'))),withdrawalTree,withdrawalRoot:'release/ART-PREVIEW-016-WITHDRAWN',publicationParent:null,targetProject:'eastfront-web-preview',expectedBranchURL:'https://art-map-preview-016.eastfront-web-preview.pages.dev/',urlStatus:'Expected from existing naming convention; not created or verified',localEntry:'http://127.0.0.1:44116/?view=full',directEntries:['?view=full','?view=north','?view=central','?view=south','?view=x14','?view=ac10','?variant=baseline&view=north'],remotePublicationRefAtPreparation:'ABSENT; verified through GitHub matching-refs API',releaseMessageNote:'Local release commit deliberately lacks CF-Pages-Skip so a separately authorized future publication can deploy. It is NOT pushed. Source/evidence commits MUST include CF-Pages-Skip.',networkWritesByThisScript:0};
await writeFile(planPath,JSON.stringify(plan,null,2)+'\n');console.log(JSON.stringify(plan));
