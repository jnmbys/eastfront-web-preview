import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join,relative} from 'node:path';
import {hash,atomic} from '../../ai/lab/common.mjs';
const out='evidence/ai-maneuver-017',old=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));
// baseline014 is copied before compiling any changed source. Reuse the frozen opponent.
for(const [name,dir] of [['experiment','.evaluation/baseline014/.ai-dist'],['opponent','.evaluation/ai005/.ai-dist']])for(const [p,h] of old[name])assert.equal(hash(readFileSync(dir+'/'+p)),h);
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','ai/tsconfig.json'],{stdio:'inherit'});
const files=p=>readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(p,e.name)):[join(p,e.name)]);
const experiment=files('.ai-dist').filter(p=>p.endsWith('.js')).map(p=>[relative('.ai-dist',p).replaceAll('\\','/'),hash(readFileSync(p))]);
const changes=experiment.filter(([p,h])=>old.experiment.find(([q])=>p===q)?.[1]!==h).map(([p])=>p);assert.deepEqual(changes,['ai/fair/routing.js']);
const sourceChanges=execFileSync('git',['diff','a655892a1eed5f8a136b6c73b9d9000560df8d91','--name-only','--','ai/fair','ai/authority','vendor','src'],{encoding:'utf8'}).trim().split('\n');assert.deepEqual(sourceChanges,['ai/fair/routing.ts']);
atomic(out+'/build-identity.json',{node:process.version,sourceChanges,runtimeChanges:changes,experiment,baseline014:old.experiment,opponent:old.opponent,configHash:hash(readFileSync(out+'/config.json'))});console.log('PASS: only routing source/runtime differs from014; frozen014/opponent hashes match; 014 advance protection, Host, Core and protocol unchanged.');
