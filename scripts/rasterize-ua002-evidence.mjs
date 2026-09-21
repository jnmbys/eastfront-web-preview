import {createRequire} from 'node:module';
import {readdirSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
const require=createRequire(import.meta.url),sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/sharp');
const root=process.argv[2];
for(const file of readdirSync(root).filter(f=>f.endsWith('.svg')))await sharp(join(root,file)).png().toFile(join(root,file.replace('.svg','.png')));
for(const dir of readdirSync(join(root,'frames'))){
 const dest=join(process.argv[3],dir);mkdirSync(dest,{recursive:true});
 for(const file of readdirSync(join(root,'frames',dir)).filter(f=>f.endsWith('.svg')))await sharp(join(root,'frames',dir,file)).png().toFile(join(dest,file.replace('.svg','.png')));
}
console.log('Software SVG strips and animation frames rasterized with sharp/librsvg.');
