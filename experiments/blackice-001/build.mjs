import fs from 'node:fs';
await import('../grand-release-002/build.mjs');
const file='.release-territory-preview/release-build.json',m=JSON.parse(fs.readFileSync(file));Object.assign(m,{release:'BLACKICE-001-local-only',rules:['BLACKICE-001-LAND-1'],save:'Isolated blackice-001 namespace; old saves rejected'});fs.writeFileSync(file,JSON.stringify(m,null,2));
