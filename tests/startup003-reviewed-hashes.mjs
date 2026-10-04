import {readFileSync} from 'node:fs';
// Keep historical frozen manifests intact. Only the explicitly reviewed terrain
// files can use this candidate's checkpoint; every other expected byte stays frozen.
const reviewed=JSON.parse(readFileSync(new URL('./fixtures/startup003-source-sha256.json',import.meta.url),'utf8'));
const r1=JSON.parse(readFileSync(new URL('./fixtures/startup003r1-source-sha256.json',import.meta.url),'utf8'));
const startup005=JSON.parse(readFileSync(new URL('./fixtures/startup005-source-sha256.json',import.meta.url),'utf8'));
export function withStartup003TerrainReview(frozen){
 return Object.fromEntries(Object.entries(frozen).map(([path,hash])=>[path,startup005[path]??r1[path]??reviewed[path]??hash]));
}
