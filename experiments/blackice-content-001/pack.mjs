import fs from 'node:fs';import path from 'node:path';import readline from 'node:readline';import {createGzip} from 'node:zlib';import {once} from 'node:events';import {createHash} from 'node:crypto';
const [out,privateRoot]=process.argv.slice(2),file=path.resolve(out,'timeline.ndjson'),dest=path.resolve(privateRoot,'timeline-original.ndjson');
if(fs.existsSync(dest))throw Error('PRIVATE_RAW_EXISTS');
const gzip=createGzip(),stream=fs.createWriteStream(path.resolve(out,'timeline.ndjson.gz'));gzip.pipe(stream);const hash=createHash('sha256');let rows=0;
for await(const line of readline.createInterface({input:fs.createReadStream(file)})){hash.update(line+'\n');const r=JSON.parse(line);if(r.cargo?.sides)r.cargo.sides={GERMAN:r.cargo.sides.GERMAN};if(!gzip.write(JSON.stringify(r)+'\n'))await once(gzip,'drain');rows++;}
gzip.end();await once(stream,'finish');fs.renameSync(file,dest);
fs.writeFileSync(path.resolve(out,'packing.json'),JSON.stringify({rows,originalNormalizedLinesSHA256:hash.digest('hex'),privateRawRetained:true,omitted:'SOVIET cargo diagnostics only; cohort/own stock and business evidence retained'},null,2));
