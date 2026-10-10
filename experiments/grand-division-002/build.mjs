import '../grand-release-001/build.mjs';
import fs from 'node:fs';
import {VERSION} from './authority.mjs';
const file='.release-territory-preview/release-build.json',m=JSON.parse(fs.readFileSync(file,'utf8'));Object.assign(m,{release:'GRAND-DIVISION-002',rules:VERSION,save:VERSION});fs.writeFileSync(file,JSON.stringify(m,null,2));console.log(JSON.stringify(m));
