import {execFileSync} from 'node:child_process';import fs from 'node:fs';const VERSION='HOI4-EQUIPMENT-PRIORITY-001-1';
execFileSync(process.execPath,['experiments/grand-release-001/build.mjs'],{stdio:'inherit'});
const file='.release-territory-preview/release-build.json',manifest=JSON.parse(fs.readFileSync(file,'utf8'));Object.assign(manifest,{release:'HOI4-EQUIPMENT-PRIORITY-001',rules:VERSION,save:VERSION,geography:'SMOLENSK-HINTERLAND-001-1'});fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
