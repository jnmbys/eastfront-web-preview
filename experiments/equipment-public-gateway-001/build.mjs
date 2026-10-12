import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const source=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(process.env.RELEASE_SOURCE_SHA&&process.env.RELEASE_SOURCE_SHA!==source)throw Error('RELEASE_SOURCE_SHA_MISMATCH');
// Older builder treats this variable as an override; never permit it to hide dirty state.
const env={...process.env};delete env.RELEASE_SOURCE_SHA;
execFileSync(process.execPath,['experiments/hoi4-equipment-priority-001/build.mjs'],{stdio:'inherit',env});
// Runtime imports depend on generated code: load only after the clean build.
const {ROOM_VERSION,VERSION,MAP_VERSION}=await import('./storage.mjs');
const file='.release-territory-preview/release-build.json',build=JSON.parse(fs.readFileSync(file));
Object.assign(build,{release:'EQUIPMENT-PUBLIC-GATEWAY-001',source,rules:VERSION,roomVersion:ROOM_VERSION,geography:MAP_VERSION});
fs.writeFileSync(file,JSON.stringify(build,null,2));console.log(JSON.stringify(build));
