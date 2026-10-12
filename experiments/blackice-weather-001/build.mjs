import {execFileSync} from 'node:child_process';import fs from 'node:fs';import {VERSION} from './weather.mjs';
execFileSync(process.execPath,['experiments/grand-release-001/build.mjs'],{stdio:'inherit'});
const file='.release-territory-preview/release-build.json',manifest=JSON.parse(fs.readFileSync(file,'utf8'));Object.assign(manifest,{release:'BLACKICE-WEATHER-001',rules:VERSION,save:VERSION});fs.writeFileSync(file,JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
