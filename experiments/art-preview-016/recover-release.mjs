import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=new URL('../..',import.meta.url),evidence=new URL('../../evidence/ART-PREVIEW-016/',import.meta.url);
const git=(args,input)=>execFileSync('git',args,{cwd:root,input,encoding:'utf8'}).trim();
const plan=JSON.parse(await readFile(new URL('release-plan.json',evidence)));
const tree=git(['rev-parse','HEAD:'+plan.runtimeRoot]);if(tree!==plan.runtimeTree)throw Error('Checkout does not contain the fixed runtime tree');
const raw=await readFile(new URL('publication-commit.txt',evidence));
const sha=git(['hash-object','-t','commit','-w','--stdin'],raw);if(sha!==plan.publicationCommit)throw Error('Release commit bytes do not match');
const ref='refs/heads/'+plan.publicationBranch;let prior='';try{prior=git(['rev-parse','--verify',ref]);}catch{}
if(prior&&prior!==sha)throw Error('Existing publication checkpoint differs; no ref overwritten');
if(!prior)git(['update-ref',ref,sha,'0000000000000000000000000000000000000000']);
console.log(JSON.stringify({status:'RECOVERED_LOCALLY_NOT_PUSHED',sha,tree,ref}));
